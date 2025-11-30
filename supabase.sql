-- Run this SQL in your Supabase SQL editor to create required tables

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists reviewers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id) on delete cascade,
  title text not null,
  content_html text not null,
  created_at timestamptz default now()
);

-- Optional index
create index if not exists idx_reviewers_subject on reviewers(subject_id);
