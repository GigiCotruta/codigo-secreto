"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CluePanel } from "@/components/clue-panel";
import { GameBoard } from "@/components/game-board";
import { PlayerList } from "@/components/player-list";
import { RoleSelector } from "@/components/role-selector";
import { TimerPanel } from "@/components/timer-panel";
import { useRoomGame } from "@/hooks/use-room-game";
import { getLastNickname, getStoredPlayerToken, setLastNickname, setStoredPlayerToken } from "@/lib/storage";
import type { TeamColor } from "@/types/game";

interface RoomClientProps {
  roomCode: string;
}

function roleForTeam(team: TeamColor) {
  return team === "red" ? "red_captain" : "blue_captain";
}

export function RoomClient({ roomCode }: RoomClientProps) {
  const [playerToken, setPlayerToken] = useState<string | null>(() => getStoredPlayerToken(roomCode));
  const [nickname, setNickname] = useState(() => getLastNickname());
  const [startingTeam, setStartingTeam] = useState<TeamColor | "random">("random");
  const [joining, setJoining] = useState(false);
  const [acting, setActing] = useState(false);

  const { state, loading, error, countdown, sendAction, refresh } = useRoomGame(roomCode, playerToken);

  const joinRoom = async () => {
    if (!nickname.trim()) {
      toast.error("Escribe un apodo antes de entrar.");
      return;
    }

    setJoining(true);
    try {
      const existingToken = getStoredPlayerToken(roomCode);
      const response = await fetch(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(existingToken ? { "x-player-token": existingToken } : {}),
        },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "No se pudo entrar en la sala.");
      }

      setStoredPlayerToken(roomCode, payload.data.playerToken);
      setLastNickname(nickname.trim());
      setPlayerToken(payload.data.playerToken);
      toast.success("Has entrado en la sala.");
      await refresh();
    } catch (joinError) {
      const message = joinError instanceof Error ? joinError.message : "No se pudo entrar en la sala.";
      toast.error(message);
    } finally {
      setJoining(false);
    }
  };

  const executeAction = async (action: Record<string, unknown>, successMessage?: string) => {
    setActing(true);
    try {
      await sendAction(action);
      if (successMessage) toast.success(successMessage);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "No se pudo ejecutar la acción.";
      toast.error(message);
    } finally {
      setActing(false);
    }
  };

  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/room/${roomCode}`;
  }, [roomCode]);

  if (!playerToken) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
        <section className="w-full rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-xl backdrop-blur-sm">
          <h1 className="text-2xl font-black text-slate-900">Entrar en la sala {roomCode}</h1>
          <p className="mt-2 text-sm text-slate-600">Escribe tu apodo para unirte como jugador o espectador.</p>

          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="nickname-room">
            Apodo
          </label>
          <input
            id="nickname-room"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-red-400 focus:ring"
            placeholder="Ejemplo: Marta"
            maxLength={24}
          />

          <button
            type="button"
            onClick={joinRoom}
            disabled={joining}
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {joining ? "Entrando..." : "Entrar en la sala"}
          </button>

          <p className="mt-4 text-xs text-slate-500">
            Si ya estabas en la sala con este navegador, recuperarás tu rol automáticamente cuando sea posible.
          </p>
        </section>
      </main>
    );
  }

  if (loading || !state) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10">
        <p className="text-lg font-semibold text-slate-700">Cargando sala...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">No se pudo cargar la sala.</p>
          <p className="text-sm">{error}</p>
        </section>
      </main>
    );
  }

  const redCaptainConnected = state.players.some((p) => p.role === "red_captain" && p.is_connected);
  const blueCaptainConnected = state.players.some((p) => p.role === "blue_captain" && p.is_connected);
  const game = state.game;

  const isMyTurnCaptain = game?.phase === "active" && state.me.role === roleForTeam(game.current_team);
  const canStart = (state.me.isCreator || state.me.role !== "spectator") && redCaptainConnected && blueCaptainConnected;
  const canReveal = Boolean(isMyTurnCaptain && game?.current_clue_word && game.remaining_guesses > 0);
  const canSubmitClue = Boolean(isMyTurnCaptain && !game?.current_clue_word);
  const canEndTurn = Boolean(isMyTurnCaptain && game?.phase === "active");
  const canControlTimer = Boolean(state.me.isCreator || state.me.role === "red_captain" || state.me.role === "blue_captain");

  if (!game) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white/85 p-6 text-slate-700">
          Estado de partida no disponible.
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <header className="mb-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Código Secreto</h1>
            <p className="text-sm text-slate-600">
              Sala: <span className="font-bold text-slate-900">{state.room.code}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(shareLink);
                toast.success("Enlace copiado.");
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              Copiar enlace
            </button>
            <Link href="/" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Estado de la partida</h2>
            {game.phase === "lobby" && (
              <p className="mt-2 text-sm text-slate-700">Esperando a que haya un capitán rojo y uno azul para empezar.</p>
            )}
            {game.phase === "active" && (
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Turno actual: {game.current_team === "red" ? "Equipo rojo" : "Equipo azul"}
              </p>
            )}
            {game.phase === "finished" && (
              <p className="mt-2 text-sm font-semibold text-emerald-700">
                Partida terminada. Ganador: {game.winner_team === "red" ? "equipo rojo" : "equipo azul"}.
              </p>
            )}

            <div className="mt-3 space-y-2">
              <RoleSelector
                players={state.players}
                currentRole={state.me.role}
                onSelectRole={(role) => executeAction({ type: "select_role", role }, "Rol actualizado.")}
                disabled={acting}
              />

              <div className="flex flex-wrap gap-2">
                <select
                  value={startingTeam}
                  onChange={(event) => setStartingTeam(event.target.value as TeamColor | "random")}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  aria-label="Equipo inicial"
                >
                  <option value="random">Inicio aleatorio</option>
                  <option value="red">Empieza rojo</option>
                  <option value="blue">Empieza azul</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (!canStart) return;
                    void executeAction(
                      {
                        type: "start_game",
                        ...(startingTeam !== "random" ? { forcedStartingTeam: startingTeam } : {}),
                      },
                      "Partida iniciada."
                    );
                  }}
                  disabled={!canStart || acting}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Iniciar partida
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm("¿Seguro que quieres empezar una partida nueva?")) return;
                    void executeAction(
                      {
                        type: "new_game",
                        ...(startingTeam !== "random" ? { forcedStartingTeam: startingTeam } : {}),
                      },
                      "Nueva partida creada."
                    );
                  }}
                  disabled={acting}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  Nueva partida
                </button>
              </div>
            </div>
          </section>

          <CluePanel
            currentWord={game.current_clue_word}
            currentNumber={game.current_clue_number}
            remainingGuesses={game.remaining_guesses}
            canSubmit={canSubmitClue}
            onSubmit={(word, number) => executeAction({ type: "submit_clue", word, number }, "Pista enviada.")}
          />

          <GameBoard
            cards={state.cards}
            canReveal={canReveal}
            onReveal={(cardId) => executeAction({ type: "reveal_card", cardId })}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => executeAction({ type: "end_turn" }, "Turno terminado.")}
              disabled={!canEndTurn || acting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Terminar turno
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <TimerPanel
            countdown={countdown}
            status={game.timer_status}
            canControl={canControlTimer}
            onPause={() => void executeAction({ type: "timer_pause" }, "Temporizador en pausa.")}
            onResume={() => void executeAction({ type: "timer_resume" }, "Temporizador reanudado.")}
            onReset={() => {
              if (!window.confirm("¿Quieres reiniciar el temporizador a 2:00?")) return;
              void executeAction({ type: "timer_reset" }, "Temporizador reiniciado.");
            }}
          />
          <PlayerList state={state} />
        </aside>
      </div>
    </main>
  );
}
