const TOKEN_KEY_PREFIX = "codigo-secreto-player-token:";
const NICKNAME_KEY = "codigo-secreto-last-nickname";

export function getStoredPlayerToken(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${TOKEN_KEY_PREFIX}${roomCode}`);
}

export function setStoredPlayerToken(roomCode: string, playerToken: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${TOKEN_KEY_PREFIX}${roomCode}`, playerToken);
}

export function setLastNickname(nickname: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NICKNAME_KEY, nickname);
}

export function getLastNickname(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NICKNAME_KEY) ?? "";
}
