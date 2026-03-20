import type { GameEventRecord } from "@/types/game";

function eventLabel(event: GameEventRecord): string {
  if (event.event_type === "game_started") return "Partida iniciada";
  if (event.event_type === "clue_submitted") {
    const word = String(event.payload.word ?? "");
    const number = String(event.payload.number ?? "");
    return `Pista: ${word}${number ? `, ${number}` : ""}`;
  }
  if (event.event_type === "vote_submitted") {
    const votes = Number(event.payload.votes ?? 0);
    const required = Number(event.payload.required ?? 0);
    return `Voto de carta (${votes}/${required})`;
  }
  if (event.event_type === "card_revealed") return "Carta descubierta";
  if (event.event_type === "turn_ended") return "Turno terminado";
  if (event.event_type === "game_ended") return "Partida terminada";
  return event.event_type;
}

export function GameLog({ events }: { events: GameEventRecord[] }) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white/80 p-3 shadow-sm" aria-label="Registro de partida">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Game Log</h3>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
        {events.length === 0 && <li className="text-xs text-slate-500">Sin eventos por ahora.</li>}
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
            {eventLabel(event)}
          </li>
        ))}
      </ul>
    </section>
  );
}
