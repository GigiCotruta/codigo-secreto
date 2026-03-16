import { NextRequest } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { success, failure } from "@/lib/api-response";
import { normalizeRoomCode } from "@/lib/room-code";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const roomCode = normalizeRoomCode(code);
    const body = await request.json();
    const playerToken = body?.playerToken as string | undefined;
    const connected = Boolean(body?.connected ?? true);

    if (!playerToken) {
      return failure("Token de jugador requerido.", 401);
    }

    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.rpc("rpc_mark_presence", {
      p_code: roomCode,
      p_player_token: playerToken,
      p_connected: connected,
    });

    if (error) {
      return failure("No se pudo actualizar presencia.", 500);
    }

    return success({ connected });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Missing required environment variable")) {
      return failure("Falta configurar variables de entorno de Supabase en .env.local.", 500);
    }
    return failure("Error interno al actualizar presencia.", 500);
  }
}
