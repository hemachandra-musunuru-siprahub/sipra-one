/**
 * One-time role seeding for existing users.
 *
 * Since the migration defaulted all users to 'Employee', this script
 * promotes known users to their correct application roles.
 *
 * Edit the ROLE_ASSIGNMENTS map below and run:
 *   npx ts-node src/migrations/003_seed_existing_roles.ts
 */
import { query } from "../db";

// Map email → desired application role
const ROLE_ASSIGNMENTS: Record<string, "Admin" | "HR" | "Manager" | "Employee"> = {
  "nakshatra.krishnamurthy@siprahub.com": "Admin",
  "hemachandra.musunuru@siprahub.com":    "Admin",
  "aravind.guggilla@siprahub.com":        "Manager",
  "aravind.siddharthan@siprahub.com":     "Manager",
  // Leave remaining users as "Employee" (no entry needed)
};

async function seed() {
  console.log("Seeding roles for existing users...\n");

  for (const [email, role] of Object.entries(ROLE_ASSIGNMENTS)) {
    const { rowCount } = await query(
      "UPDATE users SET role = $1 WHERE email = $2",
      [role, email]
    );
    if (rowCount && rowCount > 0) {
      console.log(`  ✅  ${email}  →  ${role}`);
    } else {
      console.warn(`  ⚠️   ${email}  not found in DB — skipped`);
    }
  }

  console.log("\nDone. Run show_users.ts to verify.\n");
  process.exit(0);
}

seed().catch(e => { console.error("Seeding failed:", e.message); process.exit(1); });
