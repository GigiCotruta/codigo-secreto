import { cn } from "@/lib/utils";
import type { RoomStateResult } from "@/types/api";
import type { TeamColor } from "@/types/game";

const ROLE_LABELS: Record<string, string> = {
  red_captain: "Capitan",
  blue_captain: "Capitan",
  player: "Operativo",
};

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

interface TeamPanelProps {
  state: RoomStateResult;
  team: TeamColor;
}

export function TeamPanel({ state, team }: TeamPanelProps) {
  const players = state.players
    .filter((player) => player.player_team === team || player.role === `${team}_captain`)
    .sort(sortTeamPlayers);

  const cardClass =
    team === "blue"
      ? "border-blue-400 bg-blue-100/80 text-blue-950"
      : "border-red-400 bg-red-100/80 text-red-950";

  return (
    <section className={cn("rounded-2xl border p-3 shadow-sm", cardClass)} aria-label={`Equipo ${team}`}>
      <h3 className="text-xs font-black uppercase tracking-wider">Equipo {team === "blue" ? "azul" : "rojo"}</h3>
      <ul className="mt-2 space-y-2">
        {players.map((player) => {
          const isMe = player.player_token === state.me.playerToken;
          const captain = isCaptain(player.role);

          return (
            <li key={player.id} className={cn("rounded-xl border px-2 py-1.5 text-sm", team === "blue" ? "border-blue-300 bg-blue-50" : "border-red-300 bg-red-50", isMe ? "ring-2 ring-slate-900/70" : "") }>
              <p className="truncate font-semibold">
                <span className="inline-flex items-center gap-1">
                  {captain && <CrownIcon />}
                  <span>{player.nickname}</span>
                  {isMe && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">TU</span>}
                </span>
              </p>
              <p className="text-xs opacity-80">{ROLE_LABELS[player.role]}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
