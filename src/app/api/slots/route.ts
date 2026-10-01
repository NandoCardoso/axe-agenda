import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase, isSupabaseConfigured } from '@/lib/supabase/server';
import { calcularSlotsDisponiveis } from '@/lib/calcular-slots';
import { ESCALA_PADRAO, type Escala12x36Config } from '@/lib/escala-clt';
import { format, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { RegraDisponibilidade, Evento } from '@/lib/types';
import { MOCK_REGRAS, MOCK_EVENTOS } from '@/lib/mock-data';

const TZ = 'America/Sao_Paulo';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hojeSP = toZonedTime(new Date(), TZ);

    // Default: próximos 14 dias se não especificado
    const dataInicioParam = searchParams.get('inicio') || format(hojeSP, 'yyyy-MM-dd');
    const dataFimParam = searchParams.get('fim') || format(addDays(hojeSP, 14), 'yyyy-MM-dd');

    // 1. Carregar regras de disponibilidade ativas (com fallback para modo local/demo)
    let regras: RegraDisponibilidade[] = MOCK_REGRAS;
    let eventos: Evento[] = MOCK_EVENTOS;
    let antecedenciaMinimaHoras = 24;

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createServiceSupabase();
        const { data: regrasData, error: regrasErr } = await supabase
          .from('regras_disponibilidade')
          .select('*')
          .eq('ativo', true);

        if (!regrasErr && regrasData && regrasData.length > 0) {
          regras = regrasData as RegraDisponibilidade[];
        }

        const { data: eventosData, error: eventosErr } = await supabase
          .from('eventos')
          .select('*');

        if (!eventosErr && eventosData && eventosData.length > 0) {
          eventos = eventosData as Evento[];
        }

        const { data: configsData } = await supabase
          .from('configuracoes')
          .select('chave, valor');

        if (configsData) {
          const configs: Record<string, string> = {};
          configsData.forEach((c: { chave: string; valor: string }) => {
            configs[c.chave] = c.valor;
          });
          if (configs['antecedencia_minima_horas']) {
            antecedenciaMinimaHoras = parseInt(configs['antecedencia_minima_horas'], 10);
          }
        }
      } catch {}
    }

    // 4. Configuração da escala 12x36
    const escala12x36: Escala12x36Config = {
      ativa: true,
      data_ancora_trabalho: '2026-10-01',
      bloquear_atendimentos: true,
    };

    // 5. Calcular slots livres usando a função testada com bloqueio CLT
    const slots = calcularSlotsDisponiveis({
      dataInicio: dataInicioParam,
      dataFim: dataFimParam,
      regras,
      eventos,
      antecedenciaMinimaHoras,
      agora: hojeSP,
      escala12x36,
    });

    // Retorna apenas horários livres. NENHUM evento ou dado privado é retornado.
    return NextResponse.json({
      slots,
      intervalo: {
        inicio: dataInicioParam,
        fim: dataFimParam,
      },
    });
  } catch (error) {
    console.error('Erro no cálculo de slots:', error);
    return NextResponse.json({ error: 'Falha interna ao calcular horários' }, { status: 500 });
  }
}
