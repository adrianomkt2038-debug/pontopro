-- One-time server-issued challenges for active face liveness verification.
-- These records contain no images or video and are not readable by browser roles.
create table if not exists public.face_liveness_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('clock_in', 'enrollment')),
  challenge_steps text[] not null check (
    cardinality(challenge_steps) = 3
    and challenge_steps @> array['blink', 'turn_left', 'turn_right']::text[]
    and challenge_steps <@ array['blink', 'turn_left', 'turn_right']::text[]
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists face_liveness_challenges_user_created_idx
  on public.face_liveness_challenges (user_id, created_at desc);

alter table public.face_liveness_challenges enable row level security;
revoke all on table public.face_liveness_challenges from anon, authenticated;
grant all on table public.face_liveness_challenges to service_role;
