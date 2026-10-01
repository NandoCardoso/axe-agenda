'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toSP } from '@/lib/calcular-slots';
import {
  Check,
  X,
  Clock,
  MessageCircle,
  Loader2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import type { Solicitacao } from '@/lib/types';
import { MOCK_SOLICITACOES } from '@/lib/mock-data';
import { fromZonedTime } from 'date-fns-tz';

const TZ = 'America/Sao_Paulo';

type Filtro = 'pendente' | 'aprovada' | 'recusada' | 'todos';

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Solicitacao[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('pendente');
  const [loading, setLoading] = useState(true);
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Record<string, string>>({});
  const [expandido, setExpandido] = useState<string | null>(null);

  const supabase = createClient();

  const carregarPedidos = useCallback(async () => {
    setLoading(true);
    if (isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('solicitacoes')
          .select('*')
          .order('created_at', { ascending: false });

        if (filtro !== 'todos') {
          query = query.eq('status', filtro);
        }

        const { data, error } = await query.limit(50);
        if (!error && data && data.length > 0) {
          setPedidos(data as Solicitacao[]);
        } else {
          const mockFiltrado = filtro === 'todos' ? MOCK_SOLICITACOES : MOCK_SOLICITACOES.filter(s => s.status === filtro);
          setPedidos(mockFiltrado);
        }
      } catch {
        const mockFiltrado = filtro === 'todos' ? MOCK_SOLICITACOES : MOCK_SOLICITACOES.filter(s => s.status === filtro);
        setPedidos(mockFiltrado);
      }
    } else {
      let base = MOCK_SOLICITACOES;
      try {
        const extra = JSON.parse(localStorage.getItem('axe_solicitacoes_extra') || '[]');
        if (Array.isArray(extra) && extra.length > 0) {
          base = [...extra, ...base];
        }
      } catch {}
      const mockFiltrado = filtro === 'todos' ? base : base.filter(s => s.status === filtro);
      setPedidos(mockFiltrado);
    }
    setLoading(false);
  }, [supabase, filtro]);

  useEffect(() => {
    carregarPedidos();
  }, [carregarPedidos]);

  async function aprovar(pedido: Solicitacao) {
    setAcaoLoading(pedido.id);

    // 1. Atualizar status
    await supabase
      .from('solicitacoes')
      .update({
        status: 'aprovada',
        resposta: resposta[pedido.id] || null,
      })
      .eq('id', pedido.id);

    // 2. Criar evento de atendimento
    await supabase.from('eventos').insert({
      tipo: 'atendimento',
      titulo: `Atendimento - ${pedido.nome}`,
      subtipo: null,
      inicio: pedido.inicio,
      fim: pedido.fim,
      dia_inteiro: false,
      rrule: null,
      excecoes: [],
      solicitacao_id: pedido.id,
    });

    setAcaoLoading(null);
    carregarPedidos();
  }

  async function recusar(pedido: Solicitacao) {
    setAcaoLoading(pedido.id);

    await supabase
      .from('solicitacoes')
      .update({
        status: 'recusada',
        resposta: resposta[pedido.id] || null,
      })
      .eq('id', pedido.id);

    setAcaoLoading(null);
    carregarPedidos();
  }

  function extrairTipo(obs?: string | null): string {
    if (!obs) return 'Consulta espiritual';
    const match = obs.match(/^\[(.*?)\]/);
    return match ? match[1] : 'Consulta espiritual';
  }

  function extrairMotivoLimpo(obs?: string | null): string {
    if (!obs) return '';
    return obs.replace(/^\[.*?\]\s*/, '');
  }

  function montarLinkWhatsApp(pedido: Solicitacao, tipo: 'aprovado' | 'recusado' | 'outro_horario') {
    const dataSP = toSP(pedido.inicio);
    const dataFormatada = format(dataSP, "d 'de' MMMM", { locale: ptBR });
    const horaFormatada = format(dataSP, 'HH:mm');
    const numero = pedido.whatsapp.replace(/\D/g, '');
    const tipoConsulta = extrairTipo(pedido.observacao);

    let msg = '';
    if (tipo === 'aprovado') {
      msg = `Olá ${pedido.nome}! Aqui é o Pai de Santo Leandro. Sua consulta de ${tipoConsulta} está confirmada para ${dataFormatada} às ${horaFormatada}. Axé e até lá!`;
    } else if (tipo === 'recusado') {
      const motivo = resposta[pedido.id] ? ` Motivo: ${resposta[pedido.id]}` : '';
      msg = `Olá ${pedido.nome}! Aqui é o Pai de Santo Leandro. Infelizmente não será possível atender no horário solicitado para ${tipoConsulta} (${dataFormatada} às ${horaFormatada}).${motivo} Se desejar, fique à vontade para escolher outro horário na nossa agenda.`;
    } else {
      msg = `Olá ${pedido.nome}! Aqui é o Pai de Santo Leandro sobre seu pedido de ${tipoConsulta} para ${dataFormatada} às ${horaFormatada}. Gostaria de sugerir outro horário disponível. Que tal `;
    }

    return `https://wa.me/55${numero}?text=${encodeURIComponent(msg)}`;
  }

  const filtros: { label: string; value: Filtro }[] = [
    { label: 'Pendentes', value: 'pendente' },
    { label: 'Aprovados', value: 'aprovada' },
    { label: 'Recusados', value: 'recusada' },
    { label: 'Todos', value: 'todos' },
  ];

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-white mb-4">Pedidos de atendimento</h1>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {filtros.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 ${
              filtro === f.value
                ? 'bg-brand-500 text-white'
                : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            {f.label}
            {f.value === 'pendente' && pedidos.filter(p => p.status === 'pendente').length > 0 && filtro !== 'pendente' && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {pedidos.filter(p => p.status === 'pendente').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="bg-surface-800/50 rounded-xl p-8 text-center text-surface-500 text-sm">
          Nenhum pedido {filtro !== 'todos' ? filtro : ''}
        </div>
      ) : (
        <div className="space-y-3 pb-20">
          {pedidos.map(pedido => {
            const isExpandido = expandido === pedido.id;
            const isPendente = pedido.status === 'pendente';
            const dataSP = toSP(pedido.inicio);

            return (
              <div
                key={pedido.id}
                className="bg-surface-800/50 border border-surface-700/30 rounded-xl overflow-hidden"
              >
                {/* Cabeçalho */}
                <button
                  onClick={() => setExpandido(isExpandido ? null : pedido.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">
                        {pedido.nome}
                      </p>
                      <span className="px-2 py-0.5 bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] font-bold rounded-full">
                        {extrairTipo(pedido.observacao)}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        pedido.status === 'pendente'
                          ? 'bg-amber-500/20 text-amber-400'
                          : pedido.status === 'aprovada'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                      }`}>
                        {pedido.status === 'pendente' ? 'Pendente' : pedido.status === 'aprovada' ? 'Aprovado' : 'Recusado'}
                      </span>
                    </div>
                    <p className="text-xs text-surface-400 capitalize mt-0.5">
                      {format(dataSP, "EEE, d 'de' MMM · HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-surface-500 transition-transform ${isExpandido ? 'rotate-180' : ''}`} />
                </button>

                {/* Detalhes expandidos */}
                {isExpandido && (
                  <div className="px-4 pb-4 space-y-3 border-t border-surface-700/30 pt-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-surface-500">WhatsApp</span>
                        <p className="text-surface-200">{pedido.whatsapp}</p>
                      </div>
                      <div>
                        <span className="text-xs text-surface-500">Modalidade</span>
                        <p className="text-surface-200 capitalize">{pedido.modalidade}</p>
                      </div>
                    </div>

                    {pedido.observacao && (
                      <div>
                        <span className="text-xs text-surface-500">Tipo & Observação</span>
                        <p className="text-sm text-surface-300 mt-0.5">{extrairMotivoLimpo(pedido.observacao) || pedido.observacao}</p>
                      </div>
                    )}

                    {pedido.resposta && (
                      <div className="bg-surface-900/50 rounded-lg p-2">
                        <span className="text-xs text-surface-500">Sua resposta</span>
                        <p className="text-sm text-surface-300">{pedido.resposta}</p>
                      </div>
                    )}

                    {/* Ações para pendentes */}
                    {isPendente && (
                      <>
                        <div>
                          <label className="block text-xs text-surface-500 mb-1">
                            Mensagem <span className="text-surface-600">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={resposta[pedido.id] || ''}
                            onChange={(e) => setResposta(r => ({ ...r, [pedido.id]: e.target.value }))}
                            placeholder="Ex: Traga uma vela branca"
                            className="w-full px-3 py-2.5 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-sm placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => aprovar(pedido)}
                            disabled={acaoLoading === pedido.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-green-500/20 border border-green-500/30 text-green-400 font-medium rounded-xl text-sm hover:bg-green-500/30 disabled:opacity-50 active:scale-[0.98]"
                          >
                            {acaoLoading === pedido.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Aprovar
                          </button>
                          <button
                            onClick={() => recusar(pedido)}
                            disabled={acaoLoading === pedido.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-medium rounded-xl text-sm hover:bg-red-500/20 disabled:opacity-50 active:scale-[0.98]"
                          >
                            <X className="w-4 h-4" />
                            Recusar
                          </button>
                        </div>
                      </>
                    )}

                    {/* Botão WhatsApp */}
                    <a
                      href={montarLinkWhatsApp(
                        pedido,
                        pedido.status === 'aprovada' ? 'aprovado' : pedido.status === 'recusada' ? 'recusado' : 'outro_horario'
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 font-medium rounded-xl text-sm hover:bg-emerald-600/30 transition-colors w-full active:scale-[0.98]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {pedido.status === 'pendente' ? 'Sugerir outro horário' : 'Enviar mensagem'}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


