import { NextRequest } from "next/server";
import { createBoard } from "@/lib/game-engine";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { failure, success } from "@/lib/api-response";
import { normalizeRoomCode } from "@/lib/room-code";
import { actionSchema, clueSchema } from "@/lib/validators";
import { getRoomState } from "@/lib/room-state";
import type { TeamColor } from "@/types/game";

function randomStartingTeam(): TeamColor {
  return Math.random() < 0.5 ? "red" : "blue";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const playerToken = request.headers.get("x-player-token");
    if (!playerToken) {
      return failure("Token de jugador requerido.", 401);
    }

    const { code } = await params;
    const roomCode = normalizeRoomCode(code);

    const body = await request.json();
    const parsedAction = actionSchema.safeParse(body);

    if (!parsedAction.success) {
      return failure("Acción inválida.");
    }

    const action = parsedAction.data;
    const supabase = createServiceSupabaseClient();

    switch (action.type) {
      case "select_role": {
        const { error } = await supabase.rpc("rpc_select_role", {
          p_code: roomCode,
          p_player_token: playerToken,
          p_role: action.role,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "start_game":
      case "new_game": {
        const startingTeam = action.forcedStartingTeam ?? randomStartingTeam();
        const board = createBoard(startingTeam);

        const { error } = await supabase.rpc("rpc_start_game", {
          p_code: roomCode,
          p_player_token: playerToken,
          p_starting_team: startingTeam,
          p_board: board,
        });

        if (error) throw new Error(error.message);
        break;
      }
      case "submit_clue": {
        const clue = clueSchema.safeParse({
          word: action.word,
          number: action.number,
        });

        if (!clue.success) {
          return failure("La pista debe ser una sola palabra y un número válido.");
        }

        const { error } = await supabase.rpc("rpc_submit_clue", {
          p_code: roomCode,
          p_player_token: playerToken,
          p_word: clue.data.word,
          p_number: clue.data.number,
        });

        if (error) throw new Error(error.message);
        break;
      }
      case "reveal_card": {
        const { error } = await supabase.rpc("rpc_reveal_card", {
          p_code: roomCode,
          p_player_token: playerToken,
          p_card_id: action.cardId,
        });

        if (error) throw new Error(error.message);
        break;
      }
      case "end_turn": {
        const { error } = await supabase.rpc("rpc_end_turn", {
          p_code: roomCode,
          p_player_token: playerToken,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "timer_pause": {
        const { error } = await supabase.rpc("rpc_timer_pause", {
          p_code: roomCode,
          p_player_token: playerToken,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "timer_resume": {
        const { error } = await supabase.rpc("rpc_timer_resume", {
          p_code: roomCode,
          p_player_token: playerToken,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "timer_reset": {
        const { error } = await supabase.rpc("rpc_timer_reset", {
          p_code: roomCode,
          p_player_token: playerToken,
        });
        if (error) throw new Error(error.message);
        break;
      }
      default:
        break;
    }

    const state = await getRoomState(roomCode, playerToken);
    return success(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la acción.";

    if (message.includes("Missing required environment variable")) {
      return failure("Falta configurar variables de entorno de Supabase en .env.local.", 500);
    }

    if (message.toLowerCase().includes("permission")) {
      return failure("No tienes permiso para esta acción.", 403);
    }

    return failure("No se pudo ejecutar la acción.", 400);
  }
}
