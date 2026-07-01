using MonitoringScreens.Blazor.Models;

namespace MonitoringScreens.Blazor.Services;

public static class DashboardFormatters
{
    public static string BodyStateClass(string alertState) => alertState switch
    {
        "RED" => "dashboard-red",
        "AMBER" => "dashboard-amber",
        _ => "dashboard-green"
    };

    public static string DeltaText(int delta) => delta switch
    {
        > 0 => $"▲ {delta} vs yesterday",
        < 0 => $"▼ {Math.Abs(delta)} vs yesterday",
        _ => "No change vs yesterday"
    };

    public static string DeltaClass(int delta, bool positiveIsGood)
    {
        if (delta == 0)
        {
            return "neutral";
        }

        return (delta > 0) == positiveIsGood ? "positive" : "negative";
    }

    public static string RobotDeltaBadge(DashboardSnapshot snapshot)
    {
        var diff = snapshot.Model.Robots.Today.Running - snapshot.Model.Robots.Yesterday.Running;
        return diff >= 0 ? "Stable" : "Watch";
    }

    public static string RobotDeltaBadgeClass(DashboardSnapshot snapshot)
    {
        var diff = snapshot.Model.Robots.Today.Running - snapshot.Model.Robots.Yesterday.Running;
        return diff >= 0 ? "queue-action-stable" : "queue-action-watch";
    }

    public static string TicketStatusLabel(string status) => status switch
    {
        "breached" => "Breached",
        "at-risk" => "At risk",
        _ => "On track"
    };
}
