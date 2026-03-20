create table if not exists public.game_reveal_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  voter_player_token text not null,
  team team_color not null,
  card_id uuid not null references public.game_cards(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (game_id, voter_player_token)
);

create index if not exists idx_game_reveal_votes_game_team on public.game_reveal_votes(game_id, team);

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

  delete from public.game_reveal_votes where game_id = p_game_id;

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

  delete from public.game_reveal_votes where game_id = game_id_value;
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

create or replace function public.rpc_vote_reveal_card(
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
  voter_row public.room_players%rowtype;
  card_row public.game_cards%rowtype;
  required_votes integer;
  matching_votes integer;
  captain_token text;
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

  if game_row.current_clue_word is null then
    raise exception 'Submit a clue first';
  end if;

  if game_row.remaining_guesses <= 0 then
    raise exception 'No remaining guesses';
  end if;

  select * into voter_row
  from public.room_players
  where room_id = game_row.room_id and player_token = p_player_token;

  if voter_row.id is null then
    raise exception 'Player not found in room';
  end if;

  if voter_row.player_team is null or voter_row.player_team <> game_row.current_team then
    raise exception 'Player must belong to current team';
  end if;

  if not voter_row.is_connected then
    raise exception 'Player is disconnected';
  end if;

  select * into card_row
  from public.game_cards
  where id = p_card_id and game_id = game_row.id
  for update;

  if card_row.id is null then
    raise exception 'Card not found';
  end if;

  if card_row.is_revealed then
    raise exception 'Card already revealed';
  end if;

  insert into public.game_reveal_votes (game_id, voter_player_token, team, card_id)
  values (game_row.id, p_player_token, game_row.current_team, p_card_id)
  on conflict (game_id, voter_player_token)
  do update set
    card_id = excluded.card_id,
    team = excluded.team,
    updated_at = timezone('utc', now());

  select count(*) into required_votes
  from public.room_players rp
  where rp.room_id = game_row.room_id
    and rp.player_team = game_row.current_team
    and rp.is_connected = true;

  if required_votes <= 0 then
    raise exception 'No connected team players';
  end if;

  select count(*) into matching_votes
  from public.game_reveal_votes v
  join public.room_players rp
    on rp.room_id = game_row.room_id
   and rp.player_token = v.voter_player_token
  where v.game_id = game_row.id
    and v.team = game_row.current_team
    and v.card_id = p_card_id
    and rp.player_team = game_row.current_team
    and rp.is_connected = true;

  perform public.log_game_event(
    game_row.id,
    'vote_submitted',
    jsonb_build_object(
      'team', game_row.current_team,
      'cardId', p_card_id,
      'votes', matching_votes,
      'required', required_votes,
      'playerToken', p_player_token
    )
  );

  if matching_votes = required_votes then
    select player_token into captain_token
    from public.room_players
    where room_id = game_row.room_id
      and role = case when game_row.current_team = 'red' then 'red_captain'::player_role else 'blue_captain'::player_role end
    limit 1;

    if captain_token is null then
      raise exception 'Captain for current team not found';
    end if;

    delete from public.game_reveal_votes where game_id = game_row.id;

    perform public.rpc_reveal_card(p_code, captain_token, p_card_id);
  end if;
end;
$$;

grant execute on function public.rpc_vote_reveal_card(text, text, uuid) to anon;
