import { formatSeconds } from "@/lib/utils";
import type { TimerStatus } from "@/types/game";

interface TimerPanelProps {
  countdown: number;
  status: TimerStatus;
  canControl: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

export function TimerPanel({
  countdown,
  status,
  canControl,
  onPause,
  onResume,
  onReset,
}: TimerPanelProps) {
  const isUrgent = countdown <= 20;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm" aria-label="Temporizador">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Temporizador</h3>
      <p className={`mt-2 text-4xl font-black tabular-nums ${isUrgent ? "text-red-600" : "text-slate-900"}`}>
        {formatSeconds(countdown)}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Estado: {status === "running" ? "en marcha" : status === "paused" ? "pausado" : "detenido"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPause}
          disabled={!canControl || status !== "running"}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Pausar
        </button>
        <button
          type="button"
          onClick={onResume}
          disabled={!canControl || status === "running" || countdown <= 0}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Reanudar
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!canControl}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Reiniciar
        </button>
      </div>
    </section>
  );
}
