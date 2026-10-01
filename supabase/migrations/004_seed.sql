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

