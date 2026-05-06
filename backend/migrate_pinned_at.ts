import { query } from "./src/db";

async function run() {
  try {
    console.log("Checking for pinned_at column...");
    const { rows } = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'announcements' AND column_name = 'pinned_at'
    `);

    if (rows.length === 0) {
      console.log("Adding pinned_at column...");
      await query(`ALTER TABLE announcements ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE`);
      // Initialize pinned_at for existing pinned posts
      await query(`UPDATE announcements SET pinned_at = created_at WHERE is_pinned = true`);
      console.log("Successfully added pinned_at column.");
    } else {
      console.log("pinned_at column already exists.");
    }
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit();
  }
}

run();
