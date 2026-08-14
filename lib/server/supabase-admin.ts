import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function missingConfigError(): Error {
  return new Error(
    'Supabase server configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Fail closed by default. A silent mock client can make production requests
    // appear successful while no data is actually persisted.
    if (process.env.ALLOW_MOCK_SUPABASE === 'true' && process.env.NODE_ENV !== 'production') {
      return {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          upsert: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
      } as unknown as SupabaseClient;
    }

    throw missingConfigError();
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return supabaseClient;
}
