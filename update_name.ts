import { config } from 'dotenv';
config();
import { sql } from 'drizzle-orm';
import { db } from './server/db.js';

async function main() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notebooks (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id),
        name text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      ALTER TABLE content_items ADD COLUMN IF NOT EXISTS notebook_id varchar REFERENCES notebooks(id);
    `);
    console.log('Database updated successfully');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
