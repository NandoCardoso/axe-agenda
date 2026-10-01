// ============================================================================
// Axé Agenda — Tipos do domínio
// ============================================================================

export type EventoTipo = 'gira' | 'bloqueio_pessoal' | 'atendimento';
export type SolicitacaoStatus = 'pendente' | 'aprovada' | 'recusada';
export type ModalidadeTipo = 'presencial' | 'online';

export interface TipoGira {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface ExcecaoEvento {
  data_original: string; // ISO date (YYYY-MM-DD)
  acao: 'cancelar' | 'mover' | 'editar';
  novo_inicio?: string;  // ISO datetime (para acao='mover')
  novo_fim?: string;     // ISO datetime (para acao='mover')
  subtipo?: string;      // UUID do tipo_gira (para acao='editar')
}

export interface Evento {
  id: string;
  tipo: EventoTipo;
  titulo: string | null;
  subtipo: string | null;
  inicio: string;        // ISO datetime
  fim: string;           // ISO datetime
  dia_inteiro: boolean;
  rrule: string | null;
  excecoes: ExcecaoEvento[];
  solicitacao_id: string | null;
}

export interface RegraDisponibilidade {
  id: string;
  dia_semana: number;    // 0=domingo, 6=sábado
  hora_inicio: string;   // HH:mm
  hora_fim: string;      // HH:mm
  duracao_min: number;
  buffer_min: number;
  limite_dia: number;
  limite_semana: number;
  modalidade: ModalidadeTipo;
  ativo: boolean;
}

export interface Solicitacao {
  id: string;
  nome: string;
  whatsapp: string;
  inicio: string;
  fim: string;
  modalidade: ModalidadeTipo;
  tipo_atendimento?: string;
  observacao: string | null;
  status: SolicitacaoStatus;
  resposta: string | null;
  created_at: string;
}

export const OBJETIVOS_ESPIRITUAIS = [
  'Abertura de caminhos',
  'Sorte',
  'Amor',
  'Saúde',
  'Blindagem espiritual',
  'Proteção',
  'Harmonia',
  'Prosperidade',
] as const;

export interface Configuracoes {
  data_ancora_giras: string;
  atendimento_online_ativo: boolean;
  nome_terreiro: string;
  hora_inicio_gira: string;
  hora_fim_gira: string;
}

// Slot disponível para agendamento
export interface SlotDisponivel {
  inicio: string;        // ISO datetime
  fim: string;           // ISO datetime
  modalidade: ModalidadeTipo;
}

export type SlotLivre = SlotDisponivel;



export type { Escala12x36Config } from './escala-clt';
