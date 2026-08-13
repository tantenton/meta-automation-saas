import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

function fail(message) {
  console.error(`[db:bootstrap] ${message}`);
  process.exit(1);
}

const connectionString = process.env.DB_URL;
if (!connectionString) {
  fail('DB_URL is missing. Put the Supabase Postgres URI in .env.local or export DB_URL before running.');
}

const root = process.cwd();
const schemaPath = path.join(root, 'supabase', 'schema.sql');
const migrationPath = path.join(root, 'supabase', 'migrations', '20260806_production_api.sql');

const client = new Client({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('[db:bootstrap] connected');

  const exists = await client.query("select to_regclass('public.users') as users_table");
  const hasBaseSchema = Boolean(exists.rows[0]?.users_table);

  if (!hasBaseSchema) {
    console.log('[db:bootstrap] base schema missing; applying supabase/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await client.query(schema);
    console.log('[db:bootstrap] base schema applied');
  } else {
    console.log('[db:bootstrap] base schema already exists; skipping schema.sql');
  }

  console.log('[db:bootstrap] applying production migration');
  const migration = await fs.readFile(migrationPath, 'utf8');
  await client.query(migration);
  console.log('[db:bootstrap] production migration applied');

  const requiredTables = ['users', 'accounts', 'posts', 'analytics'];
  const result = await client.query(
    `select tablename from pg_tables where schemaname = 'public' and tablename = any($1::text[])`,
    [requiredTables]
  );
  const found = new Set(result.rows.map((row) => row.tablename));
  const missing = requiredTables.filter((table) => !found.has(table));

  if (missing.length) {
    fail(`migration completed but required tables are missing: ${missing.join(', ')}`);
  }

  console.log(`[db:bootstrap] verified tables: ${requiredTables.join(', ')}`);
  console.log('[db:bootstrap] OK');
} catch (error) {
  console.error('[db:bootstrap] FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
