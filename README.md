# Codigo Secreto (Custom Codenames-Inspired Realtime App)

A production-ready, room-based, realtime multiplayer web app inspired by Codenames with custom rules:

- Only 2 active players: one red captain and one blue captain.
- Spectators are read-only.
- The current captain gives the clue and reveals cards.
- Correct team reveal allows continuing.
- Wrong reveal ends turn immediately.
- Assassin reveal ends the match immediately with a loss.

The entire end-user UI is in Spanish. All source code and technical documentation are in English.

## 1. Architecture Overview

### Frontend
- Next.js 16 App Router with TypeScript.
- Responsive UI built with Tailwind CSS.
- Reusable components for board, clues, timer, roles, and player list.
- Client realtime synchronization via Supabase Realtime subscriptions.

### Backend / Data
- Supabase Postgres schema with:
	- `rooms`
	- `room_players`
	- `games`
	- `game_cards`
	- `game_events`
- Server-authoritative game actions implemented as SQL RPC functions (`plpgsql`, row locking with `FOR UPDATE`).
- Next.js API routes call RPC functions using `SUPABASE_SERVICE_ROLE_KEY`.

### State Management
- Authoritative state: Postgres records (`games`, `game_cards`, `room_players`).
- Local UI state: transient form input, loading flags, visual timer countdown.
- Clients compute a visual countdown from authoritative fields and re-sync on realtime updates and fetch refreshes.

## 2. Key Technical Decisions

- Supabase chosen by default: best fit for Vercel-friendly realtime + SQL persistence + pub/sub.
- RPC-first gameplay actions: each critical transition is done in SQL under lock to reduce race conditions and duplicate updates.
- Timer model: canonical fields are `timer_remaining_seconds`, `timer_started_at`, and `timer_status`.
- Role guards in DB logic: spectators are blocked in RPC functions even if they bypass UI.
- Refresh-safe identity: player token is stored in browser local storage per room code.
- Reconnect handling: heartbeat endpoint updates `is_connected` and `last_seen_at`.

## 3. Full Project Structure

```text
codigo-secreto/
	src/
		app/
			api/rooms/
				route.ts
				[code]/
					route.ts
					actions/route.ts
					heartbeat/route.ts
					join/route.ts
			how-to-play/page.tsx
			room/[code]/page.tsx
			globals.css
			layout.tsx
			not-found.tsx
			page.tsx
		components/
			clue-panel.tsx
			game-board.tsx
			player-list.tsx
			role-selector.tsx
			room-client.tsx
			timer-panel.tsx
			toaster-provider.tsx
		data/
			spanish-words.ts
		hooks/
			use-room-game.ts
		lib/
			api-response.ts
			env.ts
			game-engine.ts
			room-code.ts
			room-state.ts
			storage.ts
			supabase-client.ts
			supabase-server.ts
			timer.ts
			utils.ts
		types/
			api.ts
			game.ts
	supabase/
		migrations/
			202603160001_init.sql
	tests/
		game-engine.test.ts
	.env.example
	vitest.config.ts
	README.md
```

## 4. Database Schema / Migrations

Schema is in:

- `supabase/migrations/202603160001_init.sql`

Highlights:

- Enum types for roles, teams, phase, timer status, and card owner.
- Indexes for room code lookup, players by room, cards by game.
- Realtime publication includes all core tables.
- Select policies are open for anon read.
- Writes occur through security-definer RPC functions.

Key RPC functions:

- `rpc_create_room`
- `rpc_join_room`
- `rpc_select_role`
- `rpc_start_game`
- `rpc_submit_clue`
- `rpc_reveal_card`
- `rpc_end_turn`
- `rpc_timer_pause`
- `rpc_timer_resume`
- `rpc_timer_reset`
- `rpc_expire_timer`
- `rpc_mark_presence`

## 5. Full Implementation Files

Core implementation is included in this repository under:

- API and authoritative action entrypoints:
	- `src/app/api/rooms/route.ts`
	- `src/app/api/rooms/[code]/join/route.ts`
	- `src/app/api/rooms/[code]/route.ts`
	- `src/app/api/rooms/[code]/actions/route.ts`
	- `src/app/api/rooms/[code]/heartbeat/route.ts`
- Realtime room UI and game flow:
	- `src/components/room-client.tsx`
	- `src/hooks/use-room-game.ts`
- Core deterministic game helpers:
	- `src/lib/game-engine.ts`
	- `src/lib/timer.ts`
- Built-in Spanish word list:
	- `src/data/spanish-words.ts`

## 6. Test Files

- `tests/game-engine.test.ts`

Current tests cover:

- board generation distribution (9/8/7/1)
- turn switching
- reveal turn-ending behavior
- clue guess count (`number + 1`)
- completion detection for team cards
- timer countdown derivation and expiry

## 7. Setup and Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env.local` and set values:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Apply Database Migration

Using Supabase SQL editor:

1. Open your project SQL editor.
2. Paste and run `supabase/migrations/202603160001_init.sql`.

Or with Supabase CLI (if configured):

```bash
supabase db push
```

### Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## 8. Realtime and Timer Sync

### Realtime sync

Clients subscribe to:

- `games` (room-scoped)
- `room_players` (room-scoped)
- `game_cards` (game-scoped)

On any change, clients refresh room state through `/api/rooms/[code]`.

### Timer sync model

Canonical backend fields:

- `timer_status`
- `timer_remaining_seconds`
- `timer_started_at`

Clients render local countdown by deriving from these fields each second.
The server can expire turns with `rpc_expire_timer` during room state fetches.
This avoids long-running server workers and keeps drift low.

## 9. Permissions

Role behavior:

- Red captain: gameplay actions only on red turn.
- Blue captain: gameplay actions only on blue turn.
- Spectator: read-only.

Timer controls:

- Captains and room creator can pause/resume/reset timer.

All critical checks are enforced in RPC functions, not only the UI.

## 10. Deployment to Vercel

### Deploy steps

1. Push project to GitHub.
2. Import repository in Vercel.
3. Set environment variables in Vercel project settings:
	 - `NEXT_PUBLIC_SUPABASE_URL`
	 - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	 - `SUPABASE_SERVICE_ROLE_KEY`
4. Ensure the migration has been applied in Supabase.
5. Deploy.

### Build commands

- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start`

### Vercel notes

- Supabase Realtime works over WebSocket from browser clients.
- No custom websocket server is required in Vercel.
- Keep service role key only in server environment (never expose to client).

## 11. Basic Testing Instructions

Run tests:

```bash
npm run test
```

Run lint:

```bash
npm run lint
```

Run production build check:

```bash
npm run build
```

## 12. Limitations

- No user accounts/authentication by design.
- Presence is heartbeat-based and intentionally lightweight.
- `rpc_expire_timer` is triggered on fetch/action cycles, not by a background scheduler.

## 13. Future Improvements

- Add integration tests for API action flows.
- Add stale room cleanup cron/job.
- Add richer event history panel from `game_events`.
- Add optional sound effects and mute preference.
- Add room-level host settings (timer duration, max spectators, etc.).
