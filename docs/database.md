# Database Architecture

The dashboard uses a provider-neutral catalog repository:

- `IDashboardCatalogRepository` is consumed by `DashboardService`.
- `SeededDashboardCatalogRepository` keeps the app runnable without any local database.
- `EfDashboardCatalogRepository` reads catalog data from PostgreSQL when a connection string is configured.

SQLite was intentionally removed because its EF Core provider currently pulls the vulnerable `SQLitePCLRaw.lib.e_sqlite3` native package. PostgreSQL via `Npgsql.EntityFrameworkCore.PostgreSQL` is the supported live-database path.

## Run With Local PostgreSQL

Start Postgres:

```bash
docker compose up -d
```

Create `appsettings.Development.json` from `appsettings.Development.example.json`.

Run the solution or project. On startup, the app creates the catalog tables and seeds:

- processes
- exception definitions
- squads
- dashboard settings

If no `MonitoringDatabase` connection string is configured, the app uses seeded in-memory catalog data so Visual Studio/F5 still works without a database server.
