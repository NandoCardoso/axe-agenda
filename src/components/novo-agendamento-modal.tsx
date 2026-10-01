'use client';

import { useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addMinutes, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X,
  Loader2,
  Calendar,
  Clock,
  User,
  Phone,
  MessageSquare,
  CheckCircle,
  ExternalLink,
  Briefcase,
  AlertTriangle,
  Scroll,
  Compass,
  Flame,
  Sun,
  Layers,
} from 'lucide-react';
import { getStatusEscala12x36, ESCALA_PADRAO, type Escala12x36Config } from '@/lib/escala-clt';
import type { ModalidadeTipo } from '@/lib/types';

const TZ = 'America/Sao_Paulo';

const TIPOS_CONSULTA = [
  {
    id: 'baralho_cigano',
    nome: 'Baralho Cigano',
    IconComponent: Scroll,
    subtitulo: 'Presencial e Online',
  },
  {
    id: 'buzios_exu',
    nome: 'Búzios — Oráculo de Exú',
    IconComponent: Compass,
    subtitulo: 'Presencial e Online',
  },
  {
    id: 'trabalhos_espirituais',
    nome: 'Consultas e Trabalhos Espirituais',
    IconComponent: Flame,
    subtitulo: 'Abertura de caminhos, saúde, proteção e harmonia',
  },
];

interface Props {
  onClose: () => void;
  onSave: () => void;
  initialDate?: string; // YYYY-MM-DD
}

export default function NovoAgendamentoModal({ onClose, onSave, initialDate }: Props) {
  const [data, setData] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [horaInicio, setHoraInicio] = useState('14:00');
  const [duracaoMin, setDuracaoMin] = useState(60);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [modalidade, setModalidade] = useState<ModalidadeTipo>('presencial');
  const [tipoConsulta, setTipoConsulta] = useState('baralho_cigano');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [linkWhatsApp, setLinkWhatsApp] = useState<string | null>(null);

  // Escala CLT
  const [escalaConfig] = useState<Escala12x36Config>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('axe_escala_clt');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return ESCALA_PADRAO;
  });

  const supabase = createClient();

  // Verificar status de CLT para a data selecionada
  const dataSelecionadaParsed = parseISO(data);
  const isPlantaoCLT = getStatusEscala12x36(dataSelecionadaParsed, escalaConfig) === 'trabalho';

  function formatPhone(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function handlePhoneChange(v: string) {
    setWhatsapp(formatPhone(v));
  }

  async function salvar() {
    if (!nome.trim()) return;
    setLoading(true);

    const [hh, mm] = horaInicio.split(':').map(Number);
    const inicioSP = new Date(
      dataSelecionadaParsed.getFullYear(),
      dataSelecionadaParsed.getMonth(),
      dataSelecionadaParsed.getDate(),
      hh,
      mm
    );
    const fimSP = addMinutes(inicioSP, duracaoMin);

    const inicioUTC = fromZonedTime(inicioSP, TZ).toISOString();
    const fimUTC = fromZonedTime(fimSP, TZ).toISOString();

    const tipoNome = TIPOS_CONSULTA.find(t => t.id === tipoConsulta)?.nome || 'Consulta Espiritual';
    const titulo = `${nome.trim()} — ${tipoNome}`;

    // 1. Gravar no Supabase (se configurado)
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('eventos').insert({
          tipo: 'atendimento',
          titulo,
          inicio: inicioUTC,
          fim: fimUTC,
          dia_inteiro: false,
          observacao: observacao.trim() ? `[${tipoNome}] ${observacao.trim()}` : `[${tipoNome}]`,
        });

        if (error) console.error('Erro ao salvar no Supabase:', error);
      } catch (err) {
        console.error('Falha de rede ao salvar no Supabase:', err);
      }
    }

    // 2. Gravar no localStorage para persistência de teste/offline imediata
    try {
      const extraEventos = JSON.parse(localStorage.getItem('axe_eventos_extra') || '[]');
      extraEventos.push({
        id: `direto_${Date.now()}`,
        tipo: 'atendimento',
        titulo,
        inicio: inicioUTC,
        fim: fimUTC,
        dia_inteiro: false,
        observacao: observacao.trim() ? `[${tipoNome}] ${observacao.trim()}` : `[${tipoNome}]`,
      });
      localStorage.setItem('axe_eventos_extra', JSON.stringify(extraEventos));

      // Também grava como solicitação já aprovada para aparecer na lista de pedidos
      const extraSolicitacoes = JSON.parse(localStorage.getItem('axe_solicitacoes_extra') || '[]');
      extraSolicitacoes.push({
        id: `solic_${Date.now()}`,
        nome: nome.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        inicio: inicioUTC,
        fim: fimUTC,
        modalidade,
        observacao: observacao.trim() ? `[${tipoNome}] ${observacao.trim()}` : `[${tipoNome}]`,
        status: 'aprovada',
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('axe_solicitacoes_extra', JSON.stringify(extraSolicitacoes));
    } catch {}

    // 3. Montar link do WhatsApp caso tenha número
    const cleanDigits = whatsapp.replace(/\D/g, '');
    if (cleanDigits.length >= 10) {
      const phoneComDDI = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
      const dataFormatada = format(inicioSP, "EEEE, d 'de' MMMM", { locale: ptBR });
      const horaFormatada = format(inicioSP, 'HH:mm');

      const msg = encodeURIComponent(
        `Olá ${nome.trim()}! Axé!\n\n` +
        `Sua consulta com o Pai de Santo Leandro está agendada e confirmada:\n\n` +
        `*Data:* ${dataFormatada}\n` +
        `*Horário:* ${horaFormatada}\n` +
        `*Atendimento:* ${tipoNome}\n` +
        `*Modalidade:* ${modalidade === 'presencial' ? 'Presencial no Terreiro' : 'Online via Vídeo'}\n\n` +
        `Que os Guias e Orixás abençoem seus caminhos. Até breve!`
      );
      setLinkWhatsApp(`https://wa.me/${phoneComDDI}?text=${msg}`);
    }

    setLoading(false);
    setSucesso(true);
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-surface-900 border border-surface-700/60 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-white tracking-wide">Novo Agendamento Direto</h3>
              <p className="text-xs text-surface-400">Marque diretamente para o consulente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-surface-400 hover:text-white rounded-xl hover:bg-surface-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sucesso ? (
          /* Estado de Sucesso com Ação WhatsApp */
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-serif font-bold text-white">Atendimento Confirmado</h4>
              <p className="text-xs text-surface-400 max-w-xs mx-auto mt-1">
                O horário foi reservado com sucesso e protegido no calendário litúrgico.
              </p>
            </div>

            {linkWhatsApp ? (
              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                <MessageSquare className="w-4 h-4" />
                Enviar Confirmação no WhatsApp
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : null}

            <button
              onClick={onClose}
              className="w-full py-3 bg-surface-800 hover:bg-surface-700 text-surface-300 font-medium rounded-xl text-sm transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          /* Formulário de Agendamento */
          <div className="space-y-4 text-xs">
            {/* Nome do Consulente */}
            <div>
              <label className="block text-surface-300 font-medium mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-400" />
                Nome do Consulente *
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Maria Aparecida"
                className="w-full px-3 py-2.5 bg-surface-950 border border-surface-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-surface-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-brand-400" />
                WhatsApp (para envio de confirmação)
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3 py-2.5 bg-surface-950 border border-surface-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Tipo de Consulta */}
            <div>
              <label className="block text-surface-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-400" />
                Tipo de Atendimento
              </label>
              <div className="space-y-2">
                {TIPOS_CONSULTA.map(tipo => {
                  const Icon = tipo.IconComponent;
                  const isSelected = tipoConsulta === tipo.id;
                  return (
                    <button
                      key={tipo.id}
                      type="button"
                      onClick={() => setTipoConsulta(tipo.id)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                        isSelected
                          ? 'bg-brand-500/15 border-brand-500/70 text-white'
                          : 'bg-surface-800/40 border-surface-700/50 text-surface-300 hover:border-surface-600'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
                            : 'bg-surface-800 text-surface-400 border-surface-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs text-white">{tipo.nome}</p>
                        <p className="text-[11px] text-surface-400 truncate">{tipo.subtitulo}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modalidade */}
            <div>
              <label className="block text-surface-300 font-medium mb-1.5">Modalidade</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalidade('presencial')}
                  className={`py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    modalidade === 'presencial'
                      ? 'bg-brand-500/20 text-brand-300 border-brand-500/60'
                      : 'bg-surface-800/40 text-surface-400 border-surface-700/60 hover:text-white'
                  }`}
                >
                  Presencial no Terreiro
                </button>
                <button
                  type="button"
                  onClick={() => setModalidade('online')}
                  className={`py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    modalidade === 'online'
                      ? 'bg-brand-500/20 text-brand-300 border-brand-500/60'
                      : 'bg-surface-800/40 text-surface-400 border-surface-700/60 hover:text-white'
                  }`}
                >
                  Online (Vídeo)
                </button>
              </div>
            </div>

            {/* Data e Alerta de Escala CLT */}
            <div>
              <label className="block text-surface-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                Data da Consulta
              </label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full px-3 py-2 bg-surface-950 border border-surface-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              />

              {/* Badge indicativo da escala */}
              <div className="mt-2">
                {isPlantaoCLT ? (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-amber-300 text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      <strong>Atenção:</strong> Dia previsto de <strong>Plantão</strong> do Pai Leandro. Verifique sua disponibilidade antes de confirmar.
                    </span>
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-[11px]">
                    <Sun className="w-3.5 h-3.5 shrink-0" />
                    <span>Dia de <strong>Folga</strong> (Disponível para atendimentos)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Horário de Início e Duração */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-surface-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  Horário de Início
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={e => setHoraInicio(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-surface-300 font-medium mb-1.5">Duração (min)</label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={duracaoMin}
                  onChange={e => setDuracaoMin(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-surface-300 font-medium mb-1.5">
                Observações Espirituais / Motivo
              </label>
              <textarea
                rows={2}
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Ex: Pedido de abertura de caminhos; orientação para família..."
                className="w-full px-3 py-2 bg-surface-950 border border-surface-700/80 rounded-xl text-white text-xs placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Botão de Envio */}
            <button
              onClick={salvar}
              disabled={loading || !nome.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-brand-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gravando agendamento...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirmar Agendamento
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
