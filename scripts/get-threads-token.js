import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin environment is incomplete');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function decryptToken(value) {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY is missing');
  const key = crypto.createHash('sha256').update(secret).digest();
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid encrypted token');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

async function main() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('accounts').select('*').eq('platform', 'threads').eq('is_active', true).maybeSingle();

  if (error) throw error;
  if (!data) {
    console.log('NO_THREADS_ACCOUNT');
    process.exit(0);
  }

  const token = decryptToken(data.access_token_encrypted);
  console.log(token);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
