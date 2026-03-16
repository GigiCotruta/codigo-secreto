import { type FormEvent, useState } from "react";

interface CluePanelProps {
  currentWord: string | null;
  currentNumber: number | null;
  remainingGuesses: number;
  canSubmit: boolean;
  onSubmit: (word: string, number: number) => Promise<void>;
}

export function CluePanel({
  currentWord,
  currentNumber,
  remainingGuesses,
  canSubmit,
  onSubmit,
}: CluePanelProps) {
  const [word, setWord] = useState("");
  const [number, setNumber] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  const submitClue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await onSubmit(word.trim(), Number(number));
      setWord("");
      setNumber(2);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm" aria-label="Panel de pista">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Pista actual</h3>
      <div className="mt-2 rounded-xl bg-slate-100 p-3">
        <p className="text-sm text-slate-600">Última pista visible para toda la sala</p>
        <p className="mt-1 text-xl font-bold text-slate-900">
          {currentWord && currentNumber !== null ? `${currentWord}, ${currentNumber}` : "Aún no hay pista"}
        </p>
        <p className="text-xs text-slate-500">Intentos restantes: {remainingGuesses}</p>
      </div>

      <form onSubmit={submitClue} className="mt-3 grid gap-2 sm:grid-cols-[1fr_96px_auto]">
        <input
          value={word}
          onChange={(event) => setWord(event.target.value)}
          placeholder="Palabra"
          disabled={!canSubmit || submitting || Boolean(currentWord)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-red-400 focus:ring"
          aria-label="Palabra de la pista"
        />
        <input
          type="number"
          min={0}
          max={9}
          value={number}
          onChange={(event) => setNumber(Number(event.target.value))}
          disabled={!canSubmit || submitting || Boolean(currentWord)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-red-400 focus:ring"
          aria-label="Número de la pista"
        />
        <button
          type="submit"
          disabled={!canSubmit || submitting || !word.trim() || Boolean(currentWord)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Enviar pista
        </button>
      </form>
    </section>
  );
}
