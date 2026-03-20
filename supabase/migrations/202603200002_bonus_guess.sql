create or replace function public.rpc_submit_clue(
  p_code text,
  p_player_token text,
  p_word text,
  p_number integer
)
returns void
language plpgsql
security definer
as $$
declare
  game_row public.games%rowtype;
begin
  perform public.rpc_maybe_finish_preparation(p_code);

  select g.* into game_row
  from public.games g
  join public.rooms r on r.id = g.room_id
  where r.code = upper(trim(p_code))
  for update;

  if game_row.id is null then
    raise exception 'Game not found';
  end if;

  if game_row.phase <> 'active' then
    raise exception 'Game is not active';
  end if;

  if game_row.preparation_ends_at is not null then
    raise exception 'Preparation phase active';
  end if;

  perform public.require_action_permission(game_row.room_id, p_player_token, game_row.current_team, false, false);

  if game_row.current_clue_word is not null then
    raise exception 'Current clue already exists';
  end if;

  update public.games
  set
    current_clue_word = lower(trim(p_word)),
    current_clue_number = p_number,
    remaining_guesses = p_number + 1,
    version = version + 1
  where id = game_row.id;

  perform public.log_game_event(game_row.id, 'clue_submitted', jsonb_build_object('word', lower(trim(p_word)), 'number', p_number));
end;
$$;
