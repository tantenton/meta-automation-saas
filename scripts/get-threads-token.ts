import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { decryptToken } from '@/lib/server/token-crypto';

async function main() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('accounts').select('*').eq('platform', 'threads').eq('is_active', true).maybeSingle();

  if (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
  if (!data) {
    console.log('NO_THREADS_ACCOUNT');
    process.exit(0);
  }

  const token = decryptToken(data.access_token_encrypted);
  console.log(token);
}

main();
