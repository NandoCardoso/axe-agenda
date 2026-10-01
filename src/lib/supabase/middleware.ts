import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from './config';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  let user = null;

  if (isSupabaseConfigured()) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      },
    );

    try {
      const userRes = await supabase.auth.getUser();
      user = userRes.data?.user || null;
    } catch {
      user = null;
    }
  }

  // Verifica usuário real ou sessão admin de teste local
  const devUser = request.cookies.get('axe_dev_user')?.value;
  const isAuthenticated = !!user || !!devUser;

  // Proteger rotas do painel
  if (
    !isAuthenticated &&
    request.nextUrl.pathname.startsWith('/painel')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirecionar do login se já autenticado
  if (isAuthenticated && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/painel';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
