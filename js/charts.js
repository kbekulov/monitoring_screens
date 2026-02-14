(function () {
  const palette = (window.RPA && window.RPA.config && window.RPA.config.palette) || {
    ink: "#0f172a",
    textMuted: "#64748b",
    lineSoft: "rgba(15,23,42,0.06)",
    lineFaint: "rgba(15,23,42,0.04)",
    critical: "#ef4444",
    criticalSoft: "rgba(239,68,68,0.2)",
    warning: "#f97316",
    warningSoft: "rgba(249,115,22,0.24)",
    neutral: "#94a3b8",
    neutralStrong: "#64748b",
    info: "#3b82f6",
    infoSoft: "rgba(59,130,246,0.16)",
    success: "#16a34a",
    successSoft: "rgba(22,163,74,0.18)",
    heatLow: "#f8e4e4",
    heatMidLow: "#efc3c3",
    heatMidHigh: "#de8e8e",
    heatHigh: "#b94a4a",
    donutOnline: "rgba(79, 142, 247, 1)",
    donutOnlineSoft: "rgba(79, 142, 247, 0.55)",
    donutRetired: "rgba(47, 53, 66, 1)",
    donutRetiredSoft: "rgba(47, 53, 66, 0.55)"
  };

  function buildRankMap(arr) {
    const m = new Map();
    arr.forEach(function (name, i) { m.set(name, i + 1); });
    return m;
  }

  function drawSlope(model, mode) {
    if (typeof d3 === "undefined") throw new Error("d3 unavailable");

    const container = document.getElementById("slope");
    container.innerHTML = "";

    const baselineField = mode === "week" ? "weekAvg" : "yesterdayCount";
    const baselineLabel = mode === "week" ? "7d Avg" : "Yesterday";
    const todayLabel = "Today";
    const statMap = new Map(model.exceptionStats.map(function (x) { return [x.name, x]; }));

    const baselineRank = buildRankMap(
      model.exceptionStats
        .filter(function (x) { return x[baselineField] > 0; })
        .sort(function (a, b) { return b[baselineField] - a[baselineField]; })
        .map(function (x) { return x.name; })
    );
    const todayRank = buildRankMap(model.exceptionRanks.today);

    const shared = model.exceptionRanks.today.filter(function (name) { return baselineRank.has(name); }).map(function (name) {
      const baseRank = baselineRank.get(name);
      const tRank = todayRank.get(name);
      const stat = statMap.get(name);
      return {
        name,
        yday: baseRank,
        today: tRank,
        improved: tRank > baseRank,
        worsened: tRank < baseRank,
        todayCount: stat.todayCount,
        baselineCount: stat[baselineField],
        delta: stat.todayCount - stat[baselineField],
        type: stat.type,
        owner: stat.owner
      };
    });
    const topMovers = shared
      .slice()
      .sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); })
      .slice(0, 8);

    const newToday = model.exceptionStats.filter(function (x) { return x.todayCount > 0 && x[baselineField] === 0; }).map(function (x) { return x.name; });
    const resolvedFromBaseline = model.exceptionStats.filter(function (x) { return x.todayCount === 0 && x[baselineField] > 0; }).map(function (x) { return x.name; });

    const w = container.clientWidth || 1100;
    const h = 360;
    const margin = { top: 18, right: 18, bottom: 18, left: 18 };

    const svg = d3.select(container).append("svg").attr("viewBox", "0 0 " + w + " " + h);
    const xRank = margin.left + 6;
    const xLeft = Math.max(200, w * 0.22);
    const xRight = w - Math.max(260, w * 0.30);
    const y = d3.scaleLinear().domain([1, 10]).range([margin.top, h - margin.bottom]);
    const maxUsedRank = d3.max(shared, function (d) { return Math.max(d.yday, d.today); }) || 10;

    function shortLabel(text, max) {
      if (text.length <= max) return text;
      return text.slice(0, Math.max(10, max - 1)) + "…";
    }

    const placed = shared
      .map(function (d) { return { name: d.name, yPos: y(d.today) }; })
      .sort(function (a, b) { return a.yPos - b.yPos; });
    for (let i = 1; i < placed.length; i += 1) {
      if (placed[i].yPos - placed[i - 1].yPos < 14) {
        placed[i].yPos = placed[i - 1].yPos + 14;
      }
    }
    const labelY = new Map(placed.map(function (p) { return [p.name, Math.min(h - margin.bottom + 4, p.yPos)]; }));

    svg.append("g").selectAll("line")
      .data(d3.range(1, 11))
      .join("line")
      .attr("class", function (d) { return d <= maxUsedRank ? "slope-grid-active" : "slope-grid-inactive"; })
      .attr("x1", margin.left)
      .attr("x2", w - margin.right)
      .attr("y1", function (d) { return y(d); })
      .attr("y2", function (d) { return y(d); });

    svg.append("text").attr("x", xLeft).attr("y", 10).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 600).attr("fill", palette.textMuted).text(baselineLabel);
    svg.append("text").attr("x", xRight).attr("y", 10).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 600).attr("fill", palette.textMuted).text(todayLabel);

    svg.append("g").selectAll("text")
      .data(d3.range(1, 11))
      .join("text")
      .attr("class", function (d) { return d <= maxUsedRank ? "slope-rank" : "slope-rank slope-rank-dim"; })
      .attr("x", xRank)
      .attr("y", function (d) { return y(d) + 4; })
      .attr("text-anchor", "start")
      .text(function (d) { return "#" + d; });

    svg.append("g").selectAll("line")
      .data(shared)
      .join("line")
      .attr("x1", xLeft)
      .attr("y1", function (d) { return y(d.yday); })
      .attr("x2", xRight)
      .attr("y2", function (d) { return y(d.today); })
      .attr("class", function (d) {
        if (d.improved) return "slope-line-improve";
        if (d.worsened) return "slope-line-worsen";
        return "slope-line-stable";
      });

    svg.append("g").selectAll("circle")
      .data(shared)
      .join("circle")
      .attr("cx", xLeft)
      .attr("cy", function (d) { return y(d.yday); })
      .attr("r", 4)
      .attr("class", "slope-dot");

    svg.append("g").selectAll("circle")
      .data(shared)
      .join("circle")
      .attr("cx", xRight)
      .attr("cy", function (d) { return y(d.today); })
      .attr("r", 4)
      .attr("fill", palette.ink);

    const typeChip = {
      system: { code: "S", bg: "#fee2e2", fg: "#991b1b", border: "#fecaca" },
      internal: { code: "I", bg: "#ffedd5", fg: "#9a3412", border: "#fed7aa" },
      business: { code: "B", bg: "#dbeafe", fg: "#1e3a8a", border: "#bfdbfe" }
    };

    const rightLabels = svg.append("g").selectAll("g.rightLabel")
      .data(shared)
      .join("g")
      .attr("class", "rightLabel")
      .attr("transform", function (d) {
        const yPos = (labelY.get(d.name) || y(d.today)) - 8;
        return "translate(" + (xRight + 10) + "," + yPos + ")";
      });

    rightLabels.append("text")
      .attr("class", "slope-label")
      .attr("x", 0)
      .attr("y", 12)
      .attr("text-anchor", "start")
      .text(function (d) { return shortLabel(d.name, 34); });

    rightLabels.append("rect")
      .attr("x", 212)
      .attr("y", 1)
      .attr("width", 18)
      .attr("height", 14)
      .attr("rx", 7)
      .attr("fill", function (d) { return (typeChip[d.type] || typeChip.business).bg; })
      .attr("stroke", function (d) { return (typeChip[d.type] || typeChip.business).border; });

    rightLabels.append("text")
      .attr("x", 221)
      .attr("y", 12)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("font-weight", 700)
      .attr("fill", function (d) { return (typeChip[d.type] || typeChip.business).fg; })
      .text(function (d) { return (typeChip[d.type] || typeChip.business).code; });

    rightLabels.append("title")
      .text(function (d) { return d.name + " | Today " + d.todayCount + " | Baseline " + d.baselineCount + " | Delta " + (d.delta > 0 ? "+" : "") + d.delta; });

    return {
      shared: shared,
      rows: topMovers,
      baselineLabel: baselineLabel,
      improved: shared.filter(function (x) { return x.improved; }).length,
      worsened: shared.filter(function (x) { return x.worsened; }).length,
      unchanged: shared.filter(function (x) { return !x.improved && !x.worsened; }).length,
      newToday: newToday.length,
      resolved: resolvedFromBaseline.length,
      newList: newToday,
      resolvedList: resolvedFromBaseline
    };
  }

  function drawDumbbell(model) {
    if (typeof d3 === "undefined") throw new Error("d3 unavailable");
    const host = document.getElementById("dumbbell");
    host.innerHTML = "";

    const data = model.squadDumbbell;
    const w = host.clientWidth || 1100;
    const h = 360;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };

    const svg = d3.select(host).append("svg").attr("viewBox", "0 0 " + w + " " + h).style("width", "100%").style("height", "360px");
    const x = d3.scaleBand().domain(data.map(function (d) { return d.squad; })).range([margin.left, w - margin.right]).padding(0.35);
    const yMax = d3.max(data, function (d) { return Math.max(d.lastMonth, d.today); }) || 1;
    const y = d3.scaleLinear().domain([0, yMax * 1.15]).nice().range([h - margin.bottom, margin.top]);

    svg.append("g").attr("transform", "translate(" + margin.left + ",0)")
      .call(d3.axisLeft(y).ticks(6).tickSize(-(w - margin.left - margin.right)).tickFormat(d3.format("~s")))
      .call(function (g) { return g.selectAll(".tick line").attr("stroke", palette.lineSoft); })
      .call(function (g) { return g.select(".domain").remove(); });

    svg.append("g").attr("transform", "translate(0," + (h - margin.bottom) + ")")
      .call(d3.axisBottom(x)).call(function (g) { return g.select(".domain").attr("stroke", "rgba(15,23,42,0.2)"); });

    svg.append("g").selectAll("line.dline").data(data).join("line")
      .attr("x1", function (d) { return x(d.squad) + x.bandwidth() / 2; })
      .attr("x2", function (d) { return x(d.squad) + x.bandwidth() / 2; })
      .attr("y1", function (d) { return y(d.lastMonth); })
      .attr("y2", function (d) { return y(d.today); })
      .attr("stroke", "rgba(15,23,42,0.35)")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round");

    svg.append("g").selectAll("circle.last").data(data).join("circle")
      .attr("cx", function (d) { return x(d.squad) + x.bandwidth() / 2; })
      .attr("cy", function (d) { return y(d.lastMonth); })
      .attr("r", 7)
      .attr("fill", palette.ink);

    svg.append("g").selectAll("circle.today").data(data).join("circle")
      .attr("cx", function (d) { return x(d.squad) + x.bandwidth() / 2; })
      .attr("cy", function (d) { return y(d.today); })
      .attr("r", 7)
      .attr("fill", "#fff")
      .attr("stroke", palette.ink)
      .attr("stroke-width", 2);
  }

  function drawLineCharts(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__hourlyLineChart) window.__hourlyLineChart.destroy();
    if (window.__dailyLineChart) window.__dailyLineChart.destroy();

    window.__hourlyLineChart = new Chart(document.getElementById("hourlyLine"), {
      type: "line",
      data: {
        labels: model.hourlyExceptions.labels,
        datasets: [{
          label: "Exceptions (hourly)",
          data: model.hourlyExceptions.values,
          tension: 0.25,
          pointRadius: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
        scales: {
          x: { grid: { color: palette.lineSoft } },
          y: { grid: { color: palette.lineSoft }, title: { display: true, text: "Exceptions" } }
        }
      }
    });

    window.__dailyLineChart = new Chart(document.getElementById("dailyLine"), {
      type: "line",
      data: {
        labels: model.dailyExceptions.labels,
        datasets: [{
          label: "Exceptions (daily)",
          data: model.dailyExceptions.values,
          tension: 0.25,
          pointRadius: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
        scales: {
          x: { grid: { color: palette.lineSoft }, title: { display: true, text: "Day of month" } },
          y: { grid: { color: palette.lineSoft }, title: { display: true, text: "Exceptions" } }
        }
      }
    });
  }

  function drawQueueStateChart(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__queueStateChart) window.__queueStateChart.destroy();

    window.__queueStateChart = new Chart(document.getElementById("queueStateChart"), {
      type: "line",
      data: {
        labels: model.queueState.labels,
        datasets: [
          { label: "Pending", data: model.queueState.pending, borderColor: palette.warning, backgroundColor: palette.warningSoft, fill: true, tension: 0.25, pointRadius: 0, borderWidth: 2.2 },
          { label: "Exception", data: model.queueState.exception, borderColor: palette.critical, backgroundColor: palette.criticalSoft, fill: true, tension: 0.25, pointRadius: 0, borderWidth: 2.2 },
          { label: "Locked", data: model.queueState.locked, borderColor: palette.neutralStrong, backgroundColor: "rgba(100,116,139,0.08)", fill: false, tension: 0.25, pointRadius: 0, borderDash: [5, 4] },
          { label: "Complete", data: model.queueState.complete, borderColor: palette.neutral, backgroundColor: "rgba(148,163,184,0.06)", fill: false, tension: 0.25, pointRadius: 0 },
          { label: "Deferred", data: model.queueState.deferred, borderColor: "#cbd5e1", backgroundColor: "rgba(203,213,225,0.04)", fill: false, tension: 0.25, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { stacked: true, grid: { color: palette.lineSoft }, title: { display: true, text: "Last 60m (5m buckets)" } },
          y: { stacked: true, title: { display: true, text: "Queue Items" }, grid: { color: palette.lineSoft } }
        }
      }
    });
  }

  function drawDonut(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__nestedDonutChart) window.__nestedDonutChart.destroy();

    window.__nestedDonutChart = new Chart(document.getElementById("nestedDonut"), {
      type: "doughnut",
      data: {
        labels: ["Retired", "Running"],
        datasets: [
          {
            label: "Today",
            data: [model.robots.today.retired, model.robots.today.running],
            backgroundColor: [palette.donutRetired, palette.donutOnline],
            borderWidth: 0,
            hoverOffset: 6,
            radius: "52%"
          },
          {
            label: "Yesterday",
            data: [model.robots.yesterday.retired, model.robots.yesterday.running],
            backgroundColor: [palette.donutRetiredSoft, palette.donutOnlineSoft],
            borderWidth: 0,
            hoverOffset: 6,
            radius: "98%"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "54%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": " + ctx.label + " = " + ctx.parsed;
              }
            }
          }
        }
      }
    });
  }

  function drawFunnel(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__funnelChart) window.__funnelChart.destroy();
    window.__funnelChart = new Chart(document.getElementById("funnelChart"), {
      type: "bar",
      data: {
        labels: model.handoffFunnel.labels,
        datasets: [{
          label: "Exceptions",
          data: model.handoffFunnel.values,
          backgroundColor: [palette.critical, palette.warning, palette.info, "#6366f1", palette.success]
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: palette.lineSoft } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  function drawRootCauseSplit(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__rootCauseChart) window.__rootCauseChart.destroy();
    window.__rootCauseChart = new Chart(document.getElementById("rootCauseChart"), {
      type: "bar",
      data: {
        labels: model.rootCauseSplit.labels,
        datasets: [
          { label: "Environment", data: model.rootCauseSplit.environment, backgroundColor: palette.info },
          { label: "Code", data: model.rootCauseSplit.code, backgroundColor: palette.critical },
          { label: "Business Inquiry", data: model.rootCauseSplit.businessInquiry, backgroundColor: "#f59e0b" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { color: palette.lineSoft }, title: { display: true, text: "Exceptions" } }
        }
      }
    });
  }

  function drawQueueAging(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__queueAgingChart) window.__queueAgingChart.destroy();
    window.__queueAgingChart = new Chart(document.getElementById("queueAgingChart"), {
      type: "bar",
      data: {
        labels: model.queueAging.labels,
        datasets: [{
          label: "Pending/Locked Items",
          data: model.queueAging.values,
          backgroundColor: [palette.success, "#f59e0b", palette.warning, palette.critical]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: palette.lineSoft }, title: { display: true, text: "Queue Items" } }
        }
      }
    });
  }

  function drawSessionOutcomeChart(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__sessionOutcomeChart) window.__sessionOutcomeChart.destroy();
    window.__sessionOutcomeChart = new Chart(document.getElementById("sessionOutcomeChart"), {
      type: "line",
      data: {
        labels: model.sessionOutcome.labels,
        datasets: [
          { label: "Running", data: model.sessionOutcome.running, borderColor: palette.info, tension: 0.25, pointRadius: 1.8 },
          { label: "Completed", data: model.sessionOutcome.completed, borderColor: palette.success, tension: 0.25, pointRadius: 1.8 },
          { label: "Terminated", data: model.sessionOutcome.terminated, borderColor: palette.warning, tension: 0.25, pointRadius: 1.8 },
          { label: "Exceptioned", data: model.sessionOutcome.exceptioned, borderColor: palette.critical, tension: 0.25, pointRadius: 1.8 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { grid: { color: palette.lineFaint } },
          y: { grid: { color: palette.lineSoft }, title: { display: true, text: "Sessions" } }
        }
      }
    });
  }

  function drawBurstDetector(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__burstChart) window.__burstChart.destroy();
    window.__burstChart = new Chart(document.getElementById("burstChart"), {
      type: "line",
      data: {
        labels: model.burstDetector.labels,
        datasets: [
          {
            label: "Upper Band",
            data: model.burstDetector.upper,
            borderColor: "rgba(148,163,184,0.8)",
            backgroundColor: "rgba(148,163,184,0.18)",
            pointRadius: 0,
            borderWidth: 1.5,
            fill: false
          },
          {
            label: "Live Exceptions",
            data: model.burstDetector.values,
            borderColor: palette.critical,
            backgroundColor: "rgba(239,68,68,0.15)",
            pointRadius: 2,
            borderWidth: 2.5,
            tension: 0.25,
            fill: "-1"
          },
          {
            label: "Baseline",
            data: model.burstDetector.baseline,
            borderColor: palette.info,
            pointRadius: 0,
            borderWidth: 1.5,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { grid: { color: palette.lineFaint } },
          y: { grid: { color: palette.lineSoft }, title: { display: true, text: "Exceptions" } }
        }
      }
    });
  }

  function drawOutOfBoundsHeatmap(model) {
    if (typeof d3 === "undefined") throw new Error("d3 unavailable");
    const host = document.getElementById("heatmapChart");
    host.innerHTML = "";

    const w = host.clientWidth || 700;
    const margin = { top: 20, right: 8, bottom: 34, left: 170 };
    const values = model.outOfBoundsHeatmap.values;
    const processes = model.outOfBoundsHeatmap.processes;
    const days = model.outOfBoundsHeatmap.days;
    const h = Math.max(290, margin.top + margin.bottom + (processes.length * 20));

    const svg = d3.select(host).append("svg").attr("viewBox", "0 0 " + w + " " + h);
    const x = d3.scaleBand().domain(days).range([margin.left, w - margin.right]).padding(0.04);
    const y = d3.scaleBand().domain(processes).range([margin.top, h - margin.bottom]).padding(0.05);
    const maxVal = d3.max(values, function (d) { return d.value; }) || 1;
    const color = d3.scaleLinear()
      .domain([0, maxVal * 0.35, maxVal * 0.65, maxVal])
      .range([palette.heatLow, palette.heatMidLow, palette.heatMidHigh, palette.heatHigh]);

    svg.append("g").selectAll("rect")
      .data(values)
      .join("rect")
      .attr("class", "hm-cell")
      .attr("x", function (d) { return x(d.day); })
      .attr("y", function (d) { return y(d.process); })
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", function (d) { return color(d.value); });

    svg.append("g")
      .attr("transform", "translate(0," + (h - margin.bottom) + ")")
      .call(d3.axisBottom(x).tickValues(days.filter(function (_, i) { return i % 2 === 0; })))
      .call(function (g) { g.selectAll("text").attr("class", "axis-label"); g.select(".domain").remove(); });

    svg.append("g")
      .attr("transform", "translate(" + margin.left + ",0)")
      .call(d3.axisLeft(y))
      .call(function (g) { g.selectAll("text").attr("class", "axis-label"); g.select(".domain").remove(); });
  }

  function drawScheduleActivityChart(model) {
    if (typeof Chart === "undefined") throw new Error("Chart.js unavailable");
    if (window.__scheduleActivityChart) window.__scheduleActivityChart.destroy();
    window.__scheduleActivityChart = new Chart(document.getElementById("scheduleActivityChart"), {
      type: "bar",
      data: {
        labels: model.scheduleActivity.labels,
        datasets: [
          { label: "Pending", data: model.scheduleActivity.pending, backgroundColor: "#f59e0b" },
          { label: "Running", data: model.scheduleActivity.running, backgroundColor: palette.info },
          { label: "Completed", data: model.scheduleActivity.completed, backgroundColor: palette.success },
          { label: "Terminated", data: model.scheduleActivity.terminated, backgroundColor: palette.critical },
          { label: "Part exceptioned", data: model.scheduleActivity.partExceptioned, backgroundColor: "#a855f7" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { color: palette.lineSoft }, title: { display: true, text: "Schedule count" } }
        }
      }
    });
  }

  window.RPA = window.RPA || {};
  window.RPA.charts = {
    drawSlope,
    drawDumbbell,
    drawLineCharts,
    drawQueueStateChart,
    drawDonut,
    drawFunnel,
    drawRootCauseSplit,
    drawQueueAging,
    drawSessionOutcomeChart,
    drawBurstDetector,
    drawOutOfBoundsHeatmap,
    drawScheduleActivityChart
  };
})();
