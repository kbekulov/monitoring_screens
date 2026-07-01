using Microsoft.EntityFrameworkCore;
using MonitoringScreens.Blazor.Data.Entities;

namespace MonitoringScreens.Blazor.Data;

public static class MonitoringDatabaseSeeder
{
    public static async Task InitializeAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MonitoringDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (!await db.ExceptionDefinitions.AnyAsync())
        {
            db.ExceptionDefinitions.AddRange(SeedCatalogData.Exceptions.Select((item, index) => new ExceptionDefinitionEntity
            {
                Name = item.Name,
                Type = item.Type,
                SortOrder = index + 1
            }));
        }

        if (!await db.ProcessDefinitions.AnyAsync())
        {
            db.ProcessDefinitions.AddRange(SeedCatalogData.Processes.Select((name, index) => new ProcessDefinitionEntity
            {
                Name = name,
                SortOrder = index + 1
            }));
        }

        if (!await db.SquadDefinitions.AnyAsync())
        {
            db.SquadDefinitions.AddRange(SeedCatalogData.Squads.Select((name, index) => new SquadDefinitionEntity
            {
                Name = name,
                SortOrder = index + 1
            }));
        }

        if (!await db.DashboardSettings.AnyAsync())
        {
            db.DashboardSettings.AddRange(
                new DashboardSettingEntity { Key = "Failover.Chicago.DaysFromNow", Value = "3" },
                new DashboardSettingEntity { Key = "Failover.Reston.DaysFromNow", Value = "2" },
                new DashboardSettingEntity { Key = "Warnings.DefaultEnabled", Value = "true" });
        }

        await db.SaveChangesAsync();
    }
}
