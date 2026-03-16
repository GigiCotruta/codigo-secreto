export type TeamColor = "red" | "blue";

export type PlayerRole = "red_captain" | "blue_captain" | "player";

export type RoomStatus = "lobby" | "active" | "finished";

export type TimerStatus = "running" | "paused" | "stopped";

export type CardOwner = TeamColor | "neutral" | "assassin";

export interface RoomRecord {
  id: string;
  code: string;
  status: RoomStatus;
  creator_token: string;
  created_at: string;
  updated_at: string;
}

export interface RoomPlayerRecord {
  id: string;
  room_id: string;
  player_token: string;
  nickname: string;
  role: PlayerRole;
  player_team: TeamColor | null;
  is_connected: boolean;
  joined_at: string;
  last_seen_at: string;
}

export interface GameRecord {
  id: string;
  room_id: string;
  phase: RoomStatus;
  starting_team: TeamColor;
  current_team: TeamColor;
  current_clue_word: string | null;
  current_clue_number: number | null;
  remaining_guesses: number;
  timer_remaining_seconds: number;
  timer_status: TimerStatus;
  timer_started_at: string | null;
  preparation_ends_at: string | null;
  winner_team: TeamColor | null;
  loser_team: TeamColor | null;
  assassin_revealed: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface GameCardRecord {
  id: string;
  game_id: string;
  position: number;
  word: string;
  owner_type: CardOwner;
  is_revealed: boolean;
  revealed_at: string | null;
}

export interface TurnClue {
  word: string;
  number: number;
}

export interface ResolvedTimer {
  secondsLeft: number;
  isExpired: boolean;
}

export interface PublicRoomState {
  room: RoomRecord;
  players: RoomPlayerRecord[];
  game: GameRecord | null;
  cards: GameCardRecord[];
}
