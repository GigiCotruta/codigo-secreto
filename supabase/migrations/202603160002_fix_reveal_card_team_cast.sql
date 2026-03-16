create or replace function public.rpc_reveal_card(
  p_code text,
  p_player_token text,
  p_card_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  game_row public.games%rowtype;
  card_row public.game_cards%rowtype;
  other_team team_color;
  revealed_count integer;
  total_count integer;
  next_remaining integer;
begin
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

  perform public.require_action_permission(game_row.room_id, p_player_token, game_row.current_team, false, false);

  if game_row.current_clue_word is null then
    raise exception 'Submit a clue first';
  end if;

  if game_row.remaining_guesses <= 0 then
    raise exception 'No remaining guesses';
  end if;

  select * into card_row from public.game_cards where id = p_card_id and game_id = game_row.id for update;
  if card_row.id is null then
    raise exception 'Card not found';
  end if;

  if card_row.is_revealed then
    raise exception 'Card already revealed';
  end if;

  update public.game_cards
  set is_revealed = true, revealed_at = timezone('utc', now())
  where id = card_row.id;

  next_remaining := game_row.remaining_guesses - 1;

  if card_row.owner_type = 'assassin' then
    other_team := case when game_row.current_team = 'red' then 'blue' else 'red' end;

    update public.games
    set
      phase = 'finished',
      assassin_revealed = true,
      winner_team = other_team,
      loser_team = game_row.current_team,
      timer_status = 'stopped',
      timer_started_at = null,
      remaining_guesses = 0,
      version = version + 1
    where id = game_row.id;

    update public.rooms set status = 'finished' where id = game_row.room_id;

    perform public.log_game_event(game_row.id, 'game_ended', jsonb_build_object('reason', 'assassin', 'loser', game_row.current_team));
    return;
  end if;

  if card_row.owner_type = game_row.current_team::text::card_owner then
    select count(*) into revealed_count from public.game_cards where game_id = game_row.id and owner_type = game_row.current_team::text::card_owner and is_revealed = true;
    select count(*) into total_count from public.game_cards where game_id = game_row.id and owner_type = game_row.current_team::text::card_owner;

    if revealed_count = total_count then
      other_team := case when game_row.current_team = 'red' then 'blue' else 'red' end;

      update public.games
      set
        phase = 'finished',
        winner_team = game_row.current_team,
        loser_team = other_team,
        timer_status = 'stopped',
        timer_started_at = null,
        remaining_guesses = 0,
        version = version + 1
      where id = game_row.id;

      update public.rooms set status = 'finished' where id = game_row.room_id;

      perform public.log_game_event(game_row.id, 'game_ended', jsonb_build_object('reason', 'all_cards_revealed', 'winner', game_row.current_team));
      return;
    end if;

    if next_remaining > 0 then
      update public.games
      set remaining_guesses = next_remaining,
          version = version + 1
      where id = game_row.id;
      perform public.log_game_event(game_row.id, 'card_revealed', jsonb_build_object('owner', card_row.owner_type, 'continues', true));
      return;
    end if;

    perform public.switch_turn(game_row.id);
    perform public.log_game_event(game_row.id, 'turn_ended', jsonb_build_object('reason', 'guesses_exhausted'));
    return;
  end if;

  perform public.switch_turn(game_row.id);
  perform public.log_game_event(game_row.id, 'turn_ended', jsonb_build_object('reason', 'wrong_guess', 'owner', card_row.owner_type));
end;
$$;
