// ============================================================================
// Axé Agenda — Testes do cálculo de slots livres
//
// Cenários cobertos (conforme especificação):
// 1. Conflito com gira
// 2. Gira cancelada (slot reaparece)
// 3. Gira movida (slot original livre, novo horário ocupado)
// 4. Bloqueio recorrente
// 5. Buffer entre atendimentos
// 6. Limite diário
// 7. Limite semanal
// 8. Mês com 5 sábados
// 9. Virada de ano
// 10. Mudança da data-âncora
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calcularSlotsDisponiveis,
  expandirEventoRecorrente,
  toSP,
} from './calcular-slots';
import type { Evento, RegraDisponibilidade } from './types';

// ============================================================================
// Helpers para testes
// ============================================================================

/** Regra padrão: terça a sexta, 09:00-17:00, 1h, 15min buffer */
function regrasPadrao(): RegraDisponibilidade[] {
  return [2, 3, 4, 5].map((dia, i) => ({
    id: `regra-${i}`,
    dia_semana: dia,
    hora_inicio: '09:00',
    hora_fim: '17:00',
    duracao_min: 60,
    buffer_min: 15,
    limite_dia: 4,
    limite_semana: 15,
    modalidade: 'presencial' as const,
    ativo: true,
  }));
}

/** Gira recorrente: a cada 14 dias, sábado, 19:00-22:00 BRT */
function giraRecorrente(ancora: string = '2026-10-10'): Evento {
  return {
    id: 'gira-recorrente',
    tipo: 'gira',
    titulo: 'Gira',
    subtipo: 'tipo-caboclos',
    inicio: `${ancora}T22:00:00Z`, // 19:00 BRT
    fim: `${ancora}T01:00:00Z`,    // 22:00 BRT (próximo dia UTC, mas rrule usa local)
    dia_inteiro: false,
    rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA',
    excecoes: [],
    solicitacao_id: null,
  };
}

/** Cria um atendimento aprovado */
function atendimentoAprovado(
  data: string,
  horaInicio: string = '10:00',
  horaFim: string = '11:00',
): Evento {
  return {
    id: `atendimento-${data}-${horaInicio}`,
    tipo: 'atendimento',
    titulo: 'Atendimento',
    subtipo: null,
    inicio: `${data}T${horaInicio}:00-03:00`,
    fim: `${data}T${horaFim}:00-03:00`,
    dia_inteiro: false,
    rrule: null,
    excecoes: [],
    solicitacao_id: 'sol-1',
  };
}

/** Cria um bloqueio de dia inteiro */
function bloqueioDia(data: string, titulo: string = 'Bloqueio'): Evento {
  return {
    id: `bloqueio-${data}`,
    tipo: 'bloqueio_pessoal',
    titulo,
    subtipo: null,
    inicio: `${data}T03:00:00Z`, // 00:00 BRT
    fim: `${new Date(new Date(data).getTime() + 86400000).toISOString().slice(0, 10)}T03:00:00Z`, // 00:00 BRT dia seguinte
    dia_inteiro: true,
    rrule: null,
    excecoes: [],
    solicitacao_id: null,
  };
}

/** Cria um bloqueio recorrente (toda segunda) */
function bloqueioRecorrenteSeg(): Evento {
  return {
    id: 'bloqueio-seg',
    tipo: 'bloqueio_pessoal',
    titulo: 'Dia pessoal',
    subtipo: null,
    inicio: '2026-10-05T03:00:00Z', // Primeira segunda de out, 00:00 BRT
    fim: '2026-10-06T03:00:00Z',
    dia_inteiro: true,
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
    excecoes: [],
    solicitacao_id: null,
  };
}

/** Extrai apenas as horas de início dos slots (para facilitar asserts) */
function horasInicio(slots: { inicio: string }[]): string[] {
  return slots.map(s => {
    const d = toSP(s.inicio);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
}

/** Extrai datas únicas dos slots (YYYY-MM-DD em SP) */
function datasUnicas(slots: { inicio: string }[]): string[] {
  const datas = new Set(
    slots.map(s => {
      const d = toSP(s.inicio);
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    })
  );
  return Array.from(datas).sort();
}

// ============================================================================
// TESTES
// ============================================================================

describe('calcularSlotsDisponiveis', () => {

  // --------------------------------------------------------------------------
  // Cenário básico: sem eventos, regras padrão
  // --------------------------------------------------------------------------
  it('gera slots corretos para um dia sem eventos', () => {
    const slots = calcularSlotsDisponiveis({
      dataInicio: '2026-10-13', // Terça
      dataFim: '2026-10-13',
      regras: regrasPadrao(),
      eventos: [],
    });

    // 09:00-10:00, 10:15-11:15, 11:30-12:30, 12:45-13:45
    // (4 slots max por dia com duração 60 + buffer 15)
    expect(slots).toHaveLength(4);
    expect(horasInicio(slots)).toEqual(['09:00', '10:15', '11:30', '12:45']);
  });

  it('não gera slots para dia sem regra (sábado, domingo, segunda)', () => {
    const slots = calcularSlotsDisponiveis({
      dataInicio: '2026-10-10', // Sábado
      dataFim: '2026-10-12',   // Segunda
      regras: regrasPadrao(),
      eventos: [],
    });

    expect(slots).toHaveLength(0);
  });

  it('gera slots para múltiplos dias', () => {
    const slots = calcularSlotsDisponiveis({
      dataInicio: '2026-10-13', // Terça
      dataFim: '2026-10-16',   // Sexta
      regras: regrasPadrao(),
      eventos: [],
    });

    // 4 dias × 4 slots/dia = 16
    expect(slots).toHaveLength(16);
    expect(datasUnicas(slots)).toEqual([
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
  });

  // --------------------------------------------------------------------------
  // 1. Conflito com gira
  // --------------------------------------------------------------------------
  describe('conflito com gira', () => {
    it('gira no sábado não afeta slots de terça a sexta', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13', // Terça
        dataFim: '2026-10-16',   // Sexta
        regras: regrasPadrao(),
        eventos: [giraRecorrente()],
      });

      // Gira é sábado — não tem regra de atendimento no sábado
      expect(slots).toHaveLength(16);
    });

    it('gira em dia de atendimento bloqueia slots do horário da gira', () => {
      // Gira fictícia na quarta das 10:00 às 12:00
      const giraQuarta: Evento = {
        id: 'gira-qua',
        tipo: 'gira',
        titulo: 'Gira especial',
        subtipo: 'tipo-caboclos',
        inicio: '2026-10-14T13:00:00Z', // 10:00 BRT
        fim: '2026-10-14T15:00:00Z',     // 12:00 BRT
        dia_inteiro: false,
        rrule: null,
        excecoes: [],
        solicitacao_id: null,
      };

      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-14', // Quarta
        dataFim: '2026-10-14',
        regras: regrasPadrao(),
        eventos: [giraQuarta],
      });

      // Slots que colidem com 10:00-12:00: 09:00-10:00 ok (termina antes),
      // 10:15-11:15 colide, 11:30-12:30 colide
      // Sobram: 09:00, 12:45 (ou o que couber)
      const horas = horasInicio(slots);
      expect(horas).toContain('09:00');
      expect(horas).not.toContain('10:15');
      expect(horas).not.toContain('11:30');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Gira cancelada (slot deve reaparecer)
  // --------------------------------------------------------------------------
  describe('gira cancelada', () => {
    it('gira cancelada não bloqueia slots', () => {
      // Gira fictícia na quarta cancelada
      const giraCancelada: Evento = {
        id: 'gira-cancel',
        tipo: 'gira',
        titulo: 'Gira',
        subtipo: 'tipo-caboclos',
        inicio: '2026-10-14T13:00:00Z', // 10:00 BRT, quarta
        fim: '2026-10-14T15:00:00Z',     // 12:00 BRT
        dia_inteiro: false,
        rrule: null,
        excecoes: [{ data_original: '2026-10-14', acao: 'cancelar' }],
        solicitacao_id: null,
      };

      const slotsSemGira = calcularSlotsDisponiveis({
        dataInicio: '2026-10-14',
        dataFim: '2026-10-14',
        regras: regrasPadrao(),
        eventos: [],
      });

      const slotsComGiraCancelada = calcularSlotsDisponiveis({
        dataInicio: '2026-10-14',
        dataFim: '2026-10-14',
        regras: regrasPadrao(),
        eventos: [giraCancelada],
      });

      // Mesma quantidade — gira cancelada não afeta
      expect(slotsComGiraCancelada).toHaveLength(slotsSemGira.length);
    });

    it('gira recorrente com uma ocorrência cancelada', () => {
      // Gira recorrente quinzenal, mas 2026-10-24 cancelada
      const gira = giraRecorrente();
      gira.excecoes = [{ data_original: '2026-10-24', acao: 'cancelar' }];

      // Se tivesse regra de sábado, o sábado 24 ficaria livre
      // Como não tem regra no sábado, não afeta — mas vamos testar a expansão
      const blocos = expandirEventoRecorrente(
        gira,
        new Date('2026-10-01'),
        new Date('2026-11-30'),
      );

      // Gira no sábado 10, 24(cancelada), 07/nov, 21/nov
      // 24 cancelada → ficam 10, 07, 21 = 3 ocorrências
      const datas = blocos.map(b =>
        `${b.inicio.getFullYear()}-${(b.inicio.getMonth() + 1).toString().padStart(2, '0')}-${b.inicio.getDate().toString().padStart(2, '0')}`
      );
      expect(datas).not.toContain('2026-10-24');
      expect(datas).toContain('2026-10-10');
      expect(datas).toContain('2026-11-07');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Gira movida
  // --------------------------------------------------------------------------
  describe('gira movida', () => {
    it('gira movida: slot original livre, novo horário ocupado', () => {
      // Gira recorrente, 10/10 movida para domingo 11/10
      const gira = giraRecorrente();
      gira.excecoes = [{
        data_original: '2026-10-10',
        acao: 'mover',
        novo_inicio: '2026-10-11T22:00:00Z', // 19:00 BRT domingo
        novo_fim: '2026-10-12T01:00:00Z',     // 22:00 BRT domingo
      }];

      const blocos = expandirEventoRecorrente(
        gira,
        new Date('2026-10-01'),
        new Date('2026-10-31'),
      );

      const datas = blocos.map(b =>
        `${b.inicio.getFullYear()}-${(b.inicio.getMonth() + 1).toString().padStart(2, '0')}-${b.inicio.getDate().toString().padStart(2, '0')}`
      );

      // 10/10 não deve aparecer (foi movida)
      expect(datas).not.toContain('2026-10-10');
      // 11/10 (domingo) deve aparecer (novo horário)
      expect(datas).toContain('2026-10-11');
      // 24/10 normal
      expect(datas).toContain('2026-10-24');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Bloqueio recorrente
  // --------------------------------------------------------------------------
  describe('bloqueio recorrente', () => {
    it('bloqueio recorrente de segunda bloqueia todas as segundas', () => {
      // Se adicionarmos regra de segunda também:
      const regras: RegraDisponibilidade[] = [
        ...regrasPadrao(),
        {
          id: 'regra-seg',
          dia_semana: 1, // segunda
          hora_inicio: '09:00',
          hora_fim: '17:00',
          duracao_min: 60,
          buffer_min: 15,
          limite_dia: 4,
          limite_semana: 15,
          modalidade: 'presencial',
          ativo: true,
        },
      ];

      // Sem bloqueio — segunda tem slots
      const slotsSemBloqueio = calcularSlotsDisponiveis({
        dataInicio: '2026-10-12', // Segunda
        dataFim: '2026-10-12',
        regras,
        eventos: [],
      });
      expect(slotsSemBloqueio.length).toBeGreaterThan(0);

      // Com bloqueio recorrente — segunda zerada
      const slotsComBloqueio = calcularSlotsDisponiveis({
        dataInicio: '2026-10-12', // Segunda
        dataFim: '2026-10-12',
        regras,
        eventos: [bloqueioRecorrenteSeg()],
      });
      expect(slotsComBloqueio).toHaveLength(0);

      // Outra segunda (19/10) também bloqueada
      const slotsOutraSeg = calcularSlotsDisponiveis({
        dataInicio: '2026-10-19',
        dataFim: '2026-10-19',
        regras,
        eventos: [bloqueioRecorrenteSeg()],
      });
      expect(slotsOutraSeg).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Buffer entre atendimentos
  // --------------------------------------------------------------------------
  describe('buffer entre atendimentos', () => {
    it('atendimento existente bloqueia slot + buffer ao redor', () => {
      // Atendimento das 10:00-11:00 com buffer de 15min
      // → ocupa 09:45-11:15 (com buffer)
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13', // Terça
        dataFim: '2026-10-13',
        regras: regrasPadrao(),
        eventos: [atendimentoAprovado('2026-10-13', '10:00', '11:00')],
      });

      const horas = horasInicio(slots);
      // 09:00-10:00 colide com buffer (atendimento 10:00 - 15min buffer = 09:45)
      // Na verdade 09:00-10:00 NÃO colide: slot termina às 10:00, buffer começa às 09:45
      // slot [09:00, 10:00] vs bloco com buffer [09:45, 11:15] → COLIDE (09:45 < 10:00)
      expect(horas).not.toContain('10:15');
      // 09:00 colide com buffer (slot 09:00-10:00 vs bloco 09:45-11:15)
      expect(horas).not.toContain('09:00');
    });

    it('buffer de 0 minutos não bloqueia adjacentes', () => {
      const regras = regrasPadrao().map(r => ({ ...r, buffer_min: 0 }));

      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13',
        dataFim: '2026-10-13',
        regras,
        eventos: [atendimentoAprovado('2026-10-13', '10:00', '11:00')],
      });

      const horas = horasInicio(slots);
      // Com buffer 0: slot 09:00-10:00 ok (termina exatamente onde começa atendimento)
      // Slot 11:00-12:00 ok
      expect(horas).toContain('09:00');
      expect(horas).not.toContain('10:00'); // Colide direto com atendimento
    });
  });

  // --------------------------------------------------------------------------
  // 6. Limite diário
  // --------------------------------------------------------------------------
  describe('limite diário', () => {
    it('respeita limite de 4 atendimentos por dia', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13',
        dataFim: '2026-10-13',
        regras: regrasPadrao(),
        eventos: [],
      });

      // Limite de 4 por dia
      expect(slots.length).toBeLessThanOrEqual(4);
    });

    it('com 3 atendimentos existentes, só gera 1 slot', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13',
        dataFim: '2026-10-13',
        regras: regrasPadrao(),
        eventos: [
          atendimentoAprovado('2026-10-13', '09:00', '10:00'),
          atendimentoAprovado('2026-10-13', '11:00', '12:00'),
          atendimentoAprovado('2026-10-13', '13:00', '14:00'),
        ],
      });

      // Já tem 3, limite é 4, deve gerar no máximo 1
      expect(slots.length).toBeLessThanOrEqual(1);
    });

    it('com 4 atendimentos existentes, não gera nenhum slot', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13',
        dataFim: '2026-10-13',
        regras: regrasPadrao(),
        eventos: [
          atendimentoAprovado('2026-10-13', '09:00', '10:00'),
          atendimentoAprovado('2026-10-13', '11:00', '12:00'),
          atendimentoAprovado('2026-10-13', '13:00', '14:00'),
          atendimentoAprovado('2026-10-13', '15:00', '16:00'),
        ],
      });

      expect(slots).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Limite semanal
  // --------------------------------------------------------------------------
  describe('limite semanal', () => {
    it('respeita limite semanal de atendimentos', () => {
      // Regra com limite de 2 por semana para forçar o cenário
      const regras = regrasPadrao().map(r => ({ ...r, limite_semana: 2 }));

      // 2 atendimentos na semana
      const eventos = [
        atendimentoAprovado('2026-10-13', '09:00', '10:00'), // Terça
        atendimentoAprovado('2026-10-14', '09:00', '10:00'), // Quarta
      ];

      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-15', // Quinta (mesma semana)
        dataFim: '2026-10-16',   // Sexta
        regras,
        eventos,
      });

      // Limite semanal de 2 já atingido → zero slots
      expect(slots).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Mês com 5 sábados (Outubro 2026: sáb 3, 10, 17, 24, 31)
  // --------------------------------------------------------------------------
  describe('mês com 5 sábados', () => {
    it('gira quinzenal funciona corretamente com 5 sábados', () => {
      const gira = giraRecorrente();

      const blocos = expandirEventoRecorrente(
        gira,
        new Date('2026-10-01'),
        new Date('2026-10-31'),
      );

      // Âncora 10/10, quinzenal: 10/10 e 24/10
      const datas = blocos.map(b =>
        `${b.inicio.getFullYear()}-${(b.inicio.getMonth() + 1).toString().padStart(2, '0')}-${b.inicio.getDate().toString().padStart(2, '0')}`
      );

      expect(datas).toContain('2026-10-10');
      expect(datas).toContain('2026-10-24');
      // Sábados 03, 17, 31 NÃO devem ter gira
      expect(datas).not.toContain('2026-10-03');
      expect(datas).not.toContain('2026-10-17');
      expect(datas).not.toContain('2026-10-31');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Virada de ano
  // --------------------------------------------------------------------------
  describe('virada de ano', () => {
    it('gira recorrente funciona na virada dez/2026 → jan/2027', () => {
      // Âncora 10/10/2026, quinzenal
      // Outubro: 10, 24
      // Novembro: 07, 21
      // Dezembro: 05, 19
      // Janeiro: 02, 16, 30
      const gira = giraRecorrente();

      const blocos = expandirEventoRecorrente(
        gira,
        new Date('2026-12-15'),
        new Date('2027-01-31'),
      );

      const datas = blocos.map(b =>
        `${b.inicio.getFullYear()}-${(b.inicio.getMonth() + 1).toString().padStart(2, '0')}-${b.inicio.getDate().toString().padStart(2, '0')}`
      );

      expect(datas).toContain('2026-12-19');
      expect(datas).toContain('2027-01-02');
      expect(datas).toContain('2027-01-16');
      expect(datas).toContain('2027-01-30');
    });

    it('slots de atendimento na virada de ano', () => {
      // 29/12/2026=terça, 30=quarta, 31=quinta, 01/01/2027=sexta, 02/01=sábado
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-12-29', // Terça
        dataFim: '2027-01-01',   // Sexta
        regras: regrasPadrao(),
        eventos: [],
      });

      const datas = datasUnicas(slots);
      expect(datas).toContain('2026-12-29'); // Terça (dia_semana=2)
      expect(datas).toContain('2026-12-30'); // Quarta (dia_semana=3)
      expect(datas).toContain('2026-12-31'); // Quinta (dia_semana=4)
      expect(datas).toContain('2027-01-01'); // Sexta (dia_semana=5)
      expect(datas).toHaveLength(4);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Mudança da data-âncora
  // --------------------------------------------------------------------------
  describe('mudança da data-âncora', () => {
    it('nova âncora gera giras em datas diferentes', () => {
      // Âncora original: 10/10 → giras em 10, 24, 07/nov...
      const giraOriginal = giraRecorrente('2026-10-10');
      const blocosOriginal = expandirEventoRecorrente(
        giraOriginal,
        new Date('2026-10-01'),
        new Date('2026-11-30'),
      );

      // Nova âncora: 17/10 → giras em 17, 31, 14/nov...
      const giraNovaAncora = giraRecorrente('2026-10-17');
      const blocosNova = expandirEventoRecorrente(
        giraNovaAncora,
        new Date('2026-10-01'),
        new Date('2026-11-30'),
      );

      const datasOriginal = blocosOriginal.map(b =>
        `${b.inicio.getDate()}`
      );
      const datasNova = blocosNova.map(b =>
        `${b.inicio.getDate()}`
      );

      // Devem ser diferentes
      expect(datasOriginal).not.toEqual(datasNova);
      // Original: 10, 24, 07, 21
      // Nova: 17, 31, 14, 28
    });
  });

  // --------------------------------------------------------------------------
  // Bloqueio de dia inteiro
  // --------------------------------------------------------------------------
  describe('bloqueio de dia inteiro', () => {
    it('bloqueio de dia inteiro remove todos os slots do dia', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-15', // Quarta (dia do bloqueio)
        dataFim: '2026-10-15',
        regras: regrasPadrao(),
        eventos: [bloqueioDia('2026-10-15', 'Aniversário')],
      });

      expect(slots).toHaveLength(0);
    });

    it('bloqueio de um dia não afeta dias adjacentes', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-14', // Terça
        dataFim: '2026-10-16',   // Sexta
        regras: regrasPadrao(),
        eventos: [bloqueioDia('2026-10-15', 'Bloqueio quarta')],
      });

      const datas = datasUnicas(slots);
      expect(datas).toContain('2026-10-14'); // Terça ok
      expect(datas).not.toContain('2026-10-15'); // Quarta bloqueada
      expect(datas).toContain('2026-10-16'); // Sexta ok
    });
  });

  // --------------------------------------------------------------------------
  // Cenário combinado: gira + bloqueio + atendimento
  // --------------------------------------------------------------------------
  describe('cenário combinado', () => {
    it('combina gira + bloqueio + atendimento corretamente', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13', // Terça
        dataFim: '2026-10-16',   // Sexta
        regras: regrasPadrao(),
        eventos: [
          giraRecorrente(),                                          // Sáb (não afeta)
          bloqueioDia('2026-10-15', 'Aniversário'),                 // Quarta bloqueada
          atendimentoAprovado('2026-10-14', '09:00', '10:00'),       // Terça 1 atendimento
          bloqueioRecorrenteSeg(),                                    // Seg (não afeta)
        ],
      });

      const datas = datasUnicas(slots);
      // Terça: 4 - 1 existente = max 3 (mas depende do buffer)
      // Quarta: bloqueada
      // Quinta: 4 slots
      // Sexta: 4 slots
      expect(datas).toContain('2026-10-13');
      expect(datas).not.toContain('2026-10-15');
      expect(datas).toContain('2026-10-14');
      expect(datas).toContain('2026-10-16');
    });
  });

  // --------------------------------------------------------------------------
  // Sem regras ativas
  // --------------------------------------------------------------------------
  it('retorna vazio se não há regras ativas', () => {
    const regras = regrasPadrao().map(r => ({ ...r, ativo: false }));
    const slots = calcularSlotsDisponiveis({
      dataInicio: '2026-10-13',
      dataFim: '2026-10-16',
      regras,
      eventos: [],
    });

    expect(slots).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Modalidade online
  // --------------------------------------------------------------------------
  describe('modalidade', () => {
    it('retorna vazio se pedir online mas só tem regra presencial', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13',
        dataFim: '2026-10-13',
        regras: regrasPadrao(),
        eventos: [],
        modalidade: 'online',
      });

      expect(slots).toHaveLength(0);
    });

    it('retorna slots online se houver regra online', () => {
      const regras: RegraDisponibilidade[] = [
        {
          id: 'regra-online',
          dia_semana: 2, // Terça
          hora_inicio: '14:00',
          hora_fim: '17:00',
          duracao_min: 45,
          buffer_min: 15,
          limite_dia: 3,
          limite_semana: 10,
          modalidade: 'online',
          ativo: true,
        },
      ];

      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-13', // Terça
        dataFim: '2026-10-13',
        regras,
        eventos: [],
        modalidade: 'online',
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every(s => s.modalidade === 'online')).toBe(true);
    });
  });
  // ==========================================================================
  // 11. Escala CLT 12x36 (Pai Leandro)
  // ==========================================================================
  describe('Escala de Trabalho CLT 12x36 (Pai Leandro)', () => {
    // Regra disponível todos os dias das 09:00 às 17:00
    const regrasTodosDias: RegraDisponibilidade[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
      id: `regra-${dia}`,
      dia_semana: dia,
      hora_inicio: '09:00',
      hora_fim: '17:00',
      duracao_min: 60,
      buffer_min: 15,
      limite_dia: 6,
      limite_semana: 30,
      modalidade: 'presencial' as const,
      ativo: true,
    }));

    it('bloqueia completamente dias de trabalho (plantão) e libera dias de folga', () => {
      // Âncora: 01/10/2026 (Quinta) é trabalho
      // Portanto:
      // 01/10 (Qui) = Trabalho (ZERO slots)
      // 02/10 (Sex) = Folga (SLOTS LIBERADOS)
      // 03/10 (Sáb) = Trabalho (ZERO slots)
      // 04/10 (Dom) = Folga (SLOTS LIBERADOS)
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-01',
        dataFim: '2026-10-04',
        regras: regrasTodosDias,
        eventos: [],
        antecedenciaMinimaHoras: 0,
        agora: new Date('2026-09-30T00:00:00Z'),
        escala12x36: {
          ativa: true,
          data_ancora_trabalho: '2026-10-01',
          bloquear_atendimentos: true,
        },
      });

      // 01/10 não pode ter nenhum slot
      const slotsDia1 = slots.filter(s => s.inicio.startsWith('2026-10-01'));
      expect(slotsDia1.length).toBe(0);

      // 02/10 (folga) deve ter slots livres
      const slotsDia2 = slots.filter(s => s.inicio.startsWith('2026-10-02'));
      expect(slotsDia2.length).toBeGreaterThan(0);

      // 03/10 (trabalho) não pode ter nenhum slot
      const slotsDia3 = slots.filter(s => s.inicio.startsWith('2026-10-03'));
      expect(slotsDia3.length).toBe(0);

      // 04/10 (folga) deve ter slots livres
      const slotsDia4 = slots.filter(s => s.inicio.startsWith('2026-10-04'));
      expect(slotsDia4.length).toBeGreaterThan(0);
    });

    it('respeita folga de hoje (30/09/2026) e trabalho de amanhã (01/10/2026)', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-09-30',
        dataFim: '2026-10-01',
        regras: regrasTodosDias,
        eventos: [],
        antecedenciaMinimaHoras: 0,
        agora: new Date('2026-09-29T00:00:00Z'),
        escala12x36: {
          ativa: true,
          data_ancora_trabalho: '2026-10-01',
          bloquear_atendimentos: true,
        },
      });

      // 30/09 (folga) tem slots
      const slotsHoje = slots.filter(s => s.inicio.startsWith('2026-09-30'));
      expect(slotsHoje.length).toBeGreaterThan(0);

      // 01/10 (trabalho) tem zero slots
      const slotsAmanha = slots.filter(s => s.inicio.startsWith('2026-10-01'));
      expect(slotsAmanha.length).toBe(0);
    });

    it('se escala 12x36 estiver desativada, todos os dias de regras têm slots', () => {
      const slots = calcularSlotsDisponiveis({
        dataInicio: '2026-10-01',
        dataFim: '2026-10-02',
        regras: regrasTodosDias,
        eventos: [],
        antecedenciaMinimaHoras: 0,
        agora: new Date('2026-09-30T00:00:00Z'),
        escala12x36: {
          ativa: false,
          data_ancora_trabalho: '2026-10-01',
          bloquear_atendimentos: true,
        },
      });

      const slotsDia1 = slots.filter(s => s.inicio.startsWith('2026-10-01'));
      const slotsDia2 = slots.filter(s => s.inicio.startsWith('2026-10-02'));

      expect(slotsDia1.length).toBeGreaterThan(0);
      expect(slotsDia2.length).toBeGreaterThan(0);
    });
  });
});
