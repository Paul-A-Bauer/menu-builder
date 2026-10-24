# Kids' Menu Builder

React (Vite) + .NET 8 minimal API + Postgres. Layout mirrors the IHOP kids' menu: Step 1 main, Step 2 side, add a drink, add a sweet treat.

## Deploy with Docker
```bash
cp .env.example .env     # set POSTGRES_PASSWORD (and APP_PORT if 8080 is taken)
docker compose up -d --build
```
Open http://localhost:8080. Menus and photos live in the `pgdata` volume. Update with `git pull && docker compose up -d --build`.
Back up: `docker compose exec db pg_dump -U menu menubuilder > backup.sql`

## Run for development
(uncomment the `ports` line under `db` in docker-compose.yml, then `docker compose up -d db`)
```bash
docker compose up -d                              # Postgres
cd backend/MenuBuilder.Api && dotnet run          # API on :5080 (creates tables on start)
cd frontend && npm install && npm run dev         # UI on :5173 (proxies /api)
```
Production: `npm run build` in `frontend` writes into `backend/MenuBuilder.Api/wwwroot`; then `dotnet run` serves everything on :5080.

## Swapping the database
All persistence goes through `IMenuRepository` (6 methods). Menus are stored as one JSON document, images as blobs.
Implement the interface for another store (SQL Server, SQLite, Cosmos, files…) and change the one registration line in `Program.cs`.
