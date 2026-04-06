import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Checking and adding missing columns...");
  try {
    // Check if mind_map column exists
    await db.execute(sql`ALTER TABLE content_items ADD COLUMN IF NOT EXISTS mind_map text`);
    console.log("Column mind_map checked/added.");
    
    await db.execute(sql`ALTER TABLE content_items ADD COLUMN IF NOT EXISTS audio_url text`);
    console.log("Column audio_url checked/added.");
    
    await db.execute(sql`ALTER TABLE content_items ADD COLUMN IF NOT EXISTS podcast_script text`);
    console.log("Column podcast_script checked/added.");
    
    await db.execute(sql`ALTER TABLE content_items ADD COLUMN IF NOT EXISTS podcast_audio_url text`);
    console.log("Column podcast_audio_url checked/added.");
    
    console.log("Database schema sync complete.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to sync schema:", err);
    process.exit(1);
  }
}

run();
