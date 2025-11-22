import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

function normalizeDatabaseUrl(value?: string | null): string {
  if (!value) return "";
  let normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.toLowerCase().startsWith("psql")) {
    normalized = normalized.replace(/^psql\s+/i, "");
  }

  normalized = normalized.replace(/^['"]/, "").replace(/['"]$/, "");
  return normalized;
}

const DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

process.env.DATABASE_URL = DATABASE_URL;

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle({ client: pool, schema });

export async function ensureSchema(): Promise<void> {
  // Create enum types and tables if they don't exist. This is a lightweight
  // runtime schema initializer to make local development easier when
  // migrations haven't been applied.
  const createEnumsAndTables = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
      CREATE TYPE content_type AS ENUM ('document','image','video');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_status') THEN
      CREATE TYPE processing_status AS ENUM ('pending','processing','completed','failed');
    END IF;
  END$$;

  CREATE TABLE IF NOT EXISTS users (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    username text NOT NULL UNIQUE,
    password text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS content_items (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar REFERENCES users(id) NOT NULL,
    title text NOT NULL,
    type content_type NOT NULL,
    original_file_name text,
    original_url text,
    status processing_status NOT NULL DEFAULT 'pending',
    extracted_text text,
    summary text,
    audio_url text,
    podcast_script text,
    podcast_audio_url text,
    image_descriptions jsonb,
    quiz_data jsonb,
    flashcards jsonb,
    processing_options jsonb NOT NULL,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  );

  ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS flashcards jsonb;
  
  ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS podcast_script text;
  
  ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS podcast_audio_url text;
  `;

  try {
    // run as a single statement
    await pool.query(createEnumsAndTables);
  } catch (err) {
    console.warn("ensureSchema warning:", err);
  }
}