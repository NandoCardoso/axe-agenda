'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  ShieldOff,
  Clock,
  Briefcase,
  RefreshCw,
  CalendarPlus,
  Sun,
} from 'lucide-react';
import { expandirEventoRecorrente } from '@/lib/calcular-slots';
import type { Evento } from '@/lib/types';
import {
  getStatusEscala12x36,
  ESCALA_PADRAO,
  type Escala12x36Config,
} from '@/lib/escala-clt';
import BloquearDiaModal from '@/components/bloquear-dia-modal';
import NovoAgendamentoModal from '@/components/novo-agendamento-modal';
import EventoDetalheModal from '@/components/evento-detalhe-modal';
import { MOCK_TIPOS_GIRA, MOCK_EVENTOS } from '@/lib/mock-data';

const TZ = 'America/Sao_Paulo';

interface EventoVisual {
  evento: Evento;
  inicio: Date;
  fim: Date;
  tipo: string;
}

export default function CalendarioPage() {
  const [mesAtual, setMesAtual] = useState(() => {
    const agora = toZonedTime(new Date(), TZ);
    return startOfMonth(agora);
  });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventosExpandidos, setEventosExpandidos] = useState<EventoVisual[]>([]);
  const [tiposGira, setTiposGira] = useState<Record<string, string>>({});
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(() => toZonedTime(new Date(), TZ));
  const [showBloquear, setShowBloquear] = useState(false);
  const [showAgendar, setShowAgendar] = useState(false);
  const [eventoDetalhe, setEventoDetalhe] = useState<EventoVisual | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    try {
      let localEventos: Evento[] = [];
      try {
        localEventos = JSON.parse(localStorage.getItem('axe_eventos_extra') || '[]');
      } catch {}

      if (isSupabaseConfigured()) {
        const [girasRes, eventosRes] = await Promise.all([
          supabase.from('tipos_gira').select('*'),
          supabase.from('eventos').select('*'),
        ]);

        const mapaTipos: Record<string, string> = {};
        if (girasRes.data) {
          for (const t of girasRes.data) {
            mapaTipos[t.id] = t.nome;
          }
        }
        setTiposGira(mapaTipos);
        setEventos([...(eventosRes.data || []), ...localEventos]);
      } else {
        const mapaTipos: Record<string, string> = {};
        for (const t of MOCK_TIPOS_GIRA) {
          mapaTipos[t.id] = t.nome;
        }
        setTiposGira(mapaTipos);
        setEventos([...MOCK_EVENTOS, ...localEventos]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do calendário:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Expandir eventos recorrentes para o mês atual
  useEffect(() => {
    const inicioMes = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
    const fimMes = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });

    const expandidos: EventoVisual[] = [];

    for (const ev of eventos) {
      const ocorrencias = expandirEventoRecorrente(ev, inicioMes, fimMes);
      for (const oc of ocorrencias) {
        expandidos.push({
          evento: ev,
          inicio: oc.inicio,
          fim: oc.fim,
          tipo: ev.tipo,
        });
      }
    }

    setEventosExpandidos(expandidos);
  }, [eventos, mesAtual]);

  // Alternar exceção rápida de escala CLT no dia selecionado (ex: trocou plantão)
  function alternarExcecaoEscala(dataAlvo: Date) {
    const dataIso = format(dataAlvo, 'yyyy-MM-dd');
    const statusAtual = getStatusEscala12x36(dataAlvo, escalaConfig);

    setEscalaConfig(prev => {
      let novosTrabalhos = [...(prev.excecoes_trabalho || [])];
      let novasFolgas = [...(prev.excecoes_folga || [])];

      if (statusAtual === 'trabalho') {
        // Virar folga: adicionar em excecoes_folga e remover de excecoes_trabalho
        novosTrabalhos = novosTrabalhos.filter(d => d !== dataIso);
        if (!novasFolgas.includes(dataIso)) novasFolgas.push(dataIso);
      } else {
        // Virar plantão: adicionar em excecoes_trabalho e remover de excecoes_folga
        novasFolgas = novasFolgas.filter(d => d !== dataIso);
        if (!novosTrabalhos.includes(dataIso)) novosTrabalhos.push(dataIso);
      }

      const novaConfig: Escala12x36Config = {
        ...prev,
        excecoes_trabalho: novosTrabalhos,
        excecoes_folga: novasFolgas,
      };

      try {
        localStorage.setItem('axe_escala_clt', JSON.stringify(novaConfig));
      } catch {}

      return novaConfig;
    });
  }

  // Montar grid de dias do mês
  const inicioGrid = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
  const fimGrid = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });

  const dias: Date[] = [];
  let diaAtual = inicioGrid;
  while (diaAtual <= fimGrid) {
    dias.push(diaAtual);
    diaAtual = addDays(diaAtual, 1);
  }

  function eventosNoDia(d: Date): EventoVisual[] {
    return eventosExpandidos.filter(ev => {
      const inicioSP = toZonedTime(ev.inicio, TZ);
      return isSameDay(inicioSP, d);
    });
  }

  function corEvento(tipo: string) {
    switch (tipo) {
      case 'gira': return 'bg-brand-500';
      case 'bloqueio_pessoal': return 'bg-red-400';
      case 'atendimento': return 'bg-emerald-400';
      default: return 'bg-surface-400';
    }
  }

  function iconEvento(tipo: string) {
    switch (tipo) {
      case 'gira': return <Flame className="w-4 h-4 text-brand-400" />;
      case 'bloqueio_pessoal': return <ShieldOff className="w-4 h-4 text-red-400" />;
      case 'atendimento': return <Clock className="w-4 h-4 text-emerald-400" />;
      default: return null;
    }
  }

  function nomeEvento(ev: EventoVisual) {
    if (ev.tipo === 'gira') return tiposGira[ev.evento.subtipo || ''] || 'Gira';
    return ev.evento.titulo || (ev.tipo === 'bloqueio_pessoal' ? 'Bloqueio Pessoal' : 'Atendimento');
  }

  const eventosDoDiaSelecionado = diaSelecionado ? eventosNoDia(diaSelecionado) : [];
  const statusDiaSelecionado = diaSelecionado ? getStatusEscala12x36(diaSelecionado, escalaConfig) : null;

  return (
    <div className="px-4 sm:px-5 pt-6 pb-12 max-w-lg mx-auto">
      {/* Header do mês */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMesAtual(m => addMonths(m, -1))}
          className="p-2 -ml-2 text-surface-400 hover:text-white rounded-xl hover:bg-surface-800 active:scale-95 transition-colors"
          title="Mês anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-serif text-xl font-bold text-white capitalize tracking-wide">
          {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
        </h1>
        <button
          onClick={() => setMesAtual(m => addMonths(m, 1))}
          className="p-2 -mr-2 text-surface-400 hover:text-white rounded-xl hover:bg-surface-800 active:scale-95 transition-colors"
          title="Próximo mês"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Legenda discreta da escala e eventos */}
      <div className="flex items-center justify-center gap-4 mb-3 text-[11px] text-surface-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Plantão
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Folga
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          Gira
        </span>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, idx) => (
          <div key={idx} className="text-center text-[11px] font-semibold text-surface-500 py-1 uppercase">
            {dia}
          </div>
        ))}
      </div>

      {/* Grid de Dias */}
      <div className="grid grid-cols-7 gap-1 bg-surface-900/40 p-1.5 rounded-2xl border border-surface-800">
        {dias.map((d, i) => {
          const doMes = isSameMonth(d, mesAtual);
          const selecionado = diaSelecionado && isSameDay(d, diaSelecionado);
          const hoje = isToday(d);
          const evsDia = eventosNoDia(d);
          const statusEscala = getStatusEscala12x36(d, escalaConfig);
          const isTrabalho = statusEscala === 'trabalho';

          return (
            <button
              key={i}
              onClick={() => setDiaSelecionado(d)}
              className={`min-h-[58px] p-1 rounded-xl flex flex-col items-center justify-between transition-all relative ${
                selecionado
                  ? 'bg-brand-500/20 border-2 border-brand-500 text-white'
                  : hoje
                    ? 'border border-brand-500/40 bg-surface-800/40 text-white'
                    : 'hover:bg-surface-800/60 border border-transparent'
              } ${!doMes ? 'opacity-25' : ''}`}
            >
              {/* Número do dia */}
              <span
                className={`text-xs font-semibold mt-0.5 ${
                  hoje
                    ? 'text-brand-400 font-bold'
                    : doMes
                      ? 'text-surface-200'
                      : 'text-surface-600'
                }`}
              >
                {format(d, 'd')}
              </span>

              {/* Indicador de escala 12x36 */}
              {doMes && (
                <span
                  className={`text-[9px] font-semibold px-1 py-0.2 rounded leading-none ${
                    isTrabalho
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {isTrabalho ? 'Plantão' : 'Folga'}
                </span>
              )}

              {/* Indicadores de eventos (giras, bloqueios, atendimentos) */}
              <div className="flex gap-0.5 min-h-[5px] mb-0.5">
                {evsDia.slice(0, 3).map((ev, j) => (
                  <span key={j} className={`w-1.5 h-1.5 rounded-full ${corEvento(ev.tipo)}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detalhes do dia selecionado */}
      {diaSelecionado && (
        <div className="mt-5 mb-24 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif text-base font-bold text-white capitalize truncate tracking-wide">
              {format(diaSelecionado, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowAgendar(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm active:scale-95"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Agendar
              </button>
              <button
                onClick={() => setShowBloquear(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-900 hover:bg-surface-800 text-surface-300 border border-surface-700 rounded-xl text-xs font-medium transition-colors"
                title="Bloquear dia ou horário"
              >
                <ShieldOff className="w-3.5 h-3.5 text-red-400" />
                Bloquear
              </button>
            </div>
          </div>

          {/* Card de Status da Escala 12x36 no dia */}
          {statusDiaSelecionado === 'trabalho' ? (
            <div className="bg-surface-900/60 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-200">Dia de Plantão (12x36)</p>
                  <p className="text-[11px] text-surface-400">
                    Horários públicos bloqueados para proteger seu descanso e trabalho.
                  </p>
                </div>
              </div>
              <button
                onClick={() => alternarExcecaoEscala(diaSelecionado)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl shrink-0 transition-colors"
                title="Trocou de plantão com colega?"
              >
                <RefreshCw className="w-3 h-3" />
                Virou Folga
              </button>
            </div>
          ) : (
            <div className="bg-surface-900/60 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-200">Dia de Folga</p>
                  <p className="text-[11px] text-surface-400">
                    Disponível para atendimentos espirituais e giras conforme as regras.
                  </p>
                </div>
              </div>
              <button
                onClick={() => alternarExcecaoEscala(diaSelecionado)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-300 border border-surface-700 rounded-xl shrink-0 transition-colors"
                title="Trocou folga por plantão?"
              >
                <RefreshCw className="w-3 h-3" />
                Virou Plantão
              </button>
            </div>
          )}

          {/* Lista de Eventos do dia */}
          {eventosDoDiaSelecionado.length === 0 ? (
            <div className="bg-surface-900/40 border border-surface-800 rounded-2xl p-4 text-center text-surface-500 text-xs">
              Nenhum compromisso ou atendimento agendado neste dia
            </div>
          ) : (
            <div className="space-y-2">
              {eventosDoDiaSelecionado.map((ev, i) => (
                <button
                  key={i}
                  onClick={() => setEventoDetalhe(ev)}
                  className="w-full flex items-center gap-3 bg-surface-900/60 border border-surface-800 rounded-2xl p-3.5 text-left hover:border-brand-500/30 transition-all active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-800 border border-surface-700 shrink-0">
                    {iconEvento(ev.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {nomeEvento(ev)}
                    </p>
                    <p className="text-xs text-surface-400">
                      {ev.evento.dia_inteiro
                        ? 'Dia inteiro'
                        : `${format(ev.inicio, 'HH:mm')} - ${format(ev.fim, 'HH:mm')}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Modais */}
      {showAgendar && (
        <NovoAgendamentoModal
          initialDate={diaSelecionado ? format(diaSelecionado, 'yyyy-MM-dd') : undefined}
          onClose={() => setShowAgendar(false)}
          onSave={() => {
            carregarDados();
          }}
        />
      )}

      {showBloquear && diaSelecionado && (
        <BloquearDiaModal
          initialDate={diaSelecionado ? format(diaSelecionado, 'yyyy-MM-dd') : undefined}
          onClose={() => setShowBloquear(false)}
          onSave={() => {
            setShowBloquear(false);
            carregarDados();
          }}
        />
      )}

      {eventoDetalhe && (
        <EventoDetalheModal
          evento={eventoDetalhe.evento}
          inicioExpandido={eventoDetalhe.inicio}
          fimExpandido={eventoDetalhe.fim}
          tiposGira={tiposGira}
          onClose={() => setEventoDetalhe(null)}
          onUpdate={() => {
            setEventoDetalhe(null);
            carregarDados();
          }}
        />
      )}
    </div>
  );
}
