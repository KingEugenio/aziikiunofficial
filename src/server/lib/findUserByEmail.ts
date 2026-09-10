import { getServiceRoleClient } from "../supabaseClients";

// The auth.admin API has no direct "find user by email" in this SDK version -
// only paginated listUsers(). Bounded to 10 pages (10k users); beyond that
// bound callers get a clear "not found" rather than searching indefinitely.
export async function findUserByEmail(email: string): Promise<{ id: string; email?: string | null } | null> {
  const adminClient = getServiceRoleClient();
  const normalized = email.trim().toLowerCase();
  const MAX_PAGES = 10;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    // Cast needed because listUsers()'s return type is a discriminated union
    // on { data, error } that TypeScript can't narrow through the
    // already-checked `result.error` above once accessed as
    // `result.data.users` (a known limitation of destructured/nested
    // discriminant narrowing) - the runtime check on the line above is what
    // actually guarantees this is the non-error branch.
    const users = result.data.users as Array<{ id: string; email?: string | null }>;
    const match = users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (users.length < 1000) break;
  }
  return null;
}
