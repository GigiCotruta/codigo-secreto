import { cn } from "@/lib/utils";
import type { RoomStateResult } from "@/types/api";

const ROLE_LABELS: Record<string, string> = {
  red_captain: "Capitán rojo",
  blue_captain: "Capitán azul",
  player: "Jugador",
};

function teamLabel(team: "red" | "blue" | null) {
  if (team === "red") return "Equipo rojo";
  if (team === "blue") return "Equipo azul";
  return "Sin equipo";
}

function isCaptain(role: string) {
  return role === "red_captain" || role === "blue_captain";
}

function sortTeamPlayers(a: RoomStateResult["players"][number], b: RoomStateResult["players"][number]) {
  if (isCaptain(a.role) && !isCaptain(b.role)) return -1;
  if (!isCaptain(a.role) && isCaptain(b.role)) return 1;
  return a.nickname.localeCompare(b.nickname, "es", { sensitivity: "base" });
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-amber-500" aria-hidden="true">
      <path d="M3 18h18l-1.2-8.2-4.8 3.3-3-6-3 6-4.8-3.3z" />
      <rect x="3" y="19" width="18" height="2" rx="1" />
    </svg>
  );
}

function TeamGroup({
  title,
  players,
  state,
  team,
}: {
  title: string;
  players: RoomStateResult["players"];
  state: RoomStateResult;
  team: "red" | "blue";
}) {
  const cardClass =
    team === "red"
      ? "border-red-300 bg-red-100 text-red-950"
      : "border-blue-300 bg-blue-100 text-blue-950";

  return (
    <section>
      <p className={`mb-2 text-xs font-black uppercase tracking-wider ${team === "red" ? "text-red-800" : "text-blue-800"}`}>
        {title}
      </p>
      <ul className="space-y-2">
        {players.map((player) => {
          const isMe = player.player_token === state.me.playerToken;
          const captain = isCaptain(player.role);

          return (
            <li
              key={player.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                cardClass,
                isMe ? "ring-2 ring-slate-900/70" : ""
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  <span className="inline-flex items-center gap-1">
                    {captain && <CrownIcon />}
                    <span>
                      {player.nickname}
                    </span>
                    {isMe && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">TÚ</span>}
                  </span>
                </p>
                <p className="text-xs opacity-80">{ROLE_LABELS[player.role]}</p>
              </div>
              <span
                className={cn("h-2.5 w-2.5 rounded-full", player.is_connected ? "bg-emerald-500" : "bg-slate-300")}
                aria-label={player.is_connected ? "Conectado" : "Desconectado"}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PlayerList({ state }: { state: RoomStateResult }) {
  const gameStarted = state.game?.phase !== "lobby";
  const redPlayers = state.players
    .filter((player) => player.player_team === "red" || player.role === "red_captain")
    .sort(sortTeamPlayers);
  const bluePlayers = state.players
    .filter((player) => player.player_team === "blue" || player.role === "blue_captain")
    .sort(sortTeamPlayers);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm" aria-label="Jugadores conectados">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Personas en la sala</h3>
      {gameStarted ? (
        <div className="space-y-3">
          <TeamGroup title="Equipo rojo" players={redPlayers} state={state} team="red" />
          <hr className="border-slate-300" />
          <TeamGroup title="Equipo azul" players={bluePlayers} state={state} team="blue" />
        </div>
      ) : (
        <ul className="space-y-2">
          {state.players.map((player) => {
            const isMe = player.player_token === state.me.playerToken;
            return (
              <li key={player.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {player.nickname} {isMe ? "(tú)" : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ROLE_LABELS[player.role]} {player.role === "player" ? `• ${teamLabel(player.player_team)}` : ""}
                  </p>
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
      )}
    </section>
  );
}
