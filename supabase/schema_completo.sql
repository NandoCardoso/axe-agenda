-- ============================================================================
-- AXÃ‰ AGENDA â€” Schema Principal
-- Fuso fixo: America/Sao_Paulo
-- Todas as timestamps sÃ£o stored em UTC, convertidas na aplicaÃ§Ã£o
-- ============================================================================

-- =========================
-- EXTENSÃ•ES
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
-- Lista prÃ©-cadastrada de tipos de gira (editÃ¡vel pelo pai de santo)
-- =========================
create table tipos_gira (
  id         uuid primary key default uuid_generate_v4(),
  nome       text not null unique,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);

comment on table tipos_gira is 'Tipos de gira disponÃ­veis (Caboclos, Pretos Velhos, etc)';

-- =========================
-- TABELA: eventos
-- Giras, bloqueios pessoais e atendimentos confirmados
-- =========================
create table eventos (
  id          uuid primary key default uuid_generate_v4(),
  tipo        evento_tipo not null,
  titulo      text,                          -- TÃ­tulo opcional (usado em bloqueios)
  subtipo     uuid references tipos_gira(id), -- Tipo da gira (null para bloqueios/atendimentos)
  inicio      timestamptz not null,
  fim         timestamptz not null,
  dia_inteiro boolean not null default false,
  
  -- RecorrÃªncia (RFC 5545 RRULE string, null = evento Ãºnico)
  rrule       text,
  
  -- ExceÃ§Ãµes: array JSON de objetos com data original e dados da exceÃ§Ã£o
  -- Formato: [{"data_original": "2026-10-10", "acao": "cancelar"}, 
  --           {"data_original": "2026-10-24", "acao": "mover", "novo_inicio": "...", "novo_fim": "..."},
  --           {"data_original": "2026-11-07", "acao": "editar", "subtipo": "uuid-do-tipo"}]
  excecoes    jsonb not null default '[]'::jsonb,
  
  -- ReferÃªncia Ã  solicitaÃ§Ã£o original (para atendimentos aprovados)
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
-- Janelas de horÃ¡rio para atendimento
-- =========================
create table regras_disponibilidade (
  id           uuid primary key default uuid_generate_v4(),
  dia_semana   int not null check (dia_semana between 0 and 6), -- 0=domingo, 6=sÃ¡bado
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

comment on table regras_disponibilidade is 'Janelas de horÃ¡rio liberadas para atendimento, por dia da semana';

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

comment on table configuracoes is 'ConfiguraÃ§Ãµes gerais do sistema (chave/valor)';

-- =========================
-- TABELA: solicitacoes
-- Pedidos de atendimento (pÃ¡gina pÃºblica)
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

comment on table solicitacoes is 'Pedidos de atendimento feitos pela pÃ¡gina pÃºblica';

create index idx_solicitacoes_status on solicitacoes(status);
create index idx_solicitacoes_inicio on solicitacoes(inicio);

-- FK de eventos para solicitacoes (precisa existir a tabela antes)
alter table eventos
  add constraint fk_eventos_solicitacao
  foreign key (solicitacao_id) references solicitacoes(id)
  on delete set null;

-- =========================
-- TRIGGER: updated_at automÃ¡tico
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
-- ============================================================================
-- AXÃ‰ AGENDA â€” Row Level Security (RLS)
-- 
-- PrincÃ­pios:
-- 1. O pai de santo (autenticado) tem acesso total a tudo
-- 2. O pÃºblico (anon) sÃ³ pode:
--    a. INSERIR em solicitacoes (pedidos de atendimento)
--    b. LER tipos_gira ativos (para exibir na pÃ¡gina pÃºblica se necessÃ¡rio)
--    c. LER configuracoes pÃºblicas (ex: atendimento_online_ativo)
--    d. NÃƒO acessa eventos diretamente (slots via API Route)
-- 3. regras_disponibilidade: leitura anÃ´nima para calcular slots na API
-- ============================================================================

-- ============================
-- Habilitar RLS em todas as tabelas
-- ============================
alter table tipos_gira enable row level security;
alter table eventos enable row level security;
alter table regras_disponibilidade enable row level security;
alter table configuracoes enable row level security;
alter table solicitacoes enable row level security;

-- ============================
-- tipos_gira
-- ============================

-- Pai de santo: CRUD total
create policy "tipos_gira_auth_all"
  on tipos_gira
  for all
  to authenticated
  using (true)
  with check (true);

-- PÃºblico: leitura de tipos ativos (para labels na pÃ¡gina pÃºblica)
create policy "tipos_gira_anon_select"
  on tipos_gira
  for select
  to anon
  using (ativo = true);

-- ============================
-- eventos
-- ============================

-- Pai de santo: CRUD total
create policy "eventos_auth_all"
  on eventos
  for all
  to authenticated
  using (true)
  with check (true);

-- PÃºblico: SEM ACESSO DIRETO
-- Slots sÃ£o calculados via API Route do Next.js (server-side)
-- que usa service_role key para ler eventos

-- ============================
-- regras_disponibilidade
-- ============================

-- Pai de santo: CRUD total
create policy "regras_auth_all"
  on regras_disponibilidade
  for all
  to authenticated
  using (true)
  with check (true);

-- PÃºblico: leitura para cÃ¡lculo de slots na API
-- (a API Route usa service_role, mas caso queira calcular client-side no futuro)
create policy "regras_anon_select"
  on regras_disponibilidade
  for select
  to anon
  using (ativo = true);

-- ============================
-- configuracoes
-- ============================

-- Pai de santo: CRUD total
create policy "config_auth_all"
  on configuracoes
  for all
  to authenticated
  using (true)
  with check (true);

-- PÃºblico: leitura de configuraÃ§Ãµes pÃºblicas
create policy "config_anon_select"
  on configuracoes
  for select
  to anon
  using (chave in ('atendimento_online_ativo', 'nome_terreiro'));

-- ============================
-- solicitacoes
-- ============================

-- Pai de santo: CRUD total (ver, aprovar, recusar)
create policy "solicitacoes_auth_all"
  on solicitacoes
  for all
  to authenticated
  using (true)
  with check (true);

-- PÃºblico: apenas INSERT (criar pedido)
create policy "solicitacoes_anon_insert"
  on solicitacoes
  for insert
  to anon
  with check (
    -- SÃ³ permite inserir com status pendente
    status = 'pendente'
    -- Modalidade presencial por padrÃ£o (online sÃ³ se configuraÃ§Ã£o ativa)
    and modalidade = 'presencial'
  );

-- PÃºblico: NÃƒO pode ler, atualizar ou deletar solicitaÃ§Ãµes
-- (Nem a prÃ³pria â€” dados sensÃ­veis, sem login pÃºblico)
-- ============================================================================
-- AXÃ‰ AGENDA â€” FunÃ§Ã£o auxiliar para validaÃ§Ã£o de modalidade online
-- e policy atualizada para solicitaÃ§Ãµes
-- ============================================================================

-- FunÃ§Ã£o que verifica se atendimento online estÃ¡ ativo
create or replace function is_online_ativo()
returns boolean as $$
begin
  return exists (
    select 1 from configuracoes
    where chave = 'atendimento_online_ativo'
    and valor = 'true'
  );
end;
$$ language plpgsql security definer stable;

-- Dropar a policy restritiva e criar uma mais flexÃ­vel
drop policy if exists "solicitacoes_anon_insert" on solicitacoes;

create policy "solicitacoes_anon_insert"
  on solicitacoes
  for insert
  to anon
  with check (
    -- SÃ³ permite status pendente
    status = 'pendente'
    -- Presencial sempre permitido; online sÃ³ se configuraÃ§Ã£o ativa
    and (
      modalidade = 'presencial'
      or (modalidade = 'online' and is_online_ativo())
    )
  );

-- ============================================================================
-- Rate limiting via tabela de controle (opcional, reforÃ§ado na API)
-- ============================================================================
-- O rate limit principal fica na API Route (Next.js middleware).
-- Aqui adicionamos uma constraint de seguranÃ§a extra no banco:
-- mÃ¡ximo de 3 solicitaÃ§Ãµes pendentes por WhatsApp

create or replace function check_rate_limit()
returns trigger as $$
declare
  pending_count int;
begin
  select count(*) into pending_count
  from solicitacoes
  where whatsapp = new.whatsapp
  and status = 'pendente';
  
  if pending_count >= 3 then
    raise exception 'Limite de solicitaÃ§Ãµes pendentes atingido para este WhatsApp'
      using errcode = 'P0001';
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_rate_limit_solicitacoes
  before insert on solicitacoes
  for each row execute function check_rate_limit();
-- ============================================================================
-- AXÉ AGENDA — Seed com dados reais do Terreiro
-- 
-- Agenda Oficial das Giras 2026:
-- 04/10 - Gira externa - Cruzamento de calunga (Domingo)
-- 10/10 - Ciganos e Esquerda (Sábado)
-- 24/10 - Pretos velhos (Sábado)
-- 07/11 - Marinheiros (Sábado)
-- 21/11 - Festa de Seu Marabô e Dona Mulambo (Sábado)
-- 05/12 - Gira de encerramento ano litúrgico (Sábado)
-- Fuso: America/Sao_Paulo (UTC-3)
-- ============================================================================

-- =========================
-- TIPOS DE GIRA
-- =========================
insert into tipos_gira (id, nome, ativo, ordem) values
  ('11111111-1111-1111-1111-111111111101', 'Gira externa - Cruzamento de calunga',           true, 1),
  ('11111111-1111-1111-1111-111111111102', 'Ciganos e Esquerda',                    true, 2),
  ('11111111-1111-1111-1111-111111111103', 'Pretos Velhos',                         true, 3),
  ('11111111-1111-1111-1111-111111111104', 'Marinheiros',                           true, 4),
  ('11111111-1111-1111-1111-111111111105', 'Festa de Seu Marabô e Dona Mulambo',    true, 5),
  ('11111111-1111-1111-1111-111111111106', 'Gira de encerramento ano litúrgico',   true, 6),
  ('11111111-1111-1111-1111-111111111107', 'Caboclos',                              true, 7),
  ('11111111-1111-1111-1111-111111111108', 'Erês (Ibejada)',                        true, 8),
  ('11111111-1111-1111-1111-111111111109', 'Baianos e Boiadeiros',                  true, 9);

-- =========================
-- CONFIGURAÇÕES
-- =========================
insert into configuracoes (chave, valor, descricao) values
  ('data_ancora_giras', '2026-09-26', 'Data da última gira realizada (âncora da recorrência)'),
  ('atendimento_online_ativo', 'false', 'Se true, habilita opção de atendimento online na página pública'),
  ('nome_terreiro', 'Tenda de Umbanda Pai Joaquim de Angola e Baiano Zé do Coco', 'Nome do terreiro exibido na página pública'),
  ('hora_inicio_gira', '18:00', 'Horário de início padrão das giras'),
  ('hora_fim_gira', '22:00', 'Horário de fim padrão das giras'),
  ('antecedencia_minima_horas', '24', 'Antecedência mínima para solicitações de atendimento'),
  ('janela_maxima_dias', '30', 'Janela máxima para agendamento');

-- =========================
-- EVENTOS: Giras Oficiais Agendadas
-- Horário: 18:00-22:00 BRT (21:00-01:00 UTC)
-- =========================
insert into eventos (id, tipo, titulo, subtipo, inicio, fim, dia_inteiro, rrule, excecoes) values
  -- 04/10/2026 - Domingo: Gira externa - Cruzamento de calunga
  (
    '22222222-2222-2222-2222-222222222201',
    'gira',
    'Gira externa - Cruzamento de calunga',
    '11111111-1111-1111-1111-111111111101',
    '2026-10-04 21:00:00+00',
    '2026-10-05 01:00:00+00',
    false,
    null,
    '[]'::jsonb
  ),
  -- 10/10/2026 - Sábado: Ciganos e Esquerda
  (
    '22222222-2222-2222-2222-222222222202',
    'gira',
    'Ciganos e Esquerda',
    '11111111-1111-1111-1111-111111111102',
    '2026-10-10 21:00:00+00',
    '2026-10-11 01:00:00+00',
    false,
    null,
    '[]'::jsonb
  ),
  -- 24/10/2026 - Sábado: Pretos velhos
  (
    '22222222-2222-2222-2222-222222222203',
    'gira',
    'Pretos velhos',
    '11111111-1111-1111-1111-111111111103',
    '2026-10-24 21:00:00+00',
    '2026-10-25 01:00:00+00',
    false,
    null,
    '[]'::jsonb
  ),
  -- 07/11/2026 - Sábado: Marinheiros
  (
    '22222222-2222-2222-2222-222222222204',
    'gira',
    'Marinheiros',
    '11111111-1111-1111-1111-111111111104',
    '2026-11-07 21:00:00+00',
    '2026-11-08 01:00:00+00',
    false,
    null,
    '[]'::jsonb
  ),
  -- 21/11/2026 - Sábado: Festa de Seu Marabô e Dona Mulambo
  (
    '22222222-2222-2222-2222-222222222205',
    'gira',
    'Festa de Seu Marabô e Dona Mulambo',
    '11111111-1111-1111-1111-111111111105',
    '2026-11-21 21:00:00+00',
    '2026-11-22 01:00:00+00',
    false,
    null,
    '[]'::jsonb
  ),
  -- 05/12/2026 - Sábado: Gira de encerramento ano litúrgico
  (
    '22222222-2222-2222-2222-222222222206',
    'gira',
    'Gira de encerramento ano litúrgico',
    '11111111-1111-1111-1111-111111111106',
    '2026-12-05 21:00:00+00',
    '2026-12-06 01:00:00+00',
    false,
    null,
    '[]'::jsonb
  );

-- =========================
-- REGRAS DE DISPONIBILIDADE
-- Terça a Sexta, 09:00-17:00
-- =========================
insert into regras_disponibilidade (id, dia_semana, hora_inicio, hora_fim, duracao_min, buffer_min, limite_dia, limite_semana, modalidade, ativo) values
  ('33333333-3333-3333-3333-333333333302', 2, '09:00', '17:00', 60, 15, 4, 15, 'presencial', true),
  ('33333333-3333-3333-3333-333333333303', 3, '14:00', '19:00', 60, 15, 4, 15, 'presencial', true),
  ('33333333-3333-3333-3333-333333333304', 4, '09:00', '17:00', 60, 15, 4, 15, 'presencial', true),
  ('33333333-3333-3333-3333-333333333305', 5, '14:00', '18:00', 60, 15, 4, 15, 'online',     true);

-- =========================
-- BLOQUEIO RECORRENTE: Segunda-feira pessoal
-- =========================
insert into eventos (id, tipo, titulo, subtipo, inicio, fim, dia_inteiro, rrule, excecoes) values
  (
    '44444444-4444-4444-4444-444444444401',
    'bloqueio_pessoal',
    'Descanso da Família',
    null,
    '2026-09-28 03:00:00+00',
    '2026-09-29 03:00:00+00',
    true,
    'FREQ=WEEKLY;BYDAY=MO',
    '[]'::jsonb
  );

