import { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { getRoomState } from "@/lib/room-state";
import { normalizeRoomCode } from "@/lib/room-code";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const roomCode = normalizeRoomCode(code);

    const token = request.nextUrl.searchParams.get("playerToken");

    if (!token) {
      return failure("Token de jugador requerido.", 401);
    }

    const state = await getRoomState(roomCode, token);
    return success(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar la sala.";
    if (message.includes("Missing required environment variable")) {
      return failure("Falta configurar variables de entorno de Supabase en .env.local.", 500);
    }
    if (message.toLowerCase().includes("not found")) {
      return failure("La sala no existe.", 404);
    }
    if (message.toLowerCase().includes("not part")) {
      return failure("No perteneces a esta sala.", 403);
    }
    return failure("No se pudo cargar la sala.", 500);
  }
}
