import { NextRequest } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { success, failure } from "@/lib/api-response";
import { createPlayerToken, normalizeRoomCode } from "@/lib/room-code";
import { joinSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const body = await request.json();
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return failure("Nickname inválido.");
    }

    const tokenFromClient = request.headers.get("x-player-token") ?? undefined;
    const playerToken = tokenFromClient || createPlayerToken();

    const { code } = await params;
    const roomCode = normalizeRoomCode(code);

    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.rpc("rpc_join_room", {
      p_code: roomCode,
      p_player_token: playerToken,
      p_nickname: parsed.data.nickname,
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("not found")) {
        return failure("La sala no existe.", 404);
      }
      if (message.includes("full")) {
        return failure("La sala está llena (máximo 20 personas).", 409);
      }
      return failure("No se pudo entrar en la sala.", 500);
    }

    return success({ roomCode, playerToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Missing required environment variable")) {
      return failure("Faltan variables de entorno de Supabase en el servidor.", 500);
    }
    return failure("Error interno al entrar en la sala.", 500);
  }
}
