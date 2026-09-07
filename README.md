# Subsidence Game

A facilitated browser game for two teams: Residents and Industrialists. A third browser acts as Moderator and advances rounds, resets the game, and dredges the river.

## Local production setup

Docker Compose runs two services:

- `flooding`: a production React build served by Nginx on `http://127.0.0.1:3000`.
- `backend`: an internal Express state server. It is reachable only through Nginx at `/api`.

Game state is stored in the Docker volume `subsidence-game_game-data` and survives container restarts. Only the frontend is bound to the Windows host, and it is bound to loopback rather than the LAN.

1. Copy `.env.example` to `.env` if `.env` does not already exist.
2. Give all three roles unique access codes of at least eight characters.
3. Build and start the game:

   ```powershell
   docker compose up --build -d
   ```

4. Open <http://127.0.0.1:3000> in three separate browser profiles or devices reached through an approved proxy/tunnel.
5. Use one controlling browser for each role. A role lease prevents two browsers from controlling the same role simultaneously.

The repository includes local-only codes in the ignored `.env` file. Rotate them before making the application public.

### Local access codes

Read the current codes without printing any other environment variables:

```powershell
Get-Content -LiteralPath .env
```

### Game flow

1. Residents and Industrialists make their moves.
2. Each team selects **Ready for next round**. A later edit automatically clears that team's ready state.
3. The Moderator's **Next round** button becomes available when both teams are ready.
4. The backend advances the round atomically, calculates tax/sediment/subsidence and flood damage, persists the result, and clears both ready flags.

### Game history

Starting a new game from the Moderator controls creates a timestamped folder under `history/`, using Singapore time. The folder is private to this computer and is not served by Nginx or exposed through the tunnel.

Each round has two self-contained, view-only HTML snapshots:

- `round-01-start.html` records the initial board after the new game is created.
- `round-01-end.html` records both teams immediately before the Moderator advances.
- `round-02-start.html` records the post-advance board, including the flood level or **No flood**.
- The same start/end pattern continues for every subsequent round.

If the Moderator resets during an unfinished round, its current state is saved as that round's final `end` snapshot before the next timestamped game folder is created. History remains available across container restarts and is ignored by Git.

### Operations

```powershell
# Status and health
docker compose ps
Invoke-RestMethod http://127.0.0.1:3000/healthz

# Follow logs
docker compose logs -f --tail 100

# Stop while retaining game state
docker compose down

# Start again with retained game state
docker compose up -d
```

Do not run `docker compose down --volumes` unless the saved game should be permanently removed.

## Architecture and safeguards

- Same-origin browser/API traffic; there is no hard-coded cloud backend.
- Role access codes are required for all state-changing requests.
- One active controlling browser is allowed per role; leases expire after 45 seconds without traffic.
- The two teams must explicitly mark themselves ready before a round can advance.
- Round transitions, resets, and dredging are server-authoritative and atomic.
- State writes use an atomic file replacement in a persistent Docker volume.
- JSON bodies are limited to 64 KB and validated against the expected 10-by-11 grid structure.
- Basic per-client request limiting, security response headers, health checks, and automatic container restart policies are enabled.

## Public hosting later

The intended public topology is one named Cloudflare Tunnel hostname pointing to `http://localhost:3000`. No tunnel is included or started yet. Before the event:

1. Replace every access code in `.env` with a strong new value.
2. Install/configure a named Cloudflare Tunnel, not a temporary TryCloudflare URL.
3. Test from three devices outside the home network.
4. Confirm Windows and Docker Desktop will not sleep, restart, or auto-update during the event.
5. Rehearse stopping and starting Compose and verify that the saved game returns.

## Development

The frontend source is under `frontend/`; the backend is under `backend/`. The root-level Node package is legacy and is not used by Docker Compose.

Run a frontend build without Docker:

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run build
```
