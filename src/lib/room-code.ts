const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[idx];
  }
  return code;
}

export function normalizeRoomCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export function createPlayerToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
