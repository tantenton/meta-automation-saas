import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const missing: string[] = [];

  if (!process.env.HERMES_API_KEY) missing.push('HERMES_API_KEY');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.TOKEN_ENCRYPTION_KEY) missing.push('TOKEN_ENCRYPTION_KEY');
  if (!process.env.HERMES_OWNER_USER_ID) missing.push('HERMES_OWNER_USER_ID');

  let database: 'ok' | 'error' | 'not_configured' = 'not_configured';
  let databaseError: string | undefined;

  if (missing.length === 0) {
    try {
      const db = getSupabaseAdmin();
      const { error } = await db.from('users').select('id').limit(1);
      if (error) {
        database = 'error';
        databaseError = error.message;
      } else {
        database = 'ok';
      }
    } catch (error) {
      database = 'error';
      databaseError = error instanceof Error ? error.message : 'database_check_failed';
    }
  }

  const configured = missing.length === 0;
  const ok = configured && database === 'ok';

  return NextResponse.json(
    {
      ok,
      service: 'meta-automation',
      configured,
      database,
      missing,
      ...(databaseError ? { database_error: databaseError } : {}),
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
