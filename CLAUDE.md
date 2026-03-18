# CLAUDE.md

Project guide for architecture, features, and historical changes.
Last updated: 2026-03-18

## 1. What This Project Is

Codigo Secreto is a realtime, room-based game inspired by Codenames.
The UX is in Spanish. The code and technical docs are in English.

Current gameplay model:
- 2 captains are active decision-makers: red captain and blue captain.
- Players can join teams and watch the board.
- Captains submit clues and reveal cards.
- Wrong reveal ends turn immediately.
- Assassin reveal ends the game immediately.

## 2. Stack and High-Level Architecture

- Framework: Next.js App Router with TypeScript.
- Styling: Tailwind CSS (global theme in src/app/globals.css).
- Data and realtime: Supabase Postgres + Supabase Realtime.
- Validation: zod.
- Testing: Vitest.

Data flow:
1. UI triggers action from room client.
2. Next.js API route validates payload and forwards action to Supabase RPC.
3. SQL RPC function applies authoritative state transition under row lock.
4. Realtime events refresh connected clients.
5. Client re-fetches state from room endpoint and updates UI.

## 3. Source of Truth

The database is authoritative for game state.
Do not implement critical game rules only in frontend.

Main authoritative entities:
- rooms
- room_players
- games
- game_cards
- game_events

Key server entrypoints:
- src/app/api/rooms/route.ts
- src/app/api/rooms/[code]/route.ts
- src/app/api/rooms/[code]/join/route.ts
- src/app/api/rooms/[code]/actions/route.ts
- src/app/api/rooms/[code]/heartbeat/route.ts

Key state composition:
- src/lib/room-state.ts

Key client orchestrator:
- src/components/room-client.tsx
- src/hooks/use-room-game.ts

## 4. Core Game Rules (Current)

- Clue submission sets remaining guesses to the exact clue number.
- Turn auto-ends when:
  - captain uses all guesses for the clue number
  - a wrong card is revealed
  - a neutral card is revealed
- Game ends when:
  - assassin is revealed (current team loses)
  - one team reveals all its cards

Timer and preparation:
- Initial 1-minute preparation phase starts each new game.
- Preparation is finalized by rpc_maybe_finish_preparation.
- Active timer state uses timer_status, timer_remaining_seconds, and timer_started_at.

## 5. Frontend UX Patterns

Turn context:
- Persistent turn panel remains visible in room UI.
- Additional non-blocking visual turn-change banner appears on turn changes.

Endgame UX:
- Winner modal appears centered when game phase is finished.
- Confetti celebration is triggered in room client.
- Modal includes:
  - Nueva ronda
  - Volver al inicio

Important file locations:
- src/components/room-client.tsx
- src/components/clue-panel.tsx
- src/components/game-board.tsx
- src/app/globals.css

## 6. Validation and Action Contracts

Validation schema:
- src/lib/validators.ts

Action union supports:
- select_role
- start_game
- submit_clue
- reveal_card
- end_turn
- timer_pause
- timer_resume
- timer_reset
- new_game

## 7. Migration History (Chronological)

- 202603160001_init.sql
  - Initial schema, enums, core tables, baseline RPC functions.

- 202603160002_fix_reveal_card_team_cast.sql
  - Fixes team-to-card-owner casting in reveal flow.

- 202603160003_player_teams_and_preparation_phase.sql
  - Adds player teams.
  - Adds preparation phase support.
  - Updates role flow and turn/timer behavior around preparation.

- 202603180001_exact_clue_guesses.sql
  - Changes rpc_submit_clue so remaining_guesses = clue number (not number + 1).
  - Enables exact-count auto turn end requested in gameplay update.

## 8. Recent UI and Gameplay Changes (2026-03-18)

Implemented:
- Exact clue guess count rule in DB and helper tests.
- Turn change visual popup that does not block play.
- Winner center modal with confetti and action buttons.

Touched files:
- supabase/migrations/202603180001_exact_clue_guesses.sql
- src/components/room-client.tsx
- src/app/globals.css
- src/lib/game-engine.ts
- tests/game-engine.test.ts
- package.json (canvas-confetti)

## 9. Testing and Quality

Run locally:
- npm run test
- npm run lint
- npm run build

Current expected baseline:
- Unit tests pass in tests/game-engine.test.ts.
- ESLint passes with no errors.

## 10. Safe Change Playbook

When modifying rules:
1. Update SQL RPC functions first.
2. Keep API route validation aligned.
3. Update UI conditions/messages.
4. Update tests for any rule change.

When adding UI features:
1. Keep turn panel and gameplay controls intact.
2. Prefer non-blocking overlays for transient feedback.
3. Ensure keyboard and screen-reader labels are present.

When adding migrations:
1. Create a new migration file, never rewrite old history.
2. Mention behavioral impact in this file under migration history.

## 11. Known Risks and Notes

- Timer expiration is evaluated during fetch/action cycles, not by always-on worker.
- Realtime refresh can produce frequent fetches in active rooms.
- Presence depends on heartbeat and browser lifecycle behavior.

## 12. Quick Orientation for New Contributors

Start reading in this order:
1. README.md
2. src/components/room-client.tsx
3. src/hooks/use-room-game.ts
4. src/app/api/rooms/[code]/actions/route.ts
5. supabase/migrations/*.sql
6. tests/game-engine.test.ts
