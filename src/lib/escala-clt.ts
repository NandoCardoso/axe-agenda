import { differenceInCalendarDays, parseISO } from 'date-fns';

export interface Escala12x36Config {
  ativa: boolean;
  data_ancora_trabalho: string; // Ex: '2026-10-01' (dia em que trabalha)
  bloquear_atendimentos: boolean;
  excecoes_folga?: string[]; // Datas YYYY-MM-DD que eram trabalho mas viraram folga (troca de plantão)
  excecoes_trabalho?: string[]; // Datas YYYY-MM-DD que eram folga mas viraram trabalho
}

export const ESCALA_PADRAO: Escala12x36Config = {
  ativa: true,
  data_ancora_trabalho: '2026-10-01',
  bloquear_atendimentos: true,
  excecoes_folga: [],
  excecoes_trabalho: [],
};

/**
 * Retorna true se a data informada for dia de trabalho CLT na escala 12x36.
 * Âncora padrão: '2026-10-01'.
 * Se for hoje 30/09/2026: folga (retorna false).
 * Se for 01/10/2026: trabalho (retorna true).
 */
export function isDiaTrabalho12x36(
  data: Date | string,
  ancoraTrabalho = '2026-10-01',
  excecoesFolga: string[] = [],
  excecoesTrabalho: string[] = []
): boolean {
  const dataIso = typeof data === 'string' ? data.slice(0, 10) : data.toISOString().slice(0, 10);

  // Exceção manual tem precedência máxima
  if (excecoesFolga.includes(dataIso)) return false;
  if (excecoesTrabalho.includes(dataIso)) return true;

  const d = typeof data === 'string' ? parseISO(data.slice(0, 10)) : data;
  const ancora = typeof ancoraTrabalho === 'string' ? parseISO(ancoraTrabalho.slice(0, 10)) : ancoraTrabalho;

  const diff = differenceInCalendarDays(d, ancora);
  return Math.abs(diff) % 2 === 0;
}

export function getStatusEscala12x36(
  data: Date | string,
  config: Escala12x36Config = ESCALA_PADRAO
): 'trabalho' | 'folga' | 'desativada' {
  if (!config.ativa) return 'desativada';
  return isDiaTrabalho12x36(
    data,
    config.data_ancora_trabalho,
    config.excecoes_folga || [],
    config.excecoes_trabalho || []
  )
    ? 'trabalho'
    : 'folga';
}
