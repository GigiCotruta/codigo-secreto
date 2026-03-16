alter type player_role add value if not exists 'player';

alter table public.room_players
  add column if not exists player_team team_color;

alter table public.games
  add column if not exists preparation_ends_at timestamptz;

create or replace function public.switch_turn(p_game_id uuid)
returns void
language plpgsql
as $$
declare
  current_turn team_color;
  next_turn team_color;
begin
  select current_team into current_turn from public.games where id = p_game_id for update;

  if current_turn is null then
    raise exception 'Game not found';
  end if;

  next_turn := case when current_turn = 'red' then 'blue' else 'red' end;

  update public.games
  set
    current_team = next_turn,
    current_clue_word = null,
    current_clue_number = null,
    remaining_guesses = 0,
    timer_remaining_seconds = 120,
    timer_status = 'running',
    timer_started_at = timezone('utc', now()),
    preparation_ends_at = null,
    version = version + 1
  where id = p_game_id;
end;
$$;

create or replace function public.rpc_create_room(
  p_code text,
  p_creator_token text,
  p_nickname text
)
returns uuid
language plpgsql
security definer
as $$
declare
  room_id_value uuid;
begin
  insert into public.rooms (code, creator_token)
  values (upper(trim(p_code)), p_creator_token)
  returning id into room_id_value;

  insert into public.room_players (room_id, player_token, nickname, role, is_connected)
  values (room_id_value, p_creator_token, p_nickname, 'player', true);

  insert into public.games (room_id, phase, timer_status, timer_remaining_seconds)
  values (room_id_value, 'lobby', 'stopped', 120);

  return room_id_value;
end;
$$;

create or replace function public.rpc_join_room(
  p_code text,
  p_player_token text,
  p_nickname text
)
returns uuid
language plpgsql
security definer
as $$
declare
  room_id_value uuid;
  current_count integer;
  existing_player boolean;
begin
  select id into room_id_value from public.rooms where code = upper(trim(p_code));

  if room_id_value is null then
    raise exception 'Room not found';
  end if;

  select exists(
    select 1 from public.room_players where room_id = room_id_value and player_token = p_player_token
  ) into existing_player;

  select count(*) into current_count from public.room_players where room_id = room_id_value;
  if current_count >= 20 and not existing_player then
    raise exception 'Room is full';
  end if;

  insert into public.room_players (room_id, player_token, nickname, role, is_connected, last_seen_at)
  values (room_id_value, p_player_token, p_nickname, 'player', true, timezone('utc', now()))
  on conflict (room_id, player_token)
  do update set
    nickname = excluded.nickname,
    is_connected = true,
    last_seen_at = timezone('utc', now());

  return room_id_value;
end;
$$;

create or replace function public.rpc_select_role(
  p_code text,
  p_player_token text,
  p_role player_role
)
returns void
language plpgsql
security definer
as $$
declare
  room_id_value uuid;
  team_value team_color;
begin
  select id into room_id_value from public.rooms where code = upper(trim(p_code));
  if room_id_value is null then
    raise exception 'Room not found';
  end if;

  if p_role = 'red_captain' and exists (
    select 1 from public.room_players
    where room_id = room_id_value
      and role = 'red_captain'
      and player_token <> p_player_token
      and is_connected = true
  ) then
    raise exception 'Red captain role is already taken';
  end if;

  if p_role = 'blue_captain' and exists (
    select 1 from public.room_players
    where room_id = room_id_value
      and role = 'blue_captain'
      and player_token <> p_player_token
      and is_connected = true
  ) then
    raise exception 'Blue captain role is already taken';
  end if;

  team_value := case
    when p_role = 'red_captain' then 'red'::team_color
    when p_role = 'blue_captain' then 'blue'::team_color
    else null
  end;

  update public.room_players
  set role = p_role,
      player_team = team_value,
      last_seen_at = timezone('utc', now())
  where room_id = room_id_value and player_token = p_player_token;
end;
$$;

create or replace function public.rpc_start_game(
  p_code text,
  p_player_token text,
  p_starting_team team_color,
  p_board jsonb
)
returns void
language plpgsql
security definer
as $$
declare
  room_id_value uuid;
  game_id_value uuid;
  red_exists boolean;
  blue_exists boolean;
  actor_role player_role;
begin
  select id into room_id_value from public.rooms where code = upper(trim(p_code));
  if room_id_value is null then
    raise exception 'Room not found';
  end if;

  select role into actor_role
  from public.room_players
  where room_id = room_id_value and player_token = p_player_token;

  if actor_role is null then
    raise exception 'Player not in room';
  end if;

  if actor_role not in ('red_captain', 'blue_captain') then
    raise exception 'Only captains can start the game';
  end if;

  select exists(select 1 from public.room_players where room_id = room_id_value and role = 'red_captain' and is_connected = true) into red_exists;
  select exists(select 1 from public.room_players where room_id = room_id_value and role = 'blue_captain' and is_connected = true) into blue_exists;

  if not red_exists or not blue_exists then
    raise exception 'Both captains are required to start';
  end if;

  update public.room_players set player_team = 'red' where room_id = room_id_value and role = 'red_captain';
  update public.room_players set player_team = 'blue' where room_id = room_id_value and role = 'blue_captain';

  with randomized as (
    select
      id,
      row_number() over (order by random()) as rn,
      count(*) over () as total
    from public.room_players
    where room_id = room_id_value and role = 'player' and is_connected = true
  )
  update public.room_players rp
  set player_team = case when randomized.rn <= ceil(randomized.total / 2.0) then 'red'::team_color else 'blue'::team_color end
  from randomized
  where rp.id = randomized.id;

  update public.rooms set status = 'active' where id = room_id_value;

  select id into game_id_value from public.games where room_id = room_id_value for update;

  update public.games
  set
    phase = 'active',
    starting_team = p_starting_team,
    current_team = p_starting_team,
    current_clue_word = null,
    current_clue_number = null,
    remaining_guesses = 0,
    timer_remaining_seconds = 120,
    timer_status = 'paused',
    timer_started_at = null,
    preparation_ends_at = timezone('utc', now()) + interval '1 minute',
    winner_team = null,
    loser_team = null,
    assassin_revealed = false,
    version = version + 1
  where id = game_id_value;

  delete from public.game_cards where game_id = game_id_value;

  insert into public.game_cards (game_id, position, word, owner_type, is_revealed)
  select
    game_id_value,
    (card ->> 'position')::integer,
    card ->> 'word',
    (card ->> 'owner_type')::card_owner,
    false
  from jsonb_array_elements(p_board) as card;

  perform public.log_game_event(game_id_value, 'game_started', jsonb_build_object('startingTeam', p_starting_team, 'preparationSeconds', 60));
end;
$$;

create or replace function public.rpc_maybe_finish_preparation(
  p_code text
)
returns boolean
language plpgsql
security definer
as $$
declare
  game_row public.games%rowtype;
begin
  select g.* into game_row
  from public.games g
  join public.rooms r on r.id = g.room_id
  where r.code = upper(trim(p_code))
  for update;

  if game_row.id is null then
    return false;
  end if;

  if game_row.phase <> 'active' or game_row.preparation_ends_at is null then
    return false;
  end if;

  if timezone('utc', now()) < game_row.preparation_ends_at then
    return false;
  end if;

  update public.games
  set
    preparation_ends_at = null,
    timer_status = 'running',
    timer_started_at = timezone('utc', now()),
    version = version + 1
  where id = game_row.id;

  perform public.log_game_event(game_row.id, 'preparation_ended', jsonb_build_object('team', game_row.current_team));
  return true;
end;
$$;

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

create or replace function public.rpc_end_turn(
  p_code text,
  p_player_token text
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

  perform public.switch_turn(game_row.id);
  perform public.log_game_event(game_row.id, 'turn_ended', jsonb_build_object('reason', 'manual'));
end;
$$;

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
      preparation_ends_at = null,
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
        preparation_ends_at = null,
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

grant execute on function public.rpc_maybe_finish_preparation(text) to anon;
