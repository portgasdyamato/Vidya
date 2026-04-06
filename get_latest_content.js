
import { db } from "./server/db.js";
import { contentItems } from "./shared/schema.js";
import { desc } from "drizzle-orm";

async function main() {
  const latest = await db.select().from(contentItems).orderBy(desc(contentItems.id)).limit(1);
  console.log(JSON.stringify(latest[0], null, 2));
  process.exit(0);
}

main().catch(console.error);
