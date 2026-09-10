import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const accountId = '879bedfa-f217-41c6-9abf-29c75ebac0e1';

(async () => {
  const { data: account, error: accErr } = await supabase
    .from('accounts')
    .select('id, account_id, platform, created_at')
    .eq('id', accountId)
    .single();

  console.log('Account:', JSON.stringify(account, null, 2));
  if (accErr) console.error('Error:', accErr);

  const { data: pending, error: pendErr } = await supabase
    .from('pending_metrics')
    .select('*')
    .eq('account_id', accountId)
    .eq('metrics_collected', false)
    .order('check_after', { ascending: true });

  console.log('\nPending metrics count:', pending?.length || 0);
  if (pending?.length) {
    console.log('Oldest pending (first 3):', JSON.stringify(pending.slice(0, 3), null, 2));
  }

  const { data: patterns, error: patErr } = await supabase
    .from('content_patterns')
    .select('*')
    .eq('account_id', accountId)
    .order('effectiveness_score', { ascending: false });

  console.log('\nContent patterns count:', patterns?.length || 0);
  if (patterns?.length) {
    console.log('Top 3 patterns:', JSON.stringify(patterns.slice(0, 3), null, 2));
  }

  const { data: strategy, error: stratErr } = await supabase
    .from('content_strategy')
    .select('*')
    .eq('account_id', accountId)
    .single();

  console.log('\nCurrent strategy iteration:', strategy?.iteration || 0);
  if (strategy?.last_updated) {
    console.log('Last updated:', strategy.last_updated);
  }
})();
