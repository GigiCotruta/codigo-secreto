create extension if not exists pgcrypto;

create type room_status as enum ('lobby', 'active', 'finished');
create type player_role as enum ('red_captain', 'blue_captain', 'spectator');
create type team_color as enum ('red', 'blue');
create type timer_status as enum ('running', 'paused', 'stopped');
create type card_owner as enum ('red', 'blue', 'neutral', 'assassin');

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status room_status not null default 'lobby',
  creator_token text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_token text not null,
  nickname text not null,
  role player_role not null default 'spectator',
  is_connected boolean not null default true,
  joined_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique (room_id, player_token)
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms(id) on delete cascade,
  phase room_status not null default 'lobby',
  starting_team team_color not null default 'red',
  current_team team_color not null default 'red',
  current_clue_word text,
  current_clue_number integer,
  remaining_guesses integer not null default 0,
  timer_remaining_seconds integer not null default 120,
  timer_status timer_status not null default 'stopped',
  timer_started_at timestamptz,
  winner_team team_color,
  loser_team team_color,
  assassin_revealed boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.game_cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  position integer not null check (position between 0 and 24),
  word text not null,
  owner_type card_owner not null,
  is_revealed boolean not null default false,
  revealed_at timestamptz,
  unique (game_id, position)
);

create table if not exists public.game_events (
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_rooms_code on public.rooms(code);
create index if not exists idx_room_players_room on public.room_players(room_id);
create index if not exists idx_room_players_connected on public.room_players(room_id, is_connected);
create index if not exists idx_games_room on public.games(room_id);
create index if not exists idx_game_cards_game on public.game_cards(game_id);
create index if not exists idx_game_events_game_created on public.game_events(game_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_rooms_updated_at on public.rooms;
create trigger trg_rooms_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

drop trigger if exists trg_games_updated_at on public.games;
create trigger trg_games_updated_at
before update on public.games
for each row execute function public.set_updated_at();

create or replace function public.log_game_event(p_game_id uuid, p_event_type text, p_payload jsonb)
returns void
language sql
as $$
  insert into public.game_events (game_id, event_type, payload)
  values (p_game_id, p_event_type, coalesce(p_payload, '{}'::jsonb));
$$;

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
    version = version + 1
  where id = p_game_id;
end;
$$;

create or replace function public.require_action_permission(
  p_room_id uuid,
  p_player_token text,
  p_current_team team_color,
  p_allow_creator boolean default true,
  p_allow_both_captains boolean default false
)
returns void
language plpgsql
as $$
declare
  role_value player_role;
  creator text;
begin
  select rp.role, r.creator_token
  into role_value, creator
  from public.room_players rp
  join public.rooms r on r.id = rp.room_id
  where rp.room_id = p_room_id and rp.player_token = p_player_token;

  if role_value is null then
    raise exception 'Player not found in room';
  end if;

  if p_allow_creator and creator = p_player_token then
    return;
  end if;

  if p_allow_both_captains and role_value in ('red_captain', 'blue_captain') then
    return;
  end if;

  if p_current_team = 'red' and role_value = 'red_captain' then
    return;
  end if;

  if p_current_team = 'blue' and role_value = 'blue_captain' then
    return;
  end if;

  raise exception 'Player does not have permission for this action';
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
  values (room_id_value, p_creator_token, p_nickname, 'spectator', true);

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
  values (room_id_value, p_player_token, p_nickname, 'spectator', true, timezone('utc', now()))
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

  update public.room_players
  set role = p_role,
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
begin
  select id into room_id_value from public.rooms where code = upper(trim(p_code));
  if room_id_value is null then
    raise exception 'Room not found';
  end if;

  if not exists (
    select 1 from public.room_players where room_id = room_id_value and player_token = p_player_token
  ) then
    raise exception 'Player not in room';
  end if;

  select exists(select 1 from public.room_players where room_id = room_id_value and role = 'red_captain' and is_connected = true) into red_exists;
  select exists(select 1 from public.room_players where room_id = room_id_value and role = 'blue_captain' and is_connected = true) into blue_exists;

  if not red_exists or not blue_exists then
    raise exception 'Both captains are required to start';
  end if;

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
    timer_status = 'running',
    timer_started_at = timezone('utc', now()),
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

  perform public.log_game_event(game_id_value, 'game_started', jsonb_build_object('startingTeam', p_starting_team));
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

  if card_row.owner_type = game_row.current_team::card_owner then
    select count(*) into revealed_count from public.game_cards where game_id = game_row.id and owner_type = game_row.current_team::card_owner and is_revealed = true;
    select count(*) into total_count from public.game_cards where game_id = game_row.id and owner_type = game_row.current_team::card_owner;

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

create or replace function public.rpc_timer_pause(
  p_code text,
  p_player_token text
)
returns void
language plpgsql
security definer
as $$
declare
  game_row public.games%rowtype;
  elapsed_seconds integer;
  new_remaining integer;
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

  perform public.require_action_permission(game_row.room_id, p_player_token, game_row.current_team, true, true);

  if game_row.timer_status <> 'running' then
    return;
  end if;

  elapsed_seconds := floor(extract(epoch from timezone('utc', now()) - game_row.timer_started_at));
  new_remaining := greatest(game_row.timer_remaining_seconds - elapsed_seconds, 0);

  update public.games
  set
    timer_status = 'paused',
    timer_remaining_seconds = new_remaining,
    timer_started_at = null,
    version = version + 1
  where id = game_row.id;

  perform public.log_game_event(game_row.id, 'timer_paused', jsonb_build_object('remaining', new_remaining));
end;
$$;

create or replace function public.rpc_timer_resume(
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

  perform public.require_action_permission(game_row.room_id, p_player_token, game_row.current_team, true, true);

  if game_row.timer_status = 'running' then
    return;
  end if;

  if game_row.timer_remaining_seconds <= 0 then
    raise exception 'Timer cannot resume at zero';
  end if;

  update public.games
  set
    timer_status = 'running',
    timer_started_at = timezone('utc', now()),
    version = version + 1
  where id = game_row.id;

  perform public.log_game_event(game_row.id, 'timer_resumed', jsonb_build_object('remaining', game_row.timer_remaining_seconds));
end;
$$;

create or replace function public.rpc_timer_reset(
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
  select g.* into game_row
  from public.games g
  join public.rooms r on r.id = g.room_id
  where r.code = upper(trim(p_code))
  for update;

  if game_row.id is null then
    raise exception 'Game not found';
  end if;

  perform public.require_action_permission(game_row.room_id, p_player_token, game_row.current_team, true, true);

  update public.games
  set
    timer_status = case when game_row.phase = 'active' then 'paused' else 'stopped' end,
    timer_remaining_seconds = 120,
    timer_started_at = null,
    version = version + 1
  where id = game_row.id;

  perform public.log_game_event(game_row.id, 'timer_reset', jsonb_build_object('remaining', 120));
end;
$$;

create or replace function public.rpc_expire_timer(
  p_code text
)
returns boolean
language plpgsql
security definer
as $$
declare
  game_row public.games%rowtype;
  elapsed_seconds integer;
begin
  select g.* into game_row
  from public.games g
  join public.rooms r on r.id = g.room_id
  where r.code = upper(trim(p_code))
  for update;

  if game_row.id is null then
    return false;
  end if;

  if game_row.phase <> 'active' or game_row.timer_status <> 'running' or game_row.timer_started_at is null then
    return false;
  end if;

  elapsed_seconds := floor(extract(epoch from timezone('utc', now()) - game_row.timer_started_at));

  if elapsed_seconds < game_row.timer_remaining_seconds then
    return false;
  end if;

  perform public.switch_turn(game_row.id);
  perform public.log_game_event(game_row.id, 'timer_expired', jsonb_build_object('expiredTeam', game_row.current_team));
  return true;
end;
$$;

create or replace function public.rpc_mark_presence(
  p_code text,
  p_player_token text,
  p_connected boolean
)
returns void
language plpgsql
security definer
as $$
declare
  room_id_value uuid;
begin
  select id into room_id_value from public.rooms where code = upper(trim(p_code));
  if room_id_value is null then
    raise exception 'Room not found';
  end if;

  update public.room_players
  set is_connected = p_connected,
      last_seen_at = timezone('utc', now())
  where room_id = room_id_value and player_token = p_player_token;
end;
$$;

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_cards;
alter publication supabase_realtime add table public.game_events;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.games enable row level security;
alter table public.game_cards enable row level security;
alter table public.game_events enable row level security;

create policy "Public read rooms" on public.rooms for select using (true);
create policy "Public read room players" on public.room_players for select using (true);
create policy "Public read games" on public.games for select using (true);
create policy "Public read game cards" on public.game_cards for select using (true);
create policy "Public read game events" on public.game_events for select using (true);

grant execute on function public.rpc_create_room(text, text, text) to anon;
grant execute on function public.rpc_join_room(text, text, text) to anon;
grant execute on function public.rpc_select_role(text, text, player_role) to anon;
grant execute on function public.rpc_start_game(text, text, team_color, jsonb) to anon;
grant execute on function public.rpc_submit_clue(text, text, text, integer) to anon;
grant execute on function public.rpc_end_turn(text, text) to anon;
grant execute on function public.rpc_reveal_card(text, text, uuid) to anon;
grant execute on function public.rpc_timer_pause(text, text) to anon;
grant execute on function public.rpc_timer_resume(text, text) to anon;
grant execute on function public.rpc_timer_reset(text, text) to anon;
grant execute on function public.rpc_expire_timer(text) to anon;
grant execute on function public.rpc_mark_presence(text, text, boolean) to anon;
