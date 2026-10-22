-- Banco próprio do app de validação (VALIDACAO_DATABASE_URL).
-- O banco da Nova Escala (DATABASE_URL) é usado só para conferir o login.
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

-- Bateria de validação: um grupo de validações identificado pelo número da GML.
create table if not exists validacao.baterias (
  id uuid primary key default gen_random_uuid(),
  gml text not null,
  criado_por text not null,
  criado_em timestamptz not null default now()
);

-- Link da pasta no SharePoint, informado depois do upload. Ao salvar, PDFs e prints são apagados.
alter table validacao.baterias add column if not exists link_pasta text;
alter table validacao.baterias add column if not exists finalizada_em timestamptz;
alter table validacao.baterias add column if not exists finalizada_por text;

-- Uma validação de jornada dentro de uma bateria. Sem linha = pendente.
create table if not exists validacao.execucoes (
  id uuid primary key default gen_random_uuid(),
  bateria_id uuid not null references validacao.baterias(id) on delete cascade,
  jornada_id uuid not null references validacao.jornadas(id) on delete restrict,
  jornada_nome text not null,
  status text not null check (status in ('em_validacao', 'concluida')),
  responsavel_email text not null,
  responsavel_nome text,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  progresso jsonb,
  pdf bytea,
  unique (bateria_id, jornada_id)
);

-- Prints da validação. Ficam até o link da pasta ser salvo na bateria
-- (ou somem ao liberar a validação, por cascade).
create table if not exists validacao.execucao_prints (
  execucao_id uuid not null references validacao.execucoes(id) on delete cascade,
  passo_id text not null,
  imagem bytea not null,
  tipo text not null,
  atualizado_em timestamptz not null default now(),
  primary key (execucao_id, passo_id)
);
