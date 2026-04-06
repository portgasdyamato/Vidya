import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_xXeZ0I1ugwKM@ep-small-credit-ahz8phlh-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function createDefaultUser() {
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('🔍 Creating default user...\n');
    
    // Try to insert the default user
    const result = await sql`
      INSERT INTO users (id, username, password, created_at)
      VALUES ('default-user', 'default-user', '', NOW())
      ON CONFLICT (id) DO UPDATE SET username = 'default-user'
      RETURNING *
    `;
    
    console.log('✅ Default user created/updated:');
    console.log(result[0]);
    console.log('\n✅ Upload should work now! Try uploading again.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nTrying alternative method...\n');
    
    // Alternative: Check if user exists first
    try {
      const existing = await sql`SELECT * FROM users WHERE username = 'default-user'`;
      if (existing.length > 0) {
        console.log('✅ Default user already exists:');
        console.log(existing[0]);
      } else {
        console.log('❌ User does not exist and could not be created');
        console.log('   Please check database permissions');
      }
    } catch (e2) {
      console.error('❌ Could not query database:', e2.message);
    }
  }
}

createDefaultUser();
