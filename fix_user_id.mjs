import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_xXeZ0I1ugwKM@ep-small-credit-ahz8phlh-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixUser() {
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('🔍 Inspecting users...\n');
    const users = await sql`SELECT * FROM users`;
    console.log('Current users in DB:');
    users.forEach(u => console.log(`- ID: ${u.id}, Username: ${u.username}`));

    const defaultUser = users.find(u => u.username === 'default-user');

    if (defaultUser && defaultUser.id !== 'default-user') {
      console.log(`\n⚠️  Found 'default-user' but ID mismatch!`);
      console.log(`   Current ID: ${defaultUser.id}`);
      console.log(`   Expected ID: 'default-user'`);
      
      console.log('\n🛠️  Fixing: Deleting existing default-user and recreating with correct ID...');
      
      // Delete any content items first to avoid integrity errors if they exist for this old user
      await sql`DELETE FROM content_items WHERE user_id = ${defaultUser.id}`;
      await sql`DELETE FROM users WHERE id = ${defaultUser.id}`;
      
      const [recreated] = await sql`
        INSERT INTO users (id, username, password) 
        VALUES ('default-user', 'default-user', '') 
        RETURNING *
      `;
      console.log('✅ User successfully recreated with fixed ID:', recreated.id);
    } else if (!defaultUser) {
      console.log('\n🛠️  Default user missing. Creating it...');
      const [recreated] = await sql`
        INSERT INTO users (id, username, password) 
        VALUES ('default-user', 'default-user', '') 
        RETURNING *
      `;
      console.log('✅ User created with fixed ID:', recreated.id);
    } else {
      console.log('\n✅ Default user is already configuration correctly.');
    }

    console.log('\n🚀 Upload should work now! Please try again.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing user:', error.message);
    process.exit(1);
  }
}

fixUser();
