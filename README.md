# ArenaParser

ArenaParser is a local web application for importing and analysing World of Warcraft arena combat logs. It detects completed arena matches, stores them in PostgreSQL and presents match history, compositions, spell timelines, damage, healing, dispels, interrupts and death recaps in a React dashboard.

The project currently targets the Midnight 12.1 combat-log format and supports Arena Skirmish, 2v2, 3v3 and Solo Shuffle. Solo Shuffle is stored as one match containing its individual rounds.

## Architecture

```text
WoWCombatLog*.txt
       |
       v
Spring Boot parser ──> PostgreSQL
       |                    |
       +──── REST API <─────+
                |
                v
          React + Vite UI
```

### Backend

The backend is Java 21 with Spring Boot, Spring Web and Spring Data JPA.

- `CombatLogImportService` locates the newest `WoWCombatLog*.txt` file in the configured directory.
- `CombatLogParser` parses individual combat-log lines and damage events.
- `ArenaMatchDetector` identifies completed matches and builds participants, rounds, spell statistics, utility events, death recaps and timelines.
- `ImportantSpellCatalog` determines which Midnight offensive, defensive and crowd-control abilities appear in timelines.
- The versioned spell catalog is exposed through `/api/spells`, keeping timeline classification in the backend.
- The tracked-character service stores selected profiles and can enrich them with Battle.net profile, specialization, equipment and avatar data.
- `AutomaticCombatLogImportService` checks for log changes and imports only completed matches.
- `ArenaMatchService` persists matches and their detailed JSON payload.
- Controllers under `src/main/java/com/samtius/arenaparser/controller` expose the REST API.

Match metadata is stored as regular PostgreSQL columns. The larger per-match combat report is stored as JSON text so the parser model can evolve without creating a table for every nested statistic.

### Frontend

The frontend is React, TypeScript and Vite under `frontend/`.

It provides:

- recent matches grouped by arena format;
- search and composition filters for your team and the opposing team;
- team composition summaries before opening a match;
- manually tracked Battle.net profiles with equipment and active talent details;
- match and per-player spell timelines;
- damage, healing, damage-taken, dispel and interrupt breakdowns;
- death recaps;
- MMR history obtained from the two team-rating values in `ARENA_MATCH_END`;
- browser Back-button support through match IDs in the URL.

The Vite development server proxies `/api` requests to Spring Boot.

### Database and local services

`compose.yaml` runs PostgreSQL in Docker. The named Docker volume `postgres-data` keeps the database when the application or container is stopped. `docker compose down -v` deletes that volume and all locally stored match data, so do not use `-v` unless that is intentional.

Tests use an in-memory H2 database and do not require Docker or PostgreSQL.

## Requirements

Install these before setting up a new computer:

1. **Git** – used to clone and collaborate on the repository.
2. **Java Development Kit 21 or newer** – the project compiles for Java 21. Confirm with `java -version`.
3. **Node.js 22 LTS** – includes a compatible runtime for the current Vite toolchain. Confirm with `node --version`.
4. **Corepack/pnpm** – run `corepack enable`, then confirm with `corepack pnpm --version`. The required pnpm version is declared in `frontend/package.json`.
5. **Docker Desktop** – provides Docker Engine and Docker Compose. Start Docker Desktop before ArenaParser.
6. **World of Warcraft Retail** – required only when importing real combat logs.

VS Code is optional but recommended. No global Maven installation is required because the repository includes Maven Wrapper.

## Set up a new Windows computer

### 1. Clone the repository

```powershell
git clone https://github.com/samtius/ArenaParser.git
cd ArenaParser
```

If you use VS Code:

```powershell
code .
```

### 2. Create the local environment file

```powershell
Copy-Item .env.example .env
```

Open `.env` and change at least:

- `POSTGRES_PASSWORD` to a local development password;
- `ARENAPARSER_COMBAT_LOG_PATH` to this computer's WoW Retail `Logs` directory;
- `ARENAPARSER_COMBAT_LOG_ZONE` if the computer is not using the Stockholm time zone.

Use forward slashes in the WoW path. Point to the directory rather than one particular log file; ArenaParser then follows the newest `WoWCombatLog*.txt` automatically.

Example:

```dotenv
POSTGRES_DB=arenaparser
POSTGRES_USER=arenaparser
POSTGRES_PASSWORD=choose-a-local-password
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=15432

BACKEND_HOST=127.0.0.1
BACKEND_PORT=8080
FRONTEND_HOST=127.0.0.1
FRONTEND_PORT=5173

ARENAPARSER_COMBAT_LOG_PATH=C:/Program Files (x86)/World of Warcraft/_retail_/Logs
ARENAPARSER_COMBAT_LOG_ZONE=Europe/Stockholm
ARENAPARSER_AUTO_IMPORT_ENABLED=true
ARENAPARSER_AUTO_IMPORT_INTERVAL_MS=5000

# Optional Battle.net profile sync
BATTLENET_CLIENT_ID=
BATTLENET_CLIENT_SECRET=
```

`.env` is intentionally ignored by Git. Never commit real database passwords or machine-specific paths. When a new setting is introduced, add a safe example to `.env.example` as well.

### Keep local data out of Git

The repository ignores `.env`, timestamped `WoWCombatLog*.txt` files, database files and generated build output. Files under `src/test/resources` are short, synthetic parser fixtures only; do not replace them with a real combat log.

Before committing or making a fork public, verify what Git will publish:

```powershell
git status
git ls-files | Select-String -Pattern '\.env$|WoWCombatLog|\.db$|\.sqlite'
git diff --cached
```

The only expected environment file in `git ls-files` is `.env.example`, which must contain placeholders rather than working credentials. If a real secret was ever committed, removing it in a later commit is not enough because it remains in Git history. Revoke or rotate the credential immediately, then remove it from history before publishing.

### Optional Battle.net profile sync

ArenaParser starts with Watur and Shadowfiend on Defias Brotherhood in its tracked-character list. Additional characters can be added manually in the dashboard. Profiles remain stored locally when Battle.net integration is disabled.

To enable the **Sync** buttons on another computer:

1. Sign in to the [Battle.net Developer Portal](https://develop.battle.net/access/clients).
2. Create a separate API client for that developer or local installation. Do not share one developer's client secret through Git, chat or documentation.
3. Use `ArenaParser` as the client name.
4. Use `https://github.com/samtius/ArenaParser` as the service URL.
5. A redirect URI is not required. ArenaParser uses the OAuth2 **client credentials** flow for public character data, not an authorization-code login flow. Leave it empty if the portal permits it.
6. A suitable intended-use description is:

   ```text
   ArenaParser is a local, open-source World of Warcraft arena analysis application. It calls the Battle.net Profile and Game Data APIs from a local Spring Boot backend to retrieve public profile, specialization, equipment, talent, character-media, item-media and spell-media data for individual characters manually selected by the user. API credentials remain in the user's local environment file and are never exposed to the frontend or committed to the repository.
   ```

7. Copy `.env.example` to `.env` if the local file does not exist, then add the new client's credentials:

```dotenv
BATTLENET_CLIENT_ID=your-local-client-id
BATTLENET_CLIENT_SECRET=your-local-client-secret
```

Restart ArenaParser after changing `.env`; environment values are read only at backend startup. Open the tracked-character section and press **Sync** for each profile. A successful profile view contains an avatar, class, active specialization, level, item level, equipment, gems, enchants and the active class, specialization, hero and PvP talents. Item and spell icons are resolved through the local backend and cached in memory.

The client secret is read only by Spring Boot and must never be committed or exposed to the frontend. `.env` is already ignored by Git. Synced data is a timestamped public-profile snapshot; it does not prove which equipment or talents a character used in an older arena match. The current integration does not request access to a user's private Battle.net account data.

### 3. Install frontend packages

The start script installs packages automatically if `frontend/node_modules` is absent. You can also install them explicitly:

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
cd ..
```

### 4. Start the complete application

Make sure Docker Desktop is running, then execute:

```powershell
.\start.cmd
```

The script:

1. reads `.env`;
2. starts PostgreSQL with Docker Compose;
3. builds and starts Spring Boot;
4. installs missing frontend packages and starts Vite;
5. waits for both services;
6. opens ArenaParser in the default browser.

With the example ports, the frontend is at `http://127.0.0.1:5173` and the backend health endpoint is at `http://127.0.0.1:8080/api/health`.

Stop everything with:

```powershell
.\stop.cmd
```

This stops the frontend, backend and PostgreSQL container while preserving database data.

## Set up a new macOS computer

These instructions work on both Apple silicon and Intel Macs. The easiest way to install the command-line dependencies is with [Homebrew](https://brew.sh/). Install Homebrew first if it is not already available.

### 1. Install the requirements

Install Git, Java 21 and Node.js 22:

```bash
brew install git
brew install --cask temurin@21
brew install node@22
```

Homebrew may print an additional command for adding `node@22` to `PATH`. Run that command if `node --version` is not found after opening a new Terminal window.

Enable Corepack and verify the installations:

```bash
corepack enable
git --version
java -version
node --version
corepack pnpm --version
```

Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) and choose the download that matches the Mac's processor. Start Docker Desktop once and wait until Docker Engine is running.

VS Code is optional. If you use it, install the `code` shell command from VS Code's Command Palette by selecting **Shell Command: Install 'code' command in PATH**.

### 2. Clone the repository

```bash
git clone https://github.com/samtius/ArenaParser.git
cd ArenaParser
```

To open the project in VS Code:

```bash
code .
```

### 3. Create the local environment file

```bash
cp .env.example .env
```

Open `.env` and change the database password and machine-specific settings. A typical WoW Retail log directory on macOS is:

```dotenv
POSTGRES_PASSWORD=choose-a-local-password
ARENAPARSER_COMBAT_LOG_PATH="/Applications/World of Warcraft/_retail_/Logs"
ARENAPARSER_COMBAT_LOG_ZONE=Europe/Stockholm
```

Keep the quotation marks around paths containing spaces. If WoW was installed elsewhere, open its folder in Finder and use the actual `Logs` directory. ArenaParser should point to the directory, not to one particular combat-log file.

### 4. Install frontend packages

```bash
cd frontend
corepack pnpm install --frozen-lockfile
cd ..
```

### 5. Start the application

The included one-click `start.cmd` and `stop.cmd` scripts are Windows-specific. On macOS, start the services in two Terminal tabs.

In the first tab, from the repository root, start PostgreSQL and the backend:

```bash
docker compose up -d
set -a
source .env
set +a
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

In a second tab, start the frontend:

```bash
cd frontend
corepack pnpm dev
```

Open `http://127.0.0.1:5173` in a browser. The backend health endpoint is available at `http://127.0.0.1:8080/api/health`.

To stop ArenaParser, press `Control+C` in both Terminal tabs. Then stop PostgreSQL from the repository root:

```bash
docker compose stop
```

The PostgreSQL data remains in the Docker volume and is available the next time the application starts.

## Running services separately

This is useful while developing one part of the application.

Start PostgreSQL:

```powershell
docker compose up -d
```

Load `.env` and run the backend:

```powershell
. .\scripts\load-env.ps1 -Path .\.env
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local
```

Run the frontend in another terminal:

```powershell
cd frontend
corepack pnpm dev
```

## Combat logging in WoW

Enable Advanced Combat Logging in WoW's network settings. Start logging with:

```text
/combatlog
```

ArenaParser checks the newest log file at the configured interval. It waits until an arena match is complete before storing it. Keeping `/combatlog` enabled is supported, but old log files can become large and may be archived or deleted manually when WoW is closed.

## Tests and builds

Run all backend tests:

```powershell
.\mvnw.cmd test
```

Build the backend JAR:

```powershell
.\mvnw.cmd package
```

Build and type-check the frontend:

```powershell
cd frontend
corepack pnpm build
```

Generated output (`target/`, `frontend/dist/`, `node_modules/`, TypeScript build metadata and runtime logs) is ignored by Git.

## Main API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Backend health check |
| `GET` | `/api/matches` | Basic stored matches |
| `GET` | `/api/matches/summaries` | Matches with team compositions and rating metadata |
| `GET` | `/api/matches/{id}/details` | Full parsed report for one match |
| `GET` | `/api/characters` | Manually tracked character profiles |
| `POST` | `/api/characters` | Add a region, realm and character name |
| `POST` | `/api/characters/{id}/refresh` | Refresh one profile from Battle.net |
| `DELETE` | `/api/characters/{id}` | Stop tracking a profile |
| `GET` | `/api/spells` | Current versioned important-spell catalog |
| `GET` | `/api/spells/resolve` | Classify a spell for the timeline |
| `GET` | `/api/media/{type}/{id}` | Resolve and cache a Battle.net item or spell icon |
| `POST` | `/api/combat-log/import-arena-matches` | Import completed matches from the newest log |
| `POST` | `/api/application/shutdown` | Shut down the local application from the browser |

## Collaboration workflow

Avoid committing directly to `main` when several people are working on the project.

```powershell
git switch main
git pull
git switch -c feature/short-description
```

After making and testing changes:

```powershell
git status
git add <changed-files>
git commit -m "Describe the change"
git push -u origin feature/short-description
```

Then open a pull request on GitHub. Keep `.env`, combat logs, database files and generated build output out of commits.

## Troubleshooting

### Docker cannot bind the PostgreSQL port

Change `POSTGRES_PORT` in `.env`, for example from `15432` to `15433`, and restart ArenaParser. Docker's internal PostgreSQL port remains `5432`.

### `pnpm` is not recognized

Use `corepack pnpm` instead of plain `pnpm`. Run `corepack enable` once from an elevated terminal if Corepack is disabled.

### The combat log cannot be found

Check `ARENAPARSER_COMBAT_LOG_PATH` in `.env`. It should point to the Retail `Logs` directory and that directory must contain a `WoWCombatLog*.txt` file.

### Battle.net Sync is disabled

Confirm that both `BATTLENET_CLIENT_ID` and `BATTLENET_CLIENT_SECRET` contain values in the local `.env` file, without spaces around `=`. Fully stop and restart ArenaParser after editing the file. Check `http://127.0.0.1:8080/api/characters/status`; `battleNetConfigured` should be `true`.

### A Battle.net profile or icon cannot be loaded

Confirm the character's region, realm slug and name. Battle.net profile snapshots commonly update after the character logs out of WoW. A `401` indicates invalid API credentials; create or copy the local API client values again. A `404` usually means that the character or requested media record was not found. Do not put the client secret in a browser URL or frontend environment variable.

### A port is already in use

Change `BACKEND_PORT` or `FRONTEND_PORT` in `.env`. Both start/stop scripts and Vite's API proxy use those values.

### The database password was changed after PostgreSQL was first created

PostgreSQL initializes credentials only when the Docker volume is created. Either restore the old password in `.env`, change the password inside PostgreSQL, or intentionally recreate the development volume with `docker compose down -v` and then start again. Recreating the volume deletes all stored matches.

### Logs

Runtime logs and tracked process IDs are written to `.run/`. This directory is local and ignored by Git.
