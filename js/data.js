(function () {
  function seededRandom(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function zigzagSeries(rng, n, startMin, startMax, stepMin, stepMax, spikeChance, spikeMin, spikeMax) {
    const arr = [];
    let v = Math.floor(startMin + rng() * (startMax - startMin));
    let dir = 1;
    for (let i = 0; i < n; i++) {
      const step = Math.floor(stepMin + rng() * (stepMax - stepMin));
      v = v + dir * step;
      if (rng() < spikeChance) {
        const spike = Math.floor(spikeMin + rng() * (spikeMax - spikeMin));
        v = v + dir * spike;
      }
      v = Math.max(0, v);
      arr.push(v);
      dir *= -1;
    }
    return arr;
  }

  function makeHourlyData(rng, nowHour) {
    const labels = [];
    for (let h = 0; h <= nowHour; h++) labels.push(String(h).padStart(2, "0") + ":00");
    const values = zigzagSeries(rng, labels.length, 10, 30, 6, 22, 0.28, 18, 55);
    return { labels, values };
  }

  function makeDailyData(rng, day) {
    const labels = [];
    for (let d = 1; d <= day; d++) labels.push(String(d).padStart(2, "0"));
    const values = zigzagSeries(rng, labels.length, 140, 260, 35, 95, 0.22, 90, 220);
    return { labels, values };
  }

  function shuffleWithRng(values, rng) {
    const arr = values.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function shuffleWithMathRandom(values) {
    const arr = values.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function getProcessPool() {
    const fallback = [
      "Care Digital Refunds",
      "GFC Case Investigation",
      "NPC FLA Investigation",
      "IAM IBIS Upload",
      "CFO JE Upload",
      "RMO Settlement - Keying Batches",
      "Daily AUSTRAC Extract",
      "ALM Agent Setup Credit Trac",
      "Supply Chain - APA",
      "DRT Comment in CTM",
      "GSI - Hourly Report",
      "KYC PEP LVL 2",
      "Sanctions Screening Refresh",
      "Customer Onboarding Validation",
      "Loan Servicing Exception Handler"
    ];
    const external = (window.RPA && window.RPA.processNames && Array.isArray(window.RPA.processNames.list))
      ? window.RPA.processNames.list
      : [];

    const source = external.length ? external : fallback;
    const seen = new Set();
    const unique = source
      .map(function (x) { return String(x || "").trim(); })
      .filter(function (x) { return x.length > 0 && !seen.has(x) && seen.add(x); });

    return unique.length >= 15 ? unique : fallback;
  }

  function topProcesses(rng, processPool) {
    const processes = shuffleWithRng(processPool, rng);

    const byExceptions = processes.map(function (name) {
      return { name, count: Math.floor(50 + rng() * 220) };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 8);

    const byVariability = processes.map(function (name) {
      const mean = 20 + rng() * 100;
      const sd = 5 + rng() * 60;
      return { name, score: Math.round((sd / mean) * 100) };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, 7);

    return { byExceptions, byVariability, allProcesses: processes };
  }

  function buildDashboardModel(nowLocal, seed) {
    const baseSeed = Number.isFinite(seed) ? seed : parseInt(nowLocal.toFormat("yyyyLLdd"), 10);
    const rng = seededRandom(baseSeed);

    const exceptionCatalog = [
      { name: "WinSCP: Failed to Upload File", type: "system" },
      { name: "MS Graph: failed to create email draft", type: "system" },
      { name: "You must provide values for Folder and Pattern", type: "system" },
      { name: "7 Zip: Wrong Password", type: "system" },
      { name: "Could not execute code stage because exception thrown by code stage: annot find Column", type: "internal" },
      { name: "Failed to Attach on Navigation Stage \"Attach\"", type: "internal" },
      { name: "Business rule mismatch: duplicate case", type: "business" },
      { name: "Invoice missing approval code", type: "business" }
    ];

    const exceptionStats = exceptionCatalog.map(function (x, i) {
      const yesterdayCount = Math.floor(4 + rng() * 22);
      let todayCount = Math.max(0, yesterdayCount + Math.floor((rng() - 0.5) * 12));
      const weekAvg = Math.max(1, Math.floor(5 + rng() * 20));

      // Force at least one "new today" and one "resolved" example.
      if (i === 6) todayCount = Math.max(2, todayCount + 5);
      if (i === 7) todayCount = 0;

      return {
        name: x.name,
        type: x.type,
        owner: "Controller",
        todayCount,
        yesterdayCount,
        weekAvg
      };
    });

    const yesterdayRanked = exceptionStats
      .filter(function (x) { return x.yesterdayCount > 0; })
      .sort(function (a, b) { return b.yesterdayCount - a.yesterdayCount; })
      .map(function (x) { return x.name; });

    const todayRanked = exceptionStats
      .filter(function (x) { return x.todayCount > 0; })
      .sort(function (a, b) { return b.todayCount - a.todayCount; })
      .map(function (x) { return x.name; });

    const hourly = makeHourlyData(rng, nowLocal.hour);
    const daily = makeDailyData(rng, nowLocal.day);

    const ydayRobots = { running: Math.floor(60 + rng() * 30), retired: Math.floor(25 + rng() * 20) };
    const todayRobots = { running: Math.floor(60 + rng() * 30), retired: Math.floor(10 + rng() * 20) };

    const squads = ["Baymax", "WALL-E", "ATOM", "Awesom-O", "JARVIS", "Bender"];
    const invertSet = new Set(squads.slice().sort(function () { return rng() - 0.5; }).slice(0, 2));

    const squadDumbbell = squads.map(function (squad) {
      const lastMonth = Math.floor(40 + rng() * 160);
      let today = Math.max(5, Math.round(lastMonth * (0.75 + rng() * 0.7)));
      if (invertSet.has(squad)) today = Math.max(5, Math.round(lastMonth * (0.35 + rng() * 0.35)));
      return { squad, lastMonth, today };
    });

    const fiveMinLabels = Array.from({ length: 12 }, function (_, i) { return String(i * 5) + "m"; });
    const queueState = {
      labels: fiveMinLabels,
      pending: fiveMinLabels.map(function () { return Math.floor(25 + rng() * 60); }),
      locked: fiveMinLabels.map(function () { return Math.floor(8 + rng() * 28); }),
      complete: fiveMinLabels.map(function () { return Math.floor(35 + rng() * 80); }),
      exception: fiveMinLabels.map(function () { return Math.floor(4 + rng() * 24); }),
      deferred: fiveMinLabels.map(function () { return Math.floor(2 + rng() * 18); })
    };

    const sessionOutcome = {
      labels: fiveMinLabels,
      running: fiveMinLabels.map(function () { return Math.floor(18 + rng() * 30); }),
      completed: fiveMinLabels.map(function () { return Math.floor(30 + rng() * 50); }),
      terminated: fiveMinLabels.map(function () { return Math.floor(1 + rng() * 10); }),
      exceptioned: fiveMinLabels.map(function () { return Math.floor(2 + rng() * 14); })
    };

    const scheduleActivity = {
      labels: ["EOD Reconciliation", "Customer KYC Batch", "Finance Upload", "Settlement Run", "Regulatory Extract"],
      pending: Array.from({ length: 5 }, function () { return Math.floor(0 + rng() * 4); }),
      running: Array.from({ length: 5 }, function () { return Math.floor(0 + rng() * 3); }),
      completed: Array.from({ length: 5 }, function () { return Math.floor(4 + rng() * 8); }),
      terminated: Array.from({ length: 5 }, function () { return Math.floor(0 + rng() * 2); }),
      partExceptioned: Array.from({ length: 5 }, function () { return Math.floor(0 + rng() * 3); })
    };

    const highPriorityExceptions = exceptionCatalog
      .filter(function (x) { return x.type === "system" || x.type === "internal"; })
      .map(function (x) { return x.name; });
    const alerts = Array.from({ length: 10 }, function (_, i) {
      return "Alert #" + (i + 1) + " - " + highPriorityExceptions[Math.floor(rng() * highPriorityExceptions.length)];
    });

    const processPool = shuffleWithMathRandom(getProcessPool());
    const ticketProcesses = processPool.slice(0, 5);
    const tickets = [
      { key: "RPA-6786", days: Math.floor(8 + rng() * 35), title: ticketProcesses[0] + " failing on upload step", owner: "DK", lastUpdateHours: Math.floor(1 + rng() * 30), slaHours: 48 },
      { key: "RPA-2983", days: Math.floor(8 + rng() * 35), title: ticketProcesses[1] + " intermittent auth errors", owner: "RM", lastUpdateHours: Math.floor(1 + rng() * 30), slaHours: 48 },
      { key: "RPA-3948", days: Math.floor(8 + rng() * 35), title: ticketProcesses[2] + " parse drift", owner: "AK", lastUpdateHours: Math.floor(1 + rng() * 30), slaHours: 72 },
      { key: "RPA-1022", days: Math.floor(8 + rng() * 35), title: ticketProcesses[3] + " rate limit bursts", owner: "TJ", lastUpdateHours: Math.floor(1 + rng() * 30), slaHours: 48 },
      { key: "RPA-5510", days: Math.floor(8 + rng() * 35), title: ticketProcesses[4] + " deadlocks", owner: "MN", lastUpdateHours: Math.floor(1 + rng() * 30), slaHours: 72 }
    ].sort(function (a, b) { return b.days - a.days; });

    const detected = Math.floor(65 + rng() * 20);
    const raised = detected - Math.floor(2 + rng() * 6);
    const assigned = raised - Math.floor(1 + rng() * 5);
    const inProgress = Math.max(assigned - Math.floor(2 + rng() * 7), 1);
    const resolved = Math.max(inProgress - Math.floor(1 + rng() * 5), 0);
    const handoffFunnel = {
      labels: ["Detected", "Ticket Raised", "Assigned to Dev", "In Progress", "Resolved"],
      values: [detected, raised, assigned, inProgress, resolved]
    };

    const processCatalog = topProcesses(rng, processPool);
    const heatmapProcesses = processCatalog.allProcesses.slice(0, 15);
    const heatmapDays = Array.from({ length: 14 }, function (_, i) {
      return nowLocal.minus({ days: 13 - i }).toFormat("LL-dd");
    });
    const outOfBoundsHeatmap = [];
    heatmapProcesses.forEach(function (process) {
      heatmapDays.forEach(function (day, i) {
        const wave = (i >= 10 ? 2 : 0) + (i % 7 === 0 ? 2 : 0);
        outOfBoundsHeatmap.push({
          process,
          day,
          value: Math.max(0, Math.floor((rng() * 7) + wave + (rng() < 0.1 ? 5 : 0)))
        });
      });
    });

    const processPeak = new Map();
    outOfBoundsHeatmap.forEach(function (x) {
      const prev = processPeak.get(x.process) || 0;
      if (x.value > prev) processPeak.set(x.process, x.value);
    });
    const processHealth = Array.from(processPeak.keys()).map(function (name) {
      const total = Math.floor(120 + rng() * 240);
      const exceptionRate = 0.03 + rng() * 0.14; // 3%..17% demo band
      const exceptions = Math.max(1, Math.round(total * exceptionRate));
      const successRate = 1 - exceptions / total;
      const level = (exceptions / total) > 0.10 ? "RED" : "GREEN";
      const runtimeStatus = Math.random() < 0.35 ? "retired" : "running";
      const attentionType = Math.random() < 0.5 ? "MANY_EXCEPTIONS" : "SESSIONS_FAILING";
      const inMaintenance = Math.random() < 0.55;
      return { name, total, exceptions, exceptionRate: exceptions / total, successRate, level, runtimeStatus, attentionType, inMaintenance };
    });

    const byBreaching = processHealth
      .filter(function (x) { return x.exceptionRate > 0.10; })
      .sort(function (a, b) { return b.exceptionRate - a.exceptionRate; })
      .slice(0, 12);

    const rootCauseSplit = {
      labels: ["Day", "Week", "Month"],
      environment: [Math.floor(2 + rng() * 8), Math.floor(4 + rng() * 10), Math.floor(8 + rng() * 12)],
      code: [Math.floor(4 + rng() * 10), Math.floor(8 + rng() * 12), Math.floor(12 + rng() * 16)],
      businessInquiry: [Math.floor(1 + rng() * 6), Math.floor(2 + rng() * 8), Math.floor(3 + rng() * 10)]
    };

    const queueAging = {
      labels: ["0-15m", "15-30m", "30-60m", "60m+"],
      values: [Math.floor(4 + rng() * 8), Math.floor(3 + rng() * 7), Math.floor(2 + rng() * 6), Math.floor(1 + rng() * 5)]
    };

    const burstLabels = Array.from({ length: 20 }, function (_, i) { return String(i * 3) + "m"; });
    const burstValues = zigzagSeries(rng, burstLabels.length, 8, 20, 2, 8, 0.18, 6, 16);
    const burstBaseline = burstValues.map(function (v) { return Math.max(0, Math.round(v * 0.8)); });
    const burstUpper = burstValues.map(function (v) { return Math.round(v * 1.25 + 4); });
    const burstDetector = { labels: burstLabels, values: burstValues, baseline: burstBaseline, upper: burstUpper };

    return {
      seed: baseSeed,
      generatedAt: nowLocal.toISO(),
      exceptionStats,
      exceptionRanks: { yesterday: yesterdayRanked, today: todayRanked },
      hourlyExceptions: hourly,
      dailyExceptions: daily,
      robots: { today: todayRobots, yesterday: ydayRobots },
      topProcesses: Object.assign({}, processCatalog, { byBreaching }),
      processHealth,
      squadDumbbell,
      queueState,
      sessionOutcome,
      scheduleActivity,
      alerts,
      tickets,
      handoffFunnel,
      outOfBoundsHeatmap: {
        processes: heatmapProcesses,
        days: heatmapDays,
        values: outOfBoundsHeatmap
      },
      rootCauseSplit,
      queueAging,
      burstDetector
    };
  }

  function validateModel(model) {
    const issues = [];
    if (!model || typeof model !== "object") issues.push("Model missing");
    if (!Array.isArray(model.exceptionStats) || model.exceptionStats.length === 0) issues.push("Exception stats missing");
    if (!model.hourlyExceptions || !Array.isArray(model.hourlyExceptions.values)) issues.push("Hourly series missing");
    if (!model.dailyExceptions || !Array.isArray(model.dailyExceptions.values)) issues.push("Daily series missing");
    if (!model.robots || !model.robots.today || !model.robots.yesterday) issues.push("Robot segments missing");
    if (!Array.isArray(model.processHealth) || model.processHealth.length === 0) issues.push("Process health data missing");
    if (!Array.isArray(model.squadDumbbell) || model.squadDumbbell.length !== 6) issues.push("Squad data invalid");
    if (!model.topProcesses || !Array.isArray(model.topProcesses.byBreaching)) issues.push("Breaching process list missing");
    if (!Array.isArray(model.alerts) || model.alerts.length !== 10) issues.push("Alerts invalid");
    if (!Array.isArray(model.tickets) || model.tickets.length !== 5) issues.push("Tickets invalid");
    if (!model.handoffFunnel || !Array.isArray(model.handoffFunnel.values)) issues.push("Funnel data missing");
    if (!model.outOfBoundsHeatmap || !Array.isArray(model.outOfBoundsHeatmap.values)) issues.push("Heatmap data missing");
    if (!model.rootCauseSplit || !Array.isArray(model.rootCauseSplit.labels)) issues.push("Root cause data missing");
    if (!model.queueAging || !Array.isArray(model.queueAging.values)) issues.push("Queue aging data missing");
    if (!model.burstDetector || !Array.isArray(model.burstDetector.values)) issues.push("Burst detector data missing");
    if (!model.queueState || !Array.isArray(model.queueState.labels)) issues.push("Queue state data missing");
    if (!model.sessionOutcome || !Array.isArray(model.sessionOutcome.labels)) issues.push("Session outcome data missing");
    if (!model.scheduleActivity || !Array.isArray(model.scheduleActivity.labels)) issues.push("Schedule activity data missing");
    return issues;
  }

  window.RPA = window.RPA || {};
  window.RPA.data = {
    buildDashboardModel,
    validateModel
  };
})();
