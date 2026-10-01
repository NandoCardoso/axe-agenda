import type { Evento, RegraDisponibilidade, Solicitacao, TipoGira } from './types';

export const MOCK_TIPOS_GIRA: TipoGira[] = [
  { id: 'tipo-calunga', nome: 'Gira externa - Cruzamento de calunga', ativo: true, ordem: 1 },
  { id: 'tipo-ciganos', nome: 'Ciganos e Esquerda', ativo: true, ordem: 2 },
  { id: 'tipo-pretos', nome: 'Pretos Velhos', ativo: true, ordem: 3 },
  { id: 'tipo-marinheiros', nome: 'Marinheiros', ativo: true, ordem: 4 },
  { id: 'tipo-festa-marabo', nome: 'Festa de Seu Marabô e Dona Mulambo', ativo: true, ordem: 5 },
  { id: 'tipo-encerramento', nome: 'Gira de encerramento ano litúrgico', ativo: true, ordem: 6 },
  { id: 'tipo-caboclos', nome: 'Caboclos', ativo: true, ordem: 7 },
  { id: 'tipo-eres', nome: 'Erês (Ibejada)', ativo: true, ordem: 8 },
  { id: 'tipo-baianos', nome: 'Baianos e Boiadeiros', ativo: true, ordem: 9 },
];

export const MOCK_REGRAS: RegraDisponibilidade[] = [
  // Terça-feira (2)
  {
    id: 'reg-terca',
    dia_semana: 2,
    hora_inicio: '09:00',
    hora_fim: '17:00',
    duracao_min: 60,
    buffer_min: 15,
    limite_dia: 4,
    limite_semana: 15,
    modalidade: 'presencial',
    ativo: true,
  },
  // Quarta-feira (3)
  {
    id: 'reg-quarta',
    dia_semana: 3,
    hora_inicio: '14:00',
    hora_fim: '19:00',
    duracao_min: 60,
    buffer_min: 15,
    limite_dia: 4,
    limite_semana: 15,
    modalidade: 'presencial',
    ativo: true,
  },
  // Quinta-feira (4)
  {
    id: 'reg-quinta',
    dia_semana: 4,
    hora_inicio: '09:00',
    hora_fim: '17:00',
    duracao_min: 60,
    buffer_min: 15,
    limite_dia: 4,
    limite_semana: 15,
    modalidade: 'presencial',
    ativo: true,
  },
  // Sexta-feira (5)
  {
    id: 'reg-sexta',
    dia_semana: 5,
    hora_inicio: '14:00',
    hora_fim: '18:00',
    duracao_min: 60,
    buffer_min: 15,
    limite_dia: 4,
    limite_semana: 15,
    modalidade: 'online',
    ativo: true,
  },
];

export const MOCK_EVENTOS: Evento[] = [
  // 1. 04/10/2026 (Domingo) - Gira externa - Cruzamento de calunga (18h às 22h em SP)
  {
    id: 'gira-2026-10-04',
    tipo: 'gira',
    titulo: 'Gira externa - Cruzamento de calunga',
    subtipo: 'tipo-calunga',
    inicio: '2026-10-04T21:00:00.000Z',
    fim: '2026-10-05T01:00:00.000Z',
    dia_inteiro: false,
    rrule: null,
    excecoes: [],
    solicitacao_id: null,
  },
  // 2. 10/10/2026 (Sábado) - Ciganos e Esquerda (18h às 22h em SP)
  {
    id: 'gira-2026-10-10',
    tipo: 'gira',
    titulo: 'Ciganos e Esquerda',
    subtipo: 'tipo-ciganos',
    inicio: '2026-10-10T21:00:00.000Z',
    fim: '2026-10-11T01:00:00.000Z',
    dia_inteiro: false,
    rrule: null,
    excecoes: [],
    solicitacao_id: null,
  },
  // 3. 24/10/2026 (Sábado) - Pretos Velhos (18h às 22h em SP)
  {
    id: 'gira-2026-10-24',
    tipo: 'gira',
    titulo: 'Pretos Velhos',
    subtipo: 'tipo-pretos',
    inicio: '2026-10-24T21:00:00.000Z',
    fim: '2026-10-25T01:00:00.000Z',
    dia_inteiro: false,
    rrule: null,
    excecoes: [],
    solicitacao_id: null,
  },
  // 4. 07/11/2026 (Sábado) - Marinheiros (18h às 22h em SP)
  {
    id: 'gira-2026-11-07',
    tipo: 'gira',
    titulo: 'Marinheiros',
    subtipo: 'tipo-marinheiros',
    inicio: '2026-11-07T21:00:00.000Z',
    fim: '2026-11-08T01:00:00.000Z',
    dia_inteiro: false,
    rrule: null,
    excecoes: [],
    solicitacao_id: null,
  },
  // 5. 21/11/2026 (Sábado) - Festa de Seu Marabô e Dona Mulambo (18h às 22h em SP)
  {
    id: 'gira-2026-11-21',
    tipo: 'gira',
    titulo: 'Festa de Seu Marabô e Dona Mulambo',
    subtipo: 'tipo-festa-marabo',
    inicio: '2026-11-21T21:00:00.000Z',
    fim: '2026-11-22T01:00:00.000Z',
    dia_inteiro: false,
    rrule: null,
    excecoes: [],
    solicitacao_id: null,
  },
  // 6. 05/12/2026 (Sábado) - Gira de encerramento ano litúrgico (18h às 22h em SP)
  {
    id: 'gira-2026-12-05',
    tipo: 'gira',
    titulo: 'Gira de encerramento ano litúrgico',
    subtipo: 'tipo-encerramento',
    inicio: '2026-12-05T21:00:00.000Z',
    fim: '2026-12-06T01:00:00.000Z',
    dia_inteiro: false,
    rrule: null,
    excecoes: [],
    solicitacao_id: null,
  },
  // Bloqueio recorrente (Segundas-feiras = dia de descanso pessoal do Pai)
  {
    id: 'evt-bloqueio-segunda',
    tipo: 'bloqueio_pessoal',
    titulo: 'Descanso da Família',
    subtipo: null,
    inicio: '2026-09-28T03:00:00.000Z',
    fim: '2026-09-29T03:00:00.000Z',
    dia_inteiro: true,
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    excecoes: [],
    solicitacao_id: null,
  },
];

export const MOCK_SOLICITACOES: Solicitacao[] = [
  {
    id: 'sol-1',
    nome: 'Maria de Lourdes Santos',
    whatsapp: '11987654321',
    inicio: '2026-10-06T17:00:00.000Z', // 14:00 SP
    fim: '2026-10-06T18:00:00.000Z',
    modalidade: 'presencial',
    tipo_atendimento: 'Baralho Cigano',
    observacao: '[Baralho Cigano] Orientação oracular sobre decisões familiares e trabalho.',
    status: 'pendente',
    resposta: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'sol-2',
    nome: 'Carlos Eduardo Lima',
    whatsapp: '11999887766',
    inicio: '2026-10-08T18:00:00.000Z', // 15:00 SP
    fim: '2026-10-08T19:00:00.000Z',
    modalidade: 'online',
    tipo_atendimento: 'Búzios — Oráculo de Exú',
    observacao: '[Búzios — Oráculo de Exú] Consulta aos guardiões sobre proteção e direcionamento.',
    status: 'pendente',
    resposta: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'sol-3',
    nome: 'Ana Paula Ferreira',
    whatsapp: '11981234567',
    inicio: '2026-10-01T13:00:00.000Z',
    fim: '2026-10-01T14:00:00.000Z',
    modalidade: 'presencial',
    tipo_atendimento: 'Consultas e Trabalhos Espirituais',
    observacao: '[Consultas e Trabalhos Espirituais] Objetivos: Abertura de caminhos, Prosperidade, Blindagem espiritual.',
    status: 'aprovada',
    resposta: 'Confirmado! Traga uma vela branca e venha com roupas claras.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];


