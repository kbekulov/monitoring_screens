namespace MonitoringScreens.Blazor.Data.Entities;

public sealed class ExceptionDefinitionEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
