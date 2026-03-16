import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatSeconds(seconds: number): string {
  const safe = Math.max(0, seconds);
  const min = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const sec = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${min}:${sec}`;
}
