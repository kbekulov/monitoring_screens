namespace MonitoringScreens.Blazor.Data.Entities;

public sealed class SquadDefinitionEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
