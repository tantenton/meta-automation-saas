-- Thread chains idempotency table
-- Prevents duplicate UTAS posts when job retries

create table if not exists thread_chains (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade not null,
  chain_id text not null,
  idempotency_key text unique not null,
  node_count int not null default 0,
  status text check (status in ('pending', 'published', 'failed')) default 'pending' not null,
  published_at timestamp with time zone,
  error_message text,
  nodes jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists thread_chains_idempotency_key_idx on thread_chains (idempotency_key);
create index if not exists thread_chains_account_id_idx on thread_chains (account_id);
create index if not exists thread_chains_created_at_idx on thread_chains (created_at desc);
