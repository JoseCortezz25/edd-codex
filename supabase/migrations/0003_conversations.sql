-- 0003_conversations.sql
-- Conversation traceability on top of eve sessions.
-- eve persists durable session history; the app persists the session cursor
-- (eve sessionId + streamIndex), the event log used for resume (initialEvents),
-- and queryable projections (steps/usage, tool invocations, HITL input requests).
-- One conversation chains 1..N eve sessions: eve sessions expire (default 30 days)
-- and the next message then starts a fresh session inside the same conversation.
-- Same convention as 0002: no ON DELETE CASCADE, deletion is bottom-up and explicit.

create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete restrict,
  brand_id        uuid references brands (id) on delete restrict, -- null only for client/brand setup chats
  title           text,
  status          text not null default 'active' check (status in ('active', 'archived')),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists conversations_user_brand_recent_idx
  on conversations (user_id, brand_id, last_message_at desc);
create index if not exists conversations_brand_id_idx on conversations (brand_id);

create table if not exists eve_sessions (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations (id) on delete restrict,
  parent_session_id uuid references eve_sessions (id) on delete restrict, -- subagent: parent of childSessionId
  eve_session_id    text not null unique,                                 -- eve sessionId
  stream_index      integer not null default 0,                           -- resume cursor (streamIndex)
  status            text not null default 'active'
                    check (status in ('active', 'completed', 'failed', 'expired')),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz
);
create index if not exists eve_sessions_conversation_idx on eve_sessions (conversation_id, started_at desc);
create index if not exists eve_sessions_parent_idx on eve_sessions (parent_session_id);

create table if not exists session_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references eve_sessions (id) on delete restrict,
  event_id     text not null unique,  -- eve meta.id; dedupes overlapping replays
  stream_index integer not null,
  type         text not null,         -- message.received, action.result, step.completed, ...
  payload      jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists session_events_session_stream_idx on session_events (session_id, stream_index);
create index if not exists session_events_type_idx on session_events (type);

create table if not exists session_steps (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references eve_sessions (id) on delete restrict,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  status        text not null check (status in ('completed', 'failed')), -- step.completed | step.failed
  created_at    timestamptz not null default now()
);
create index if not exists session_steps_session_idx on session_steps (session_id);

create table if not exists tool_invocations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references eve_sessions (id) on delete restrict,
  tool_name   text not null,  -- manage_brand, render_piece, ...
  input       jsonb not null,
  output      jsonb,
  status      text not null default 'pending' check (status in ('pending', 'success', 'error')),
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists tool_invocations_session_idx on tool_invocations (session_id);
create index if not exists tool_invocations_tool_name_idx on tool_invocations (tool_name);

create table if not exists input_requests (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references eve_sessions (id) on delete restrict,
  tool_invocation_id uuid references tool_invocations (id) on delete restrict,
  request_id         text not null unique, -- eve requestId (input.requested / input.resolved)
  kind               text not null check (kind in ('approval', 'question')),
  options            jsonb,
  answer             text,                 -- optionId or freeform text
  resolved_by        uuid references auth.users (id) on delete restrict,
  requested_at       timestamptz not null default now(),
  resolved_at        timestamptz
);
create index if not exists input_requests_session_idx on input_requests (session_id);
create index if not exists input_requests_tool_invocation_idx on input_requests (tool_invocation_id);
create index if not exists input_requests_resolved_by_idx on input_requests (resolved_by);

alter table library_assets
  add column if not exists uploaded_in_session_id uuid references eve_sessions (id) on delete restrict;
create index if not exists library_assets_uploaded_in_session_idx on library_assets (uploaded_in_session_id);

alter table conversations    enable row level security;
alter table eve_sessions     enable row level security;
alter table session_events   enable row level security;
alter table session_steps    enable row level security;
alter table tool_invocations enable row level security;
alter table input_requests   enable row level security;
