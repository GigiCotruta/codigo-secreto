import { createServiceSupabaseClient } from "@/lib/supabase-server";
import type { RoomStateResult } from "@/types/api";

export async function getRoomState(roomCode: string, playerToken: string): Promise<RoomStateResult> {
  const supabase = createServiceSupabaseClient();

  await supabase.rpc("rpc_maybe_finish_preparation", {
    p_code: roomCode,
  });

  await supabase.rpc("rpc_expire_timer", {
    p_code: roomCode,
  });

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", roomCode)
    .single();

  if (roomError || !room) {
    throw new Error("Room not found.");
  }

  const [{ data: players, error: playerError }, { data: game, error: gameError }] = await Promise.all([
    supabase
      .from("room_players")
      .select("*")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true }),
    supabase.from("games").select("*").eq("room_id", room.id).single(),
  ]);

  if (playerError) {
    throw new Error(playerError.message);
  }

  if (gameError || !game) {
    throw new Error(gameError?.message ?? "Game state unavailable.");
  }

  const { data: cards, error: cardsError } = await supabase
    .from("game_cards")
    .select("*")
    .eq("game_id", game.id)
    .order("position", { ascending: true });

  if (cardsError) {
    throw new Error(cardsError.message);
  }

  const { data: events, error: eventsError } = await supabase
    .from("game_events")
    .select("*")
    .eq("game_id", game.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const me = players?.find((player) => player.player_token === playerToken);

  if (!me) {
    throw new Error("Player is not part of this room.");
  }

  return {
    room,
    players: players ?? [],
    game,
    cards: cards ?? [],
    events: events ?? [],
    me: {
      playerToken,
      role: me.role,
      nickname: me.nickname,
      isCreator: room.creator_token === playerToken,
    },
  };
}
