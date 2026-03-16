import { cn } from "@/lib/utils";
import type { GameCardRecord } from "@/types/game";

interface GameBoardProps {
  cards: GameCardRecord[];
  canReveal: boolean;
  onReveal: (cardId: string) => Promise<void>;
}

function revealedClass(owner: GameCardRecord["owner_type"]) {
  if (owner === "red") return "bg-red-500 text-white";
  if (owner === "blue") return "bg-blue-500 text-white";
  if (owner === "neutral") return "bg-amber-300 text-slate-900";
  return "bg-slate-900 text-white";
}

export function GameBoard({ cards, canReveal, onReveal }: GameBoardProps) {
  return (
    <section aria-label="Tablero de cartas" className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            disabled={!canReveal || card.is_revealed}
            onClick={() => onReveal(card.id)}
            className={cn(
              "group relative min-h-16 rounded-xl border border-slate-300 px-2 py-3 text-center text-xs font-bold uppercase tracking-wide transition-transform duration-200 sm:min-h-20 sm:text-sm",
              "focus:outline-none focus:ring-2 focus:ring-slate-400",
              card.is_revealed
                ? revealedClass(card.owner_type)
                : "bg-slate-100 text-slate-800 hover:-translate-y-0.5 hover:bg-slate-200",
              !canReveal || card.is_revealed ? "cursor-default" : "cursor-pointer"
            )}
            aria-label={`Carta ${card.word} ${card.is_revealed ? "descubierta" : "oculta"}`}
          >
            {card.word}
          </button>
        ))}
      </div>
    </section>
  );
}
