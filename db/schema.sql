create table if not exists designers (
  id serial primary key,
  name text not null unique,
  rr_order int not null unique,
  telegram_chat_id text,
  active boolean not null default true
);

create table if not exists rr_state (
  id int primary key default 1 check (id = 1),
  next_index int not null default 0
);

create table if not exists calls (
  id serial primary key,
  call_id text unique,
  created_at timestamptz not null default now(),
  caller_name text,
  caller_phone text,
  project_type text,
  area text,
  size_sqft int,
  timeline_text text,
  decision_maker text,
  source text,
  budget_note text,
  outcome text not null check (outcome in ('qualified','declined','escalated','missed','info_only')),
  decline_reason text,
  tier text check (tier in ('hot','priority','standard')),
  tier_reasons text,
  call_by timestamptz,
  designer_id int references designers(id),
  slot_start timestamptz,
  window_missed boolean not null default false,
  status text not null default 'new',
  summary text,
  transcript text,
  duration_sec int,
  cost_inr numeric(10,2),
  reviewed boolean not null default false,
  hubspot_deal_id text,
  telegram_message_id text
);

create table if not exists bookings (
  id serial primary key,
  designer_id int not null references designers(id),
  call_id int references calls(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  unique (designer_id, start_at)
);

create table if not exists status_events (
  id serial primary key,
  call_id int not null references calls(id),
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists calls_outcome_idx on calls (outcome, created_at desc);

alter table calls add column if not exists recording_url text;

create table if not exists users (
  id serial primary key,
  username text not null unique,
  name text not null,
  role text not null check (role in ('frontdesk','designer','chayya')),
  designer_id int references designers(id),
  password_hash text not null,
  must_change boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id int not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_idx on sessions (user_id)
;

alter table calls add column if not exists is_demo boolean not null default false;

create table if not exists projects (
  id serial primary key,
  code text unique,
  call_id int references calls(id),
  designer_id int not null references designers(id),
  name text not null,
  customer_name text not null,
  customer_phone text,
  area text,
  site_address text,
  project_type text,
  size_sqft int,
  stage text not null check (stage in ('design','approvals','execution','finishing','handover')),
  progress_pct int not null default 0,
  start_date date,
  target_date date,
  value_lakh numeric(6,2),
  summary text,
  hero_photo text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists project_designs (
  id serial primary key,
  project_id int not null references projects(id) on delete cascade,
  title text not null,
  kind text not null,
  version int not null default 1,
  status text not null default 'shared',
  image_path text,
  notes text,
  shared_on date
);

create table if not exists project_photos (
  id serial primary key,
  project_id int not null references projects(id) on delete cascade,
  caption text not null,
  stage text,
  taken_on date,
  image_path text not null
);

create table if not exists messages (
  id serial primary key,
  call_id int references calls(id) on delete cascade,
  project_id int references projects(id) on delete cascade,
  channel text not null check (channel in ('telegram','whatsapp','sms')),
  sender text not null default 'Chayya',
  to_name text,
  to_address text,
  body text not null,
  status text not null default 'sent' check (status in ('sent','not_sent')),
  note text,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false
);

alter table bookings add column if not exists kind text not null default 'consultation';
alter table bookings add column if not exists title text;
alter table bookings add column if not exists project_id int references projects(id) on delete cascade;
alter table bookings add column if not exists location text;
alter table bookings add column if not exists is_demo boolean not null default false;

create index if not exists messages_call_idx on messages (call_id);
create index if not exists projects_designer_idx on projects (designer_id)
;

create table if not exists files (
  id serial primary key,
  project_id int not null references projects(id) on delete cascade,
  kind text not null check (kind in ('photo','design')),
  mime text not null,
  size int not null,
  name text,
  data bytea not null,
  uploaded_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists files_project_idx on files (project_id)

;

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('frontdesk','designer','chayya'))
