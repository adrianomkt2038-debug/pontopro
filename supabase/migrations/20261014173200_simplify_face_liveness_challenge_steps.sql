-- Reduce false liveness failures by requiring a randomized blink plus one head turn.
-- Preserve compatibility with already-created three-step challenges in history.
alter table public.face_liveness_challenges
  drop constraint face_liveness_challenges_challenge_steps_check,
  add constraint face_liveness_challenges_challenge_steps_check
  check (
    (
      cardinality(challenge_steps) = 2
      and challenge_steps @> array['blink']::text[]
      and challenge_steps <@ array['blink', 'turn_left', 'turn_right']::text[]
      and (('turn_left' = any(challenge_steps)) <> ('turn_right' = any(challenge_steps)))
    )
    or
    (
      cardinality(challenge_steps) = 3
      and challenge_steps @> array['blink', 'turn_left', 'turn_right']::text[]
      and challenge_steps <@ array['blink', 'turn_left', 'turn_right']::text[]
    )
  );
