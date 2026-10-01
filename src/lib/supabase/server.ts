import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isSupabaseConfigured } from './config';

export { isSupabaseConfigured };

export async function createServerSupabase() {
  const cookieStore = await cookies();

  const isConfigured = isSupabaseConfigured();
  const url = isConfigured
    ? process.env.NEXT_PUBLIC_SUPABASE_URL!
    : 'https://placeholder-project.supabase.co';
  const key = isConfigured
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    : 'placeholder-anon-key';

  return createServerClient(
    url,
    key,
    {
      global: {
        fetch: async (input, init) => {
          if (!isSupabaseConfigured()) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'content-range': '0-0/0' },
            });
          }
          return fetch(input, init);
        },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored if in Server Component
          }
        },
      },
    },
  );
}

/**
 * Service role client for server-side operations that bypass RLS.
 * Use ONLY for calculating public slots (API routes).
 */
export async function createServiceSupabase() {
  const cookieStore = await cookies();

  const isConfigured = isSupabaseConfigured();
  const url = isConfigured
    ? process.env.NEXT_PUBLIC_SUPABASE_URL!
    : 'https://placeholder-project.supabase.co';
  const key = isConfigured
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    : 'placeholder-service-key';

  return createServerClient(
    url,
    key,
    {
      global: {
        fetch: async (input, init) => {
          if (!isSupabaseConfigured()) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'content-range': '0-0/0' },
            });
          }
          return fetch(input, init);
        },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored
          }
        },
      },
    },
  );
}
