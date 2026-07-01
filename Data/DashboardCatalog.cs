namespace MonitoringScreens.Blazor.Data;

public sealed record ExceptionCatalogItem(string Name, string Type);

public sealed record DashboardCatalog(
    IReadOnlyList<ExceptionCatalogItem> Exceptions,
    IReadOnlyList<string> Processes,
    IReadOnlyList<string> Squads,
    int ChicagoFailoverDays,
    int RestonFailoverDays);
