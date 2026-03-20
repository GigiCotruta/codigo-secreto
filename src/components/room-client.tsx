"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CluePanel } from "@/components/clue-panel";
import { GameLog } from "@/components/game-log";
import { GameBoard } from "@/components/game-board";
import { PlayerList } from "@/components/player-list";
import { RoleSelector } from "@/components/role-selector";
import { TeamPanel } from "@/components/team-panel";
import { TimerPanel } from "@/components/timer-panel";
import { useRoomGame } from "@/hooks/use-room-game";
import { getLastNickname, getStoredPlayerToken, setLastNickname, setStoredPlayerToken } from "@/lib/storage";
import { formatSeconds } from "@/lib/utils";
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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [turnBanner, setTurnBanner] = useState<{ team: TeamColor; message: string } | null>(null);
  const [clueBanner, setClueBanner] = useState<{ team: TeamColor; word: string; number: number } | null>(null);

  const { state, loading, error, countdown, sendAction, refresh } = useRoomGame(roomCode, playerToken);
  const previousTurnRef = useRef<{ team: TeamColor | null; phase: string | null }>({
    team: null,
    phase: null,
  });
  const previousClueRef = useRef<{ word: string | null; number: number | null }>({
    word: null,
    number: null,
  });
  const currentGame = state?.game ?? null;
  const gamePhase = currentGame?.phase ?? null;
  const currentTeam = currentGame?.current_team ?? null;
  const winnerTeam = state?.game?.winner_team;

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentGame || gamePhase !== "active" || !currentTeam) {
      previousTurnRef.current = {
        team: currentTeam,
        phase: gamePhase,
      };
      return;
    }

    const previous = previousTurnRef.current;
    const didTurnChange = previous.team !== null && previous.team !== currentTeam;
    const didGameJustStart = previous.phase !== "active";

    if (didTurnChange || didGameJustStart) {
      const teamName = currentTeam === "blue" ? "azul" : "rojo";
      setTurnBanner({
        team: currentTeam,
        message: `Turno equipo ${teamName}: el capitán puede escribir la pista.`,
      });
    }

    previousTurnRef.current = { team: currentTeam, phase: gamePhase };
  }, [currentGame, currentTeam, gamePhase]);

  useEffect(() => {
    if (!turnBanner) return;
    const timeout = window.setTimeout(() => setTurnBanner(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [turnBanner]);

  useEffect(() => {
    if (!currentGame || gamePhase !== "active") {
      previousClueRef.current = {
        word: currentGame?.current_clue_word ?? null,
        number: currentGame?.current_clue_number ?? null,
      };
      return;
    }

    const currentWord = currentGame.current_clue_word;
    const currentNumber = currentGame.current_clue_number;
    const previous = previousClueRef.current;

    const isNewClue =
      Boolean(currentWord) &&
      currentNumber !== null &&
      (previous.word !== currentWord || previous.number !== currentNumber);

    if (isNewClue) {
      setClueBanner({
        team: currentGame.current_team,
        word: currentWord ?? "",
        number: currentNumber ?? 0,
      });
    }

    previousClueRef.current = {
      word: currentWord,
      number: currentNumber,
    };
  }, [currentGame, gamePhase]);

  useEffect(() => {
    if (!clueBanner) return;
    const timeout = window.setTimeout(() => setClueBanner(null), 3400);
    return () => window.clearTimeout(timeout);
  }, [clueBanner]);

  useEffect(() => {
    if (!currentGame || gamePhase !== "finished" || !winnerTeam) return;

    let cleanup: (() => void) | undefined;

    void import("canvas-confetti")
      .then((module) => {
        const confetti = module.default ?? module;
        const end = Date.now() + 3000;
        const colors = winnerTeam === "blue" ? ["#1d4ed8", "#60a5fa", "#bfdbfe"] : ["#b91c1c", "#f87171", "#fecaca"];

        const frame = window.setInterval(() => {
          confetti({
            particleCount: 120,
            spread: 95,
            startVelocity: 42,
            zIndex: 120,
            origin: { x: 0.15, y: 0.68 },
            colors,
          });
          confetti({
            particleCount: 120,
            spread: 95,
            startVelocity: 42,
            zIndex: 120,
            origin: { x: 0.85, y: 0.68 },
            colors,
          });

          if (Date.now() > end) {
            window.clearInterval(frame);
          }
        }, 280);

        cleanup = () => window.clearInterval(frame);
      })
      .catch(() => {
        // Confetti is a visual enhancement; ignore failures gracefully.
      });

    return () => {
      cleanup?.();
    };
  }, [currentGame, gamePhase, winnerTeam]);

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
          <p className="mt-2 text-sm text-slate-600">Escribe tu apodo para unirte como jugador.</p>

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

  const mePlayer = state.players.find((p) => p.player_token === state.me.playerToken) ?? null;
  const myTeam = mePlayer?.player_team ?? null;

  const redCaptainConnected = state.players.some((p) => p.role === "red_captain" && p.is_connected);
  const blueCaptainConnected = state.players.some((p) => p.role === "blue_captain" && p.is_connected);
  const game = state.game;

  const activeCaptain = game
    ? state.players.find((player) => player.role === roleForTeam(game.current_team) && player.is_connected)
    : null;

  const preparationRemainingSeconds =
    game?.preparation_ends_at
      ? Math.max(0, Math.ceil((new Date(game.preparation_ends_at).getTime() - nowMs) / 1000))
      : 0;

  const isPreparationActive = Boolean(game?.phase === "active" && preparationRemainingSeconds > 0);
  const visibleCountdown = isPreparationActive ? preparationRemainingSeconds : countdown;

  const isMyTurnCaptain = game?.phase === "active" && state.me.role === roleForTeam(game.current_team);
  const isOnCurrentTeam = Boolean(game?.phase === "active" && mePlayer?.player_team === game.current_team);
  const canStart = (state.me.role === "red_captain" || state.me.role === "blue_captain") && redCaptainConnected && blueCaptainConnected;
  const canReveal = Boolean(isOnCurrentTeam && !isPreparationActive && game?.current_clue_word && game.remaining_guesses > 0);
  const canSubmitClue = Boolean(isMyTurnCaptain && !isPreparationActive && !game?.current_clue_word);
  const canEndTurn = Boolean(isMyTurnCaptain && !isPreparationActive && game?.phase === "active");
  const canControlTimer = Boolean(state.me.isCreator || state.me.role === "red_captain" || state.me.role === "blue_captain");
  const showOwnership = Boolean(state.me.role === "red_captain" || state.me.role === "blue_captain");

  const revealStatusMessage = (() => {
    if (!game) {
      return "Estado de partida no disponible.";
    }

    if (game.phase !== "active") {
      return "La partida no está activa.";
    }

    if (!isOnCurrentTeam) {
      return `Vota el equipo ${game.current_team === "blue" ? "azul" : "rojo"}.`;
    }

    if (isPreparationActive) {
      return "Fase de estrategia activa: espera a que termine el minuto inicial.";
    }

    if (!game.current_clue_word) {
      return "Primero debes enviar una pista (palabra y número).";
    }

    if (game.remaining_guesses <= 0) {
      return "No quedan intentos. Termina el turno para continuar.";
    }

    return "Pulsa una carta para votar. Se descubre cuando todo tu equipo confirma la misma carta.";
  })();

  const clueInputHint = (() => {
    if (!game || game.phase !== "active") {
      return "La partida debe estar activa para enviar una pista.";
    }

    if (state.me.role === "player") {
      return "Solo el capitán activo puede escribir y enviar la pista.";
    }

    if (!isMyTurnCaptain) {
      return "No es tu turno de capitán para enviar pista.";
    }

    if (isPreparationActive) {
      return "Fase de estrategia activa: espera a que termine el minuto inicial.";
    }

    if (game.current_clue_word) {
      return `Ya hay una pista activa: ${game.current_clue_word}, ${game.current_clue_number}.`;
    }

    return "Escribe una palabra y un número para enviar la pista.";
  })();

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
      {turnBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-40 flex justify-center px-4">
          <div
            className={`turn-banner rounded-2xl border px-6 py-4 text-center shadow-2xl ${
              turnBanner.team === "blue"
                ? "border-blue-300 bg-blue-100/95 text-blue-950"
                : "border-red-300 bg-red-100/95 text-red-950"
            }`}
            role="status"
            aria-live="polite"
          >
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Cambio de turno</p>
            <p className="text-lg font-black">{turnBanner.message}</p>
          </div>
        </div>
      )}

      {clueBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center px-4">
          <div
            className={`clue-banner rounded-2xl border px-6 py-4 text-center shadow-2xl ${
              clueBanner.team === "blue"
                ? "border-blue-300 bg-blue-100/95 text-blue-950"
                : "border-red-300 bg-red-100/95 text-red-950"
            }`}
            role="status"
            aria-live="polite"
          >
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Nueva pista</p>
            <p className="text-2xl font-black">
              {clueBanner.word}, {clueBanner.number}
            </p>
          </div>
        </div>
      )}

      {game.phase === "finished" && game.winner_team && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <section
            className={`winner-modal w-full max-w-xl rounded-3xl border-2 p-8 text-center shadow-2xl ${
              game.winner_team === "blue"
                ? "border-blue-300 bg-blue-50 text-blue-950"
                : "border-red-300 bg-red-50 text-red-950"
            }`}
            aria-label="Resultado de la partida"
          >
            <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Partida terminada</p>
            <h2 className="mt-3 text-4xl font-black">
              Gana el equipo {game.winner_team === "blue" ? "azul" : "rojo"}
            </h2>
            <p className="mt-2 text-sm opacity-90">
              Excelente ronda. Puedes iniciar una nueva partida o volver al inicio.
            </p>

            {state.me.role === "player" && myTeam && (
              <p className={`mt-3 text-base font-black ${myTeam === "blue" ? "text-blue-900" : "text-red-900"}`}>
                Tu equipo: {myTeam === "blue" ? "Equipo azul" : "Equipo rojo"}
              </p>
            )}

            <div className="winner-confetti" aria-hidden="true">
              {Array.from({ length: 20 }).map((_, index) => (
                <span
                  key={`confetti-${index}`}
                  className="winner-confetti-piece"
                  style={{
                    left: `${5 + index * 4.6}%`,
                    animationDelay: `${(index % 7) * 0.12}s`,
                    animationDuration: `${2.1 + (index % 5) * 0.28}s`,
                  }}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void executeAction(
                    {
                      type: "new_game",
                      ...(startingTeam !== "random" ? { forcedStartingTeam: startingTeam } : {}),
                    },
                    "Nueva ronda iniciada."
                  );
                }}
                disabled={acting}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Nueva ronda
              </button>
              <Link href="/" className="rounded-xl border border-current px-4 py-2 text-sm font-semibold">
                Volver al inicio
              </Link>
            </div>
          </section>
        </div>
      )}

      {game.phase === "lobby" && (
        <header className="mb-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Código Secreto</h1>
              <p className="text-sm text-slate-600">
                Sala: <span className="font-bold text-slate-900">{state.room.code}</span>
              </p>
              {state.me.role === "player" && (
                <p className="text-xs font-semibold text-slate-600">
                  Tu equipo: {mePlayer?.player_team === "red"
                    ? "rojo"
                    : mePlayer?.player_team === "blue"
                      ? "azul"
                      : "sin asignar"}
                </p>
              )}
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
      )}

      {game.phase === "active" && (
        <section
          className={`sticky top-2 z-30 mb-4 rounded-2xl border px-3 py-2 shadow-sm backdrop-blur-sm ${
            game.current_team === "blue"
              ? "border-blue-400 bg-blue-100/95 text-blue-950"
              : "border-red-400 bg-red-100/95 text-red-950"
          }`}
          aria-label="Turno actual"
        >
          <div className="grid gap-2 sm:grid-cols-3 sm:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Turno actual</p>
              <p className="text-base font-black">{game.current_team === "blue" ? "Equipo azul" : "Equipo rojo"}</p>
              <p className="text-xs opacity-90">Capitán: {activeCaptain ? activeCaptain.nickname : "no disponible"}</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Temporizador</p>
              <p className={`text-base font-black tabular-nums ${visibleCountdown <= 20 ? "text-red-600" : ""}`}>
                {formatSeconds(visibleCountdown)}
              </p>
              <p className="text-xs opacity-80">
                {game.timer_status === "running"
                  ? "En marcha"
                  : game.timer_status === "paused"
                    ? "Pausado"
                    : "Detenido"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Pista</p>
              <p className="text-base font-black">
                {game.current_clue_word && game.current_clue_number !== null
                  ? `${game.current_clue_word}, ${game.current_clue_number}`
                  : "Sin pista"}
              </p>
              <p className="text-xs opacity-80">Intentos restantes: {game.remaining_guesses}</p>
            </div>
          </div>
        </section>
      )}

      <div
        className={`grid gap-4 ${
          game.phase === "lobby" ? "lg:grid-cols-[1fr_320px]" : "lg:grid-cols-[260px_1fr_300px]"
        }`}
      >
        {game.phase !== "lobby" && (
          <aside className="space-y-4">
            <TeamPanel state={state} team="blue" />
          </aside>
        )}

        <section className="space-y-4">
          {game.phase === "lobby" && (
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Estado de la partida</h2>
              <p className="mt-2 text-sm text-slate-700">Esperando a que haya un capitán rojo y uno azul para empezar.</p>

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
                    Iniciar partida (1 min de estrategia)
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
          )}

          <CluePanel
            currentWord={game.current_clue_word}
            currentNumber={game.current_clue_number}
            remainingGuesses={game.remaining_guesses}
            canSubmit={canSubmitClue}
            hint={clueInputHint}
            canEndTurn={canEndTurn}
            endTurnDisabled={acting}
            onEndTurn={() => {
              void executeAction({ type: "end_turn" }, "Turno terminado.");
            }}
            onSubmit={(word, number) => executeAction({ type: "submit_clue", word, number }, "Pista enviada.")}
          />

          <GameBoard
            cards={state.cards}
            canReveal={canReveal}
            showOwnership={showOwnership}
            onReveal={async (cardId) => {
              if (!canReveal) {
                toast.error(revealStatusMessage);
                return;
              }

              const selectedCard = state.cards.find((card) => card.id === cardId);
              if (!window.confirm(`Confirmar voto para ${selectedCard?.word ?? "esta carta"}?`)) {
                return;
              }

              await executeAction({ type: "reveal_card", cardId }, "Voto enviado.");
            }}
          />

          {game.phase !== "lobby" && (
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700 shadow-sm">
              {revealStatusMessage}
              {game.phase === "active" && (
                <p className="mt-1 text-xs text-slate-500">
                  Puede descubrir ahora: {activeCaptain ? activeCaptain.nickname : "capitán no disponible"}.
                </p>
              )}
            </section>
          )}

          {showOwnership && (
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
              Vista de capitán: rojo = equipo rojo, azul = equipo azul, gris = neutral, negra = asesino.
            </section>
          )}

        </section>

        <aside className="space-y-4">
          <TimerPanel
            countdown={visibleCountdown}
            status={game.timer_status}
            canControl={canControlTimer}
            onPause={() => void executeAction({ type: "timer_pause" }, "Temporizador en pausa.")}
            onResume={() => void executeAction({ type: "timer_resume" }, "Temporizador reanudado.")}
            onReset={() => {
              if (!window.confirm("¿Quieres reiniciar el temporizador a 2:00?")) return;
              void executeAction({ type: "timer_reset" }, "Temporizador reiniciado.");
            }}
          />
          {game.phase === "lobby" ? (
            <PlayerList state={state} />
          ) : (
            <>
              <TeamPanel state={state} team="red" />
              <GameLog events={state.events} />
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
