namespace MonitoringScreens.Blazor.Data;

public sealed class SeededDashboardCatalogRepository : IDashboardCatalogRepository
{
    public DashboardCatalog LoadCatalog() => SeedCatalogData.BuildDefaultCatalog();
}
