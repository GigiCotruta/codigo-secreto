import { SPANISH_WORDS } from "@/data/spanish-words";
import type { CardOwner, GameCardRecord, TeamColor } from "@/types/game";

const BOARD_SIZE = 25;
const TEAM_CARD_COUNTS: Record<TeamColor, number> = {
  red: 8,
  blue: 8,
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickUniqueWords(total: number): string[] {
  if (SPANISH_WORDS.length < total) {
    throw new Error("Not enough words in the built-in dictionary.");
  }

  return shuffle(SPANISH_WORDS).slice(0, total);
}

export function createBoard(startingTeam: TeamColor): Array<Pick<GameCardRecord, "position" | "word" | "owner_type">> {
  const words = pickUniqueWords(BOARD_SIZE);

  const ownerPool: CardOwner[] = [];
  const firstTeamCards = TEAM_CARD_COUNTS[startingTeam] + 1;
  const secondTeam: TeamColor = startingTeam === "red" ? "blue" : "red";

  for (let i = 0; i < firstTeamCards; i += 1) ownerPool.push(startingTeam);
  for (let i = 0; i < TEAM_CARD_COUNTS[secondTeam]; i += 1) ownerPool.push(secondTeam);
  for (let i = 0; i < 7; i += 1) ownerPool.push("neutral");
  ownerPool.push("assassin");

  const shuffledOwners = shuffle(ownerPool);

  return words.map((word, index) => ({
    position: index,
    word,
    owner_type: shuffledOwners[index],
  }));
}

export function nextTeam(team: TeamColor): TeamColor {
  return team === "red" ? "blue" : "red";
}

export function defaultRemainingGuesses(clueNumber: number): number {
  return clueNumber;
}

export function countRevealedByOwner(cards: GameCardRecord[], owner: TeamColor): number {
  return cards.filter((card) => card.owner_type === owner && card.is_revealed).length;
}

export function totalCardsByOwner(cards: GameCardRecord[], owner: TeamColor): number {
  return cards.filter((card) => card.owner_type === owner).length;
}

export function hasTeamCompletedCards(cards: GameCardRecord[], owner: TeamColor): boolean {
  const total = totalCardsByOwner(cards, owner);
  const revealed = countRevealedByOwner(cards, owner);
  return total > 0 && total === revealed;
}

export function shouldEndTurnAfterReveal(owner: CardOwner, activeTeam: TeamColor): boolean {
  if (owner === "assassin") return true;
  if (owner === "neutral") return true;
  if (owner === activeTeam) return false;
  return true;
}

export function isCorrectTeamReveal(owner: CardOwner, activeTeam: TeamColor): boolean {
  return owner === activeTeam;
}
