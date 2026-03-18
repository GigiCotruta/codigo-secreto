import { cn } from "@/lib/utils";
import type { GameCardRecord } from "@/types/game";

interface GameBoardProps {
  cards: GameCardRecord[];
  canReveal: boolean;
  showOwnership: boolean;
  onReveal: (cardId: string) => Promise<void>;
}

function revealedClass(owner: GameCardRecord["owner_type"]) {
  if (owner === "red") return "bg-red-600 text-white";
  if (owner === "blue") return "bg-blue-700 text-white";
  if (owner === "neutral") return "bg-white text-slate-900";
  return "bg-slate-900 text-white";
}

function hiddenOwnershipClass(owner: GameCardRecord["owner_type"]) {
  if (owner === "red") return "border-red-600 bg-red-300 text-red-950";
  if (owner === "blue") return "border-blue-700 bg-blue-300 text-blue-950";
  if (owner === "neutral") return "border-slate-300 bg-white text-slate-700";
  return "border-slate-900 bg-black text-white";
}

function ownerLabel(owner: GameCardRecord["owner_type"]) {
  if (owner === "red") return "ROJO";
  if (owner === "blue") return "AZUL";
  if (owner === "neutral") return "GRIS";
  return "NEGRA";
}

export function GameBoard({ cards, canReveal, showOwnership, onReveal }: GameBoardProps) {
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
                : showOwnership
                  ? hiddenOwnershipClass(card.owner_type)
                  : "bg-slate-100 text-slate-800 hover:-translate-y-0.5 hover:bg-slate-200",
              !canReveal || card.is_revealed ? "cursor-default" : "cursor-pointer"
            )}
            aria-label={`Carta ${card.word} ${card.is_revealed ? "descubierta" : "oculta"}`}
          >
            {!card.is_revealed && showOwnership && (
              <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-white/85 px-1.5 py-0.5 text-[10px] font-black tracking-normal text-slate-900">
                {ownerLabel(card.owner_type)}
              </span>
            )}
            {card.word}
          </button>
        ))}
      </div>
    </section>
  );
}
