-- ============================================================================
-- AXÉ AGENDA — Row Level Security (RLS)
-- 
-- Princípios:
-- 1. O pai de santo (autenticado) tem acesso total a tudo
-- 2. O público (anon) só pode:
--    a. INSERIR em solicitacoes (pedidos de atendimento)
--    b. LER tipos_gira ativos (para exibir na página pública se necessário)
--    c. LER configuracoes públicas (ex: atendimento_online_ativo)
--    d. NÃO acessa eventos diretamente (slots via API Route)
-- 3. regras_disponibilidade: leitura anônima para calcular slots na API
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
-- Defesa em Profundidade: Privilégios de Tabela (Grants)
-- ============================
revoke all on eventos from anon;
revoke select, update, delete on solicitacoes from anon;
grant select on tipos_gira to anon;
grant select on regras_disponibilidade to anon;
grant select on configuracoes to anon;
grant insert on solicitacoes to anon;

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

-- Público: leitura de tipos ativos (para labels na página pública)
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

-- Público: SEM ACESSO DIRETO
-- Slots são calculados via API Route do Next.js (server-side)
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

-- Público: leitura para cálculo de slots na API
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

-- Público: leitura de configurações públicas
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

-- Público: apenas INSERT (criar pedido)
create policy "solicitacoes_anon_insert"
  on solicitacoes
  for insert
  to anon
  with check (
    -- Só permite inserir com status pendente
    status = 'pendente'
    -- Modalidade presencial por padrão (online só se configuração ativa)
    and modalidade = 'presencial'
  );

-- Público: NÃO pode ler, atualizar ou deletar solicitações
-- (Nem a própria — dados sensíveis, sem login público)
