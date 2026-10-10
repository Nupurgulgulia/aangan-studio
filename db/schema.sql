create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  vaani_call_id text not null unique,
  caller_number text,
  caller_name text,
  started_at timestamptz not null default now(),
  duration_sec integer,
  answered_after_sec integer,
  after_hours boolean not null default false,
  answer_trigger text,                    -- 'after_hours' | 'no_answer_3_rings'
  transcript text,

  label text check (label in ('qualified','borderline','not_a_fit')),
  reason text,
  criteria jsonb,                         -- 5 criteria: status, evidence_quote, note
  brief jsonb,
  uncertainty jsonb,
  pricing_violation boolean not null default false,
  pricing_violation_text text,
  scoring_error text,

  status text not null default 'received'
    check (status in ('received','with_designer','in_review','closed')),
  designer_name text,
  designer_email text,
  booking_start timestamptz,
  booking_url text,

  stage text not null default 'new'
    check (stage in ('new','accepted','called','proposal','won','lost')),
  stage_changed_at timestamptz default now(),
  accepted_at timestamptz,
  deal_value_inr numeric,
  lost_reason text,

  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  reminded_at timestamptz,

  hubspot_deal_id text,
  hubspot_error text,
  email_error text,

  vaani_cost_inr numeric not null default 0,
  ai_cost_inr numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists calls_created_idx on public.calls (created_at desc);
create index if not exists calls_status_idx on public.calls (status);


-- v2 (aligned with the team reference): deterministic rules over extracted fields, escalation tier.
alter table public.calls add column if not exists fields jsonb;
alter table public.calls add column if not exists reasons jsonb;
alter table public.calls add column if not exists caller_email text;
alter table public.calls drop constraint if exists calls_label_check;
alter table public.calls add constraint calls_label_check check (label in ('qualified','borderline','not_a_fit','escalate'));
