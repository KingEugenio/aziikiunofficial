/**
 * Stress test data generator for Aziiki
 * Generates 500-2000 users with realistic business data
 * 
 * Usage: npx ts-node scripts/generateDummyData.ts [--users 1000] [--cleanup]
 */

import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";
import "dotenv/config";

const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

interface DummyDataConfig {
  userCount: number;
  usersPerBusiness: number;
  invoicesPerUser: number;
  customersPerUser: number;
  paymentsPerUser: number;
  cleanup: boolean;
}

const config: DummyDataConfig = {
  userCount: parseInt(process.argv.find((arg) => arg.startsWith("--users"))?.split("=")[1] || "1000"),
  usersPerBusiness: 5,
  invoicesPerUser: 20,
  customersPerUser: 30,
  paymentsPerUser: 10,
  cleanup: process.argv.includes("--cleanup"),
};

async function cleanup() {
  console.log("🧹 Cleaning up dummy data...");
  try {
    // Delete in order of foreign key dependencies
    await supabase.from("game_scores").delete().eq("user_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("game_sessions").delete().eq("user_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("activity_logs").delete().eq("user_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("invoice_items").delete().neq("id", "");
    await supabase.from("invoices").delete().ilike("custom_client_name", "TEST-%");
    await supabase.from("customers").delete().ilike("name", "TEST-%");
    await supabase.from("profiles").delete().ilike("email", "test%@dummy.local");
    console.log("✓ Cleanup complete");
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

async function generateUsers(): Promise<string[]> {
  console.log(`👥 Generating ${config.userCount} users...`);
  const userIds: string[] = [];

  for (let i = 0; i < config.userCount; i++) {
    const email = `test.user${i}@dummy.local`;
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: "TestPassword123!",
        email_confirm: true,
      });

      if (authError || !authData.user) {
        if (!authError?.message?.includes("already exists")) {
          console.error(`❌ Failed to create user ${i}:`, authError);
        }
        continue;
      }

      userIds.push(authData.user.id);

      // Create profile
      await supabase.from("profiles").insert({
        id: authData.user.id,
        email,
        full_name: faker.person.fullName(),
        tier: ["basic", "standard", "pro"][Math.floor(Math.random() * 3)],
        created_at: new Date().toISOString(),
      });

      if ((i + 1) % 100 === 0) {
        console.log(`  ✓ Created ${i + 1} users`);
      }
    } catch (err) {
      console.error(`❌ Error creating user ${i}:`, err);
    }
  }

  console.log(`✓ Generated ${userIds.length} users`);
  return userIds;
}

async function generateBusinesses(userIds: string[]): Promise<Map<string, string>> {
  console.log(`🏢 Generating businesses...`);
  const userToBusinessMap = new Map<string, string>();
  let businessCount = Math.ceil(userIds.length / config.usersPerBusiness);

  for (let i = 0; i < businessCount; i++) {
    const businessName = `TEST-${faker.company.name()} ${i}`;
    const ownerIdx = i * config.usersPerBusiness;
    if (ownerIdx >= userIds.length) break;

    try {
      const { data: businessData, error } = await supabase
        .from("businesses")
        .insert({
          owner_id: userIds[ownerIdx],
          business_name: businessName,
          business_type: ["sole_proprietorship", "partnership", "company"][Math.floor(Math.random() * 3)],
          industry: faker.company.catchPhrase(),
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !businessData) throw error;

      // Assign users to this business
      const startUser = i * config.usersPerBusiness;
      const endUser = Math.min(startUser + config.usersPerBusiness, userIds.length);
      for (let u = startUser; u < endUser; u++) {
        userToBusinessMap.set(userIds[u], businessData.id);
      }

      if ((i + 1) % 50 === 0) {
        console.log(`  ✓ Created ${i + 1} businesses`);
      }
    } catch (err) {
      console.error(`❌ Error creating business ${i}:`, err);
    }
  }

  console.log(`✓ Generated ${businessCount} businesses`);
  return userToBusinessMap;
}

async function generateInvoices(
  userToBusinessMap: Map<string, string>,
  userIds: string[]
): Promise<void> {
  console.log(`📋 Generating invoices...`);
  let invoiceCount = 0;

  for (const userId of userIds) {
    const businessId = userToBusinessMap.get(userId);
    if (!businessId) continue;

    for (let i = 0; i < config.invoicesPerUser; i++) {
      try {
        const invoiceDate = faker.date.past({ years: 2 });
        const { data: invoiceData, error } = await supabase
          .from("invoices")
          .insert({
            business_id: businessId,
            user_id: userId,
            invoice_number: `TEST-INV-${userId.slice(0, 8)}-${i}`,
            date: invoiceDate.toISOString().split("T")[0],
            due_date: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            custom_client_name: `TEST-${faker.company.name()}`,
            discount: Math.random() > 0.7 ? Math.floor(Math.random() * 20) : 0,
            tax_rate: ["0", "5", "10", "15"][Math.floor(Math.random() * 4)],
            status: ["draft", "sent", "paid", "overdue"][Math.floor(Math.random() * 4)],
            created_at: invoiceDate.toISOString(),
          })
          .select("id")
          .single();

        if (error || !invoiceData) throw error;

        // Add invoice items
        const itemCount = Math.floor(Math.random() * 5) + 1;
        for (let j = 0; j < itemCount; j++) {
          await supabase.from("invoice_items").insert({
            invoice_id: invoiceData.id,
            description: faker.commerce.productName(),
            quantity: Math.floor(Math.random() * 10) + 1,
            rate: Math.floor(Math.random() * 500) + 10,
            position: j,
          });
        }

        invoiceCount++;
      } catch (err) {
        console.error(`❌ Error creating invoice:`, err);
      }
    }

    if ((invoiceCount % 200) === 0 && invoiceCount > 0) {
      console.log(`  ✓ Created ${invoiceCount} invoices`);
    }
  }

  console.log(`✓ Generated ${invoiceCount} invoices`);
}

async function generateActivityLogs(userToBusinessMap: Map<string, string>, userIds: string[]): Promise<void> {
  console.log(`📊 Generating activity logs (1M+ entries)...`);
  let logCount = 0;
  const actions = ["create", "read", "update", "delete", "upload", "download", "export"];
  const entityTypes = ["invoice", "customer", "payment", "report", "settings"];

  for (const userId of userIds) {
    const businessId = userToBusinessMap.get(userId);
    if (!businessId) continue;

    // Generate 500-1000 activity logs per user
    const logsPerUser = Math.floor(Math.random() * 500) + 500;
    const logs = [];

    for (let i = 0; i < logsPerUser; i++) {
      const timestamp = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000); // Last 90 days
      logs.push({
        business_id: businessId,
        user_id: userId,
        action_type: actions[Math.floor(Math.random() * actions.length)],
        entity_type: entityTypes[Math.floor(Math.random() * entityTypes.length)],
        timestamp: timestamp.toISOString(),
        ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        user_agent: faker.internet.userAgent(),
      });
    }

    try {
      // Batch insert (Supabase limit ~1000 rows per insert)
      for (let j = 0; j < logs.length; j += 1000) {
        const batch = logs.slice(j, j + 1000);
        await supabase.from("activity_logs").insert(batch);
        logCount += batch.length;
      }
    } catch (err) {
      console.error(`❌ Error creating activity logs:`, err);
    }

    if ((logCount % 10000) === 0 && logCount > 0) {
      console.log(`  ✓ Created ${logCount.toLocaleString()} activity logs`);
    }
  }

  console.log(`✓ Generated ${logCount.toLocaleString()} activity logs`);
}

async function main() {
  try {
    console.log("🚀 Aziiki Stress Test Data Generator");
    console.log(`📊 Configuration: ${config.userCount} users, ${config.invoicesPerUser} invoices/user`);
    console.log("");

    if (config.cleanup) {
      await cleanup();
      console.log("");
    }

    const startTime = Date.now();

    const userIds = await generateUsers();
    console.log("");

    const userToBusinessMap = await generateBusinesses(userIds);
    console.log("");

    await generateInvoices(userToBusinessMap, userIds);
    console.log("");

    await generateActivityLogs(userToBusinessMap, userIds);
    console.log("");

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`✅ Data generation complete! (${duration} minutes)`);
    console.log("");
    console.log("📈 Generated:");
    console.log(`   • ${userIds.length} users`);
    console.log(`   • ${Math.ceil(userIds.length / config.usersPerBusiness)} businesses`);
    console.log(`   • ${userIds.length * config.invoicesPerUser} invoices`);
    console.log(`   • ${userIds.length * 750}+ activity log entries`);
  } catch (err) {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  }
}

main();
