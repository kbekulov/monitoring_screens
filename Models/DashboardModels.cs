namespace MonitoringScreens.Blazor.Models;

public sealed record DashboardOptions(int? Seed, bool ForceWarnings, bool ForceFreeze);

public sealed class DashboardSnapshot
{
    public required DashboardModel Model { get; init; }
    public required string AlertState { get; init; }
    public required string RenderStatus { get; init; }
    public required string ActionOwner { get; init; }
    public required MaintenanceOverview MaintenanceOverview { get; init; }
    public required IReadOnlyList<string> ReleaseApprovals { get; init; }
    public required IReadOnlyList<ProcessFocusItem> MaintenanceProcesses { get; init; }
    public required IReadOnlyList<ProcessFocusItem> PotentialProcesses { get; init; }
    public required IReadOnlyList<BannerAnnouncement> WarningAnnouncements { get; init; }
    public required bool ShowFreezeBanner { get; init; }
    public required FailoverInfo ChicagoFailover { get; init; }
    public required FailoverInfo RestonFailover { get; init; }
    public required AlertTotals AlertTotals { get; init; }
    public required IReadOnlyList<AlertGroup> AlertGroups { get; init; }
    public required IReadOnlyList<TicketLane> TicketLanes { get; init; }
    public required string AlertsNextAction { get; init; }
    public required string QueueActionReason { get; init; }
    public required string QueueActionLabel { get; init; }
    public required string ExceptionsActionReason { get; init; }
    public required string ExceptionsActionLabel { get; init; }
    public required SummaryTexts Summaries { get; init; }
}

public sealed class DashboardModel
{
    public required int Seed { get; init; }
    public required DateTimeOffset GeneratedAt { get; init; }
    public required IReadOnlyList<ExceptionStat> ExceptionStats { get; init; }
    public required RankingSet ExceptionRanks { get; init; }
    public required Series HourlyExceptions { get; init; }
    public required Series DailyExceptions { get; init; }
    public required RobotSnapshot Robots { get; init; }
    public required TopProcessSet TopProcesses { get; init; }
    public required IReadOnlyList<ProcessHealth> ProcessHealth { get; init; }
    public required IReadOnlyList<SquadComparison> SquadDumbbell { get; init; }
    public required MultiSeries QueueState { get; init; }
    public required OutcomeSeries SessionOutcome { get; init; }
    public required ScheduleActivity ScheduleActivity { get; init; }
    public required IReadOnlyList<string> Alerts { get; init; }
    public required IReadOnlyList<TicketItem> Tickets { get; init; }
    public required Funnel HandoffFunnel { get; init; }
    public required HeatmapData OutOfBoundsHeatmap { get; init; }
    public required RootCauseSplit RootCauseSplit { get; init; }
    public required QueueAging QueueAging { get; init; }
    public required BurstDetector BurstDetector { get; init; }
}

public sealed record ExceptionStat(string Name, string Type, string Owner, int TodayCount, int YesterdayCount, int WeekAvg);
public sealed record RankingSet(IReadOnlyList<string> Yesterday, IReadOnlyList<string> Today);
public sealed record Series(IReadOnlyList<string> Labels, IReadOnlyList<int> Values);
public sealed record RobotState(int Running, int Retired);
public sealed record RobotSnapshot(RobotState Today, RobotState Yesterday);
public sealed record ProcessBucket(string Name, int Count);
public sealed record VariabilityBucket(string Name, int Score);
public sealed record TopProcessSet(IReadOnlyList<ProcessBucket> ByExceptions, IReadOnlyList<VariabilityBucket> ByVariability, IReadOnlyList<string> AllProcesses, IReadOnlyList<ProcessHealth> ByBreaching);
public sealed record ProcessHealth(string Name, int Total, int Exceptions, double ExceptionRate, double SuccessRate, string Level, string RuntimeStatus, string AttentionType, bool InMaintenance);
public sealed record SquadComparison(string Squad, int LastMonth, int Today);
public sealed record MultiSeries(IReadOnlyList<string> Labels, IReadOnlyList<int> Pending, IReadOnlyList<int> Locked, IReadOnlyList<int> Complete, IReadOnlyList<int> Exception, IReadOnlyList<int> Deferred);
public sealed record OutcomeSeries(IReadOnlyList<string> Labels, IReadOnlyList<int> Running, IReadOnlyList<int> Completed, IReadOnlyList<int> Terminated, IReadOnlyList<int> Exceptioned);
public sealed record ScheduleActivity(IReadOnlyList<string> Labels, IReadOnlyList<int> Pending, IReadOnlyList<int> Running, IReadOnlyList<int> Completed, IReadOnlyList<int> Terminated, IReadOnlyList<int> PartExceptioned);
public sealed record TicketItem(string Key, int Days, string Title, string Owner, int LastUpdateHours, int SlaHours);
public sealed record Funnel(IReadOnlyList<string> Labels, IReadOnlyList<int> Values);
public sealed record HeatmapPoint(string Process, string Day, int Value);
public sealed record HeatmapData(IReadOnlyList<string> Processes, IReadOnlyList<string> Days, IReadOnlyList<HeatmapPoint> Values);
public sealed record RootCauseSplit(IReadOnlyList<string> Labels, IReadOnlyList<int> Environment, IReadOnlyList<int> Code, IReadOnlyList<int> BusinessInquiry);
public sealed record QueueAging(IReadOnlyList<string> Labels, IReadOnlyList<int> Values);
public sealed record BurstDetector(IReadOnlyList<string> Labels, IReadOnlyList<int> Values, IReadOnlyList<int> Baseline, IReadOnlyList<int> Upper);
public sealed record MaintenanceOverview(int InboxEmails, int Todo, int WorkedOn);
public sealed record ProcessFocusItem(string Process, int MaxValue, string Level, string Status, string AttentionType, bool InMaintenance);
public sealed record BannerAnnouncement(string Title);
public sealed record FailoverInfo(string Label, string ZoneLabel, DateTimeOffset TargetTime);
public sealed record AlertTotals(int Breached, int AtRisk, int OnTrack);
public sealed record AlertGroup(string Name, int Count);
public sealed record TicketLane(string Key, string Title, string Owner, int Days, int LastUpdateHours, string Status);
public sealed record SummaryTexts(string Slope, string Hourly, string Daily, string QueueState, string RobotCounts, string Dumbbell, string Heatmap, string RootCause, string SessionOutcome, string QueueAging, string Burst, string ScheduleActivity);
public sealed record SlopeRow(string Name, int TodayCount, int ComparisonCount, int Delta, string Direction, bool NewToday, bool Resolved, int? RankToday, int? RankComparison);
public sealed record SlopeStats(int Improved, int Worsened, int Unchanged, int NewToday, int Resolved, IReadOnlyList<SlopeRow> Rows);
