import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    // Fallback to mock client when Supabase is not configured
    return {
      from: () => ({
        select: () => ({ 
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null })
          }) 
        }),
        upsert: () => ({
          eq: () => Promise.resolve({ error: null })
        })
      })
    };
  }
  
  if (!supabaseClient) {
    supabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return supabaseClient;
}
