-- ============================================================================
-- AXÉ AGENDA — Schema Principal
-- Fuso fixo: America/Sao_Paulo
-- Todas as timestamps são stored em UTC, convertidas na aplicação
-- ============================================================================

-- =========================
-- EXTENSÕES
-- =========================
create extension if not exists "uuid-ossp";

-- =========================
-- ENUMS
-- =========================
create type evento_tipo as enum ('gira', 'bloqueio_pessoal', 'atendimento');
create type solicitacao_status as enum ('pendente', 'aprovada', 'recusada');
create type modalidade_tipo as enum ('presencial', 'online');

-- =========================
-- TABELA: tipos_gira
-- Lista pré-cadastrada de tipos de gira (editável pelo pai de santo)
-- =========================
create table tipos_gira (
  id         uuid primary key default uuid_generate_v4(),
  nome       text not null unique,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);

comment on table tipos_gira is 'Tipos de gira disponíveis (Caboclos, Pretos Velhos, etc)';

-- =========================
-- TABELA: eventos
-- Giras, bloqueios pessoais e atendimentos confirmados
-- =========================
create table eventos (
  id          uuid primary key default uuid_generate_v4(),
  tipo        evento_tipo not null,
  titulo      text,                          -- Título opcional (usado em bloqueios)
  subtipo     uuid references tipos_gira(id), -- Tipo da gira (null para bloqueios/atendimentos)
  inicio      timestamptz not null,
  fim         timestamptz not null,
  dia_inteiro boolean not null default false,
  
  -- Recorrência (RFC 5545 RRULE string, null = evento único)
  rrule       text,
  
  -- Exceções: array JSON de objetos com data original e dados da exceção
  -- Formato: [{"data_original": "2026-10-10", "acao": "cancelar"}, 
  --           {"data_original": "2026-10-24", "acao": "mover", "novo_inicio": "...", "novo_fim": "..."},
  --           {"data_original": "2026-11-07", "acao": "editar", "subtipo": "uuid-do-tipo"}]
  excecoes    jsonb not null default '[]'::jsonb,
  
  -- Referência à solicitação original (para atendimentos aprovados)
  solicitacao_id uuid,
  
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  
  -- Constraints
  constraint chk_fim_depois_inicio check (fim > inicio),
  constraint chk_gira_tem_subtipo check (
    (tipo != 'gira') or (subtipo is not null)
  )
);

comment on table eventos is 'Todos os eventos da agenda: giras, bloqueios e atendimentos confirmados';

create index idx_eventos_tipo on eventos(tipo);
create index idx_eventos_inicio on eventos(inicio);
create index idx_eventos_tipo_inicio on eventos(tipo, inicio);

-- =========================
-- TABELA: regras_disponibilidade
-- Janelas de horário para atendimento
-- =========================
create table regras_disponibilidade (
  id           uuid primary key default uuid_generate_v4(),
  dia_semana   int not null check (dia_semana between 0 and 6), -- 0=domingo, 6=sábado
  hora_inicio  time not null,
  hora_fim     time not null,
  duracao_min  int not null default 60 check (duracao_min > 0),
  buffer_min   int not null default 15 check (buffer_min >= 0),
  limite_dia   int not null default 4 check (limite_dia > 0),
  limite_semana int not null default 15 check (limite_semana > 0),
  modalidade   modalidade_tipo not null default 'presencial',
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  
  constraint chk_hora_fim_depois check (hora_fim > hora_inicio)
);

comment on table regras_disponibilidade is 'Janelas de horário liberadas para atendimento, por dia da semana';

create index idx_regras_dia on regras_disponibilidade(dia_semana, ativo);

-- =========================
-- TABELA: configuracoes
-- Chave-valor para settings gerais
-- =========================
create table configuracoes (
  chave      text primary key,
  valor      text not null,
  descricao  text,
  updated_at timestamptz not null default now()
);

comment on table configuracoes is 'Configurações gerais do sistema (chave/valor)';

-- =========================
-- TABELA: solicitacoes
-- Pedidos de atendimento (página pública)
-- =========================
create table solicitacoes (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null check (char_length(nome) between 2 and 100),
  whatsapp    text not null check (char_length(whatsapp) between 10 and 20),
  inicio      timestamptz not null,
  fim         timestamptz not null,
  modalidade  modalidade_tipo not null default 'presencial',
  observacao  text check (char_length(observacao) <= 500),
  status      solicitacao_status not null default 'pendente',
  resposta    text,              -- Mensagem do pai de santo ao aprovar/recusar
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  
  constraint chk_sol_fim_depois_inicio check (fim > inicio)
);

comment on table solicitacoes is 'Pedidos de atendimento feitos pela página pública';

create index idx_solicitacoes_status on solicitacoes(status);
create index idx_solicitacoes_inicio on solicitacoes(inicio);

-- FK de eventos para solicitacoes (precisa existir a tabela antes)
alter table eventos
  add constraint fk_eventos_solicitacao
  foreign key (solicitacao_id) references solicitacoes(id)
  on delete set null;

-- =========================
-- TRIGGER: updated_at automático
-- =========================
create or replace function trg_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_eventos
  before update on eventos
  for each row execute function trg_set_updated_at();

create trigger set_updated_at_solicitacoes
  before update on solicitacoes
  for each row execute function trg_set_updated_at();

create trigger set_updated_at_configuracoes
  before update on configuracoes
  for each row execute function trg_set_updated_at();
