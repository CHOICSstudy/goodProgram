create extension if not exists btree_gist;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  site text not null,
  login_id text not null,
  login_password text not null,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  account_id uuid not null references accounts(id) on delete cascade
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  member_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint reservations_no_overlap exclude using gist (
    account_id with =,
    tstzrange(start_at, end_at) with &&
  )
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  member_name text not null,
  checked_in_at timestamptz not null default now(),
  planned_checkout_at timestamptz,
  checked_out_at timestamptz
);

create table login_attempts (
  ip text primary key,
  fail_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- 한 계정에 열린 세션은 하나만 (체크인 경합 방지)
create unique index sessions_one_active_per_account
  on sessions (account_id) where checked_out_at is null;
