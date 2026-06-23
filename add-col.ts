import "dotenv/config";
import { pool } from "./server/db.js";

async function run() {
  try {
    await pool.query(`ALTER TABLE content_items ADD COLUMN stats JSONB DEFAULT '{"pagesRead": [], "highlightsCount": 0, "quizScores": [], "flashcardsConfidence": {}}'::jsonb`);
    console.log("Column added successfully!");
  } catch (e) {
    if (e.message.includes("already exists")) {
       console.log("Column already exists.");
    } else {
       console.error("Error:", e);
    }
  }
  process.exit(0);
}

run();
