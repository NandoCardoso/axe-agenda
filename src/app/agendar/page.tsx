'use client';

import { useState, useEffect, useId } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  CheckCircle,
  Loader2,
  AlertCircle,
  HeartHandshake,
  Scroll,
  Compass,
  Flame,
  Check,
  Plus,
} from 'lucide-react';
import type { SlotLivre } from '@/lib/types';
import { toSP } from '@/lib/calcular-slots';

const TIPOS_CONSULTA = [
  {
    id: 'baralho_cigano',
    nome: 'Baralho Cigano',
    descricao: 'Orientação oracular e clareza para momentos de decisão',
    tag: 'Presencial e Online',
    Icon: Scroll,
  },
  {
    id: 'buzios_exu',
    nome: 'Búzios — Oráculo de Exú',
    descricao: 'Consulta ancestral aos búzios com firmeza dos guardiões',
    tag: 'Presencial e Online',
    Icon: Compass,
  },
  {
    id: 'trabalhos_espirituais',
    nome: 'Consultas e Trabalhos Espirituais',
    descricao: 'Firmezas para abertura de caminhos, proteção, saúde e harmonia',
    tag: 'Presencial e Online',
    Icon: Flame,
  },
];

const OBJETIVOS_ESPIRITUAIS = [
  'Abertura de caminhos',
  'Sorte',
  'Amor',
  'Saúde',
  'Blindagem espiritual',
  'Proteção',
  'Harmonia',
  'Prosperidade',
];

export default function AgendarPublicPage() {
  const nameId = useId();
  const phoneId = useId();
  const reasonId = useId();
  const [slots, setSlots] = useState<SlotLivre[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Formulário
  const [tipoAtendimento, setTipoAtendimento] = useState<string>('baralho_cigano');
  const [objetivosSelecionados, setObjetivosSelecionados] = useState<string[]>([]);
  const [modalidade, setModalidade] = useState<'presencial' | 'online'>('presencial');
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [slotSelecionado, setSlotSelecionado] = useState<SlotLivre | null>(null);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [motivo, setMotivo] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Buscar slots livres da API
  useEffect(() => {
    async function carregarSlots() {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch('/api/slots');
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao carregar horários disponíveis');
        }

        setSlots(data.slots || []);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Não foi possível carregar os horários disponíveis.');
      } finally {
        setLoading(false);
      }
    }

    carregarSlots();
  }, []);

  // Filtrar slots pela modalidade selecionada
  const slotsFiltrados = slots.filter(
    (s) => s.modalidade === modalidade
  );

  // Agrupar datas disponíveis
  const diasDisponiveisMap = new Map<string, SlotLivre[]>();
  slotsFiltrados.forEach((s) => {
    const dataSP = toSP(s.inicio);
    const dataKey = format(dataSP, 'yyyy-MM-dd');
    const lista = diasDisponiveisMap.get(dataKey) || [];
    lista.push(s);
    diasDisponiveisMap.set(dataKey, lista);
  });

  const diasDisponiveis = Array.from(diasDisponiveisMap.keys()).sort();

  // Se o dia selecionado não tiver mais slots após mudar modalidade, reseta
  useEffect(() => {
    if (diaSelecionado && !diasDisponiveisMap.has(diaSelecionado)) {
      setDiaSelecionado(null);
      setSlotSelecionado(null);
    }
  }, [modalidade, diasDisponiveisMap, diaSelecionado]);

  // Formatar máscara do WhatsApp
  function handlePhoneChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) {
      setWhatsapp(digits);
    } else if (digits.length <= 7) {
      setWhatsapp(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
    } else {
      setWhatsapp(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`);
    }
  }

  function toggleObjetivo(obj: string) {
    setObjetivosSelecionados(prev =>
      prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotSelecionado) {
      setErrorMsg('Por favor, selecione um dia e horário.');
      return;
    }

    if (!nome.trim() || whatsapp.replace(/\D/g, '').length < 10) {
      setErrorMsg('Preencha seu nome e um número de WhatsApp válido.');
      return;
    }

    setEnviando(true);
    setErrorMsg('');

    const tipoObj = TIPOS_CONSULTA.find(t => t.id === tipoAtendimento);
    const tipoNome = tipoObj ? tipoObj.nome : 'Atendimento Espiritual';

    let motivoFinal = motivo.trim();
    if (tipoAtendimento === 'trabalhos_espirituais' && objetivosSelecionados.length > 0) {
      const objetivosStr = `Objetivos: ${objetivosSelecionados.join(', ')}`;
      motivoFinal = motivoFinal ? `${objetivosStr}. ${motivoFinal}` : objetivosStr;
    }

    try {
      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          whatsapp,
          modalidade,
          tipo_atendimento: tipoNome,
          inicio: slotSelecionado.inicio,
          fim: slotSelecionado.fim,
          motivo: motivoFinal || null,
          website_hp: honeypot, // Honeypot
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar solicitação.');
      }

      setSucesso(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao solicitar atendimento.');
    } finally {
      setEnviando(false);
    }
  }

  // TELA DE SUCESSO
  if (sucesso && slotSelecionado) {
    const dataSP = toSP(slotSelecionado.inicio);
    const dataExtenso = format(dataSP, "EEEE, d 'de' MMMM", { locale: ptBR });
    const horaInicio = format(dataSP, 'HH:mm');
    const tipoNome = TIPOS_CONSULTA.find(t => t.id === tipoAtendimento)?.nome || 'Atendimento';

    return (
      <main className="min-h-screen bg-surface-950 text-white flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md bg-surface-900 border border-surface-800 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 space-y-5">
          <div className="w-16 h-16 bg-brand-500/15 border border-brand-500/30 rounded-2xl flex items-center justify-center mx-auto text-brand-400">
            <CheckCircle className="w-9 h-9" />
          </div>

          <div>
            <h1 className="font-serif text-2xl font-medium text-white tracking-wide">Solicitação Recebida</h1>
            <p className="text-surface-300 text-xs leading-relaxed mt-2">
              Saravá, <span className="font-semibold text-white">{nome}</span>. Seu pedido foi encaminhado com respeito e carinho para o <strong className="text-white">Pai de Santo Leandro</strong>.
            </p>
          </div>

          <div className="bg-surface-800/60 border border-surface-700/50 rounded-2xl p-4 text-left space-y-2.5">
            <div className="text-[11px] font-semibold text-brand-400 tracking-wider uppercase">
              {tipoNome}
            </div>
            <div className="flex items-center gap-2.5 text-xs text-surface-200">
              <CalendarIcon className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="capitalize">{dataExtenso}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-surface-200">
              <Clock className="w-4 h-4 text-brand-400 shrink-0" />
              <span>{horaInicio} ({modalidade === 'presencial' ? 'Presencial no Terreiro' : 'Online via Vídeo'})</span>
            </div>
          </div>

          <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl text-xs text-surface-300 text-left space-y-1.5 leading-relaxed">
            <p className="font-semibold text-brand-300">Como funciona a confirmação?</p>
            <p className="text-[11px] text-surface-400">
              O Pai de Santo Leandro avalia a agenda e entrará em contato diretamente no seu WhatsApp para confirmar o horário e passar as orientações para o seu atendimento.
            </p>
          </div>

          <button
            onClick={() => {
              setSucesso(false);
              setSlotSelecionado(null);
              setDiaSelecionado(null);
              setNome('');
              setWhatsapp('');
              setMotivo('');
              setObjetivosSelecionados([]);
            }}
            className="w-full py-3 px-4 bg-surface-800 hover:bg-surface-700 text-surface-200 rounded-xl font-medium text-xs transition-colors"
          >
            Fazer outro agendamento
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-950 text-white pb-20">
      {/* Top Banner / Hero */}
      <header className="border-b border-surface-800/80 px-4 pt-10 pb-8 text-center bg-gradient-to-b from-surface-900/80 to-surface-950">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mx-auto mb-3.5 text-brand-400 shadow-lg shadow-brand-500/5">
          <Flame className="w-6 h-6" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-wide text-white mb-1">
          Atendimento Espiritual
        </h1>
        <p className="font-serif text-xs text-brand-400 tracking-widest uppercase">
          Pai de Santo Leandro
        </p>
        <p className="text-xs text-surface-400 max-w-sm mx-auto mt-3 leading-relaxed">
          Consultas oraculares e trabalhos espirituais com acolhimento, respeito e hora marcada.
        </p>
      </header>

      <div className="max-w-lg mx-auto px-4 mt-6 space-y-6">
        {errorMsg && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* 1. SELEÇÃO DO TIPO DE ATENDIMENTO */}
        <section className="bg-surface-900 border border-surface-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider">
            1. Qual tipo de atendimento você procura?
          </label>
          <div className="space-y-2.5">
            {TIPOS_CONSULTA.map(tipo => {
              const isSelected = tipoAtendimento === tipo.id;
              const IconComponent = tipo.Icon;
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => setTipoAtendimento(tipo.id)}
                  className={`w-full flex items-start gap-3.5 p-3.5 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'bg-brand-500/10 border-brand-500/50 shadow-md ring-1 ring-brand-500/30'
                      : 'bg-surface-800/40 border-surface-700/50 text-surface-300 hover:border-surface-600'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-800 text-surface-400'
                  }`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-white">{tipo.nome}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-surface-800 text-surface-400 border border-surface-700 shrink-0">
                        {tipo.tag}
                      </span>
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{tipo.descricao}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Seletor de objetivos se for trabalhos espirituais */}
          {tipoAtendimento === 'trabalhos_espirituais' && (
            <div className="mt-4 pt-4 border-t border-surface-800">
              <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">
                Objetivos principais do trabalho / consulta:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {OBJETIVOS_ESPIRITUAIS.map(obj => {
                  const sel = objetivosSelecionados.includes(obj);
                  return (
                    <button
                      key={obj}
                      type="button"
                      onClick={() => toggleObjetivo(obj)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                        sel
                          ? 'bg-brand-500 text-white shadow-sm'
                          : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                      }`}
                    >
                      {sel ? <Check className="w-3 h-3 text-white" /> : <Plus className="w-3 h-3 text-surface-400" />}
                      {obj}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 2. SELEÇÃO DE MODALIDADE */}
        <section className="bg-surface-900 border border-surface-800 rounded-2xl p-4 sm:p-5">
          <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
            2. Como prefere realizar a consulta?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setModalidade('presencial')}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                modalidade === 'presencial'
                  ? 'bg-brand-500/10 border-brand-500 text-white shadow-sm'
                  : 'bg-surface-800/40 border-surface-700/50 text-surface-400 hover:border-surface-600'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                modalidade === 'presencial' ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-800 text-surface-500'
              }`}>
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-xs text-white">Presencial</p>
                <p className="text-[11px] text-surface-400">No Terreiro</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setModalidade('online')}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                modalidade === 'online'
                  ? 'bg-brand-500/10 border-brand-500 text-white shadow-sm'
                  : 'bg-surface-800/40 border-surface-700/50 text-surface-400 hover:border-surface-600'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                modalidade === 'online' ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-800 text-surface-500'
              }`}>
                <Video className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-xs text-white">Online</p>
                <p className="text-[11px] text-surface-400">Vídeo chamada</p>
              </div>
            </button>
          </div>
        </section>

        {/* 3. SELEÇÃO DE DIA */}
        <section className="bg-surface-900 border border-surface-800 rounded-2xl p-4 sm:p-5">
          <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
            3. Escolha o dia
          </label>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
            </div>
          ) : diasDisponiveis.length === 0 ? (
            <div className="py-6 text-center text-surface-500 text-xs">
              Não há dias disponíveis no momento. Por favor, tente novamente mais tarde.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {diasDisponiveis.map((diaStr) => {
                const diaDate = parseISO(diaStr);
                const diaSemana = format(diaDate, 'EEE', { locale: ptBR });
                const diaNum = format(diaDate, 'd');
                const mesNome = format(diaDate, 'MMM', { locale: ptBR });
                const isSelected = diaSelecionado === diaStr;

                return (
                  <button
                    key={diaStr}
                    type="button"
                    onClick={() => {
                      setDiaSelecionado(diaStr);
                      setSlotSelecionado(null);
                    }}
                    className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-brand-500 text-white border-brand-400 shadow-md scale-[1.02]'
                        : 'bg-surface-800/50 border-surface-700/50 text-surface-300 hover:border-surface-600'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold opacity-75">{diaSemana}</span>
                    <span className="text-lg font-bold my-0.5">{diaNum}</span>
                    <span className="text-[10px] capitalize opacity-75">{mesNome}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. SELEÇÃO DE HORÁRIO */}
        {diaSelecionado && (
          <section className="bg-surface-900 border border-surface-800 rounded-2xl p-4 sm:p-5 animate-in fade-in duration-200">
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
              4. Horários para {format(parseISO(diaSelecionado), "d 'de' MMMM", { locale: ptBR })}
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(diasDisponiveisMap.get(diaSelecionado) || []).map((slot, idx) => {
                const dataInicioSP = toSP(slot.inicio);
                const horaStr = format(dataInicioSP, 'HH:mm');
                const isSelected =
                  slotSelecionado?.inicio === slot.inicio && slotSelecionado?.fim === slot.fim;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSlotSelecionado(slot)}
                    className={`py-3 px-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-brand-500 text-white border-brand-400 shadow-md'
                        : 'bg-surface-800/40 border-surface-700/50 text-surface-300 hover:border-brand-500/30'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 opacity-60" />
                    {horaStr}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. DADOS DO CONSULENTE */}
        {slotSelecionado && (
          <form
            onSubmit={handleSubmit}
            className="bg-surface-900 border border-surface-800 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200"
          >
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
              5. Seus dados para contato
            </label>

            {/* Honeypot field contra robôs */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website_hp">Não preencha este campo</label>
              <input
                type="text"
                id="website_hp"
                name="website_hp"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor={nameId} className="block text-xs text-surface-300 font-medium mb-1">
                Seu nome completo *
              </label>
              <input
                id={nameId}
                type="text"
                required
                placeholder="Como prefere ser chamado(a)?"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 bg-surface-950 border border-surface-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor={phoneId} className="block text-xs text-surface-300 font-medium mb-1">
                WhatsApp com DDD *
              </label>
              <input
                id={phoneId}
                type="tel"
                required
                placeholder="(11) 98765-4321"
                value={whatsapp}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full px-4 py-3 bg-surface-950 border border-surface-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="text-[11px] text-surface-500 mt-1">
                Usado pelo Pai Leandro para confirmar o horário e passar as orientações da consulta.
              </p>
            </div>

            <div>
              <label htmlFor={reasonId} className="block text-xs text-surface-300 font-medium mb-1">
                Detalhes ou observações adicionais <span className="text-surface-500">(opcional)</span>
              </label>
              <textarea
                id={reasonId}
                rows={2}
                maxLength={250}
                placeholder="Conte brevemente o que deseja trazer para a consulta..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-4 py-3 bg-surface-950 border border-surface-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando solicitação...
                </>
              ) : (
                <>
                  <HeartHandshake className="w-5 h-5" />
                  Solicitar Consulta com Pai Leandro
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
