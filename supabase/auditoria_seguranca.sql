-- ============================================================================
-- AXÉ AGENDA — SCRIPT DE AUDITORIA DE SEGURANÇA E CONFORMIDADE RLS
-- Execute este script no SQL Editor do Supabase para validar a segurança do seu banco.
-- ============================================================================

-- 1. Diagnóstico de Tabelas e Row Level Security (RLS)
-- Todas as tabelas DEVEM ter rowsecurity = true
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_ativo,
  CASE 
    WHEN rowsecurity = true THEN '✅ SEGURO (RLS Habilitado)'
    ELSE '🚨 VULNERÁVEL (RLS Desativado)'
  END AS status_seguranca
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Lista de Políticas de Acesso Configuradas (RLS Policies)
-- Mostra quais papéis (anon vs authenticated) têm acesso a quê
SELECT 
  tablename,
  policyname,
  roles,
  cmd AS operacao,
  qual AS condicao_using,
  with_check AS condicao_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 3. Verificação de Isolamento de Dados Pessoais (LGPD)
-- Confirma que o público ('anon') NÃO tem nenhuma política de SELECT em solicitacoes ou eventos
SELECT 
  tablename,
  cmd,
  roles,
  CASE 
    WHEN 'anon' = ANY(roles) AND cmd = 'SELECT' THEN '🚨 ALERTA: Leitura pública permitida'
    ELSE '✅ SEGURO: Bloqueado para público'
  END AS diagnostico_lgpd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('eventos', 'solicitacoes');
