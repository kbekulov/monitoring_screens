using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace MonitoringScreens.Blazor.Data;

public sealed class EfDashboardCatalogRepository(MonitoringDbContext db) : IDashboardCatalogRepository
{
    public DashboardCatalog LoadCatalog()
    {
        var exceptionCatalog = db.ExceptionDefinitions
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Select(x => new ExceptionCatalogItem(x.Name, x.Type))
            .ToList();

        var processPool = db.ProcessDefinitions
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Select(x => x.Name)
            .ToList();

        var squadPool = db.SquadDefinitions
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Select(x => x.Name)
            .ToList();

        var settings = db.DashboardSettings
            .AsNoTracking()
            .ToDictionary(x => x.Key, x => x.Value, StringComparer.OrdinalIgnoreCase);

        return new DashboardCatalog(
            exceptionCatalog.Count > 0 ? exceptionCatalog : SeedCatalogData.Exceptions,
            processPool.Count > 0 ? processPool : SeedCatalogData.Processes,
            squadPool.Count > 0 ? squadPool : SeedCatalogData.Squads,
            ReadIntSetting(settings, "Failover.Chicago.DaysFromNow", 3),
            ReadIntSetting(settings, "Failover.Reston.DaysFromNow", 2));
    }

    private static int ReadIntSetting(IReadOnlyDictionary<string, string> settings, string key, int fallback) =>
        settings.TryGetValue(key, out var rawValue) && int.TryParse(rawValue, CultureInfo.InvariantCulture, out var value)
            ? value
            : fallback;
}
