namespace MonitoringScreens.Blazor.Data;

public static class SeedCatalogData
{
    public static readonly IReadOnlyList<ExceptionCatalogItem> Exceptions =
    [
        new("WinSCP: Failed to Upload File", "system"),
        new("MS Graph: failed to create email draft", "system"),
        new("You must provide values for Folder and Pattern", "system"),
        new("7 Zip: Wrong Password", "system"),
        new("Could not execute code stage because exception thrown by code stage: cannot find Column", "internal"),
        new("Failed to Attach on Navigation Stage \"Attach\"", "internal"),
        new("Business rule mismatch: duplicate case", "business"),
        new("Invoice missing approval code", "business")
    ];

    public static readonly IReadOnlyList<string> Processes =
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

    public static readonly IReadOnlyList<string> Squads =
    [
        "Baymax",
        "WALL-E",
        "ATOM",
        "Awesom-O",
        "JARVIS",
        "Bender"
    ];

    public static DashboardCatalog BuildDefaultCatalog() => new(
        Exceptions,
        Processes,
        Squads,
        ChicagoFailoverDays: 3,
        RestonFailoverDays: 2);
}
