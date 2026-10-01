'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Loader2, Plus, Trash2, Save, LogOut, CheckCircle, Briefcase, RefreshCw } from 'lucide-react';
import type { RegraDisponibilidade } from '@/lib/types';
import { MOCK_REGRAS, MOCK_TIPOS_GIRA } from '@/lib/mock-data';
import {
  getStatusEscala12x36,
  ESCALA_PADRAO,
  type Escala12x36Config,
} from '@/lib/escala-clt';
import { addDays, format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useRouter } from 'next/navigation';

const TZ = 'America/Sao_Paulo';
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AjustesPage() {
  const [regras, setRegras] = useState<RegraDisponibilidade[]>([]);
  const [tiposGira, setTiposGira] = useState<{ id: string; nome: string; ativo: boolean }[]>([]);
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [novoTipoGira, setNovoTipoGira] = useState('');

  // Escala CLT 12x36
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
  const router = useRouter();

  const carregarDados = useCallback(async () => {
    setLoading(true);

    // 1. Tentar ler do localStorage primeiro (persistência local)
    let regrasSalvas: RegraDisponibilidade[] | null = null;
    let tiposSalvos: { id: string; nome: string; ativo: boolean }[] | null = null;
    let configsSalvas: Record<string, string> | null = null;

    try {
      const regLocal = localStorage.getItem('axe_regras');
      if (regLocal) regrasSalvas = JSON.parse(regLocal);

      const tipLocal = localStorage.getItem('axe_tipos_gira');
      if (tipLocal) tiposSalvos = JSON.parse(tipLocal);

      const cfgLocal = localStorage.getItem('axe_configs');
      if (cfgLocal) configsSalvas = JSON.parse(cfgLocal);
    } catch {}

    // 2. Tentar sincronizar com Supabase se disponível
    let regrasLista = regrasSalvas || MOCK_REGRAS;
    let tiposLista = tiposSalvos || MOCK_TIPOS_GIRA;
    let configMap: Record<string, string> = configsSalvas || {
      data_ancora_giras: '2026-09-26',
      nome_terreiro: 'Tenda de Umbanda Pai Joaquim de Angola e Baiano Zé do Coco',
      atendimento_online_ativo: 'false',
      antecedencia_minima_horas: '24',
      janela_maxima_dias: '30',
    };

    if (isSupabaseConfigured()) {
      try {
        const [{ data: r, error: erR }, { data: t, error: erT }, { data: c, error: erC }] = await Promise.all([
          supabase.from('regras_disponibilidade').select('*').order('dia_semana'),
          supabase.from('tipos_gira').select('*').order('ordem'),
          supabase.from('configuracoes').select('*'),
        ]);

        if (!erR && r && r.length > 0 && !regrasSalvas) regrasLista = r as RegraDisponibilidade[];
        if (!erT && t && t.length > 0 && !tiposSalvos) tiposLista = t;
        if (!erC && c && c.length > 0 && !configsSalvas) {
          configMap = {};
          c.forEach((cfg: { chave: string; valor: string }) => { configMap[cfg.chave] = cfg.valor; });
        }
      } catch {
        // Offline/placeholder mode
      }
    }

    setRegras(regrasLista);
    setTiposGira(tiposLista);
    setConfigs(configMap);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Regra helpers
  function atualizarRegra(id: string, campo: string, valor: string | number | boolean) {
    setRegras(prev => {
      const novas = prev.map(r => r.id === id ? { ...r, [campo]: valor } : r);
      try { localStorage.setItem('axe_regras', JSON.stringify(novas)); } catch {}
      return novas;
    });
  }

  function atualizarEscala<K extends keyof Escala12x36Config>(campo: K, valor: Escala12x36Config[K]) {
    setEscalaConfig(prev => {
      const atualizado = { ...prev, [campo]: valor };
      try { localStorage.setItem('axe_escala_clt', JSON.stringify(atualizado)); } catch {}
      return atualizado;
    });
  }

  function inverterEscala() {
    const d = parseISO(escalaConfig.data_ancora_trabalho);
    const invertida = format(addDays(d, 1), 'yyyy-MM-dd');
    atualizarEscala('data_ancora_trabalho', invertida);
  }

  async function salvarRegras() {
    setSalvando(true);
    setSalvoComSucesso(false);

    // 1. Persistir imediatamente no localStorage
    try {
      localStorage.setItem('axe_regras', JSON.stringify(regras));
      localStorage.setItem('axe_configs', JSON.stringify(configs));
      localStorage.setItem('axe_tipos_gira', JSON.stringify(tiposGira));
      localStorage.setItem('axe_escala_clt', JSON.stringify(escalaConfig));
    } catch {}

    // 2. Tentar persistir no Supabase (se configurado)
    if (isSupabaseConfigured()) {
      try {
        for (const regra of regras) {
          await supabase
            .from('regras_disponibilidade')
            .update({
              hora_inicio: regra.hora_inicio,
              hora_fim: regra.hora_fim,
              duracao_min: regra.duracao_min,
              buffer_min: regra.buffer_min,
              limite_dia: regra.limite_dia,
              limite_semana: regra.limite_semana,
              ativo: regra.ativo,
            })
            .eq('id', regra.id);
        }

        for (const [chave, valor] of Object.entries(configs)) {
          await supabase
            .from('configuracoes')
            .update({ valor })
            .eq('chave', chave);
        }
      } catch (e) {
        console.warn('Banco remoto indisponível, ajustes salvos localmente com sucesso.', e);
      }
    }

    setSalvando(false);
    setSalvoComSucesso(true);
    setTimeout(() => setSalvoComSucesso(false), 3500);
  }

  async function adicionarRegra(diaSemana: number) {
    const novaRegra: RegraDisponibilidade = {
      id: `reg-${diaSemana}-${Date.now()}`,
      dia_semana: diaSemana,
      hora_inicio: '09:00',
      hora_fim: '17:00',
      duracao_min: 60,
      buffer_min: 15,
      limite_dia: 4,
      limite_semana: 15,
      modalidade: 'presencial',
      ativo: true,
    };

    setRegras(prev => {
      const atualizadas = [...prev, novaRegra].sort((a, b) => a.dia_semana - b.dia_semana);
      try { localStorage.setItem('axe_regras', JSON.stringify(atualizadas)); } catch {}
      return atualizadas;
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('regras_disponibilidade').insert(novaRegra);
      } catch {}
    }
  }

  async function removerRegra(id: string) {
    setRegras(prev => {
      const filtradas = prev.filter(r => r.id !== id);
      try { localStorage.setItem('axe_regras', JSON.stringify(filtradas)); } catch {}
      return filtradas;
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('regras_disponibilidade').delete().eq('id', id);
      } catch {}
    }
  }

  async function adicionarTipoGira() {
    if (!novoTipoGira.trim()) return;
    const maxOrdem = tiposGira.reduce((max, t) => Math.max(max, (t as unknown as { ordem: number }).ordem || 0), 0);

    const novo = {
      id: `tipo-${Date.now()}`,
      nome: novoTipoGira.trim(),
      ativo: true,
      ordem: maxOrdem + 1,
    };

    setTiposGira(prev => {
      const atualizados = [...prev, novo];
      try { localStorage.setItem('axe_tipos_gira', JSON.stringify(atualizados)); } catch {}
      return atualizados;
    });

    setNovoTipoGira('');

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('tipos_gira').insert(novo);
      } catch {}
    }
  }

  async function toggleTipoGira(id: string, ativo: boolean) {
    setTiposGira(prev => {
      const atualizados = prev.map(t => t.id === id ? { ...t, ativo } : t);
      try { localStorage.setItem('axe_tipos_gira', JSON.stringify(atualizados)); } catch {}
      return atualizados;
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('tipos_gira').update({ ativo }).eq('id', id);
      } catch {}
    }
  }

  async function sair() {
    document.cookie = 'axe_dev_user=; path=/; max-age=0';
    try {
      await supabase.auth.signOut();
    } catch {}
    router.push('/login');
  }

  // Dias sem regra
  const diasComRegra = new Set(regras.map(r => r.dia_semana));
  const diasSemRegra = [0, 1, 2, 3, 4, 5, 6].filter(d => !diasComRegra.has(d));

  // Status da escala
  const agoraSP = toZonedTime(new Date(), TZ);
  const amanhaSP = addDays(agoraSP, 1);
  const escalaHoje = getStatusEscala12x36(agoraSP, escalaConfig);
  const escalaAmanha = getStatusEscala12x36(amanhaSP, escalaConfig);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Ajustes da Agenda</h1>
          <p className="text-xs text-surface-400">Configure suas regras de atendimento e escalas</p>
        </div>
        <button
          onClick={salvarRegras}
          disabled={salvando}
          className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-brand-500/20 active:scale-95"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>

      {/* ========================= */}
      {/* ESCALA 12X36 */}
      {/* ========================= */}
      <section className="bg-surface-800/40 border border-surface-700/40 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Escala 12x36</h2>
              <p className="text-xs text-surface-400">Plantão dia sim, folga dia não</p>
            </div>
          </div>
          <button
            onClick={() => atualizarEscala('ativa', !escalaConfig.ativa)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              escalaConfig.ativa ? 'bg-brand-500' : 'bg-surface-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform shadow ${
                escalaConfig.ativa ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {escalaConfig.ativa && (
          <div className="space-y-3 pt-2 border-t border-surface-700/40">
            {/* Status atual */}
            <div className="p-3 bg-surface-900/60 border border-surface-700/30 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-surface-400">Status atual: </span>
                <span className={escalaHoje === 'trabalho' ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold'}>
                  Hoje {escalaHoje === 'trabalho' ? 'Plantão' : 'Folga'}
                </span>
                <span className="text-surface-500 mx-1.5">•</span>
                <span className={escalaAmanha === 'trabalho' ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold'}>
                  Amanhã {escalaAmanha === 'trabalho' ? 'Plantão' : 'Folga'}
                </span>
              </div>
              <button
                onClick={inverterEscala}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-300 text-[11px] font-medium rounded-lg border border-surface-700 transition-colors"
                title="Inverte os dias de folga e plantão"
              >
                <RefreshCw className="w-3 h-3 text-brand-400" />
                Inverter
              </button>
            </div>

            {/* Toggle bloquear atendimentos */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-xs font-medium text-surface-200">
                  Bloquear agendamentos no dia de plantão
                </p>
                <p className="text-[11px] text-surface-500">
                  O sistema diz &quot;não&quot; por você e oculta horários nos dias de plantão
                </p>
              </div>
              <button
                onClick={() => atualizarEscala('bloquear_atendimentos', !escalaConfig.bloquear_atendimentos)}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  escalaConfig.bloquear_atendimentos ? 'bg-amber-500' : 'bg-surface-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                    escalaConfig.bloquear_atendimentos ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ========================= */}
      {/* Horários de atendimento */}
      {/* ========================= */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">
            Horários de atendimento
          </h2>
          <span className="text-xs text-surface-500">{regras.length} dias configurados</span>
        </div>

        <div className="space-y-3">
          {regras.map(regra => (
            <div
              key={regra.id}
              className={`bg-surface-800/50 border rounded-xl p-4 transition-colors ${
                regra.ativo ? 'border-surface-700/50' : 'border-surface-800 opacity-60'
              }`}
            >
              {/* Header da regra */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {DIAS_SEMANA[regra.dia_semana]}
                  </span>
                  <span className="text-xs text-surface-400 capitalize">
                    ({regra.modalidade})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => atualizarRegra(regra.id, 'ativo', !regra.ativo)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      regra.ativo ? 'bg-brand-500' : 'bg-surface-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                        regra.ativo ? 'translate-x-4' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => removerRegra(regra.id)}
                    className="p-1 text-surface-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Campos editáveis */}
              {regra.ativo && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-surface-400 block mb-1">Início</label>
                    <input
                      type="time"
                      value={regra.hora_inicio}
                      onChange={e => atualizarRegra(regra.id, 'hora_inicio', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-surface-900/50 border border-surface-600/50 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-surface-400 block mb-1">Fim</label>
                    <input
                      type="time"
                      value={regra.hora_fim}
                      onChange={e => atualizarRegra(regra.id, 'hora_fim', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-surface-900/50 border border-surface-600/50 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-surface-400 block mb-1">Duração (min)</label>
                    <input
                      type="number"
                      value={regra.duracao_min}
                      onChange={e => atualizarRegra(regra.id, 'duracao_min', Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-surface-900/50 border border-surface-600/50 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-surface-400 block mb-1">Intervalo (min)</label>
                    <input
                      type="number"
                      value={regra.buffer_min}
                      onChange={e => atualizarRegra(regra.id, 'buffer_min', Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-surface-900/50 border border-surface-600/50 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-surface-400 block mb-1">Limite/dia</label>
                    <input
                      type="number"
                      value={regra.limite_dia}
                      onChange={e => atualizarRegra(regra.id, 'limite_dia', Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-surface-900/50 border border-surface-600/50 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-surface-400 block mb-1">Limite/semana</label>
                    <input
                      type="number"
                      value={regra.limite_semana}
                      onChange={e => atualizarRegra(regra.id, 'limite_semana', Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-surface-900/50 border border-surface-600/50 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Adicionar dia */}
          {diasSemRegra.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {diasSemRegra.map(dia => (
                <button
                  key={dia}
                  onClick={() => adicionarRegra(dia)}
                  className="px-3 py-1.5 bg-surface-800 text-surface-400 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 border border-surface-700/50 active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  {DIAS_SEMANA[dia]}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========================= */}
      {/* Tipos de gira */}
      {/* ========================= */}
      <section>
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          Tipos de gira
        </h2>
        <div className="space-y-2">
          {tiposGira.map(tipo => (
            <div
              key={tipo.id}
              className="flex items-center justify-between bg-surface-800/50 border border-surface-700/30 rounded-xl px-4 py-3"
            >
              <span className={`text-sm ${tipo.ativo ? 'text-white' : 'text-surface-500 line-through'}`}>
                {tipo.nome}
              </span>
              <button
                onClick={() => toggleTipoGira(tipo.id, !tipo.ativo)}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  tipo.ativo ? 'bg-brand-500' : 'bg-surface-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                    tipo.ativo ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
          ))}

          {/* Adicionar tipo */}
          <div className="flex gap-2">
            <input
              type="text"
              value={novoTipoGira}
              onChange={e => setNovoTipoGira(e.target.value)}
              placeholder="Novo tipo de gira"
              className="flex-1 px-3 py-2.5 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-sm placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            />
            <button
              onClick={adicionarTipoGira}
              disabled={!novoTipoGira.trim()}
              className="px-4 py-2.5 bg-purple-500/20 text-purple-300 rounded-xl text-sm font-medium hover:bg-purple-500/30 disabled:opacity-30 active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================= */}
      {/* Configurações gerais */}
      {/* ========================= */}
      <section>
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
          Configurações
        </h2>
        <div className="space-y-3">
          {/* Data-âncora */}
          <div className="bg-surface-800/50 border border-surface-700/30 rounded-xl p-4">
            <label className="block text-sm font-medium text-surface-300 mb-1">
              Data da última gira realizada
            </label>
            <p className="text-xs text-surface-500 mb-2">
              A partir desta data, as giras são calculadas a cada 14 dias
            </p>
            <input
              type="date"
              value={configs.data_ancora_giras || '2026-09-26'}
              onChange={e => setConfigs(c => ({ ...c, data_ancora_giras: e.target.value }))}
              className="w-full px-3 py-2.5 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            />
          </div>

          {/* Nome do terreiro */}
          <div className="bg-surface-800/50 border border-surface-700/30 rounded-xl p-4">
            <label className="block text-sm font-medium text-surface-300 mb-1">
              Nome do terreiro
            </label>
            <input
              type="text"
              value={configs.nome_terreiro || ''}
              onChange={e => setConfigs(c => ({ ...c, nome_terreiro: e.target.value }))}
              placeholder="Ex: Tenda de Umbanda Pai Joaquim de Angola"
              className="w-full px-3 py-2.5 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-sm placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
            />
          </div>

          {/* Atendimento online */}
          <div className="bg-surface-800/50 border border-surface-700/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-300">Atendimento online</p>
              <p className="text-xs text-surface-500">Mostrar opção online na página pública</p>
            </div>
            <button
              onClick={() => setConfigs(c => ({
                ...c,
                atendimento_online_ativo: c.atendimento_online_ativo === 'true' ? 'false' : 'true',
              }))}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                configs.atendimento_online_ativo === 'true' ? 'bg-brand-500' : 'bg-surface-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform shadow ${
                  configs.atendimento_online_ativo === 'true' ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Alerta de Sucesso */}
      {salvoComSucesso && (
        <div className="flex items-center justify-center gap-2 p-3.5 bg-green-500/10 border border-green-500/30 rounded-2xl text-green-400 text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="w-5 h-5 shrink-0 text-green-400" />
          Ajustes salvos com sucesso!
        </div>
      )}

      {/* Botão salvar */}
      <button
        onClick={salvarRegras}
        disabled={salvando}
        className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base active:scale-[0.98] shadow-lg shadow-brand-500/20"
      >
        {salvando ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Salvando alterações...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Salvar ajustes
          </>
        )}
      </button>

      {/* Sair */}
      <button
        onClick={sair}
        className="w-full py-3 bg-surface-800 border border-surface-700/50 text-surface-400 font-medium rounded-xl flex items-center justify-center gap-2 text-sm hover:text-white transition-colors active:scale-[0.98]"
      >
        <LogOut className="w-4 h-4" />
        Sair
      </button>
    </div>
  );
}
