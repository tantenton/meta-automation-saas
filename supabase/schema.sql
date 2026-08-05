-- Meta Automation SaaS — Supabase Schema
-- Date: 2026-08-05
-- Tables: users, accounts, posts, analytics

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users table
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  meta_access_token text,
  meta_refresh_token text,
  meta_token_expiry timestamp with time zone,
  meta_account_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Accounts table (Instagram Business/Creator + Threads)
create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  platform text check (platform in ('instagram', 'threads', 'facebook')) not null,
  account_id text not null,
  account_name text,
  profile_picture_url text,
  follower_count int default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, platform, account_id)
);

-- 3. Posts table
create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade not null,
  content text not null,
  media_url text[] default '{}',
  status text check (status in ('draft', 'scheduled', 'published', 'failed')) default 'draft' not null,
  scheduled_at timestamp with time zone,
  published_at timestamp with time zone,
  meta_media_id text,
  meta_post_id text,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Analytics table (daily insights)
create table if not exists analytics (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references posts(id) on delete cascade not null,
  reach int default 0,
  impressions int default 0,
  likes int default 0,
  comments int default 0,
  shares int default 0,
  saves int default 0,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(post_id, date)
);

-- RLS Policies
alter table users enable row level security;
alter table accounts enable row level security;
alter table posts enable row level security;
alter table analytics enable row level security;

-- Users: own data only
create policy "Users can view own profile"
  on users for select using (auth.uid() = id);

create policy "Users can update own profile"
  on users for update using (auth.uid() = id);

-- Accounts: owner only
create policy "Users can view own accounts"
  on accounts for select using (
    exists (select 1 from users where id = auth.uid() and users.id = accounts.user_id)
  );

create policy "Users can insert own accounts"
  on accounts for insert with check (
    exists (select 1 from users where id = auth.uid() and users.id = accounts.user_id)
  );

create policy "Users can update own accounts"
  on accounts for update using (
    exists (select 1 from users where id = auth.uid() and users.id = accounts.user_id)
  );

-- Posts: owner via accounts join
create policy "Users can view own posts"
  on posts for select using (
    exists (select 1 from accounts where id = posts.account_id and accounts.user_id = auth.uid())
  );

create policy "Users can insert own posts"
  on posts for insert with check (
    exists (select 1 from accounts where id = posts.account_id and accounts.user_id = auth.uid())
  );

create policy "Users can update own posts"
  on posts for update using (
    exists (select 1 from accounts where id = posts.account_id and accounts.user_id = auth.uid())
  );

create policy "Users can delete own posts"
  on posts for delete using (
    exists (select 1 from accounts where id = posts.account_id and accounts.user_id = auth.uid())
  );

-- Analytics: owner via posts join
create policy "Users can view own analytics"
  on analytics for select using (
    exists (select 1 from posts where id = analytics.post_id and posts.account_id in (
      select id from accounts where user_id = auth.uid()
    ))
  );

-- Triggers for updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger set_users_updated_at before update on users for each row execute function update_updated_at();
create trigger set_accounts_updated_at before update on accounts for each row execute function update_updated_at();
create trigger set_posts_updated_at before update on posts for each row execute function update_updated_at();
