/**
 * Verifica se o Supabase está configurado com credenciais válidas.
 * Em modo local/demo (sem .env.local ou com placeholder), retorna false.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return false;
  if (url.includes('placeholder-project') || url.includes('placeholder') || key.includes('placeholder')) {
    return false;
  }
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return false;
  }
  return true;
}
