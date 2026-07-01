using System.Globalization;
using MonitoringScreens.Blazor.Models;

namespace MonitoringScreens.Blazor.Services;

public static class PlotlyChartFactory
{
    public static object Config { get; } = new { responsive = true, displayModeBar = false };

    public static IReadOnlyList<object> BuildSlopeChartData(SlopeStats slopeStats, string mode)
    {
        var rows = TopSlopeRows(slopeStats).AsEnumerable().Reverse().ToList();
        var data = new List<object>();

        foreach (var row in rows)
        {
            data.Add(new
            {
                type = "scatter",
                mode = "lines",
                x = new[] { row.ComparisonCount, row.TodayCount },
                y = new[] { ShortExceptionName(row.Name), ShortExceptionName(row.Name) },
                line = new { color = row.Delta > 0 ? "rgba(239,68,68,0.35)" : "rgba(51,65,85,0.28)", width = 3 },
                hoverinfo = "skip",
                showlegend = false
            });
        }

        data.Add(new
        {
            type = "scatter",
            mode = "markers",
            x = rows.Select(x => x.ComparisonCount).ToArray(),
            y = rows.Select(x => ShortExceptionName(x.Name)).ToArray(),
            marker = new { color = "#94a3b8", size = 9 },
            name = mode == "week" ? "7d avg" : "Yesterday",
            customdata = rows.Select(x => new object[] { x.Name, x.ComparisonCount }).ToArray(),
            hovertemplate = "%{customdata[0]}<br>Compare: %{customdata[1]}<extra></extra>"
        });

        data.Add(new
        {
            type = "scatter",
            mode = "markers+text",
            x = rows.Select(x => x.TodayCount).ToArray(),
            y = rows.Select(x => ShortExceptionName(x.Name)).ToArray(),
            marker = new
            {
                color = rows.Select(x => x.Delta > 0 ? "#ef4444" : x.Delta < 0 ? "#334155" : "#64748b").ToArray(),
                size = 12,
                line = new { color = "#ffffff", width = 1 }
            },
            text = rows.Select(x => x.Delta > 0 ? $"+{x.Delta}" : x.Delta.ToString(CultureInfo.InvariantCulture)).ToArray(),
            textposition = "middle right",
            textfont = new { color = "#334155", size = 11 },
            cliponaxis = false,
            name = "Today",
            customdata = rows.Select(x => new object[] { x.Name, x.TodayCount, x.Delta }).ToArray(),
            hovertemplate = "%{customdata[0]}<br>Today: %{customdata[1]}<br>Delta: %{customdata[2]}<extra></extra>"
        });

        return data;
    }

    public static object BuildSlopeLayout(SlopeStats slopeStats)
    {
        var topRows = TopSlopeRows(slopeStats);
        var maxCount = topRows.Count == 0 ? 10 : topRows.Max(x => Math.Max(x.TodayCount, x.ComparisonCount));

        return TransparentLayout(new
        {
            margin = new { l = 190, r = 78, t = 8, b = 44 },
            xaxis = new
            {
                title = "Daily exception count",
                range = new[] { -4, maxCount + 4 },
                gridcolor = "rgba(15,23,42,0.06)",
                zeroline = false
            },
            yaxis = new { automargin = true },
            legend = new { orientation = "h", y = 1.12 }
        });
    }

    public static IReadOnlyList<object> BuildExceptionsChartData(DashboardSnapshot snapshot, string mode)
    {
        var series = mode == "hourly" ? snapshot.Model.HourlyExceptions : snapshot.Model.DailyExceptions;
        return
        [
            new
            {
                type = "scatter",
                mode = "lines+markers",
                x = series.Labels.ToArray(),
                y = series.Values.ToArray(),
                line = new { color = "#1d4ed8", width = 3 },
                marker = new { color = "#0f172a", size = 7 },
                fill = "tozeroy",
                fillcolor = "rgba(59,130,246,0.12)"
            }
        ];
    }

    public static object BuildExceptionsLayout(string mode) => TransparentLayout(new
    {
        margin = new { l = 40, r = 20, t = 10, b = 40 },
        xaxis = new { automargin = true, tickangle = mode == "hourly" ? 0 : -35 },
        yaxis = new { gridcolor = "rgba(15,23,42,0.06)" },
        showlegend = false
    });

    public static IReadOnlyList<object> BuildBurstChartData(DashboardSnapshot snapshot)
    {
        var model = snapshot.Model.BurstDetector;
        return
        [
            new
            {
                type = "scatter",
                mode = "lines",
                x = model.Labels.ToArray(),
                y = model.Baseline.ToArray(),
                line = new { color = "#94a3b8", dash = "dot", width = 2 },
                name = "Baseline"
            },
            new
            {
                type = "scatter",
                mode = "lines",
                x = model.Labels.ToArray(),
                y = model.Upper.ToArray(),
                line = new { color = "#ef4444", dash = "dash", width = 2 },
                name = "Upper band"
            },
            new
            {
                type = "scatter",
                mode = "lines+markers",
                x = model.Labels.ToArray(),
                y = model.Values.ToArray(),
                line = new { color = "#0f172a", width = 3 },
                marker = new { color = "#f97316", size = 7 },
                fill = "tozeroy",
                fillcolor = "rgba(249,115,22,0.12)",
                name = "Burst"
            }
        ];
    }

    public static object BuildBurstLayout() => TransparentLayout(new
    {
        margin = new { l = 40, r = 20, t = 10, b = 40 },
        yaxis = new { gridcolor = "rgba(15,23,42,0.06)" },
        legend = new { orientation = "h", y = 1.12 }
    });

    public static IReadOnlyList<object> BuildDumbbellChartData(DashboardSnapshot snapshot)
    {
        var rows = snapshot.Model.SquadDumbbell.OrderByDescending(x => Math.Max(x.LastMonth, x.Today)).ToList();
        var data = new List<object>();

        foreach (var row in rows)
        {
            data.Add(new
            {
                type = "scatter",
                mode = "lines",
                x = new[] { row.Squad, row.Squad },
                y = new[] { row.LastMonth, row.Today },
                line = new { color = "rgba(15,23,42,0.25)", width = 3 },
                hoverinfo = "skip",
                showlegend = false
            });
        }

        data.Add(new
        {
            type = "scatter",
            mode = "markers",
            x = rows.Select(x => x.Squad).ToArray(),
            y = rows.Select(x => x.LastMonth).ToArray(),
            marker = new { color = "#111111", size = 11 },
            name = "Last month"
        });

        data.Add(new
        {
            type = "scatter",
            mode = "markers",
            x = rows.Select(x => x.Squad).ToArray(),
            y = rows.Select(x => x.Today).ToArray(),
            marker = new { color = "#ffffff", line = new { color = "#111111", width = 2 }, size = 11 },
            name = "Today"
        });

        return data;
    }

    public static object BuildDumbbellLayout() => TransparentLayout(new
    {
        margin = new { l = 45, r = 20, t = 10, b = 80 },
        xaxis = new { automargin = true, tickangle = -28 },
        yaxis = new { gridcolor = "rgba(15,23,42,0.06)", rangemode = "tozero" },
        legend = new { orientation = "h", y = 1.12 }
    });

    public static IReadOnlyList<object> BuildHeatmapData(DashboardSnapshot snapshot)
    {
        var processes = snapshot.Model.OutOfBoundsHeatmap.Processes.Take(6).ToArray();
        var days = Enumerable.Range(1, 14).Select(day => $"Day {day}").ToArray();
        var z = processes
            .Select((_, processIndex) => days
                .Select((_, dayIndex) =>
                {
                    var wave = (processIndex * 2 + dayIndex * 3) % 9;
                    var hotSpot = (processIndex + dayIndex) % 11 == 0 ? 7 : 0;
                    return Math.Min(16, wave + hotSpot);
                })
                .ToArray())
            .ToArray();

        return
        [
            new
            {
                type = "heatmap",
                x = days,
                y = processes,
                z,
                zmin = 0,
                zmax = 16,
                colorscale = new object[]
                {
                    new object[] { 0.0, "#f8fafc" },
                    new object[] { 0.25, "#dbeafe" },
                    new object[] { 0.50, "#fef3c7" },
                    new object[] { 0.75, "#fb923c" },
                    new object[] { 1.0, "#b91c1c" }
                },
                showscale = true,
                colorbar = new { title = "Hits", thickness = 10 }
            }
        ];
    }

    public static object BuildHeatmapLayout() => TransparentLayout(new
    {
        margin = new { l = 150, r = 20, t = 10, b = 40 },
        xaxis = new { type = "category", tickangle = -35, automargin = true },
        yaxis = new { automargin = true }
    });

    public static IReadOnlyList<object> BuildQueueStateData(DashboardSnapshot snapshot)
    {
        var queue = snapshot.Model.QueueState;
        return
        [
            new { type = "bar", name = "Pending", x = queue.Labels.ToArray(), y = queue.Pending.ToArray(), marker = new { color = "#f59e0b" } },
            new { type = "bar", name = "Locked", x = queue.Labels.ToArray(), y = queue.Locked.ToArray(), marker = new { color = "#3b82f6" } },
            new { type = "bar", name = "Complete", x = queue.Labels.ToArray(), y = queue.Complete.ToArray(), marker = new { color = "#16a34a" } },
            new { type = "bar", name = "Exception", x = queue.Labels.ToArray(), y = queue.Exception.ToArray(), marker = new { color = "#ef4444" } },
            new { type = "bar", name = "Deferred", x = queue.Labels.ToArray(), y = queue.Deferred.ToArray(), marker = new { color = "#94a3b8" } }
        ];
    }

    public static object BuildQueueStateLayout() => TransparentLayout(new
    {
        barmode = "stack",
        margin = new { l = 40, r = 20, t = 10, b = 40 },
        yaxis = new { gridcolor = "rgba(15,23,42,0.06)" },
        legend = new { orientation = "h", y = 1.12 }
    });

    public static IReadOnlyList<object> BuildRootCauseData(DashboardSnapshot snapshot)
    {
        var root = snapshot.Model.RootCauseSplit;
        return
        [
            new { type = "bar", name = "Environment", x = root.Labels.ToArray(), y = root.Environment.ToArray(), marker = new { color = "#ef4444" } },
            new { type = "bar", name = "Code", x = root.Labels.ToArray(), y = root.Code.ToArray(), marker = new { color = "#0f172a" } },
            new { type = "bar", name = "Business Inquiry", x = root.Labels.ToArray(), y = root.BusinessInquiry.ToArray(), marker = new { color = "#64748b" } }
        ];
    }

    public static object BuildRootCauseLayout() => TransparentLayout(new
    {
        barmode = "group",
        margin = new { l = 40, r = 20, t = 10, b = 40 },
        yaxis = new { gridcolor = "rgba(15,23,42,0.06)" },
        legend = new { orientation = "h", y = 1.12 }
    });

    private static List<SlopeRow> TopSlopeRows(SlopeStats slopeStats) => slopeStats.Rows
        .OrderByDescending(x => Math.Abs(x.Delta))
        .ThenByDescending(x => x.TodayCount)
        .Take(7)
        .ToList();

    private static string ShortExceptionName(string value)
    {
        var cleaned = value
            .Replace("You must provide values for Folder and Pattern", "Missing folder/pattern", StringComparison.OrdinalIgnoreCase)
            .Replace("Could not execute code stage because exception thrown by code stage: ", "", StringComparison.OrdinalIgnoreCase)
            .Replace("Business rule mismatch: duplicate case", "Duplicate case rule mismatch", StringComparison.OrdinalIgnoreCase)
            .Replace("Failed to Attach on Navigation Stage ", "Attach failed: ", StringComparison.OrdinalIgnoreCase);

        return cleaned.Length <= 32 ? cleaned : cleaned[..29] + "...";
    }

    private static IReadOnlyDictionary<string, object?> TransparentLayout(object layout)
    {
        var values = new Dictionary<string, object?>
        {
            ["paper_bgcolor"] = "rgba(0,0,0,0)",
            ["plot_bgcolor"] = "rgba(0,0,0,0)"
        };

        foreach (var property in layout.GetType().GetProperties())
        {
            var value = property.GetValue(layout);
            if (value is not null)
            {
                values[property.Name] = value;
            }
        }

        return values;
    }
}
