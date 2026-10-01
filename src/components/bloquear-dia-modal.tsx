'use client';

import { useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { fromZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';
import { X, Loader2 } from 'lucide-react';

const TZ = 'America/Sao_Paulo';

interface Props {
  onClose: () => void;
  onSave: () => void;
  initialDate?: string; // YYYY-MM-DD
}

export default function BloquearDiaModal({ onClose, onSave, initialDate }: Props) {
  const [data, setData] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [titulo, setTitulo] = useState('');
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('18:00');
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function salvar() {
    setLoading(true);

    let inicio: string;
    let fim: string;

    if (diaInteiro) {
      // Dia inteiro: 00:00 até 00:00 do dia seguinte (em SP)
      const dataObj = new Date(data + 'T00:00:00');
      inicio = fromZonedTime(dataObj, TZ).toISOString();
      fim = fromZonedTime(addDays(dataObj, 1), TZ).toISOString();
    } else {
      inicio = fromZonedTime(new Date(`${data}T${horaInicio}:00`), TZ).toISOString();
      fim = fromZonedTime(new Date(`${data}T${horaFim}:00`), TZ).toISOString();
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('eventos').insert({
          tipo: 'bloqueio_pessoal',
          titulo: titulo.trim() || null,
          subtipo: null,
          inicio,
          fim,
          dia_inteiro: diaInteiro,
          rrule: null,
          excecoes: [],
        });
      } catch {}
    }

    try {
      const extra = JSON.parse(localStorage.getItem('axe_eventos_extra') || '[]');
      extra.push({
        id: `blk-${Date.now()}`,
        tipo: 'bloqueio_pessoal',
        titulo: titulo.trim() || 'Bloqueio pessoal',
        subtipo: null,
        inicio,
        fim,
        dia_inteiro: diaInteiro,
        rrule: null,
        excecoes: [],
        solicitacao_id: null,
      });
      localStorage.setItem('axe_eventos_extra', JSON.stringify(extra));
    } catch {}

    setLoading(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-surface-800 rounded-t-3xl sm:rounded-2xl border border-surface-700/50 p-6 pb-safe animate-in slide-in-from-bottom duration-200">
        {/* Handle + Close */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Bloquear dia</h2>
          <button onClick={onClose} className="p-2 -m-2 text-surface-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Data */}
          <div>
            <label htmlFor="blk-data" className="block text-sm font-medium text-surface-300 mb-1">
              Qual dia?
            </label>
            <input
              id="blk-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full px-4 py-3 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {/* Título opcional */}
          <div>
            <label htmlFor="blk-titulo" className="block text-sm font-medium text-surface-300 mb-1">
              Motivo <span className="text-surface-500">(opcional)</span>
            </label>
            <input
              id="blk-titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Aniversário da filha"
              maxLength={100}
              className="w-full px-4 py-3 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white placeholder:text-surface-500 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {/* Dia inteiro toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-surface-300">Dia inteiro</span>
            <button
              onClick={() => setDiaInteiro(!diaInteiro)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                diaInteiro ? 'bg-brand-500' : 'bg-surface-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform shadow ${
                  diaInteiro ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* Horários (se não dia inteiro) */}
          {!diaInteiro && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="blk-hora-ini" className="block text-sm font-medium text-surface-300 mb-1">
                  Das
                </label>
                <input
                  id="blk-hora-ini"
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="blk-hora-fim" className="block text-sm font-medium text-surface-300 mb-1">
                  Até
                </label>
                <input
                  id="blk-hora-fim"
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-900/50 border border-surface-600/50 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
          )}

          {/* Salvar */}
          <button
            onClick={salvar}
            disabled={loading || !data}
            className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base mt-2 active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Salvar bloqueio'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

