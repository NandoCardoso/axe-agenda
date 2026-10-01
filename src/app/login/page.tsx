'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, Loader2, CheckCircle, ShieldCheck, Flame, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@axeagenda.com');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const supabase = createClient();

  // Login de Teste Direto para Desenvolvimento/Homologação
  function handleTestAdminLogin() {
    setLoading(true);
    const adminEmail = email.trim() || 'admin@axeagenda.com';
    // Grava cookie de sessão admin dev
    document.cookie = `axe_dev_user=${encodeURIComponent(adminEmail)}; path=/; max-age=86400; SameSite=Lax`;
    router.push('/painel');
  }

  // Login via Magic Link oficial Supabase
  async function handleMagicLinkLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setLoading(false);

      if (error) {
        setError('Serviço Supabase não configurado ou indisponível. Use o botão de acesso rápido abaixo para testar.');
      } else {
        setSent(true);
      }
    } catch {
      setLoading(false);
      setError('Serviço Supabase não configurado. Use o botão de teste rápido abaixo.');
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface-950 px-4 py-8 relative overflow-hidden">
      {/* Glow suave e acolhedor (âmbar/dourado ancestral, sem o azul/roxo genérico de IA) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Logo / Título */}
        <div className="text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-brand-400/20 to-brand-600/30 border border-brand-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-500/10">
            <Flame className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white tracking-wide">Axé Agenda</h1>
          <p className="text-surface-400 text-xs mt-1">Painel do Pai de Santo & Gestão Litúrgica</p>
        </div>

        {/* Card de Acesso Rápido de Teste (Admin) */}
        <div className="bg-surface-900/90 border border-brand-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2.5 text-brand-300 text-sm font-semibold mb-2">
            <ShieldCheck className="w-5 h-5 text-brand-400" />
            <span>Acesso Rápido (Ambiente de Teste)</span>
          </div>
          <p className="text-xs text-surface-400 mb-4 leading-relaxed">
            Ambiente pronto para você testar todas as funcionalidades do painel, calendário e pedidos com 1 clique.
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="test-email" className="block text-xs text-surface-300 font-medium mb-1.5">
                E-mail de Acesso
              </label>
              <input
                id="test-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-950 border border-surface-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <button
              type="button"
              onClick={handleTestAdminLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-brand-500/20 active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando no painel...
                </>
              ) : (
                <>
                  Entrar no Painel
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card Alternativo: Supabase Magic Link */}
        <div className="bg-surface-900/50 backdrop-blur-sm border border-surface-800 rounded-2xl p-5 shadow-lg">
          <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-3 text-center">
            Ou acesse via link por e-mail (Supabase)
          </p>

          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h2 className="text-base font-semibold text-white mb-1">Link enviado!</h2>
              <p className="text-surface-400 text-xs">
                Verifique sua caixa de entrada para acessar diretamente.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkLogin} className="space-y-3">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-surface-700/60"
              >
                <Mail className="w-3.5 h-3.5 text-surface-400" />
                Receber link por e-mail
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
