import { cn } from "@/lib/utils";
import type { PlayerRole, RoomPlayerRecord } from "@/types/game";

interface RoleSelectorProps {
  players: RoomPlayerRecord[];
  currentRole: PlayerRole;
  onSelectRole: (role: PlayerRole) => void;
  disabled?: boolean;
}

function hasRole(players: RoomPlayerRecord[], role: PlayerRole) {
  return players.some((player) => player.role === role && player.is_connected);
}

export function RoleSelector({ players, currentRole, onSelectRole, disabled }: RoleSelectorProps) {
  const options: Array<{ role: PlayerRole; label: string; colorClass: string }> = [
    { role: "red_captain", label: "Capitán rojo", colorClass: "border-red-300 bg-red-50 text-red-700" },
    { role: "blue_captain", label: "Capitán azul", colorClass: "border-blue-300 bg-blue-50 text-blue-700" },
    { role: "player", label: "Jugador", colorClass: "border-slate-300 bg-slate-50 text-slate-700" },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Selección de rol">
      {options.map((option) => {
        const occupied = (option.role === "red_captain" || option.role === "blue_captain") && hasRole(players, option.role) && currentRole !== option.role;
        return (
          <button
            key={option.role}
            type="button"
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-semibold transition",
              option.colorClass,
              currentRole === option.role ? "ring-2 ring-slate-400" : "hover:opacity-90",
              occupied || disabled ? "cursor-not-allowed opacity-50" : ""
            )}
            disabled={occupied || disabled}
            onClick={() => onSelectRole(option.role)}
          >
            {option.label}
            {occupied ? " (ocupado)" : ""}
          </button>
        );
      })}
    </div>
  );
}
