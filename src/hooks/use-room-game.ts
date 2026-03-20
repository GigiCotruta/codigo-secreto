"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";
import { resolveTimerSeconds } from "@/lib/timer";
import type { RoomStateResult } from "@/types/api";

interface RoomGameHook {
  state: RoomStateResult | null;
  loading: boolean;
  error: string | null;
  countdown: number;
  refresh: () => Promise<void>;
  sendAction: (action: Record<string, unknown>) => Promise<void>;
  markDisconnected: () => void;
}

export function useRoomGame(roomCode: string, playerToken: string | null): RoomGameHook {
  const [state, setState] = useState<RoomStateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(120);

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const refresh = useCallback(async () => {
    if (!playerToken) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/rooms/${roomCode}?playerToken=${playerToken}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "No se pudo sincronizar la sala.");
      }

      setState(payload.data);
      const game = payload.data.game;
      if (game) {
        const resolved = resolveTimerSeconds(
          game.timer_status,
          game.timer_remaining_seconds,
          game.timer_started_at
        );
        setCountdown(resolved.secondsLeft);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar la sala.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [playerToken, roomCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const game = state?.game;
    if (!game) return;

    const tick = () => {
      const next = resolveTimerSeconds(
        game.timer_status,
        game.timer_remaining_seconds,
        game.timer_started_at
      );
      setCountdown(next.secondsLeft);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [state?.game]);

  useEffect(() => {
    if (!state?.room || !state?.game) return;

    const channels: RealtimeChannel[] = [];

    const gameChannel = supabase
      .channel(`room-${state.room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `room_id=eq.${state.room.id}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${state.room.id}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_cards",
          filter: `game_id=eq.${state.game.id}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_events",
          filter: `game_id=eq.${state.game.id}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();

    channels.push(gameChannel);

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [refresh, state?.game, state?.room, supabase]);

  useEffect(() => {
    if (!playerToken) return;

    const sendHeartbeat = async (connected: boolean) => {
      await fetch(`/api/rooms/${roomCode}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerToken, connected }),
        keepalive: true,
      });
    };

    void sendHeartbeat(true);
    const interval = window.setInterval(() => {
      void sendHeartbeat(true);
    }, 15000);

    const beforeUnload = () => {
      navigator.sendBeacon(
        `/api/rooms/${roomCode}/heartbeat`,
        JSON.stringify({ playerToken, connected: false })
      );
    };

    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", beforeUnload);
      void sendHeartbeat(false);
    };
  }, [playerToken, roomCode]);

  const sendAction = useCallback(
    async (action: Record<string, unknown>) => {
      if (!playerToken) return;

      const response = await fetch(`/api/rooms/${roomCode}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-player-token": playerToken,
        },
        body: JSON.stringify(action),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Acción no permitida.");
      }

      setState(payload.data);
    },
    [playerToken, roomCode]
  );

  const markDisconnected = useCallback(() => {
    if (!playerToken) return;
    void fetch(`/api/rooms/${roomCode}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerToken, connected: false }),
      keepalive: true,
    });
  }, [playerToken, roomCode]);

  return {
    state,
    loading,
    error,
    countdown,
    refresh,
    sendAction,
    markDisconnected,
  };
}
