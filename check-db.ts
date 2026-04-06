import { db } from "./server/db";
import { users } from "./shared/schema";

async function listUsers() {
  try {
    const allUsers = await db.select().from(users);
    console.log("Users in DB:", allUsers.length);
    allUsers.forEach(u => console.log(`- ${u.id}: ${u.username}`));
  } catch (err) {
    console.error("DB check failed:", err);
  }
}

listUsers();
