import "dotenv/config";
import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => 
  client.query("ALTER TABLE content_items ADD COLUMN chat_history jsonb DEFAULT '[]'")
).then(() => { 
  console.log('Added column'); 
  process.exit(0); 
}).catch(err => { 
  console.error(err); 
  process.exit(1); 
});
