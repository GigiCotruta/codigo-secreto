import { cn } from "@/lib/utils";
import type { RoomStateResult } from "@/types/api";

const ROLE_LABELS: Record<string, string> = {
  red_captain: "Capitán rojo",
  blue_captain: "Capitán azul",
  spectator: "Espectador",
};

export function PlayerList({ state }: { state: RoomStateResult }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm" aria-label="Jugadores conectados">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Personas en la sala</h3>
      <ul className="space-y-2">
        {state.players.map((player) => {
          const isMe = player.player_token === state.me.playerToken;
          return (
            <li key={player.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {player.nickname} {isMe ? "(tú)" : ""}
                </p>
                <p className="text-xs text-slate-500">{ROLE_LABELS[player.role]}</p>
              </div>
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  player.is_connected ? "bg-emerald-500" : "bg-slate-300"
                )}
                aria-label={player.is_connected ? "Conectado" : "Desconectado"}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
