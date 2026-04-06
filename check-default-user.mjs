import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkDefaultUser() {
  try {
    console.log('🔍 Checking for default user...\n');
    
    const [user] = await db.select().from(users).where(eq(users.username, 'default-user'));
    
    if (user) {
      console.log('✅ Default user EXISTS in database:');
      console.log('   ID:', user.id);
      console.log('   Username:', user.username);
      console.log('   Created:', user.createdAt);
    } else {
      console.log('❌ Default user NOT FOUND in database');
      console.log('   This is the problem! Creating it now...\n');
      
      const [newUser] = await db
        .insert(users)
        .values({ id: 'default-user', username: 'default-user', password: '' })
        .returning();
      
      console.log('✅ Default user CREATED:');
      console.log('   ID:', newUser.id);
      console.log('   Username:', newUser.username);
    }
    
    console.log('\n✅ Upload should work now!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDefaultUser();
