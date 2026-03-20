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

    await supabase.rpc("rpc_maybe_finish_preparation", {
      p_code: roomCode,
    });

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
        const { error } = await supabase.rpc("rpc_vote_reveal_card", {
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
      return failure("Faltan variables de entorno de Supabase en el servidor.", 500);
    }

    if (message.toLowerCase().includes("permission")) {
      return failure("No tienes permiso para esta acción.", 403);
    }

    if (message.includes("Submit a clue first")) {
      return failure("Primero debes enviar una pista.", 400);
    }

    if (message.includes("No remaining guesses")) {
      return failure("No quedan intentos en este turno.", 400);
    }

    if (message.includes("Player must belong to current team")) {
      return failure("Solo los jugadores del equipo en turno pueden votar carta.", 403);
    }

    if (message.includes("Player is disconnected")) {
      return failure("Debes estar conectado para votar carta.", 403);
    }

    if (message.includes("No connected team players")) {
      return failure("No hay jugadores conectados en el equipo actual.", 400);
    }

    if (message.includes("Current clue already exists")) {
      return failure("Ya hay una pista activa en este turno.", 400);
    }

    if (message.includes("Preparation phase active")) {
      return failure("Fase de estrategia activa. Espera a que termine el minuto inicial.", 400);
    }

    if (message.includes("Card already revealed")) {
      return failure("Esa carta ya está descubierta.", 400);
    }

    if (message.includes("Game is not active")) {
      return failure("La partida no está activa.", 400);
    }

    if (message.includes("Game not found")) {
      return failure("No se encontró la partida de esta sala.", 404);
    }

    if (message.includes("Player not in room") || message.includes("Player not found in room")) {
      return failure("Tu sesión no está asociada a esta sala.", 403);
    }

    if (message.includes("Only captains can start the game")) {
      return failure("Solo los capitanes pueden iniciar la partida.", 403);
    }

    if (
      message.includes("cannot cast type team_color to card_owner") ||
      message.includes("invalid input value for enum card_owner")
    ) {
      return failure(
        "El servidor de juego necesita una migración de base de datos pendiente para descubrir cartas.",
        500
      );
    }

    if (
      message.includes("rpc_maybe_finish_preparation") ||
      message.includes("rpc_submit_clue") ||
      (message.includes("schema cache") && message.includes("function")) ||
      (message.includes("function") && message.includes("does not exist"))
    ) {
      return failure(
        "El servidor de juego necesita migraciones de base de datos pendientes. Aplica las migraciones y vuelve a intentarlo.",
        500
      );
    }

    return failure(`No se pudo ejecutar la acción. Detalle: ${message}`, 400);
  }
}
