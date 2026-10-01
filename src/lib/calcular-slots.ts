// ============================================================================
// Axé Agenda — Cálculo de Slots Livres
//
// Calcula horários disponíveis para atendimento, subtraindo:
// 1. Giras (incluindo recorrência e exceções)
// 2. Bloqueios pessoais (incluindo recorrência)
// 3. Atendimentos já aprovados
// Respeitando: buffer entre atendimentos, limites diários e semanais
//
// Fuso fixo: America/Sao_Paulo
// ============================================================================

import {
  startOfDay,
  endOfDay,
  addMinutes,
  addDays,
  isBefore,
  isAfter,
  isEqual,
  format,
  parseISO,
  getDay,
  startOfWeek,
  endOfWeek,
  differenceInMinutes,
  isWithinInterval,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { RRule } from 'rrule';
import { isDiaTrabalho12x36, type Escala12x36Config } from './escala-clt';
import type {
  Evento,
  ExcecaoEvento,
  RegraDisponibilidade,
  SlotDisponivel,
  ModalidadeTipo,
} from './types';

const TIMEZONE = 'America/Sao_Paulo';

// ============================================================================
// Tipos internos
// ============================================================================

interface BlocoOcupado {
  inicio: Date; // Em horário de SP
  fim: Date;    // Em horário de SP
}

interface CalcularSlotsParams {
  dataInicio: string;        // ISO date (YYYY-MM-DD) — início do range
  dataFim: string;           // ISO date (YYYY-MM-DD) — fim do range
  regras: RegraDisponibilidade[];
  eventos: Evento[];
  modalidade?: ModalidadeTipo;
  antecedenciaMinimaHoras?: number;
  agora?: Date;
  escala12x36?: Escala12x36Config;
}

// ============================================================================
// Funções auxiliares
// ============================================================================

/**
 * Converte uma data UTC para horário de São Paulo
 */
export function toSP(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(d, TIMEZONE);
}

/**
 * Converte uma data em horário de São Paulo para UTC
 */
export function fromSP(date: Date): Date {
  return fromZonedTime(date, TIMEZONE);
}

/**
 * Gera ocorrências de um evento recorrente dentro de um range.
 * Aplica exceções (cancelar, mover, editar).
 * Retorna blocos ocupados já em horário de SP.
 */
export function expandirEventoRecorrente(
  evento: Evento,
  rangeInicio: Date, // SP time
  rangeFim: Date,    // SP time
): BlocoOcupado[] {
  const blocos: BlocoOcupado[] = [];

  if (!evento.rrule) {
    // Evento único
    const inicioSP = toSP(evento.inicio);
    const fimSP = toSP(evento.fim);

    // Verificar se está no range
    if (isBefore(fimSP, rangeInicio) || isAfter(inicioSP, rangeFim)) {
      return [];
    }

    // Verificar se foi cancelado por exceção
    const dataStr = format(inicioSP, 'yyyy-MM-dd');
    const excecao = evento.excecoes.find(e => e.data_original === dataStr);
    if (excecao?.acao === 'cancelar') {
      return [];
    }

    return [{ inicio: inicioSP, fim: fimSP }];
  }

  // Evento recorrente — expandir via rrule
  const inicioSP = toSP(evento.inicio);
  const fimSP = toSP(evento.fim);
  const duracaoMin = differenceInMinutes(fimSP, inicioSP);

  // Parsear a rrule. O dtstart deve ser a data do evento em SP.
  const rule = RRule.fromString(
    `DTSTART:${format(inicioSP, "yyyyMMdd'T'HHmmss")}\nRRULE:${evento.rrule}`
  );

  // Gerar ocorrências dentro do range
  // rrule trabalha com datas "fake UTC" — precisamos converter
  const ocorrencias = rule.between(
    rangeInicio,
    rangeFim,
    true // inclusive
  );

  for (const ocorrencia of ocorrencias) {
    const dataStr = format(ocorrencia, 'yyyy-MM-dd');

    // Verificar exceções
    const excecao = evento.excecoes.find(e => e.data_original === dataStr);

    if (excecao?.acao === 'cancelar') {
      continue; // Pular esta ocorrência
    }

    if (excecao?.acao === 'mover' && excecao.novo_inicio && excecao.novo_fim) {
      // Ocorrência foi movida — usar novas datas
      const novoInicio = toSP(excecao.novo_inicio);
      const novoFim = toSP(excecao.novo_fim);

      // Verificar se a nova data está no range
      if (!isBefore(novoFim, rangeInicio) && !isAfter(novoInicio, rangeFim)) {
        blocos.push({ inicio: novoInicio, fim: novoFim });
      }
      continue;
    }

    // Ocorrência normal (ou editada — editar muda subtipo, não horário)
    const inicioOcorrencia = ocorrencia;
    const fimOcorrencia = addMinutes(ocorrencia, duracaoMin);

    blocos.push({
      inicio: inicioOcorrencia,
      fim: fimOcorrencia,
    });
  }

  return blocos;
}

/**
 * Coleta todos os blocos ocupados (giras, bloqueios, atendimentos)
 * dentro de um range, já em horário de SP.
 */
export function coletarBlocosOcupados(
  eventos: Evento[],
  rangeInicio: Date,
  rangeFim: Date,
  bufferMin: number,
): BlocoOcupado[] {
  const blocos: BlocoOcupado[] = [];

  for (const evento of eventos) {
    const expandidos = expandirEventoRecorrente(evento, rangeInicio, rangeFim);

    for (const bloco of expandidos) {
      // Adicionar buffer antes e depois de atendimentos
      if (evento.tipo === 'atendimento') {
        blocos.push({
          inicio: addMinutes(bloco.inicio, -bufferMin),
          fim: addMinutes(bloco.fim, bufferMin),
        });
      } else {
        // Giras e bloqueios já ocupam o espaço todo
        blocos.push(bloco);
      }
    }
  }

  return blocos;
}

/**
 * Verifica se um slot colide com algum bloco ocupado
 */
function slotColide(
  slotInicio: Date,
  slotFim: Date,
  blocos: BlocoOcupado[],
): boolean {
  for (const bloco of blocos) {
    // Colisão: slot começa antes do bloco terminar E slot termina depois do bloco começar
    if (isBefore(slotInicio, bloco.fim) && isAfter(slotFim, bloco.inicio)) {
      return true;
    }
  }
  return false;
}

/**
 * Conta atendimentos aprovados em uma semana (seg-dom)
 */
function contarAtendimentosSemana(
  dia: Date,
  eventos: Evento[],
  _rangeInicio: Date,
  _rangeFim: Date,
): number {
  const inicioSemana = startOfWeek(dia, { weekStartsOn: 1 }); // Segunda
  const fimSemana = endOfWeek(dia, { weekStartsOn: 1 }); // Domingo

  let count = 0;

  for (const evento of eventos) {
    if (evento.tipo !== 'atendimento') continue;

    // Expandir usando a semana inteira para capturar todos os atendimentos
    const expandidos = expandirEventoRecorrente(evento, inicioSemana, fimSemana);
    for (const bloco of expandidos) {
      if (
        !isBefore(bloco.inicio, inicioSemana) &&
        !isAfter(bloco.inicio, fimSemana)
      ) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Conta atendimentos aprovados em um dia específico
 */
function contarAtendimentosDia(
  dia: Date,
  eventos: Evento[],
  rangeInicio: Date,
  rangeFim: Date,
): number {
  const inicioDia = startOfDay(dia);
  const fimDia = endOfDay(dia);

  let count = 0;

  for (const evento of eventos) {
    if (evento.tipo !== 'atendimento') continue;

    const expandidos = expandirEventoRecorrente(evento, rangeInicio, rangeFim);
    for (const bloco of expandidos) {
      if (
        !isBefore(bloco.inicio, inicioDia) &&
        !isAfter(bloco.inicio, fimDia)
      ) {
        count++;
      }
    }
  }

  return count;
}

// ============================================================================
// Função principal
// ============================================================================

/**
 * Calcula todos os slots disponíveis para agendamento dentro de um range.
 *
 * Lógica:
 * 1. Para cada dia no range, encontra a regra de disponibilidade
 * 2. Gera slots baseado na regra (hora_inicio até hora_fim, com duração e buffer)
 * 3. Remove slots que colidem com giras, bloqueios ou atendimentos
 * 4. Respeita limites diários e semanais
 *
 * @param params Parâmetros do cálculo
 * @returns Lista de slots disponíveis
 */
export function calcularSlotsDisponiveis(
  params: CalcularSlotsParams,
): SlotDisponivel[] {
  const {
    dataInicio,
    dataFim,
    regras,
    eventos,
    modalidade = 'presencial',
    antecedenciaMinimaHoras,
    agora,
    escala12x36,
  } = params;

  const limiteAntecedencia =
    agora && antecedenciaMinimaHoras && antecedenciaMinimaHoras > 0
      ? addMinutes(agora, antecedenciaMinimaHoras * 60)
      : null;

  const slots: SlotDisponivel[] = [];

  // Filtrar regras ativas para a modalidade desejada
  const regrasAtivas = regras.filter(r => r.ativo && r.modalidade === modalidade);

  if (regrasAtivas.length === 0) {
    return [];
  }

  // Determinar o buffer padrão (maior buffer entre as regras)
  const bufferPadrao = Math.max(...regrasAtivas.map(r => r.buffer_min));

  // Range em "horário de SP" (para iterar por dias)
  const rangeInicio = parseISO(dataInicio); // Já interpretado como data local
  const rangeFim = parseISO(dataFim);

  // Expandir range para capturar eventos que podem cair nele
  const rangeExpandido = {
    inicio: addDays(rangeInicio, -1),
    fim: addDays(rangeFim, 1),
  };

  // Coletar todos os blocos ocupados
  const blocosOcupados = coletarBlocosOcupados(
    eventos,
    rangeExpandido.inicio,
    rangeExpandido.fim,
    bufferPadrao,
  );

  // Iterar por cada dia no range
  let diaAtual = rangeInicio;
  while (!isAfter(diaAtual, rangeFim)) {
    // Se a escala 12x36 estiver ativa e configurada para bloquear o dia de plantão CLT:
    if (
      escala12x36?.ativa &&
      escala12x36.bloquear_atendimentos &&
      isDiaTrabalho12x36(
        diaAtual,
        escala12x36.data_ancora_trabalho,
        escala12x36.excecoes_folga,
        escala12x36.excecoes_trabalho
      )
    ) {
      diaAtual = addDays(diaAtual, 1);
      continue;
    }

    const diaSemana = getDay(diaAtual); // 0=domingo, 6=sábado

    // Encontrar regra para este dia da semana
    const regra = regrasAtivas.find(r => r.dia_semana === diaSemana);

    if (regra) {
      // Verificar limite semanal
      const atendimentosSemana = contarAtendimentosSemana(
        diaAtual,
        eventos,
        rangeExpandido.inicio,
        rangeExpandido.fim,
      );

      if (atendimentosSemana >= regra.limite_semana) {
        diaAtual = addDays(diaAtual, 1);
        continue;
      }

      // Verificar limite diário
      const atendimentosDia = contarAtendimentosDia(
        diaAtual,
        eventos,
        rangeExpandido.inicio,
        rangeExpandido.fim,
      );

      if (atendimentosDia >= regra.limite_dia) {
        diaAtual = addDays(diaAtual, 1);
        continue;
      }

      // Gerar slots para este dia
      const [horaIni, minIni] = regra.hora_inicio.split(':').map(Number);
      const [horaFm, minFm] = regra.hora_fim.split(':').map(Number);

      let slotInicio = new Date(diaAtual);
      slotInicio.setHours(horaIni, minIni, 0, 0);

      const fimJanela = new Date(diaAtual);
      fimJanela.setHours(horaFm, minFm, 0, 0);

      let slotsGeradosNoDia = 0;
      const maxSlotsNoDia = regra.limite_dia - atendimentosDia;

      while (slotsGeradosNoDia < maxSlotsNoDia) {
        const slotFim = addMinutes(slotInicio, regra.duracao_min);

        // Verificar se o slot cabe na janela
        if (isAfter(slotFim, fimJanela)) {
          break;
        }

        // Verificar antecedência mínima
        const atendeAntecedencia = !limiteAntecedencia || !isBefore(slotInicio, limiteAntecedencia);

        // Verificar colisão com blocos ocupados
        if (atendeAntecedencia && !slotColide(slotInicio, slotFim, blocosOcupados)) {
          slots.push({
            inicio: fromSP(slotInicio).toISOString(),
            fim: fromSP(slotFim).toISOString(),
            modalidade,
          });
          slotsGeradosNoDia++;
        }

        // Próximo slot = fim + buffer
        slotInicio = addMinutes(slotFim, regra.buffer_min);
      }
    }

    diaAtual = addDays(diaAtual, 1);
  }

  return slots;
}
