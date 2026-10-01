'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import {
  ShieldOff,
  ChevronRight,
  Clock,
  Users,
  Flame,
  Share2,
  Copy,
  Check,
  Briefcase,
  CalendarPlus,
  Sun,
} from 'lucide-react';
import Link from 'next/link';
import type { Evento, Solicitacao } from '@/lib/types';
import { expandirEventoRecorrente } from '@/lib/calcular-slots';
import {
  getStatusEscala12x36,
  ESCALA_PADRAO,
  type Escala12x36Config,
} from '@/lib/escala-clt';
import BloquearDiaModal from '@/components/bloquear-dia-modal';
import NovoAgendamentoModal from '@/components/novo-agendamento-modal';
import { MOCK_TIPOS_GIRA, MOCK_EVENTOS, MOCK_SOLICITACOES } from '@/lib/mock-data';

const TZ = 'America/Sao_Paulo';

interface GiraProxima {
  data: Date;
  subtipo: string | null;
  nomeSubtipo: string;
}

export default function PainelHome() {
  const [giras, setGiras] = useState<GiraProxima[]>([]);
  const [pedidosPendentes, setPedidosPendentes] = useState<Solicitacao[]>([]);
  const [atendimentos, setAtendimentos] = useState<Evento[]>([]);
  const [tiposGira, setTiposGira] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showBloquear, setShowBloquear] = useState(false);
  const [showAgendar, setShowAgendar] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Escala CLT
  const [escalaConfig, setEscalaConfig] = useState<Escala12x36Config>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('axe_escala_clt');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return ESCALA_PADRAO;
  });

  const supabase = createClient();

  const carregarDados = useCallback(async () => {
    try {
      const agora = new Date();
      const limite30Dias = addDays(agora, 30);

      // Ler possíveis dados extras do localStorage
      let localEventos: Evento[] = [];
      let localSolicitacoes: Solicitacao[] = [];
      try {
        localEventos = JSON.parse(localStorage.getItem('axe_eventos_extra') || '[]');
        localSolicitacoes = JSON.parse(localStorage.getItem('axe_solicitacoes_extra') || '[]');
      } catch {}

      if (isSupabaseConfigured()) {
        const [girasRes, eventosRes, solicitacoesRes] = await Promise.all([
          supabase.from('tipos_gira').select('*'),
          supabase.from('eventos').select('*').gte('inicio', agora.toISOString()).order('inicio', { ascending: true }),
          supabase.from('solicitacoes').select('*').eq('status', 'pendente').order('inicio', { ascending: true }),
        ]);

        const mapaTipos: Record<string, string> = {};
        if (girasRes.data) {
          for (const t of girasRes.data) {
            mapaTipos[t.id] = t.nome;
          }
        }
        setTiposGira(mapaTipos);

        const todosEventos = [...(eventosRes.data || []), ...localEventos];
        processarEventos(todosEventos, mapaTipos, agora, limite30Dias);

        const todasSolicitacoes = [...(solicitacoesRes.data || []), ...localSolicitacoes.filter(s => s.status === 'pendente')];
        setPedidosPendentes(todasSolicitacoes.slice(0, 5));
      } else {
        // Fallback Mock com dados em memória e localStorage
        const mapaTipos: Record<string, string> = {};
        for (const t of MOCK_TIPOS_GIRA) {
          mapaTipos[t.id] = t.nome;
        }
        setTiposGira(mapaTipos);

        const todosEventos = [...MOCK_EVENTOS, ...localEventos];
        processarEventos(todosEventos, mapaTipos, agora, limite30Dias);

        const todasSolicitacoes = [...MOCK_SOLICITACOES, ...localSolicitacoes].filter(s => s.status === 'pendente');
        setPedidosPendentes(todasSolicitacoes.slice(0, 5));
      }
    } catch (err) {
      console.error('Erro ao carregar dados do painel:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  function processarEventos(
    eventos: Evento[],
    mapaTipos: Record<string, string>,
    agora: Date,
    limite: Date
  ) {
    const listaGiras: GiraProxima[] = [];
    const listaAtendimentos: Evento[] = [];

    for (const ev of eventos) {
      if (ev.tipo === 'gira') {
        const ocorrencias = expandirEventoRecorrente(ev, agora, limite);
        for (const oc of ocorrencias) {
          if (oc.inicio >= agora && oc.inicio <= limite) {
            listaGiras.push({
              data: oc.inicio,
              subtipo: ev.subtipo,
              nomeSubtipo: mapaTipos[ev.subtipo || ''] || ev.titulo || 'Gira',
            });
          }
        }
      } else if (ev.tipo === 'atendimento') {
        const inicio = new Date(ev.inicio);
        if (inicio >= agora) {
          listaAtendimentos.push(ev);
        }
      }
    }

    listaGiras.sort((a, b) => a.data.getTime() - b.data.getTime());
    setGiras(listaGiras.slice(0, 5));

    listaAtendimentos.sort(
      (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
    );
    setAtendimentos(listaAtendimentos.slice(0, 5));
  }

  function formatarDataSP(data: Date | string) {
    const d = typeof data === 'string' ? new Date(data) : data;
    const zoned = toZonedTime(d, TZ);
    return format(zoned, "EEEE, d 'de' MMMM", { locale: ptBR });
  }

  function formatarHoraSP(data: Date | string) {
    const d = typeof data === 'string' ? new Date(data) : data;
    return format(d, 'HH:mm');
  }

  // Cálculos de status da escala CLT
  const agoraSP = toZonedTime(new Date(), TZ);
  const amanhaSP = addDays(agoraSP, 1);
  const escalaHoje = getStatusEscala12x36(agoraSP, escalaConfig);
  const escalaAmanha = getStatusEscala12x36(amanhaSP, escalaConfig);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 pt-6 pb-12 max-w-lg mx-auto space-y-6">
      {/* Saudação e Identidade */}
      <div className="pb-1">
        <h1 className="font-serif text-2xl font-bold text-white tracking-wide">
          Axé, Pai Leandro
        </h1>
        <p className="text-xs text-surface-400 mt-0.5">
          Gestão litúrgica e atendimentos do terreiro
        </p>
      </div>

      {/* Botões de Ação Rápida: Agendar na Hora ou Bloquear Dia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Botão: Agendar Consulta */}
        <button
          onClick={() => setShowAgendar(true)}
          className="flex items-center gap-3.5 p-4 bg-gradient-to-r from-brand-600/25 via-brand-500/15 to-transparent border border-brand-500/40 rounded-2xl hover:border-brand-500/70 active:scale-[0.98] transition-all group text-left shadow-lg shadow-brand-500/5"
        >
          <div className="w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center shrink-0 border border-brand-500/30">
            <CalendarPlus className="w-6 h-6 text-brand-400 group-hover:scale-105 transition-transform" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-base font-serif font-bold text-white block">Agendar Consulta</span>
            <p className="text-xs text-brand-300/80 truncate">Marcar na hora para o consulente</p>
          </div>
          <ChevronRight className="w-5 h-5 text-surface-500 group-hover:text-brand-400 transition-colors" />
        </button>

        {/* Botão: Bloquear Dia */}
        <button
          onClick={() => setShowBloquear(true)}
          className="flex items-center gap-3.5 p-4 bg-surface-900/60 border border-surface-800 rounded-2xl hover:border-surface-700 active:scale-[0.98] transition-all group text-left"
        >
          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0 border border-red-500/20">
            <ShieldOff className="w-6 h-6 text-red-400 group-hover:scale-105 transition-transform" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-base font-serif font-bold text-white block">Bloquear Horário</span>
            <p className="text-xs text-surface-400 truncate">Reservar folga ou descanso</p>
          </div>
          <ChevronRight className="w-5 h-5 text-surface-500 group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* Card da Escala de Trabalho 12x36 */}
      <div className="bg-surface-900/60 border border-surface-800 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Escala 12x36</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20">
                Ativa
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-surface-400 mt-1">
              <span className="flex items-center gap-1.5">
                Hoje:{' '}
                {escalaHoje === 'trabalho' ? (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Plantão
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <Sun className="w-3 h-3 text-emerald-400" />
                    Folga
                  </span>
                )}
              </span>
              <span className="text-surface-700">•</span>
              <span className="flex items-center gap-1.5">
                Amanhã:{' '}
                {escalaAmanha === 'trabalho' ? (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Plantão
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <Sun className="w-3 h-3 text-emerald-400" />
                    Folga
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/painel/calendario"
          className="text-xs text-brand-400 hover:text-brand-300 shrink-0 font-medium transition-colors"
        >
          Ver escala
        </Link>
      </div>

      {/* Cartão de Link Público para WhatsApp */}
      <div className="bg-surface-900/60 border border-surface-800 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">Link de Agendamento Público</p>
          <p className="text-[11px] text-surface-400 truncate">Envie para o consulente escolher o horário disponível</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              const url = `${window.location.origin}/agendar`;
              navigator.clipboard.writeText(url);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-xl text-xs font-medium transition-colors"
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
          <a
            href="/agendar"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white rounded-xl text-xs transition-colors"
            title="Abrir página pública"
          >
            <Share2 className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Próximas Giras */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Próximas Giras Litúrgicas
          </h2>
          <Link href="/painel/calendario" className="text-xs text-brand-400 hover:text-brand-300">
            Ver todas
          </Link>
        </div>
        {giras.length === 0 ? (
          <div className="bg-surface-900/40 border border-surface-800 rounded-2xl p-4 text-center text-surface-500 text-xs">
            Nenhuma gira nos próximos 30 dias
          </div>
        ) : (
          <div className="space-y-2">
            {giras.map((gira, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 bg-surface-900/60 border border-surface-800/80 rounded-2xl p-3.5 hover:border-surface-700 transition-colors"
              >
                <div className="w-10 h-10 bg-brand-500/15 border border-brand-500/30 rounded-xl flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">
                      {gira.nomeSubtipo}
                    </p>
                    {gira.nomeSubtipo.toLowerCase().includes('externa') && (
                      <span className="px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold rounded-full shrink-0">
                        Externa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-surface-400 capitalize">
                    {formatarDataSP(gira.data)}
                  </p>
                </div>
                <span className="text-xs text-surface-400 font-medium shrink-0">
                  {formatarHoraSP(gira.data)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pedidos Pendentes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Pedidos de Atendimento
            </h2>
            {pedidosPendentes.length > 0 && (
              <span className="px-2 py-0.5 bg-brand-500/20 text-brand-300 text-xs font-semibold rounded-full">
                {pedidosPendentes.length}
              </span>
            )}
          </div>
          <Link href="/painel/pedidos" className="text-xs text-brand-400 hover:text-brand-300">
            Ver todos
          </Link>
        </div>
        {pedidosPendentes.length === 0 ? (
          <div className="bg-surface-900/40 border border-surface-800 rounded-2xl p-4 text-center text-surface-500 text-xs">
            Nenhum pedido pendente
          </div>
        ) : (
          <div className="space-y-2">
            {pedidosPendentes.map((pedido) => (
              <Link
                key={pedido.id}
                href="/painel/pedidos"
                className="flex items-center gap-3.5 bg-surface-900/60 border border-surface-800/80 rounded-2xl p-3.5 hover:border-brand-500/30 transition-colors"
              >
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {pedido.nome}
                  </p>
                  <p className="text-xs text-surface-400 capitalize">
                    {formatarDataSP(pedido.inicio)} — {formatarHoraSP(pedido.inicio)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-surface-500" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Próximos Atendimentos */}
      <section className="pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Próximos Atendimentos Confirmados
          </h2>
        </div>
        {atendimentos.length === 0 ? (
          <div className="bg-surface-900/40 border border-surface-800 rounded-2xl p-4 text-center text-surface-500 text-xs">
            Nenhum atendimento agendado
          </div>
        ) : (
          <div className="space-y-2">
            {atendimentos.map((at) => (
              <div
                key={at.id}
                className="flex items-center gap-3.5 bg-surface-900/60 border border-surface-800/80 rounded-2xl p-3.5"
              >
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {at.titulo || 'Atendimento'}
                  </p>
                  <p className="text-xs text-surface-400 capitalize">
                    {formatarDataSP(at.inicio)} — {formatarHoraSP(at.inicio)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal: Agendar Consulta Direta */}
      {showAgendar && (
        <NovoAgendamentoModal
          onClose={() => setShowAgendar(false)}
          onSave={() => {
            carregarDados();
          }}
        />
      )}

      {/* Modal: Bloquear Dia */}
      {showBloquear && (
        <BloquearDiaModal
          onClose={() => setShowBloquear(false)}
          onSave={() => {
            setShowBloquear(false);
            carregarDados();
          }}
        />
      )}
    </div>
  );
}
