import { NextRequest } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { success, failure } from "@/lib/api-response";
import { generateRoomCode, createPlayerToken } from "@/lib/room-code";
import { joinSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = joinSchema.safeParse(body);

    if (!parsed.success) {
      return failure("Nickname inválido.");
    }

    const playerToken = createPlayerToken();
    const supabase = createServiceSupabaseClient();

    let attempts = 0;
    while (attempts < 5) {
      const roomCode = generateRoomCode();
      const { error } = await supabase.rpc("rpc_create_room", {
        p_code: roomCode,
        p_creator_token: playerToken,
        p_nickname: parsed.data.nickname,
      });

      if (!error) {
        return success({ roomCode, playerToken }, { status: 201 });
      }

      if (!error.message.toLowerCase().includes("duplicate")) {
        return failure("No se pudo crear la sala.", 500);
      }

      attempts += 1;
    }

    return failure("No se pudo generar un código único. Inténtalo de nuevo.", 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Missing required environment variable")) {
      return failure("Falta configurar variables de entorno de Supabase en .env.local.", 500);
    }
    return failure("Error interno al crear la sala.", 500);
  }
}
