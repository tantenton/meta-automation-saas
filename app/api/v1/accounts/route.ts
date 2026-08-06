import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { encryptToken } from '@/lib/server/token-crypto';
import { validateMetaToken } from '@/lib/meta-api/client';

const schema = z.object({
  platform: z.enum(['instagram', 'threads']),
  platform_account_id: z.string().min(1),
  account_name: z.string().min(1).optional(),
  access_token: z.string().min(20),
  token_expires_at: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('accounts').select('id,platform,account_id,account_name,is_active,token_expires_at,created_at,updated_at').order('created_at');
  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data });
}

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  try {
    const input = schema.parse(await request.json());
    const ownerId = process.env.HERMES_OWNER_USER_ID;
    if (!ownerId) return NextResponse.json({ error: 'server_not_configured', message: 'HERMES_OWNER_USER_ID is missing' }, { status: 503 });
    const tokenInfo = await validateMetaToken(input.platform, input.access_token).catch((error) => {
      throw new Error(`Token validation failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('accounts').upsert({
      user_id: ownerId,
      platform: input.platform,
      account_id: input.platform_account_id,
      account_name: input.account_name || tokenInfo.username || tokenInfo.name || input.platform_account_id,
      access_token_encrypted: encryptToken(input.access_token),
      token_expires_at: input.token_expires_at || null,
      token_last_validated_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'user_id,platform,account_id' }).select('id,platform,account_id,account_name,is_active,token_expires_at').single();
    if (error) throw error;
    return NextResponse.json({ account: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'validation_error', issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: 'account_connect_failed', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
