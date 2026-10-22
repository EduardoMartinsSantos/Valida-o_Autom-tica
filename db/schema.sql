-- Esquema próprio do app de validação, dentro do banco da Nova Escala (Neon).
-- Não altera nenhuma tabela da Nova Escala; só lê public.colaboradores no login.
create schema if not exists validacao;

create table if not exists validacao.jornadas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null,
  passos jsonb not null,
  criado_por text not null,
  atualizado_por text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists jornadas_nome_key on validacao.jornadas (lower(nome));

-- Bloqueio de força bruta no login (por e-mail).
create table if not exists validacao.login_falhas (
  email text primary key,
  tentativas integer not null,
  desde timestamptz not null
);
