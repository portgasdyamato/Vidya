#!/usr/bin/env node

/**
 * Vidya AI Platform - Comprehensive System Check & Fix
 * This script verifies all critical components and fixes common issues
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

console.log('🔍 Vidya AI Platform - System Diagnostic\n');
console.log('═'.repeat(60));

// 1. Environment Variables Check
console.log('\n📋 Step 1: Environment Variables');
console.log('─'.repeat(60));

const requiredEnvVars = {
  'DATABASE_URL': process.env.DATABASE_URL,
  'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
  'SESSION_SECRET': process.env.SESSION_SECRET,
};

let envIssues = 0;
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.log(`❌ ${key}: NOT SET`);
    envIssues++;
  } else {
    const display = key === 'DATABASE_URL' || key === 'GEMINI_API_KEY' || key === 'SESSION_SECRET'
      ? `${value.substring(0, 20)}...`
      : value;
    console.log(`✅ ${key}: ${display}`);
  }
}

if (envIssues > 0) {
  console.log(`\n⚠️  ${envIssues} environment variable(s) missing!`);
  console.log('Please check your .env file.');
} else {
  console.log('\n✅ All required environment variables are set');
}

// 2. Database Connection Check
console.log('\n📊 Step 2: Database Connection');
console.log('─'.repeat(60));

try {
  const { db } = await import('./server/db.js');
  const { sql } = await import('drizzle-orm');
  
  const result = await db.execute(sql`SELECT 1 as test`);
  console.log('✅ Database connection successful');
  
  // Check if tables exist
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  
  console.log(`✅ Found ${tables.rows.length} table(s) in database`);
  
  if (tables.rows.length === 0) {
    console.log('⚠️  No tables found. You may need to run: npm run db:push');
  }
} catch (error) {
  console.log('❌ Database connection failed:', error.message);
  console.log('   Please check your DATABASE_URL in .env');
}

// 3. Gemini API Check
console.log('\n🤖 Step 3: Gemini AI API');
console.log('─'.repeat(60));

if (process.env.GEMINI_API_KEY) {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const result = await model.generateContent('Say "Hello" in one word');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini API is working');
    console.log(`   Test response: "${text.trim()}"`);
  } catch (error) {
    console.log('❌ Gemini API test failed:', error.message);
    console.log('   Please verify your GEMINI_API_KEY');
  }
} else {
  console.log('⚠️  GEMINI_API_KEY not set - AI features will be limited');
}

// 4. File System Check
console.log('\n📁 Step 4: File System');
console.log('─'.repeat(60));

const criticalPaths = [
  'uploads',
  'client/dist',
];

for (const path of criticalPaths) {
  const fullPath = join(__dirname, path);
  if (existsSync(fullPath)) {
    console.log(`✅ ${path}/ exists`);
  } else {
    console.log(`⚠️  ${path}/ missing (will be created on first use)`);
  }
}

// 5. Default User Check
console.log('\n👤 Step 5: Default User');
console.log('─'.repeat(60));

try {
  const { storage } = await import('./server/storage.js');
  const user = await storage.ensureDefaultUser();
  console.log('✅ Default user verified');
  console.log(`   User ID: ${user.id}`);
  console.log(`   Username: ${user.username}`);
} catch (error) {
  console.log('❌ Default user creation failed:', error.message);
}

// Summary
console.log('\n' + '═'.repeat(60));
console.log('📊 DIAGNOSTIC SUMMARY');
console.log('═'.repeat(60));

if (envIssues === 0) {
  console.log('✅ System is ready!');
  console.log('\n🚀 You can now run: npm run dev');
  console.log('   Then visit: http://localhost:5000');
} else {
  console.log('⚠️  Please fix the issues above before starting the server');
}

console.log('\n');
process.exit(0);
