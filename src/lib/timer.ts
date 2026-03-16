import type { ResolvedTimer, TimerStatus } from "@/types/game";

export function resolveTimerSeconds(
  timerStatus: TimerStatus,
  timerRemainingSeconds: number,
  timerStartedAt: string | null,
  nowMs = Date.now()
): ResolvedTimer {
  if (timerStatus !== "running" || !timerStartedAt) {
    return {
      secondsLeft: Math.max(0, timerRemainingSeconds),
      isExpired: timerRemainingSeconds <= 0,
    };
  }

  const elapsed = Math.floor((nowMs - new Date(timerStartedAt).getTime()) / 1000);
  const secondsLeft = Math.max(0, timerRemainingSeconds - elapsed);

  return {
    secondsLeft,
    isExpired: secondsLeft <= 0,
  };
}
