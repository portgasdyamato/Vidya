#!/usr/bin/env node
/**
 * Pre-flight check script for Vidya
 * Validates that all necessary configuration is in place before starting the app
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

const checks = [];
let hasErrors = false;

function checkEnvVar(name, required = true, description = '') {
  const value = process.env[name];
  const exists = !!value;
  
  if (required && !exists) {
    hasErrors = true;
    checks.push({
      status: '❌',
      name,
      message: `Missing required environment variable${description ? ': ' + description : ''}`,
    });
  } else if (!exists) {
    checks.push({
      status: '⚠️',
      name,
      message: `Optional variable not set${description ? ': ' + description : ''}`,
    });
  } else {
    checks.push({
      status: '✅',
      name,
      message: exists ? 'Configured' : 'Not configured (optional)',
    });
  }
  
  return exists;
}

console.log('\n🔍 Vidya Pre-flight Checks\n');
console.log('='.repeat(60));

// Check for .env file
console.log('\n📄 Configuration Files:');
const envExists = existsSync(join(process.cwd(), '.env'));
console.log(`${envExists ? '✅' : '❌'} .env file ${envExists ? 'found' : 'missing'}`);

if (!envExists) {
  console.log('\n⚠️  No .env file found. Please create one using .env.example as a template.\n');
  hasErrors = true;
} else {
  // Check critical environment variables
  console.log('\n🔧 Required Configuration:');
  checkEnvVar('DATABASE_URL', true, 'Neon PostgreSQL connection string');
  
  console.log('\n🤖 AI Configuration (at least one required):');
  const hasOpenAI = checkEnvVar('OPENAI_API_KEY', false, 'OpenAI API for GPT-4, Whisper, TTS');
  const hasGemini = checkEnvVar('GEMINI_API_KEY', false, 'Google Gemini API');
  const hasOpenRouter = checkEnvVar('OPENROUTER_API_KEY', false, 'OpenRouter (Omni AI)');
  
  if (!hasOpenAI && !hasGemini && !hasOpenRouter) {
    hasErrors = true;
    checks.push({
      status: '❌',
      name: 'AI APIs',
      message: 'At least one AI provider (OpenAI or Gemini) must be configured',
    });
  }
  
  console.log('\n🔐 Authentication & Security:');
  checkEnvVar('SESSION_SECRET', true, 'Session encryption key');
  checkEnvVar('GOOGLE_CLIENT_ID', false, 'Google OAuth');
  checkEnvVar('GOOGLE_CLIENT_SECRET', false, 'Google OAuth');
  
  console.log('\n🌐 Server Configuration:');
  checkEnvVar('PORT', false, 'Server port (default: 5000)');
  checkEnvVar('BASE_URL', false, 'Base URL for OAuth callbacks');
}

// Print summary
console.log('\n' + '='.repeat(60));
checks.forEach(check => {
  console.log(`${check.status} ${check.name}: ${check.message}`);
});

console.log('\n' + '='.repeat(60));

if (hasErrors) {
  console.log('\n❌ Pre-flight check FAILED. Please fix the errors above.\n');
  process.exit(1);
} else {
  console.log('\n✅ Pre-flight check PASSED. Ready to start!\n');
  console.log('Run: npm run dev\n');
  process.exit(0);
}
