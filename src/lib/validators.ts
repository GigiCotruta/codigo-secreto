import { z } from "zod";

export const nicknameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ0-9 _-]+$/, "Nickname contains invalid characters.");

export const clueSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .regex(/^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ]+$/, "Clue must be a single word."),
  number: z.number().int().min(0).max(9),
});

export const roleSchema = z.enum(["red_captain", "blue_captain", "spectator"]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("select_role"),
    role: roleSchema,
  }),
  z.object({
    type: z.literal("start_game"),
    forcedStartingTeam: z.enum(["red", "blue"]).optional(),
  }),
  z.object({
    type: z.literal("submit_clue"),
    word: z.string(),
    number: z.number(),
  }),
  z.object({
    type: z.literal("reveal_card"),
    cardId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("end_turn"),
  }),
  z.object({
    type: z.literal("timer_pause"),
  }),
  z.object({
    type: z.literal("timer_resume"),
  }),
  z.object({
    type: z.literal("timer_reset"),
  }),
  z.object({
    type: z.literal("new_game"),
    forcedStartingTeam: z.enum(["red", "blue"]).optional(),
  }),
]);

export const joinSchema = z.object({
  nickname: nicknameSchema,
});
