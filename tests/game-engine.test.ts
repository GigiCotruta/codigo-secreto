import { describe, expect, it } from "vitest";
import {
  createBoard,
  defaultRemainingGuesses,
  hasTeamCompletedCards,
  nextTeam,
  shouldEndTurnAfterReveal,
} from "@/lib/game-engine";
import { resolveTimerSeconds } from "@/lib/timer";
import type { GameCardRecord } from "@/types/game";

describe("game engine board generation", () => {
  it("creates 25 cards with expected owner distribution for red start", () => {
    const board = createBoard("red");

    expect(board).toHaveLength(25);
    expect(board.filter((card) => card.owner_type === "red")).toHaveLength(9);
    expect(board.filter((card) => card.owner_type === "blue")).toHaveLength(8);
    expect(board.filter((card) => card.owner_type === "neutral")).toHaveLength(7);
    expect(board.filter((card) => card.owner_type === "assassin")).toHaveLength(1);
  });

  it("creates 25 cards with expected owner distribution for blue start", () => {
    const board = createBoard("blue");

    expect(board.filter((card) => card.owner_type === "blue")).toHaveLength(9);
    expect(board.filter((card) => card.owner_type === "red")).toHaveLength(8);
  });
});

describe("turn and reveal rules", () => {
  it("switches team correctly", () => {
    expect(nextTeam("red")).toBe("blue");
    expect(nextTeam("blue")).toBe("red");
  });

  it("calculates clue guesses as number + 1", () => {
    expect(defaultRemainingGuesses(0)).toBe(1);
    expect(defaultRemainingGuesses(2)).toBe(3);
  });

  it("ends turn on neutral, opponent, and assassin reveals", () => {
    expect(shouldEndTurnAfterReveal("neutral", "red")).toBe(true);
    expect(shouldEndTurnAfterReveal("blue", "red")).toBe(true);
    expect(shouldEndTurnAfterReveal("assassin", "red")).toBe(true);
    expect(shouldEndTurnAfterReveal("red", "red")).toBe(false);
  });

  it("detects completed team cards", () => {
    const cards: GameCardRecord[] = [
      {
        id: "f713d2ed-75cc-4efd-94cf-6d6eb8c7ae12",
        game_id: "2c0a2722-4f3e-4fa4-b367-56f171f4d640",
        position: 0,
        word: "perro",
        owner_type: "red",
        is_revealed: true,
        revealed_at: new Date().toISOString(),
      },
      {
        id: "6d5d6f37-09c8-45a0-9077-217f67c3cb45",
        game_id: "2c0a2722-4f3e-4fa4-b367-56f171f4d640",
        position: 1,
        word: "gato",
        owner_type: "red",
        is_revealed: true,
        revealed_at: new Date().toISOString(),
      },
    ];

    expect(hasTeamCompletedCards(cards, "red")).toBe(true);
  });
});

describe("timer resolution", () => {
  it("keeps paused timers stable", () => {
    const resolved = resolveTimerSeconds("paused", 87, null, Date.now());
    expect(resolved.secondsLeft).toBe(87);
    expect(resolved.isExpired).toBe(false);
  });

  it("reduces running timer with elapsed time", () => {
    const startedAt = new Date(Date.now() - 15_000).toISOString();
    const resolved = resolveTimerSeconds("running", 120, startedAt, Date.now());

    expect(resolved.secondsLeft).toBeGreaterThanOrEqual(104);
    expect(resolved.secondsLeft).toBeLessThanOrEqual(105);
  });

  it("expires running timer at zero", () => {
    const startedAt = new Date(Date.now() - 130_000).toISOString();
    const resolved = resolveTimerSeconds("running", 120, startedAt, Date.now());

    expect(resolved.secondsLeft).toBe(0);
    expect(resolved.isExpired).toBe(true);
  });
});
