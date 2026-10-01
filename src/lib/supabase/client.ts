import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured } from './config';

export { isSupabaseConfigured };

export function createClient() {
  const isConfigured = isSupabaseConfigured();
  const url = isConfigured
    ? process.env.NEXT_PUBLIC_SUPABASE_URL!
    : 'https://placeholder-project.supabase.co';
  const key = isConfigured
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    : 'placeholder-anon-key';

  return createBrowserClient(url, key, {
    global: {
      fetch: async (input, init) => {
        // Se o Supabase estiver em modo placeholder/offline, não dispara fetch na rede
        // para evitar erros de DNS no console do navegador (ERR_NAME_NOT_RESOLVED).
        if (!isSupabaseConfigured()) {
          const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
          if (urlStr.includes('/auth/v1/')) {
            return new Response(JSON.stringify({ user: null, session: null, error: { message: 'Modo local/offline' } }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'content-range': '0-0/0',
            },
          });
        }
        return fetch(input, init);
      },
    },
  });
}
