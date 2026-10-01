'use client';

import { useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fromZonedTime } from 'date-fns-tz';
import { X, Trash2, MoveRight, Edit3, Loader2 } from 'lucide-react';
import type { Evento, ExcecaoEvento } from '@/lib/types';

const TZ = 'America/Sao_Paulo';

interface Props {
  evento: Evento;
  inicioExpandido: Date; // Data expandida (em SP)
  fimExpandido: Date;
  tiposGira: Record<string, string>;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EventoDetalheModal({
  evento,
  inicioExpandido,
  fimExpandido,
  tiposGira,
  onClose,
  onUpdate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [modoMover, setModoMover] = useState(false);
  const [novaData, setNovaData] = useState(format(inicioExpandido, 'yyyy-MM-dd'));
  const [novaHora, setNovaHora] = useState(format(inicioExpandido, 'HH:mm'));
  const [subtipoSelecionado, setSubtipoSelecionado] = useState(evento.subtipo || '');

  const supabase = createClient();
  const isGira = evento.tipo === 'gira';
  const isRecorrente = !!evento.rrule;
  const dataOriginal = format(inicioExpandido, 'yyyy-MM-dd');

  async function cancelarOcorrencia() {
    setLoading(true);

    if (isSupabaseConfigured()) {
      try {
        if (isRecorrente) {
          const excecoes: ExcecaoEvento[] = [
            ...evento.excecoes,
            { data_original: dataOriginal, acao: 'cancelar' },
          ];
          await supabase.from('eventos').update({ excecoes }).eq('id', evento.id);
        } else {
          await supabase.from('eventos').delete().eq('id', evento.id);
        }
      } catch {}
    } else {
      try {
        const extra = JSON.parse(localStorage.getItem('axe_eventos_extra') || '[]');
        const filtered = extra.filter((e: any) => e.id !== evento.id);
        localStorage.setItem('axe_eventos_extra', JSON.stringify(filtered));
      } catch {}
    }

    setLoading(false);
    onUpdate();
  }

  async function moverOcorrencia() {
    setLoading(true);

    const durMin = (fimExpandido.getTime() - inicioExpandido.getTime()) / 60000;
    const novoInicio = fromZonedTime(new Date(`${novaData}T${novaHora}:00`), TZ);
    const novoFim = new Date(novoInicio.getTime() + durMin * 60000);

    if (isSupabaseConfigured()) {
      try {
        if (isRecorrente) {
          const excecoes: ExcecaoEvento[] = [
            ...evento.excecoes.filter(e => e.data_original !== dataOriginal),
            {
              data_original: dataOriginal,
              acao: 'mover',
              novo_inicio: novoInicio.toISOString(),
              novo_fim: novoFim.toISOString(),
            },
          ];
          await supabase.from('eventos').update({ excecoes }).eq('id', evento.id);
        } else {
          await supabase.from('eventos').update({
            inicio: novoInicio.toISOString(),
            fim: novoFim.toISOString(),
          }).eq('id', evento.id);
        }
      } catch {}
    }

    setLoading(false);
    onUpdate();
  }

  async function alterarTipoGira() {
    setLoading(true);

    if (isSupabaseConfigured()) {
      try {
        if (isRecorrente) {
          const excecoes: ExcecaoEvento[] = [
            ...evento.excecoes.filter(e => e.data_original !== dataOriginal),
            {
              data_original: dataOriginal,
              acao: 'editar',
              subtipo: subtipoSelecionado,
            },
          ];
          await supabase.from('eventos').update({ excecoes }).eq('id', evento.id);
        } else {
          await supabase.from('eventos').update({ subtipo: subtipoSelecionado }).eq('id', evento.id);
        }
      } catch {}
    }

    setLoading(false);
    onUpdate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-surface-800 rounded-t-3xl sm:rounded-2xl border border-surface-700/50 p-6 pb-safe">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            {isGira ? (tiposGira[evento.subtipo || ''] || 'Gira') : (evento.titulo || 'Bloqueio')}
          </h2>
          <button onClick={onClose} className="p-2 -m-2 text-surface-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info */}
        <div className="bg-surface-900/50 rounded-xl p-3 mb-4">
          <p className="text-sm text-surface-300 capitalize">
            {format(inicioExpandido, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="text-sm text-surface-400">
            {evento.dia_inteiro
              ? 'Dia inteiro'
              : `${format(inicioExpandido, 'HH:mm')} - ${format(fimExpandido, 'HH:mm')}`}
          </p>
          {isRecorrente && (
            <p className="text-xs text-brand-400 mt-1">Evento recorrente</p>
          )}
        </div>

        {/* Tipo da gira (se for gira) */}
        {isGira && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-surface-300 mb-2">
              Tipo da gira
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(tiposGira).map(([id, nome]) => (
                <button
                  key={id}
                  onClick={() => setSubtipoSelecionado(id)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                    subtipoSelecionado === id
                      ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                      : 'bg-surface-700/50 border border-surface-600/30 text-surface-300 hover:border-surface-500/50'
                  }`}
                >
                  {nome}
                </button>
              ))}
            </div>
            {subtipoSelecionado !== evento.subtipo && (
              <button
                onClick={alterarTipoGira}
                disabled={loading}
                className="mt-2 w-full py-2.5 bg-purple-500/20 text-purple-300 font-medium rounded-xl text-sm hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                Salvar tipo
              </button>
            )}
          </div>
        )}

        {/* Mover */}
        {modoMover ? (
          <div className="mb-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-surface-400 mb-1">Nova data</label>
                <input
                  type="date"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              {!evento.dia_inteiro && (
                <div className="flex-1">
                  <label className="block text-xs text-surface-400 mb-1">Horário</label>
                  <input
                    type="time"
                    value={novaHora}
                    onChange={(e) => setNovaHora(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setModoMover(false)}
                className="flex-1 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={moverOcorrencia}
                disabled={loading}
                className="flex-1 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mover'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setModoMover(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-700/50 border border-surface-600/30 rounded-xl text-sm font-medium text-surface-300 hover:border-surface-500/50 transition-colors active:scale-[0.98]"
            >
              <MoveRight className="w-4 h-4" />
              Mover
            </button>
            <button
              onClick={cancelarOcorrencia}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isRecorrente ? 'Cancelar este' : 'Excluir'}
            </button>
          </div>
        )}

        {isRecorrente && !modoMover && (
          <p className="text-xs text-surface-500 text-center">
            Ações afetam apenas esta ocorrência, não as demais
          </p>
        )}
      </div>
    </div>
  );
}
