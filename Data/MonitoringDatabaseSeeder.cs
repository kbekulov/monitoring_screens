using Microsoft.EntityFrameworkCore;
using MonitoringScreens.Blazor.Data.Entities;

namespace MonitoringScreens.Blazor.Data;

public static class MonitoringDatabaseSeeder
{
    private static readonly (string Name, string Type)[] ExceptionDefinitions =
    [
        ("WinSCP: Failed to Upload File", "system"),
        ("MS Graph: failed to create email draft", "system"),
        ("You must provide values for Folder and Pattern", "system"),
        ("7 Zip: Wrong Password", "system"),
        ("Could not execute code stage because exception thrown by code stage: cannot find Column", "internal"),
        ("Failed to Attach on Navigation Stage \"Attach\"", "internal"),
        ("Business rule mismatch: duplicate case", "business"),
        ("Invoice missing approval code", "business")
    ];

    private static readonly string[] ProcessDefinitions =
    [
        "Care Digital Refunds",
        "GFC Case Investigation",
        "NPC FLA Investigation",
        "IAM IBIS Upload",
        "CFO JE Upload",
        "RMO Settlement - Keying Batches",
        "Daily AUSTRAC Extract",
        "ALM Agent Setup Credit Trac",
        "Supply Chain - APA",
        "DRT Comment in CTM",
        "GSI - Hourly Report",
        "KYC PEP LVL 2",
        "Sanctions Screening Refresh",
        "Customer Onboarding Validation",
        "Loan Servicing Exception Handler"
    ];

    private static readonly string[] SquadDefinitions =
    [
        "Baymax",
        "WALL-E",
        "ATOM",
        "Awesom-O",
        "JARVIS",
        "Bender"
    ];

    public static async Task InitializeAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MonitoringDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (!await db.ExceptionDefinitions.AnyAsync())
        {
            db.ExceptionDefinitions.AddRange(ExceptionDefinitions.Select((item, index) => new ExceptionDefinitionEntity
            {
                Name = item.Name,
                Type = item.Type,
                SortOrder = index + 1
            }));
        }

        if (!await db.ProcessDefinitions.AnyAsync())
        {
            db.ProcessDefinitions.AddRange(ProcessDefinitions.Select((name, index) => new ProcessDefinitionEntity
            {
                Name = name,
                SortOrder = index + 1
            }));
        }

        if (!await db.SquadDefinitions.AnyAsync())
        {
            db.SquadDefinitions.AddRange(SquadDefinitions.Select((name, index) => new SquadDefinitionEntity
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
