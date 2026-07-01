using System.Globalization;
using MonitoringScreens.Blazor.Data;
using MonitoringScreens.Blazor.Models;

namespace MonitoringScreens.Blazor.Services;

public sealed class DashboardService(IDashboardCatalogRepository catalogRepository)
{
    private static readonly DashboardThresholds Thresholds = new();

    public DashboardSnapshot BuildSnapshot(DateTimeOffset nowUtc, DashboardOptions options)
    {
        var vilniusNow = ConvertToZone(nowUtc, "Europe/Vilnius");
        var seed = options.Seed ?? int.Parse(vilniusNow.ToString("yyyyMMdd", CultureInfo.InvariantCulture), CultureInfo.InvariantCulture);
        var rng = new Mulberry32(seed);
        var catalog = catalogRepository.LoadCatalog();
        var model = BuildModel(vilniusNow, seed, rng, catalog);
        var slopeStats = GetSlopeStats(model, "yesterday");
        var summaries = BuildSummaries(model, slopeStats);
        var policy = EvaluateAlertPolicy(model);
        var breachList = DeriveBreachProcesses(model);
        var maintenanceProcesses = PickBalanced(breachList.Where(x => x.InMaintenance).ToList(), 7, x => x.Status.Equals("retired", StringComparison.OrdinalIgnoreCase));
        var potentialProcesses = PickBalanced(breachList.Where(x => !x.InMaintenance).ToList(), 7, x => x.AttentionType == "SESSIONS_FAILING");
        var restonFailover = new FailoverInfo("Reston failover", "America/New_York", MakeFailoverTarget(nowUtc, "America/New_York", catalog.RestonFailoverDays));
        var chicagoFailover = new FailoverInfo("Chicago failover", "America/Chicago", MakeFailoverTarget(nowUtc, "America/Chicago", catalog.ChicagoFailoverDays));
        var warnings = DeriveAnnouncements(options, policy.AlertState, nowUtc, restonFailover, chicagoFailover);
        var queueAction = DeriveQueueAction(model);
        var exceptionsAction = DeriveExceptionsAction(model);
        var tickets = BuildTicketLanes(model.Tickets);
        var alertTotals = new AlertTotals(
            tickets.Count(x => x.Status == "breached"),
            tickets.Count(x => x.Status == "at-risk"),
            tickets.Count(x => x.Status == "on-track"));
        var alertGroups = model.Alerts
            .Select(x => x.Split(" - ", 2).Last())
            .GroupBy(x => x)
            .Select(x => new AlertGroup(x.Key, x.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var maintenanceOverview = new MaintenanceOverview(
            InboxEmails: 130 + rng.NextInt(8, 28),
            Todo: 24 + rng.NextInt(8, 26),
            WorkedOn: 18 + rng.NextInt(4, 18));

        var releaseApprovals = new List<string>
        {
            $"{model.TopProcesses.ByExceptions[0].Name} release waiting on CAB sign-off",
            $"{model.TopProcesses.ByExceptions[1].Name} prod validation pending",
            $"{model.TopProcesses.ByExceptions[2].Name} release notes awaiting approval"
        };

        var renderStatus = policy.AlertState switch
        {
            "RED" => "Critical",
            "AMBER" => "Good",
            _ => "Healthy"
        };

        return new DashboardSnapshot
        {
            Model = model,
            AlertState = policy.AlertState,
            RenderStatus = renderStatus,
            ActionOwner = policy.ActionOwner,
            MaintenanceOverview = maintenanceOverview,
            ReleaseApprovals = releaseApprovals,
            MaintenanceProcesses = maintenanceProcesses,
            PotentialProcesses = potentialProcesses,
            WarningAnnouncements = warnings,
            ShowFreezeBanner = options.ForceFreeze,
            ChicagoFailover = chicagoFailover,
            RestonFailover = restonFailover,
            AlertTotals = alertTotals,
            AlertGroups = alertGroups,
            TicketLanes = tickets,
            AlertsNextAction = BuildNextAction(tickets),
            QueueActionReason = queueAction.Reason,
            QueueActionLabel = queueAction.Label,
            ExceptionsActionReason = exceptionsAction.Reason,
            ExceptionsActionLabel = exceptionsAction.Label,
            Summaries = summaries
        };
    }

    public SlopeStats GetSlopeStats(DashboardModel model, string mode)
    {
        var comparisonRanks = mode == "week"
            ? model.ExceptionStats
                .Where(x => x.WeekAvg > 0)
                .OrderByDescending(x => x.WeekAvg)
                .Select(x => x.Name)
                .ToList()
            : model.ExceptionRanks.Yesterday.ToList();

        var rows = model.ExceptionStats
            .Select(stat =>
            {
                var comparisonCount = mode == "week" ? stat.WeekAvg : stat.YesterdayCount;
                var delta = stat.TodayCount - comparisonCount;
                var newToday = comparisonCount == 0 && stat.TodayCount > 0;
                var resolved = stat.TodayCount == 0 && comparisonCount > 0;
                var direction = delta switch
                {
                    > 0 => "Worsened",
                    < 0 => "Improved",
                    _ => "Unchanged"
                };
                var rankToday = model.ExceptionRanks.Today.ToList().IndexOf(stat.Name);
                var rankComparison = comparisonRanks.IndexOf(stat.Name);

                return new SlopeRow(
                    stat.Name,
                    stat.TodayCount,
                    comparisonCount,
                    delta,
                    direction,
                    newToday,
                    resolved,
                    rankToday >= 0 ? rankToday + 1 : null,
                    rankComparison >= 0 ? rankComparison + 1 : null);
            })
            .OrderByDescending(x => Math.Abs(x.Delta))
            .ThenByDescending(x => x.TodayCount)
            .ToList();

        return new SlopeStats(
            Improved: rows.Count(x => x.Direction == "Improved"),
            Worsened: rows.Count(x => x.Direction == "Worsened"),
            Unchanged: rows.Count(x => x.Direction == "Unchanged"),
            NewToday: rows.Count(x => x.NewToday),
            Resolved: rows.Count(x => x.Resolved),
            Rows: rows);
    }

    public static DateTimeOffset ConvertToZone(DateTimeOffset timestamp, string zoneId)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        return TimeZoneInfo.ConvertTime(timestamp, tz);
    }

    private static DashboardModel BuildModel(DateTimeOffset nowLocal, int seed, Mulberry32 rng, DashboardCatalog catalog)
    {
        var exceptionStats = catalog.Exceptions.Select((entry, index) =>
        {
            var yesterdayCount = rng.NextInt(4, 26);
            var todayCount = Math.Max(0, yesterdayCount + (int)Math.Floor((rng.NextDouble() - 0.5) * 12));
            var weekAvg = Math.Max(1, rng.NextInt(5, 25));

            if (index == 6) todayCount = Math.Max(2, todayCount + 5);
            if (index == 7) todayCount = 0;

            return new ExceptionStat(entry.Name, entry.Type, "Controller", todayCount, yesterdayCount, weekAvg);
        }).ToList();

        var yesterdayRanked = exceptionStats
            .Where(x => x.YesterdayCount > 0)
            .OrderByDescending(x => x.YesterdayCount)
            .Select(x => x.Name)
            .ToList();

        var todayRanked = exceptionStats
            .Where(x => x.TodayCount > 0)
            .OrderByDescending(x => x.TodayCount)
            .Select(x => x.Name)
            .ToList();

        var hourly = MakeHourlyData(rng, nowLocal.Hour);
        var daily = MakeDailyData(rng, nowLocal.Day);

        var yesterdayRobots = new RobotState(rng.NextInt(60, 90), rng.NextInt(25, 45));
        var todayRobots = new RobotState(rng.NextInt(60, 90), rng.NextInt(10, 30));

        var invertSet = Shuffle(catalog.Squads, rng).Take(2).ToHashSet();
        var squadDumbbell = catalog.Squads.Select(squad =>
        {
            var lastMonth = rng.NextInt(40, 200);
            var today = Math.Max(5, (int)Math.Round(lastMonth * (0.75 + rng.NextDouble() * 0.7)));
            if (invertSet.Contains(squad))
            {
                today = Math.Max(5, (int)Math.Round(lastMonth * (0.35 + rng.NextDouble() * 0.35)));
            }

            return new SquadComparison(squad, lastMonth, today);
        }).ToList();

        var fiveMinuteLabels = Enumerable.Range(0, 12).Select(i => $"{i * 5}m").ToList();
        var queueState = new MultiSeries(
            fiveMinuteLabels,
            fiveMinuteLabels.Select(_ => rng.NextInt(25, 85)).ToList(),
            fiveMinuteLabels.Select(_ => rng.NextInt(8, 36)).ToList(),
            fiveMinuteLabels.Select(_ => rng.NextInt(35, 115)).ToList(),
            fiveMinuteLabels.Select(_ => rng.NextInt(4, 28)).ToList(),
            fiveMinuteLabels.Select(_ => rng.NextInt(2, 20)).ToList());

        var sessionOutcome = new OutcomeSeries(
            fiveMinuteLabels,
            fiveMinuteLabels.Select(_ => rng.NextInt(18, 48)).ToList(),
            fiveMinuteLabels.Select(_ => rng.NextInt(30, 80)).ToList(),
            fiveMinuteLabels.Select(_ => rng.NextInt(1, 11)).ToList(),
            fiveMinuteLabels.Select(_ => rng.NextInt(2, 16)).ToList());

        var scheduleActivity = new ScheduleActivity(
            ["EOD Reconciliation", "Customer KYC Batch", "Finance Upload", "Settlement Run", "Regulatory Extract"],
            Enumerable.Range(0, 5).Select(_ => rng.NextInt(0, 4)).ToList(),
            Enumerable.Range(0, 5).Select(_ => rng.NextInt(0, 3)).ToList(),
            Enumerable.Range(0, 5).Select(_ => rng.NextInt(4, 12)).ToList(),
            Enumerable.Range(0, 5).Select(_ => rng.NextInt(0, 2)).ToList(),
            Enumerable.Range(0, 5).Select(_ => rng.NextInt(0, 3)).ToList());

        var highPriority = catalog.Exceptions.Where(x => x.Type is "system" or "internal").Select(x => x.Name).ToArray();
        var alerts = Enumerable.Range(1, 10)
            .Select(i => $"Alert #{i} - {highPriority[rng.NextInt(0, highPriority.Length)]}")
            .ToList();

        var processPool = Shuffle(catalog.Processes, rng).ToList();
        var ticketProcesses = processPool.Take(5).ToArray();
        var tickets = new List<TicketItem>
        {
            new("RPA-6786", rng.NextInt(8, 43), $"{ticketProcesses[0]} failing on upload step", "DK", rng.NextInt(1, 30), 48),
            new("RPA-2983", rng.NextInt(8, 43), $"{ticketProcesses[1]} intermittent auth errors", "RM", rng.NextInt(1, 30), 48),
            new("RPA-3948", rng.NextInt(8, 43), $"{ticketProcesses[2]} parse drift", "AK", rng.NextInt(1, 30), 72),
            new("RPA-1022", rng.NextInt(8, 43), $"{ticketProcesses[3]} rate limit bursts", "TJ", rng.NextInt(1, 30), 48),
            new("RPA-5510", rng.NextInt(8, 43), $"{ticketProcesses[4]} deadlocks", "MN", rng.NextInt(1, 30), 72)
        }.OrderByDescending(x => x.Days).ToList();

        var detected = rng.NextInt(65, 85);
        var raised = detected - rng.NextInt(2, 7);
        var assigned = raised - rng.NextInt(1, 6);
        var inProgress = Math.Max(assigned - rng.NextInt(2, 8), 1);
        var resolved = Math.Max(inProgress - rng.NextInt(1, 6), 0);
        var funnel = new Funnel(["Detected", "Ticket Raised", "Assigned to Dev", "In Progress", "Resolved"], [detected, raised, assigned, inProgress, resolved]);

        var topProcessSet = BuildTopProcesses(processPool, rng);
        var heatmapProcesses = topProcessSet.AllProcesses.Take(15).ToList();
        var heatmapDays = Enumerable.Range(0, 14)
            .Select(i => nowLocal.AddDays(-(13 - i)).ToString("MM-dd", CultureInfo.InvariantCulture))
            .ToList();
        var heatmapValues = new List<HeatmapPoint>();

        foreach (var process in heatmapProcesses)
        {
            for (var i = 0; i < heatmapDays.Count; i++)
            {
                var wave = (i >= 10 ? 2 : 0) + (i % 7 == 0 ? 2 : 0);
                var spike = rng.NextDouble() < 0.1 ? 5 : 0;
                heatmapValues.Add(new HeatmapPoint(process, heatmapDays[i], Math.Max(0, (int)Math.Floor(rng.NextDouble() * 7 + wave + spike))));
            }
        }

        var peakByProcess = heatmapValues
            .GroupBy(x => x.Process)
            .ToDictionary(x => x.Key, x => x.Max(y => y.Value));

        var processHealth = peakByProcess.Keys.Select(name =>
        {
            var total = rng.NextInt(120, 360);
            var exceptionRate = 0.03 + rng.NextDouble() * 0.14;
            var exceptions = Math.Max(1, (int)Math.Round(total * exceptionRate));
            var level = exceptionRate > 0.10 ? "RED" : "GREEN";
            var runtimeStatus = rng.NextDouble() < 0.35 ? "retired" : "running";
            var attentionType = rng.NextDouble() < 0.5 ? "MANY_EXCEPTIONS" : "SESSIONS_FAILING";
            var inMaintenance = rng.NextDouble() < 0.55;
            return new ProcessHealth(name, total, exceptions, exceptions / (double)total, 1 - exceptions / (double)total, level, runtimeStatus, attentionType, inMaintenance);
        }).ToList();

        var byBreaching = processHealth
            .Where(x => x.ExceptionRate > 0.10)
            .OrderByDescending(x => x.ExceptionRate)
            .Take(12)
            .ToList();

        var rootCause = new RootCauseSplit(
            ["Day", "Week", "Month"],
            [rng.NextInt(2, 10), rng.NextInt(4, 14), rng.NextInt(8, 20)],
            [rng.NextInt(4, 14), rng.NextInt(8, 20), rng.NextInt(12, 28)],
            [rng.NextInt(1, 7), rng.NextInt(2, 10), rng.NextInt(3, 13)]);

        var queueAging = new QueueAging(
            ["0-15m", "15-30m", "30-60m", "60m+"],
            [rng.NextInt(4, 12), rng.NextInt(3, 10), rng.NextInt(2, 8), rng.NextInt(1, 6)]);

        var burstLabels = Enumerable.Range(0, 20).Select(i => $"{i * 3}m").ToList();
        var burstValues = ZigZagSeries(rng, burstLabels.Count, 8, 20, 2, 8, 0.18, 6, 16);
        var baseline = burstValues.Select(v => Math.Max(0, (int)Math.Round(v * 0.8))).ToList();
        var upper = burstValues.Select(v => (int)Math.Round(v * 1.25 + 4)).ToList();

        return new DashboardModel
        {
            Seed = seed,
            GeneratedAt = nowLocal,
            ExceptionStats = exceptionStats,
            ExceptionRanks = new RankingSet(yesterdayRanked, todayRanked),
            HourlyExceptions = hourly,
            DailyExceptions = daily,
            Robots = new RobotSnapshot(todayRobots, yesterdayRobots),
            TopProcesses = topProcessSet with { ByBreaching = byBreaching },
            ProcessHealth = processHealth,
            SquadDumbbell = squadDumbbell,
            QueueState = queueState,
            SessionOutcome = sessionOutcome,
            ScheduleActivity = scheduleActivity,
            Alerts = alerts,
            Tickets = tickets,
            HandoffFunnel = funnel,
            OutOfBoundsHeatmap = new HeatmapData(heatmapProcesses, heatmapDays, heatmapValues),
            RootCauseSplit = rootCause,
            QueueAging = queueAging,
            BurstDetector = new BurstDetector(burstLabels, burstValues, baseline, upper)
        };
    }

    private static TopProcessSet BuildTopProcesses(IReadOnlyList<string> processPool, Mulberry32 rng)
    {
        var byExceptions = processPool
            .Select(name => new ProcessBucket(name, rng.NextInt(50, 270)))
            .OrderByDescending(x => x.Count)
            .Take(8)
            .ToList();

        var byVariability = processPool
            .Select(name =>
            {
                var mean = 20 + rng.NextDouble() * 100;
                var standardDeviation = 5 + rng.NextDouble() * 60;
                return new VariabilityBucket(name, (int)Math.Round((standardDeviation / mean) * 100));
            })
            .OrderByDescending(x => x.Score)
            .Take(7)
            .ToList();

        return new TopProcessSet(byExceptions, byVariability, processPool.ToList(), []);
    }

    private static Series MakeHourlyData(Mulberry32 rng, int currentHour)
    {
        var labels = Enumerable.Range(0, currentHour + 1)
            .Select(h => $"{h:00}:00")
            .ToList();
        return new Series(labels, ZigZagSeries(rng, labels.Count, 10, 30, 6, 22, 0.28, 18, 55));
    }

    private static Series MakeDailyData(Mulberry32 rng, int dayOfMonth)
    {
        var labels = Enumerable.Range(1, dayOfMonth)
            .Select(d => d.ToString("00", CultureInfo.InvariantCulture))
            .ToList();
        return new Series(labels, ZigZagSeries(rng, labels.Count, 140, 260, 35, 95, 0.22, 90, 220));
    }

    private static List<int> ZigZagSeries(Mulberry32 rng, int length, int startMin, int startMax, int stepMin, int stepMax, double spikeChance, int spikeMin, int spikeMax)
    {
        var values = new List<int>(length);
        var current = rng.NextInt(startMin, startMax);
        var direction = 1;

        for (var i = 0; i < length; i++)
        {
            var step = rng.NextInt(stepMin, stepMax);
            current += direction * step;
            if (rng.NextDouble() < spikeChance)
            {
                current += direction * rng.NextInt(spikeMin, spikeMax);
            }

            current = Math.Max(0, current);
            values.Add(current);
            direction *= -1;
        }

        return values;
    }

    private static List<T> Shuffle<T>(IReadOnlyList<T> source, Mulberry32 rng)
    {
        var list = source.ToList();
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = rng.NextInt(0, i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }

        return list;
    }

    private static List<ProcessFocusItem> DeriveBreachProcesses(DashboardModel model)
    {
        var fromHealth = model.ProcessHealth
            .Select(x =>
            {
                var level = x.ExceptionRate > Thresholds.ExceptionRed
                    ? "RED"
                    : x.ExceptionRate > Thresholds.ExceptionAmber
                        ? "AMBER"
                        : "GREEN";
                return new ProcessFocusItem(x.Name, (int)Math.Round(x.ExceptionRate * 100), level, x.RuntimeStatus, x.AttentionType, x.InMaintenance);
            })
            .OrderByDescending(x => x.MaxValue)
            .ToList();

        var existing = fromHealth.Select(x => x.Process).ToHashSet(StringComparer.Ordinal);
        var extras = model.TopProcesses.AllProcesses
            .Where(name => !existing.Contains(name))
            .Select(name =>
            {
                var hash = name.Sum(ch => ch) % 9973;
                var maxValue = 6 + hash % 12;
                var level = maxValue >= 11 ? "RED" : maxValue >= 8 ? "AMBER" : "GREEN";
                return new ProcessFocusItem(
                    name,
                    maxValue,
                    level,
                    hash % 3 == 0 ? "retired" : "running",
                    hash % 2 == 0 ? "MANY_EXCEPTIONS" : "SESSIONS_FAILING",
                    hash % 2 == 0);
            });

        return fromHealth.Concat(extras).OrderByDescending(x => x.MaxValue).ToList();
    }

    private static List<ProcessFocusItem> PickBalanced(IReadOnlyList<ProcessFocusItem> list, int count, Func<ProcessFocusItem, bool> groupPredicate)
    {
        var groupA = list.Where(groupPredicate).ToList();
        var groupB = list.Where(x => !groupPredicate(x)).ToList();
        var targetA = count / 2;
        var targetB = count - targetA;
        var selected = new List<ProcessFocusItem>();

        selected.AddRange(groupA.Take(targetA));
        selected.AddRange(groupB.Take(targetB));

        if (selected.Count < count)
        {
            var seen = selected.Select(x => x.Process).ToHashSet(StringComparer.Ordinal);
            selected.AddRange(list.Where(x => !seen.Contains(x.Process)).Take(count - selected.Count));
        }

        return selected;
    }

    private static (string Label, string Reason) DeriveQueueAction(DashboardModel model)
    {
        var pending = model.QueueState.Pending;
        var exceptions = model.QueueState.Exception;
        var pNow = pending[^1];
        var pPrev = pending.Count > 1 ? pending[^2] : pNow;
        var pPrev2 = pending.Count > 2 ? pending[^3] : pPrev;
        var eNow = exceptions[^1];
        var ePrev = exceptions.Count > 1 ? exceptions[^2] : eNow;
        var ePrev2 = exceptions.Count > 2 ? exceptions[^3] : ePrev;

        var pendingRising = pNow > pPrev && pPrev > pPrev2;
        var exceptionRising = eNow > ePrev && ePrev > ePrev2;

        if (eNow >= 12 || pNow >= 130 || (pendingRising && eNow >= 9) || (exceptionRising && pNow >= 100))
        {
            return ("Action Required", $"Immediate action: pending {pNow}, exceptions {eNow} (risk threshold breached).");
        }

        if (eNow >= 8 || pNow >= 100 || pendingRising || exceptionRising)
        {
            return ("Watch Closely", $"Watch list: pending {pNow}, exceptions {eNow} (rising but below hard threshold).");
        }

        return ("Stable", $"No immediate action: pending {pNow}, exceptions {eNow} are within normal band.");
    }

    private static (string Label, string Reason) DeriveExceptionsAction(DashboardModel model)
    {
        var hourly = model.HourlyExceptions.Values;
        var daily = model.DailyExceptions.Values;

        if (hourly.Count == 0 || daily.Count == 0)
        {
            return ("Stable", "Insufficient data to evaluate action.");
        }

        static double Average(IEnumerable<int> values) => values.Any() ? values.Average() : 0;

        var hNow = hourly[^1];
        var hPrev = hourly.Count > 1 ? hourly[^2] : hNow;
        var hPrev2 = hourly.Count > 2 ? hourly[^3] : hPrev;
        var hBase = Math.Max(1, (int)Math.Round(Average(hourly.Take(Math.Max(1, hourly.Count - 1)))));
        var dNow = daily[^1];
        var dPrev = daily.Count > 1 ? daily[^2] : dNow;
        var dPrev2 = daily.Count > 2 ? daily[^3] : dPrev;
        var dBase = Math.Max(1, (int)Math.Round(Average(daily.Take(Math.Max(1, daily.Count - 1)))));

        var hRise3 = hNow > hPrev && hPrev > hPrev2;
        var dRise2 = dNow > dPrev && dPrev > dPrev2;
        var hSpike = hNow >= Math.Max(45, (int)Math.Round(hBase * 1.55));
        var hAbove = hNow >= (int)Math.Round(hBase * 1.25);
        var dAbove = dNow >= (int)Math.Round(dBase * 1.15);
        var vsPrev = hNow - hPrev;
        var vsBase = hNow - hBase;

        if (hSpike || (hRise3 && dRise2) || (hAbove && dAbove && hNow >= 32))
        {
            return ("Action Required", $"Immediate action: hour {hNow} ({FormatSigned(vsPrev)} vs prev, {FormatSigned(vsBase)} vs baseline), sustained rise detected.");
        }

        if (hAbove || dRise2 || dAbove || (hNow - hPrev >= 10))
        {
            return ("Watch Closely", $"Watch list: hour {hNow} ({FormatSigned(vsPrev)} vs prev, {FormatSigned(vsBase)} vs baseline), upward pressure building.");
        }

        return ("Stable", $"No immediate action: hour {hNow} is within normal band (baseline {hBase}).");
    }

    private static (string AlertState, string ActionOwner) EvaluateAlertPolicy(DashboardModel model)
    {
        var funnelDrop = model.HandoffFunnel.Values[0] - model.HandoffFunnel.Values[2];
        var processRed = model.ProcessHealth.Count(x => x.ExceptionRate > Thresholds.ExceptionRed);
        var burstOverBandCount = model.BurstDetector.Values.Select((value, index) => value > model.BurstDetector.Upper[index] ? 1 : 0).Sum();
        var aging60 = model.QueueAging.Values[3];
        var env60 = model.RootCauseSplit.Environment[2];
        var code60 = model.RootCauseSplit.Code[2];
        var infraDominant = env60 > code60;

        var redCount = 0;
        var amberCount = 0;

        void AddSignal(string level)
        {
            if (level == "RED") redCount++;
            if (level == "AMBER") amberCount++;
        }

        if (funnelDrop >= Thresholds.FunnelRed) AddSignal("RED");
        else if (funnelDrop >= Thresholds.FunnelAmber) AddSignal("AMBER");

        if (processRed > 0) AddSignal("RED");

        if (aging60 >= Thresholds.AgingRed) AddSignal("RED");
        else if (aging60 >= Thresholds.AgingAmber) AddSignal("AMBER");

        if (burstOverBandCount >= Thresholds.BurstRed) AddSignal("RED");
        else if (burstOverBandCount >= Thresholds.BurstAmber) AddSignal("AMBER");

        if (infraDominant && env60 >= 12) AddSignal(env60 >= 18 ? "RED" : "AMBER");

        var alertState = redCount >= 2 ? "RED" : redCount == 1 || amberCount > 0 ? "AMBER" : "GREEN";
        var actionOwner = alertState switch
        {
            "RED" when infraDominant => "Developers + Infrastructure (PO oversight)",
            "RED" => "Developers immediate (PO oversight)",
            "AMBER" when infraDominant => "Controllers + Infrastructure",
            "AMBER" => "Controllers take action",
            _ => "Controllers monitor"
        };

        return (alertState, actionOwner);
    }

    private static List<BannerAnnouncement> DeriveAnnouncements(DashboardOptions options, string alertState, DateTimeOffset nowUtc, FailoverInfo reston, FailoverInfo chicago)
    {
        var announcements = new List<BannerAnnouncement>();

        if (!options.ForceWarnings)
        {
            return announcements;
        }

        announcements.Add(new BannerAnnouncement("All MS Graph APIs are down."));

        if (alertState == "RED")
        {
            announcements.Add(new BannerAnnouncement("Blue Prism is down. Developers should respond immediately."));
        }

        var minutesToFailover = new[]
        {
            (int)Math.Floor((reston.TargetTime - nowUtc).TotalMinutes),
            (int)Math.Floor((chicago.TargetTime - nowUtc).TotalMinutes)
        }.Where(x => x >= 0).ToList();

        if (minutesToFailover.Count > 0)
        {
            var minRemaining = minutesToFailover.Min();
            if (minRemaining <= 60)
            {
                announcements.Add(new BannerAnnouncement($"Failover approaching in {minRemaining} minutes."));
            }
        }

        return announcements;
    }

    private static DateTimeOffset MakeFailoverTarget(DateTimeOffset nowUtc, string zoneId, int plusDays)
    {
        var local = ConvertToZone(nowUtc, zoneId).AddDays(plusDays);
        var truncated = new DateTime(local.Year, local.Month, local.Day, local.Hour, 0, 0, DateTimeKind.Unspecified).AddHours(1);
        var timezone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        var offset = timezone.GetUtcOffset(truncated);
        return new DateTimeOffset(truncated, offset);
    }

    private static List<TicketLane> BuildTicketLanes(IReadOnlyList<TicketItem> tickets)
    {
        return tickets.Select(ticket =>
        {
            var elapsedHours = ticket.Days * 24;
            var status = elapsedHours >= ticket.SlaHours
                ? "breached"
                : elapsedHours >= (int)Math.Round(ticket.SlaHours * 0.75)
                    ? "at-risk"
                    : "on-track";
            return new TicketLane(ticket.Key, ticket.Title, ticket.Owner, ticket.Days, ticket.LastUpdateHours, status);
        }).ToList();
    }

    private static string BuildNextAction(IReadOnlyList<TicketLane> tickets)
    {
        var top = tickets.FirstOrDefault(x => x.Status == "breached")
                  ?? tickets.FirstOrDefault(x => x.Status == "at-risk")
                  ?? tickets.First();
        var label = top.Status switch
        {
            "breached" => "Breached",
            "at-risk" => "At risk",
            _ => "On track"
        };
        return $"Next action now: {top.Key} ({label}), owner {top.Owner}, unresolved {top.Days}d.";
    }

    private static SummaryTexts BuildSummaries(DashboardModel model, SlopeStats slopeStats)
    {
        var bestSquad = model.SquadDumbbell.MaxBy(x => x.Today - x.LastMonth)!;
        var maxHourly = model.HourlyExceptions.Values.Max();
        var minHourly = model.HourlyExceptions.Values.Min();
        var maxDaily = model.DailyExceptions.Values.Max();
        var latestDaily = model.DailyExceptions.Values[^1];
        var lastPending = model.QueueState.Pending[^1];
        var lastExceptionQueue = model.QueueState.Exception[^1];
        var lastSessionRunning = model.SessionOutcome.Running[^1];
        var lastSessionExceptioned = model.SessionOutcome.Exceptioned[^1];
        var onlinePct = (int)Math.Round(model.Robots.Today.Running / (double)(model.Robots.Today.Running + model.Robots.Today.Retired) * 100);
        var hotCells = model.OutOfBoundsHeatmap.Values.Count(x => x.Value >= 8);
        var dominantRoot = new Dictionary<string, int>
        {
            ["Environment"] = model.RootCauseSplit.Environment[2],
            ["Code"] = model.RootCauseSplit.Code[2],
            ["Business Inquiry"] = model.RootCauseSplit.BusinessInquiry[2]
        }.MaxBy(x => x.Value);
        var agingHigh = model.QueueAging.Values[3];
        var latestBurst = model.BurstDetector.Values[^1];
        var latestBand = model.BurstDetector.Upper[^1];
        var problematicSchedules = model.ScheduleActivity.Terminated.Select((x, index) => x > 0 || model.ScheduleActivity.PartExceptioned[index] > 0 ? 1 : 0).Sum();
        var slopeText = slopeStats.Worsened > slopeStats.Improved
            ? "More worsened than improved. Controller action required."
            : slopeStats.Worsened == 0
                ? "No worsening in top exceptions."
                : "Mixed movement across top exceptions.";

        return new SummaryTexts(
            $"{slopeText} {slopeStats.Improved} improved, {slopeStats.Worsened} worsened.",
            $"Hourly range is {minHourly} to {maxHourly} exceptions.",
            $"Latest daily count is {latestDaily}; monthly peak is {maxDaily}.",
            $"Latest queue states: pending {lastPending}, exception {lastExceptionQueue}.",
            $"Today online availability is {onlinePct}%.",
            $"{bestSquad.Squad} shows the largest increase vs last month.",
            $"{hotCells} process-day cells show elevated exception concentration.",
            $"{dominantRoot.Key} is dominant in the month view.",
            $"Latest sessions: running {lastSessionRunning}, exceptioned {lastSessionExceptioned}.",
            $"{agingHigh} queue items are in the 60m+ age bucket.",
            $"Latest burst {latestBurst} vs upper band {latestBand}.",
            $"{problematicSchedules} schedules have terminated/part-exceptioned outcomes.");
    }

    private static string FormatSigned(int value) => value >= 0 ? $"+{value}" : value.ToString(CultureInfo.InvariantCulture);

    private sealed class DashboardThresholds
    {
        public double ExceptionAmber { get; } = 0.08;
        public double ExceptionRed { get; } = 0.10;
        public int FunnelAmber { get; } = 6;
        public int FunnelRed { get; } = 12;
        public int AgingAmber { get; } = 4;
        public int AgingRed { get; } = 7;
        public int BurstAmber { get; } = 1;
        public int BurstRed { get; } = 3;
    }

    private sealed class Mulberry32(int seed)
    {
        private uint _state = unchecked((uint)seed);

        public double NextDouble()
        {
            _state += 0x6D2B79F5u;
            uint x = _state;
            x = unchecked((uint)((x ^ (x >> 15)) * (1u | x)));
            x ^= x + unchecked((uint)((x ^ (x >> 7)) * (61u | x)));
            x ^= x >> 14;
            return x / 4294967296d;
        }

        public int NextInt(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive)
            {
                return minInclusive;
            }

            return minInclusive + (int)Math.Floor(NextDouble() * (maxExclusive - minInclusive));
        }
    }
}
