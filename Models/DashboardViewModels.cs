namespace MonitoringScreens.Blazor.Models;

public sealed record ClockDisplay(string TimeText, bool IsDay);

public sealed record CountdownDisplay(int Days, int Hours, int Minutes);

public enum FocusPanelKind
{
    Maintenance,
    PotentialAttention
}
