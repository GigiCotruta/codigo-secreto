-- WARNING: Destructive operation.
-- Deletes all runtime game data (rooms, players, games, cards, events).
-- Run manually in Supabase SQL Editor when you want to reset all rooms.

begin;

truncate table
	public.game_events,
	public.game_cards,
	public.games,
	public.room_players,
	public.rooms
restart identity cascade;

commit;
