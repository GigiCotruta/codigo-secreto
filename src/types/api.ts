import type { PublicRoomState } from "@/types/game";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface CreateRoomResult {
  roomCode: string;
  playerToken: string;
}

export interface JoinRoomResult {
  roomCode: string;
  playerToken: string;
}

export interface RoomStateResult extends PublicRoomState {
  me: {
    playerToken: string;
    role: "red_captain" | "blue_captain" | "spectator";
    nickname: string;
    isCreator: boolean;
  };
}
