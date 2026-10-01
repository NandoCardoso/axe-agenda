-- ============================================================================
-- AXÉ AGENDA — Função auxiliar para validação de modalidade online
-- e policy atualizada para solicitações
-- ============================================================================

-- Função que verifica se atendimento online está ativo
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

-- Dropar a policy restritiva e criar uma mais flexível
drop policy if exists "solicitacoes_anon_insert" on solicitacoes;

create policy "solicitacoes_anon_insert"
  on solicitacoes
  for insert
  to anon
  with check (
    -- Só permite status pendente
    status = 'pendente'
    -- Presencial sempre permitido; online só se configuração ativa
    and (
      modalidade = 'presencial'
      or (modalidade = 'online' and is_online_ativo())
    )
  );

-- ============================================================================
-- Rate limiting via tabela de controle (opcional, reforçado na API)
-- ============================================================================
-- O rate limit principal fica na API Route (Next.js middleware).
-- Aqui adicionamos uma constraint de segurança extra no banco:
-- máximo de 3 solicitações pendentes por WhatsApp

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
    raise exception 'Limite de solicitações pendentes atingido para este WhatsApp'
      using errcode = 'P0001';
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_rate_limit_solicitacoes
  before insert on solicitacoes
  for each row execute function check_rate_limit();
