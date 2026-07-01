namespace MonitoringScreens.Blazor.Data.Entities;

public sealed class DashboardSettingEntity
{
    public int Id { get; set; }
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}
