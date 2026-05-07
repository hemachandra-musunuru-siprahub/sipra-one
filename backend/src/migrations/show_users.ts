/**
 * Utility: Show all users and their current roles.
 * Run: npx ts-node src/migrations/show_users.ts
 */
import { query } from "../db";

async function main() {
  const { rows } = await query(
    "SELECT id, entra_oid, email, name, role, is_active FROM users ORDER BY created_at ASC"
  );
  console.log("\nCurrent users in SipraHub:\n");
  rows.forEach((u: any) => {
    const status = u.is_active ? "✅ active" : "❌ inactive";
    console.log(`  [${u.role.padEnd(8)}] ${u.name} <${u.email}> — ${status}`);
  });
  console.log(`\nTotal: ${rows.length} user(s)\n`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
