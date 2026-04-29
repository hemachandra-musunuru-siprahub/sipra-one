import { query } from "./db";

async function migrate() {
  try {
    console.log("Starting migration...");
    
    // Add effective_role
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS effective_role TEXT DEFAULT 'employee'`);
    console.log("Added effective_role column");
    
    // Add role_source
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_source TEXT DEFAULT 'entra'`);
    console.log("Added role_source column");
    
    // Add azure_groups
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS azure_groups JSONB DEFAULT '[]'`);
    console.log("Added azure_groups column");
    
    console.log("Migration complete!");
    process.exit(0);
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  }
}

migrate();
