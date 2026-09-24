# Aziiki Backup & Disaster Recovery Strategy

**Last Updated:** September 2026
**Status:** Production Ready

## Executive Summary

This document outlines the comprehensive backup, recovery, and database scaling strategy for Aziiki, a business management platform serving African SMEs. The system uses Supabase (PostgreSQL) as the primary database with automated backups, point-in-time recovery, and multi-tier archival strategies.

---

## 1. Database Architecture Overview

### Current Setup
- **Primary Database:** Supabase PostgreSQL (hosted)
- **Storage:** Supabase Storage (S3-compatible)
- **Region:** [Your Supabase Region]
- **Tier:** Pro (recommended for production)

### Key Tables Requiring Special Attention
- `profiles` (user data) - ~1,000-10,000 rows
- `businesses` (business data) - ~500-5,000 rows
- `invoices` (financial records) - Growing, can exceed 1M rows
- `activity_logs` (audit trail) - **Critical for compliance** - Can exceed 10M rows
- `game_sessions`, `game_scores` (engagement data) - Moderate growth
- `analytics_events` (product analytics) - High volume

---

## 2. Automated Backup Strategy

### Supabase Native Backups

**Point-in-Time Recovery (PITR)**
- **Retention:** 7-30 days (configurable)
- **Cost:** Included in Pro tier
- **How it works:** Database transaction logs capture every change
- **Recovery time:** ~5-15 minutes per recovery point

**Daily Snapshots**
- **Frequency:** Automated daily backups
- **Retention:** 30 days
- **Storage:** Supabase-managed (included in Pro)
- **RPO (Recovery Point Objective):** 1 day
- **RTO (Recovery Time Objective):** ~30 minutes

**Configuration Steps:**
1. Go to Supabase Dashboard → Project Settings → Backups
2. Enable "Enable backup"
3. Set PITR to 7 or 14 days (recommended: 14 days)
4. Backups are automatic - no action needed

### pg_dump Manual Backups to S3

**Why Separate Backups?**
- Supabase-managed backups can have outages
- Manual backups provide air-gapped copies
- S3 provides durable, geo-redundant storage
- Cost-effective long-term archival

**Weekly Backup Script:**

```bash
#!/bin/bash
# File: scripts/backup-to-s3.sh

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="aziiki_backup_${BACKUP_DATE}.sql.gz"
BACKUP_MANIFEST="aziiki_manifest_${BACKUP_DATE}.json"

# Create backup
PGPASSWORD=$SUPABASE_PASSWORD pg_dump \
  -h $SUPABASE_HOST \
  -U postgres \
  -d postgres \
  --no-password \
  --verbose \
  --no-owner \
  | gzip > "/tmp/${BACKUP_FILE}"

# Upload to S3 with encryption
aws s3 cp "/tmp/${BACKUP_FILE}" \
  "s3://aziiki-backups/database/${BACKUP_FILE}" \
  --sse AES256 \
  --storage-class STANDARD_IA \
  --region us-east-1

# Create manifest with metadata
cat > "/tmp/${BACKUP_MANIFEST}" << MANIFEST
{
  "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "filename": "${BACKUP_FILE}",
  "size_bytes": $(stat -f%z "/tmp/${BACKUP_FILE}" 2>/dev/null || stat -c%s "/tmp/${BACKUP_FILE}"),
  "database": "postgres",
  "host": "${SUPABASE_HOST}",
  "tables_count": $(PGPASSWORD=$SUPABASE_PASSWORD psql -h $SUPABASE_HOST -U postgres -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"),
  "integrity_check": "pending"
}
MANIFEST

# Upload manifest
aws s3 cp "/tmp/${BACKUP_MANIFEST}" \
  "s3://aziiki-backups/manifests/${BACKUP_MANIFEST}" \
  --sse AES256 \
  --region us-east-1

# Cleanup
rm "/tmp/${BACKUP_FILE}" "/tmp/${BACKUP_MANIFEST}"

echo "✓ Backup complete: ${BACKUP_FILE}"
```

**Cron Schedule:**
```bash
# Every Sunday at 2 AM UTC
0 2 * * 0 /home/aziiki/scripts/backup-to-s3.sh >> /var/log/aziiki-backup.log 2>&1
```

**S3 Configuration:**
```bash
# Create bucket with versioning and encryption
aws s3api create-bucket \
  --bucket aziiki-backups \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket aziiki-backups \
  --versioning-configuration Status=Enabled

# Enable default encryption
aws s3api put-bucket-encryption \
  --bucket aziiki-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Enable MFA Delete (requires root account)
aws s3api put-bucket-versioning \
  --bucket aziiki-backups \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::123456789012:mfa/root-account-mfa 123456"
```

---

## 3. Activity Logs Specific Strategy

### The Challenge
- **Volume:** 500+ events per active user per month
- **Growth:** 10M+ entries annually
- **Query patterns:** Time-range filters, user-specific queries
- **Retention:** Compliance requires 7+ years

### Tiered Storage Solution

**Tier 1: Hot Storage (Last 90 Days)**
- **Location:** Supabase PostgreSQL (main database)
- **Use case:** Daily monitoring, compliance checks, user-initiated queries
- **Query performance:** Sub-millisecond
- **Cost:** Highest (but necessary)
- **Maintenance:** Indexed for fast filtering by user_id, business_id, timestamp

**Tier 2: Warm Storage (91 Days - 1 Year)**
- **Location:** S3 Standard (Apache Parquet format)
- **Use case:** Quarterly audits, trend analysis
- **Query performance:** Seconds (via AWS Athena)
- **Cost:** ~10% of hot storage
- **Archive command:**
  ```sql
  -- Nightly at 3 AM UTC
  -- Move logs older than 90 days to S3
  SELECT * FROM activity_logs 
  WHERE timestamp < NOW() - INTERVAL '90 days'
  ```

**Tier 3: Cold Storage (1+ Years)**
- **Location:** S3 Glacier Deep Archive
- **Use case:** Legal holds, compliance archival
- **Query performance:** Hours (if needed)
- **Cost:** ~2% of hot storage
- **Retention:** 7 years minimum

### Implementation: Activity Log Partitioning

```sql
-- Create partitioned activity_logs table by month
-- This improves query performance and enables easy archival

CREATE TABLE public.activity_logs_partitioned (
  LIKE activity_logs INCLUDING ALL
) PARTITION BY RANGE (CAST(timestamp AS DATE));

-- Create month-based partitions (example: Jan 2026 - Dec 2026)
CREATE TABLE activity_logs_2026_01 PARTITION OF activity_logs_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE activity_logs_2026_02 PARTITION OF activity_logs_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- ... repeat for all months

-- Archive old partitions (quarterly)
-- 1. Export to S3
COPY activity_logs_2025_01 TO PROGRAM 
  'aws s3 cp /dev/stdin s3://aziiki-backups/activity-logs/2025/01/activity_logs_2025_01.parquet';

-- 2. Delete from main database
DROP TABLE activity_logs_2025_01;
```

---

## 4. Recovery Procedures

### Scenario 1: Accidental Data Delete (Last 30 Days)

**Recovery Time:** ~5 minutes
**Data Loss:** 0 (restore to specific point-in-time)

```bash
# 1. Via Supabase Dashboard (Easiest)
# - Go to Project Settings → Backups
# - Select recovery point
# - Click "Restore"
# - Restore to new database (don't overwrite production immediately)

# 2. Via CLI (if Supabase Dashboard unavailable)
supabase db pull --backup-url "https://your-project.supabase.co/backups/..."
```

**Verification:**
```sql
-- Connect to restored database
SELECT COUNT(*) FROM activity_logs 
WHERE created_at > NOW() - INTERVAL '30 days';
-- Should show recovered entries
```

### Scenario 2: Catastrophic Database Failure

**Recovery Time:** ~30-60 minutes
**Data Loss:** Up to 1 day (if no PITR available)

```bash
# 1. Download latest backup from S3
aws s3 cp s3://aziiki-backups/database/aziiki_backup_20260915.sql.gz \
  aziiki_backup.sql.gz

# 2. Spin up new Supabase project (via CLI or Dashboard)
supabase projects create --name "aziiki-recovery"

# 3. Restore backup to new project
gunzip -c aziiki_backup.sql.gz | \
  PGPASSWORD=$NEW_SUPABASE_PASSWORD psql \
  -h $NEW_SUPABASE_HOST \
  -U postgres \
  -d postgres

# 4. Run integrity checks
# See "Backup Verification" section below

# 5. Update connection strings in production
# Update .env: SUPABASE_URL, SUPABASE_KEY
# Deploy with: git push origin main

# 6. Verify on staging first
npm run test:integration
```

### Scenario 3: Ransomware / Malicious Deletion

**Recovery Time:** ~2-4 hours
**Data Loss:** Up to 24 hours

```bash
# 1. IMMEDIATELY disable application access
# - Revoke all API keys
# - Block all database connections except admin
# - Alert security team

# 2. Disconnect from internet (optional, for extreme cases)

# 3. Restore from oldest available backup
# - Find backup predating the attack (check manifests in S3)
aws s3 ls s3://aziiki-backups/manifests/ | grep attack-date

# 4. Follow "Catastrophic Failure" recovery above

# 5. Analyze attack vector
grep -i "malicious" /var/log/supabase-audit.log
supabase logs --level ERROR --before 2026-09-20
```

---

## 5. Backup Verification

### Automated Integrity Checks

**Weekly Verification Script:**

```bash
#!/bin/bash
# File: scripts/verify-backups.sh

echo "🔍 Verifying S3 backups..."

BACKUPS=$(aws s3 ls s3://aziiki-backups/manifests/ | awk '{print $4}')

for manifest in $BACKUPS; do
  echo "Verifying: $manifest"
  
  # Download manifest
  aws s3 cp "s3://aziiki-backups/manifests/$manifest" "/tmp/$manifest"
  
  # Extract filename
  BACKUP_FILE=$(jq -r '.filename' "/tmp/$manifest")
  
  # Verify size
  S3_SIZE=$(aws s3api head-object \
    --bucket aziiki-backups \
    --key "database/$BACKUP_FILE" \
    --query 'ContentLength' --output text)
  
  MANIFEST_SIZE=$(jq -r '.size_bytes' "/tmp/$manifest")
  
  if [ "$S3_SIZE" = "$MANIFEST_SIZE" ]; then
    echo "  ✓ Size verified"
  else
    echo "  ❌ Size mismatch! Expected: $MANIFEST_SIZE, Got: $S3_SIZE"
  fi
  
  # Verify readability (sample decompress)
  if gunzip -t "/tmp/$BACKUP_FILE" 2>/dev/null; then
    echo "  ✓ Integrity check passed"
  else
    echo "  ❌ Corruption detected!"
  fi
done

echo "✓ Verification complete"
```

**Cron Schedule:**
```bash
# Every Sunday at 4 AM UTC
0 4 * * 0 /home/aziiki/scripts/verify-backups.sh >> /var/log/backup-verify.log 2>&1
```

### Manual Test Restore

**Quarterly (every 90 days):**

```bash
# Create temporary test database
supabase projects create --name "aziiki-test-restore"

# Restore to test database
gunzip -c s3://aziiki-backups/database/aziiki_backup_latest.sql.gz | \
  psql -h test-db.supabase.co -U postgres -d postgres

# Run tests
npm run test:backup-restore --env=test-db

# Verify key tables
psql -h test-db.supabase.co -U postgres -d postgres -c \
  "SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
   UNION ALL
   SELECT 'invoices', COUNT(*) FROM invoices
   UNION ALL
   SELECT 'activity_logs', COUNT(*) FROM activity_logs;"

# Destroy test database
supabase projects delete aziiki-test-restore
```

---

## 6. Database Scaling Strategy

### Monitoring Metrics

**Monitor these metrics in Supabase Dashboard:**

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|------------------|-------------------|--------|
| Database size | 80 GB | 100 GB | Archive old data |
| Connection count | 80 | 100 | Add read replicas |
| Query latency (p95) | 500ms | 2s | Add indexes, optimize |
| Transaction ID age | 10M | 100M | VACUUM ANALYZE |

### Read Replicas for Scale

```sql
-- Enable read replicas via Supabase Dashboard
-- Add replicas in same region for analytics workloads

-- After replicas are created:
-- Direct analytics/reporting queries to read replicas
-- SELECT * FROM activity_logs WHERE timestamp > NOW() - INTERVAL '30 days'
-- -- This query uses read replica automatically
```

### Caching with Redis

```typescript
// Example: Cache aggregated stats
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getActivityStats(businessId: string) {
  const cacheKey = `activity_stats:${businessId}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // If not cached, query database
  const stats = await db.query(`
    SELECT action_type, COUNT(*) as count
    FROM activity_logs
    WHERE business_id = $1 AND timestamp > NOW() - INTERVAL '30 days'
    GROUP BY action_type
  `, [businessId]);
  
  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(stats));
  
  return stats;
}
```

### Connection Pooling

```bash
# Configure PgBouncer for connection pooling
# File: /etc/pgbouncer/pgbouncer.ini

[databases]
aziiki = host=db.supabase.co port=5432 dbname=postgres

[pgbouncer]
listen_addr = *
listen_port = 6432
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
server_lifetime = 3600
```

---

## 7. Disaster Recovery Runbook

### Pre-Disaster Checklist
- [ ] All backups verified (weekly verification script running)
- [ ] Team trained on recovery procedures
- [ ] Contact list updated (AWS support, Supabase support)
- [ ] RTO/RPO documented and tested
- [ ] Backup encryption keys stored in AWS Secrets Manager
- [ ] Recovery procedures documented in wiki

### During Disaster
1. **Declare incident** - Alert team immediately
2. **Disable access** - Block API requests to prevent data corruption
3. **Assess damage** - Determine scope and timing of incident
4. **Choose recovery point** - Select closest backup without corrupted data
5. **Begin recovery** - Follow appropriate scenario above
6. **Verify integrity** - Run full test suite
7. **Gradual rollout** - Restore to staging → canary → production

### Post-Disaster
1. **Root cause analysis** - What caused the disaster?
2. **Improve prevention** - Implement safeguards
3. **Update runbook** - Document what worked/didn't
4. **Team debrief** - Share learnings
5. **Test recovery again** - Verify improvements work

---

## 8. Cost Optimization

### Backup Storage Costs (Estimated Annual)

| Component | Volume | Cost/Month | Annual |
|-----------|--------|-----------|--------|
| Supabase PITR (14 days) | Included | $0 | $0 |
| Supabase Daily Snapshots (30 days) | Included | $0 | $0 |
| S3 Standard (weekly backups) | ~100 GB | $2 | $24 |
| S3 Glacier (90+ days) | ~500 GB | $10 | $120 |
| RDS Read Replicas (if used) | Per replica | $50-100 | $600-1200 |
| **Total** | | | **$744-1344** |

**Cost Optimization Tips:**
- Use S3 Intelligent-Tiering for automatic archival
- Delete application logs older than 90 days from database (keep in S3)
- Use read replicas only during peak hours
- Archive activity_logs to Parquet format (compressed ~80% smaller)

---

## 9. Compliance & Regulatory

### Data Retention Policy
- **Activity logs:** 7 years (compliance requirement)
- **Transaction data:** 5 years (financial regulations)
- **User profiles:** Until account deletion + 30 days
- **Payment records:** 7 years (PCI DSS)

### Audit Trail
All backups must include:
- [ ] Backup timestamp
- [ ] File checksum (SHA-256)
- [ ] Encryption algorithm used
- [ ] Verified by (administrator name)
- [ ] Recovery tested date

### GDPR Right to Erasure
```sql
-- Right to be forgotten: Delete all user data
BEGIN;
  UPDATE activity_logs SET user_id = 'deleted_user' 
  WHERE user_id = 'user-to-delete-id';
  
  DELETE FROM game_scores WHERE user_id = 'user-to-delete-id';
  DELETE FROM game_sessions WHERE user_id = 'user-to-delete-id';
  DELETE FROM profiles WHERE id = 'user-to-delete-id';
  
  -- Backups will still contain data, but production is clean
COMMIT;
```

---

## 10. Quick Reference

### Backup Locations
- **Supabase Automated:** Supabase Dashboard → Project Settings → Backups
- **Manual S3 Backups:** `s3://aziiki-backups/database/`
- **Backup Manifests:** `s3://aziiki-backups/manifests/`
- **Activity Log Archives:** `s3://aziiki-backups/activity-logs/`

### Emergency Contacts
- **AWS Support:** +1-206-266-4064 (create enterprise support plan)
- **Supabase Support:** support@supabase.io
- **On-call Engineer:** [Slack channel]

### Key Credentials (Store in AWS Secrets Manager)
- `supabase/master-password`
- `aws/s3-backup-key`
- `postgres/admin-password`

---

## Appendix A: Terraform Infrastructure as Code

```hcl
# File: terraform/backup.tf

resource "aws_s3_bucket" "aziiki_backups" {
  bucket = "aziiki-backups-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "aziiki_backups" {
  bucket = aws_s3_bucket.aziiki_backups.id
  
  versioning_configuration {
    status     = "Enabled"
    mfa_delete = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "aziiki_backups" {
  bucket = aws_s3_bucket.aziiki_backups.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudwatch_event_rule" "weekly_backup" {
  name                = "aziiki-weekly-backup"
  description         = "Trigger weekly database backup"
  schedule_expression = "cron(0 2 ? * SUN *)"  # 2 AM UTC every Sunday
}
```

---

**Document Version:** 1.0
**Last Reviewed:** September 2026
**Next Review:** December 2026
