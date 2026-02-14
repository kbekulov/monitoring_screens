(function () {
  const state = {
    errors: [],
    renderStatus: "starting",
    dependencyStatus: "checking",
    alertState: "GREEN",
    actionOwner: "Controllers monitor",
    nextRefreshLabel: "Next refresh: pending..."
  };

  const runtime = {
    model: null,
    slopeMode: "yesterday",
    exceptionsMode: "hourly",
    slopeAutoTimer: null,
    exceptionsAutoTimer: null,
    failoverTargetsMs: [],
    nextRefreshAt: null,
    refreshTimer: null,
    clockTimer: null,
    refreshCountdownTimer: null,
    countdownStarted: false,
    resizeTimer: null
  };

  function recordError(scope, error) {
    state.errors.push({ scope, message: error && error.message ? error.message : String(error) });
    if (window.RPA && window.RPA.config && window.RPA.config.enableConsoleTelemetry) {
      console.error("[dashboard]", scope, error);
    }
  }

  function callSafe(scope, fn) {
    try {
      return fn();
    } catch (e) {
      recordError(scope, e);
      return null;
    }
  }

  function setBodyStateClass(alertState) {
    document.body.classList.remove("dashboard-green", "dashboard-amber", "dashboard-red");
    if (alertState === "RED") document.body.classList.add("dashboard-red");
    else if (alertState === "AMBER") document.body.classList.add("dashboard-amber");
    else document.body.classList.add("dashboard-green");
  }

  function setSlopeKpis(slopeStats) {
    const map = [
      ["slopeImproved", slopeStats.improved],
      ["slopeWorsened", slopeStats.worsened],
      ["slopeUnchanged", slopeStats.unchanged],
      ["slopeNew", slopeStats.newToday],
      ["slopeResolved", slopeStats.resolved]
    ];
    map.forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (el) el.textContent = String(pair[1]);
    });
  }

  function getSlopeMode() {
    return runtime.slopeMode || "yesterday";
  }

  function syncSlopeButtons() {
    document.querySelectorAll(".slope-mode-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.mode === getSlopeMode());
    });
  }

  function getExceptionsMode() {
    return runtime.exceptionsMode || "hourly";
  }

  function syncExceptionsButtons() {
    document.querySelectorAll(".exceptions-mode-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.mode === getExceptionsMode());
    });
  }

  function syncExceptionsView() {
    const hourly = document.getElementById("exceptionsHourlyView");
    const daily = document.getElementById("exceptionsDailyView");
    if (!hourly || !daily) return;
    const mode = getExceptionsMode();
    hourly.classList.toggle("d-none", mode !== "hourly");
    daily.classList.toggle("d-none", mode !== "daily");
  }

  function renderSlopeForCurrentMode(scope) {
    if (!runtime.model) return;
    const slopeStats = callSafe(scope, function () { return window.RPA.charts.drawSlope(runtime.model, getSlopeMode()); }) || { improved: 0, worsened: 0, unchanged: 0, newToday: 0, resolved: 0, rows: [], newList: [], resolvedList: [] };
    setSlopeKpis(slopeStats);
    const summaries = buildSummaries(runtime.model, slopeStats);
    callSafe("render-slope-summary", function () { window.RPA.renderers.writeSummaries(summaries); });
  }

  function rotateSlopeMode() {
    runtime.slopeMode = getSlopeMode() === "yesterday" ? "week" : "yesterday";
    syncSlopeButtons();
    renderSlopeForCurrentMode("render-slope-auto-cycle");
  }

  function scheduleSlopeAutoCycle() {
    if (runtime.slopeAutoTimer) clearInterval(runtime.slopeAutoTimer);
    if (!window.RPA.config.autoSlopeCycle) return;
    runtime.slopeAutoTimer = setInterval(rotateSlopeMode, window.RPA.config.slopeCycleMs);
  }

  function rotateExceptionsMode() {
    runtime.exceptionsMode = getExceptionsMode() === "hourly" ? "daily" : "hourly";
    syncExceptionsButtons();
    syncExceptionsView();
  }

  function scheduleExceptionsAutoCycle() {
    if (runtime.exceptionsAutoTimer) clearInterval(runtime.exceptionsAutoTimer);
    if (!window.RPA.config.autoSlopeCycle) return;
    runtime.exceptionsAutoTimer = setInterval(rotateExceptionsMode, window.RPA.config.slopeCycleMs);
  }

  function applyMaintenanceThresholds() {
    const cfg = (window.RPA && window.RPA.config && window.RPA.config.maintenanceThresholds) || {};
    const items = [
      { id: "maintenanceInboxValue", threshold: cfg.inboxEmails },
      { id: "maintenanceTodoValue", threshold: cfg.todo },
      { id: "maintenanceWorkedValue", threshold: cfg.workedOn }
    ];

    items.forEach(function (it) {
      const el = document.getElementById(it.id);
      if (!el || !Number.isFinite(it.threshold)) return;
      const value = Number(String(el.textContent || "").replace(/[^\d.-]/g, ""));
      const breached = Number.isFinite(value) && value > it.threshold;

      el.classList.toggle("maintenance-breach", breached);

      let icon = el.querySelector(".maintenance-breach-icon");
      if (breached && !icon) {
        icon = document.createElement("span");
        icon.className = "maintenance-breach-icon";
        icon.innerHTML = '<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>';
        el.appendChild(icon);
      }
      if (!breached && icon) icon.remove();
    });
  }

  function buildSummaries(model, slopeStats) {
    const bestSquad = model.squadDumbbell.reduce(function (best, d) {
      return (d.today - d.lastMonth) > (best.today - best.lastMonth) ? d : best;
    }, model.squadDumbbell[0]);

    const maxHourly = Math.max.apply(null, model.hourlyExceptions.values);
    const minHourly = Math.min.apply(null, model.hourlyExceptions.values);
    const maxDaily = Math.max.apply(null, model.dailyExceptions.values);
    const latestDaily = model.dailyExceptions.values[model.dailyExceptions.values.length - 1];
    const lastPending = model.queueState.pending[model.queueState.pending.length - 1];
    const lastExceptionQueue = model.queueState.exception[model.queueState.exception.length - 1];
    const lastSessionRunning = model.sessionOutcome.running[model.sessionOutcome.running.length - 1];
    const lastSessionExceptioned = model.sessionOutcome.exceptioned[model.sessionOutcome.exceptioned.length - 1];
    const onlinePct = Math.round((model.robots.today.running / (model.robots.today.running + model.robots.today.retired)) * 100);
    const funnelDrop = model.handoffFunnel.values[0] - model.handoffFunnel.values[2];
    const hotCells = model.outOfBoundsHeatmap.values.filter(function (x) { return x.value >= 8; }).length;
    const dominantRoot = [
      { name: "Environment", value: model.rootCauseSplit.environment[2] },
      { name: "Code", value: model.rootCauseSplit.code[2] },
      { name: "Business Inquiry", value: model.rootCauseSplit.businessInquiry[2] }
    ].sort(function (a, b) { return b.value - a.value; })[0];
    const agingHigh = model.queueAging.values[3];
    const latestBurst = model.burstDetector.values[model.burstDetector.values.length - 1];
    const latestBand = model.burstDetector.upper[model.burstDetector.upper.length - 1];
    const problematicSchedules = model.scheduleActivity.terminated.reduce(function (acc, x, i) {
      return acc + (x > 0 || model.scheduleActivity.partExceptioned[i] > 0 ? 1 : 0);
    }, 0);

    const slopeActionText = slopeStats.worsened > slopeStats.improved
      ? "More worsened than improved. Controller action required."
      : (slopeStats.worsened === 0 ? "No worsening in top exceptions." : "Mixed movement across top exceptions.");

    return {
      slope: slopeActionText + " " + slopeStats.improved + " improved, " + slopeStats.worsened + " worsened.",
      hourly: "Hourly range is " + minHourly + " to " + maxHourly + " exceptions.",
      daily: "Latest daily count is " + latestDaily + "; monthly peak is " + maxDaily + ".",
      queueState: "Latest queue states: pending " + lastPending + ", exception " + lastExceptionQueue + ".",
      donut: "Today online availability is " + onlinePct + "%.",
      dumbbell: bestSquad.squad + " shows the largest increase vs last month.",
      funnel: "Detected-to-assigned drop is " + funnelDrop + " exceptions in live handoff.",
      heatmap: hotCells + " process-day cells show elevated exception concentration.",
      rootCause: dominantRoot.name + " is dominant in the month view.",
      sessionOutcome: "Latest sessions: running " + lastSessionRunning + ", exceptioned " + lastSessionExceptioned + ".",
      queueAging: agingHigh + " queue items are in the 60m+ age bucket.",
      burst: "Latest burst " + latestBurst + " vs upper band " + latestBand + ".",
      scheduleActivity: problematicSchedules + " schedules have terminated/part-exceptioned outcomes."
    };
  }

  function deriveCriticalAnnouncements(policy) {
    const announcements = [];

    if (window.RPA.config.forceCriticalAnnouncement) {
      announcements.push({
        title: window.RPA.config.forcedAnnouncementTitle || "All MS Graph APIs are down."
      });
    }

    if (policy.alertState === "RED") {
      announcements.push({
        title: "Blue Prism is down. Developers should respond immediately."
      });
    }

    const leadMinutes = window.RPA.config.failoverAnnouncementLeadMinutes || 60;
    if (runtime.failoverTargetsMs && runtime.failoverTargetsMs.length) {
      const nowMs = Date.now();
      const minsToFailover = runtime.failoverTargetsMs
        .map(function (t) { return Math.floor((t - nowMs) / 60000); })
        .filter(function (m) { return m >= 0; });

      if (minsToFailover.length) {
        const minRemaining = Math.min.apply(null, minsToFailover);
        if (minRemaining <= leadMinutes) {
          announcements.push({
            title: "Failover approaching in " + minRemaining + " minutes."
          });
        }
      }
    }

    return announcements;
  }

  function renderCountdown() {
    if (runtime.countdownStarted) return;
    runtime.countdownStarted = true;

    const DateTime = luxon.DateTime;
    const Duration = luxon.Duration;

    function makeTarget(zone, plusDays) {
      return DateTime.now().setZone(zone).plus({ days: plusDays }).startOf("hour").plus({ hours: 1 });
    }

    const targetReston = makeTarget("America/New_York", 2);
    const targetChicago = makeTarget("America/Chicago", 3);
    runtime.failoverTargetsMs = [targetReston.toMillis(), targetChicago.toMillis()];

    document.getElementById("restonTarget").textContent = "Target: " + targetReston.toFormat("yyyy-LL-dd HH:mm ZZZZ");
    document.getElementById("chicagoTarget").textContent = "Target: " + targetChicago.toFormat("yyyy-LL-dd HH:mm ZZZZ");

    function formatCountdown(diff) {
      const d = Math.max(0, Math.floor(diff.as("days")));
      const h = diff.minus({ days: d }).hours | 0;
      const m = diff.minus({ days: d, hours: h }).minutes | 0;
      return '<span class="fw-semibold">' + String(d).padStart(2, "0") + '</span><span class="unit">days</span>' +
        '<span class="fw-semibold">' + String(h).padStart(2, "0") + '</span><span class="unit">hours</span>' +
        '<span class="fw-semibold">' + String(m).padStart(2, "0") + '</span><span class="unit">min</span>';
    }

    function tick() {
      const nR = DateTime.now().setZone("America/New_York");
      const nC = DateTime.now().setZone("America/Chicago");

      let diffR = targetReston.diff(nR, ["days", "hours", "minutes"]);
      let diffC = targetChicago.diff(nC, ["days", "hours", "minutes"]);

      if (diffR.as("milliseconds") < 0) diffR = Duration.fromObject({ days: 0, hours: 0, minutes: 0 });
      if (diffC.as("milliseconds") < 0) diffC = Duration.fromObject({ days: 0, hours: 0, minutes: 0 });

      document.getElementById("cdReston").innerHTML = formatCountdown(diffR);
      document.getElementById("cdChicago").innerHTML = formatCountdown(diffC);
    }

    tick();
    setInterval(tick, 30000);
  }

  function deriveBreachProcesses(model, thresholds) {
    const fromHealth = model.processHealth
      .map(function (x) {
        const level = x.exceptionRate > thresholds.exceptionRate.red
          ? "RED"
          : (x.exceptionRate > thresholds.exceptionRate.amber ? "AMBER" : "GREEN");
        return {
          process: x.name,
          maxValue: Math.round(x.exceptionRate * 100),
          level,
          status: x.runtimeStatus || "running",
          attentionType: x.attentionType || "MANY_EXCEPTIONS",
          inMaintenance: Boolean(x.inMaintenance)
        };
      })
      .sort(function (a, b) { return b.maxValue - a.maxValue; });

    const seen = new Set(fromHealth.map(function (x) { return x.process; }));
    const pool = (model.topProcesses && Array.isArray(model.topProcesses.allProcesses))
      ? model.topProcesses.allProcesses
      : [];

    // Ensure we always have enough process candidates to fill both panels with >=10 each.
    const extras = pool
      .filter(function (name) { return !seen.has(name); })
      .map(function (name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % 9973;
        const maxValue = 6 + (hash % 12); // 6..17
        const level = maxValue >= 11 ? "RED" : (maxValue >= 8 ? "AMBER" : "GREEN");
        return {
          process: name,
          maxValue: maxValue,
          level: level,
          status: (hash % 3 === 0) ? "retired" : "running",
          attentionType: (hash % 2 === 0) ? "MANY_EXCEPTIONS" : "SESSIONS_FAILING",
          inMaintenance: (hash % 2 === 0)
        };
      });

    return fromHealth.concat(extras).sort(function (a, b) { return b.maxValue - a.maxValue; });
  }

  function deriveQueueAction(model) {
    const pending = model.queueState.pending;
    const exception = model.queueState.exception;

    const pNow = pending[pending.length - 1] || 0;
    const pPrev = pending[pending.length - 2] || pNow;
    const pPrev2 = pending[pending.length - 3] || pPrev;
    const eNow = exception[exception.length - 1] || 0;
    const ePrev = exception[exception.length - 2] || eNow;
    const ePrev2 = exception[exception.length - 3] || ePrev;

    const pendingRising = pNow > pPrev && pPrev > pPrev2;
    const exceptionRising = eNow > ePrev && ePrev > ePrev2;

    if (eNow >= 12 || pNow >= 130 || (pendingRising && eNow >= 9) || (exceptionRising && pNow >= 100)) {
      return {
        label: "Action Required",
        levelClass: "queue-action-required",
        reason: "Immediate action: pending " + pNow + ", exceptions " + eNow + " (risk threshold breached)."
      };
    }

    if (eNow >= 8 || pNow >= 100 || pendingRising || exceptionRising) {
      return {
        label: "Watch Closely",
        levelClass: "queue-action-watch",
        reason: "Watch list: pending " + pNow + ", exceptions " + eNow + " (rising but below hard threshold)."
      };
    }

    return {
      label: "Stable",
      levelClass: "queue-action-stable",
      reason: "No immediate action: pending " + pNow + ", exceptions " + eNow + " are within normal band."
    };
  }

  function deriveExceptionsAction(model) {
    const hourly = model.hourlyExceptions.values || [];
    const daily = model.dailyExceptions.values || [];
    if (!hourly.length || !daily.length) {
      return { label: "Stable", levelClass: "queue-action-stable", reason: "Insufficient data to evaluate action." };
    }

    function avg(arr) {
      if (!arr.length) return 0;
      return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
    }

    const hNow = hourly[hourly.length - 1];
    const hPrev = hourly[hourly.length - 2] || hNow;
    const hPrev2 = hourly[hourly.length - 3] || hPrev;
    const hBase = Math.max(1, Math.round(avg(hourly.slice(0, -1))));

    const dNow = daily[daily.length - 1];
    const dPrev = daily[daily.length - 2] || dNow;
    const dPrev2 = daily[daily.length - 3] || dPrev;
    const dBase = Math.max(1, Math.round(avg(daily.slice(0, -1))));

    const hRise3 = hNow > hPrev && hPrev > hPrev2;
    const dRise2 = dNow > dPrev && dPrev > dPrev2;
    const hSpike = hNow >= Math.max(45, Math.round(hBase * 1.55));
    const hAbove = hNow >= Math.round(hBase * 1.25);
    const dAbove = dNow >= Math.round(dBase * 1.15);

    const vsPrev = hNow - hPrev;
    const vsBase = hNow - hBase;

    if (hSpike || (hRise3 && dRise2) || (hAbove && dAbove && hNow >= 32)) {
      return {
        label: "Action Required",
        levelClass: "queue-action-required",
        reason: "Immediate action: hour " + hNow + " (" + (vsPrev >= 0 ? "+" : "") + vsPrev + " vs prev, " + (vsBase >= 0 ? "+" : "") + vsBase + " vs baseline), sustained rise detected."
      };
    }

    if (hAbove || dRise2 || dAbove || (hNow - hPrev >= 10)) {
      return {
        label: "Watch Closely",
        levelClass: "queue-action-watch",
        reason: "Watch list: hour " + hNow + " (" + (vsPrev >= 0 ? "+" : "") + vsPrev + " vs prev, " + (vsBase >= 0 ? "+" : "") + vsBase + " vs baseline), upward pressure building."
      };
    }

    return {
      label: "Stable",
      levelClass: "queue-action-stable",
      reason: "No immediate action: hour " + hNow + " is within normal band (baseline " + hBase + ")."
    };
  }

  function evaluateAlertPolicy(model, thresholds, redCardsForCrisis) {
    const funnelDrop = model.handoffFunnel.values[0] - model.handoffFunnel.values[2];
    const processRed = model.processHealth.filter(function (x) { return x.exceptionRate > thresholds.exceptionRate.red; }).length;

    const burstOverBandCount = model.burstDetector.values.reduce(function (acc, val, i) {
      return acc + (val > model.burstDetector.upper[i] ? 1 : 0);
    }, 0);

    const aging60 = model.queueAging.values[3];
    const env60 = model.rootCauseSplit.environment[2];
    const code60 = model.rootCauseSplit.code[2];
    const infraDominant = env60 > code60;

    const signals = [];
    if (funnelDrop >= thresholds.funnelDrop.red) signals.push({ key: "funnel", level: "RED" });
    else if (funnelDrop >= thresholds.funnelDrop.amber) signals.push({ key: "funnel", level: "AMBER" });

    if (processRed > 0) signals.push({ key: "process-quality", level: "RED" });

    if (aging60 >= thresholds.aging60plus.red) signals.push({ key: "aging", level: "RED" });
    else if (aging60 >= thresholds.aging60plus.amber) signals.push({ key: "aging", level: "AMBER" });

    if (burstOverBandCount >= thresholds.burstOverBand.red) signals.push({ key: "burst", level: "RED" });
    else if (burstOverBandCount >= thresholds.burstOverBand.amber) signals.push({ key: "burst", level: "AMBER" });

    if (infraDominant && env60 >= 12) signals.push({ key: "infrastructure", level: env60 >= 18 ? "RED" : "AMBER" });

    const redCount = signals.filter(function (s) { return s.level === "RED"; }).length;
    const amberCount = signals.filter(function (s) { return s.level === "AMBER"; }).length;

    let alertState = "GREEN";
    if (redCount >= redCardsForCrisis) alertState = "RED";
    else if (redCount === 1 || amberCount > 0) alertState = "AMBER";

    const infraSignal = signals.some(function (s) { return s.key === "infrastructure"; });
    let actionOwner = "Controllers monitor";
    if (alertState === "AMBER") {
      actionOwner = infraSignal ? "Controllers + Infrastructure" : "Controllers take action";
    }
    if (alertState === "RED") {
      actionOwner = infraSignal ? "Developers + Infrastructure (PO oversight)" : "Developers immediate (PO oversight)";
    }

    return {
      alertState,
      actionOwner,
      redCount,
      amberCount,
      signals
    };
  }

  function updateRefreshCountdown() {
    if (!runtime.nextRefreshAt) return;
    const ms = Math.max(0, runtime.nextRefreshAt - Date.now());
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    state.nextRefreshLabel = "Next refresh: " + String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
    window.RPA.renderers.updateBanner(state);
  }

  function scheduleRefresh() {
    if (runtime.refreshTimer) clearInterval(runtime.refreshTimer);
    runtime.refreshTimer = setInterval(renderCycle, window.RPA.config.refreshMs);

    if (runtime.refreshCountdownTimer) clearInterval(runtime.refreshCountdownTimer);
    runtime.refreshCountdownTimer = setInterval(updateRefreshCountdown, 1000);

    runtime.nextRefreshAt = Date.now() + window.RPA.config.refreshMs;
    updateRefreshCountdown();
  }

  function updateHeaderClocks() {
    const vilniusNow = luxon.DateTime.now().setZone("Europe/Vilnius");
    const costaRicaNow = luxon.DateTime.now().setZone("America/Costa_Rica");
    const isDay = function (dt) {
      const h = dt.hour;
      return h >= 7 && h < 19;
    };
    window.RPA.renderers.renderTimestamp({
      vilnius: vilniusNow.toFormat("HH:mm:ss"),
      costaRica: costaRicaNow.toFormat("HH:mm:ss"),
      vilniusDay: isDay(vilniusNow),
      costaRicaDay: isDay(costaRicaNow)
    });
  }

  function scheduleHeaderClocks() {
    if (runtime.clockTimer) clearInterval(runtime.clockTimer);
    updateHeaderClocks();
    runtime.clockTimer = setInterval(updateHeaderClocks, 1000);
  }

  function renderCycle() {
    state.errors = [];
    const nowLocal = luxon.DateTime.now().setZone(window.RPA.config.timezone);
    updateHeaderClocks();

    const model = callSafe("build-model", function () {
      return window.RPA.data.buildDashboardModel(nowLocal, window.RPA.config.seed);
    });

    if (!model) {
      state.renderStatus = "failed";
      window.RPA.renderers.updateBanner(state);
      return;
    }

    runtime.model = model;

    const issues = window.RPA.data.validateModel(model);
    if (issues.length) issues.forEach(function (x) { recordError("validate", new Error(x)); });

    callSafe("render-lists", function () { window.RPA.renderers.renderLists(model); });
    callSafe("render-alerts-tickets", function () { window.RPA.renderers.renderAlertsAndTickets(model); });
    callSafe("render-robot-counts", function () { window.RPA.renderers.renderRobotCounts(model); });

    callSafe("render-lines", function () { window.RPA.charts.drawLineCharts(model); });
    callSafe("render-queue-state", function () { window.RPA.charts.drawQueueStateChart(model); });
    callSafe("render-donut", function () { window.RPA.charts.drawDonut(model); });
    callSafe("render-funnel", function () { window.RPA.charts.drawFunnel(model); });
    callSafe("render-root-cause", function () { window.RPA.charts.drawRootCauseSplit(model); });
    callSafe("render-queue-aging", function () { window.RPA.charts.drawQueueAging(model); });
    callSafe("render-session-outcome", function () { window.RPA.charts.drawSessionOutcomeChart(model); });
    callSafe("render-burst", function () { window.RPA.charts.drawBurstDetector(model); });

    const slopeStats = callSafe("render-slope", function () { return window.RPA.charts.drawSlope(model, getSlopeMode()); }) || { improved: 0, worsened: 0, unchanged: 0, newToday: 0, resolved: 0, rows: [], newList: [], resolvedList: [] };
    setSlopeKpis(slopeStats);
    callSafe("render-dumbbell", function () { window.RPA.charts.drawDumbbell(model); });
    callSafe("render-heatmap", function () { window.RPA.charts.drawOutOfBoundsHeatmap(model); });
    callSafe("render-schedule-activity", function () { window.RPA.charts.drawScheduleActivityChart(model); });

    const summaries = buildSummaries(model, slopeStats);
    callSafe("render-summaries", function () { window.RPA.renderers.writeSummaries(summaries); });

    const policy = evaluateAlertPolicy(model, window.RPA.config.thresholds, window.RPA.config.redCardsForCrisis);
    state.alertState = policy.alertState;
    state.actionOwner = policy.actionOwner;

    const breaches = deriveBreachProcesses(model, window.RPA.config.thresholds);
    callSafe("render-breach-focus", function () { window.RPA.renderers.renderBreachFocus(breaches); });
    const exceptionsAction = deriveExceptionsAction(model);
    callSafe("render-exceptions-action", function () { window.RPA.renderers.renderExceptionsAction(exceptionsAction); });
    const queueAction = deriveQueueAction(model);
    callSafe("render-queue-action", function () { window.RPA.renderers.renderQueueAction(queueAction); });
    const announcements = deriveCriticalAnnouncements(policy);
    callSafe("render-critical-announcements", function () {
      window.RPA.renderers.renderCriticalAnnouncements(announcements, !!window.RPA.config.forceFreezeAnnouncement);
    });

    if (state.errors.length) {
      state.renderStatus = "Degraded";
    } else if (state.alertState === "RED") {
      state.renderStatus = "Critical";
    } else if (state.alertState === "AMBER") {
      state.renderStatus = "Good";
    } else {
      state.renderStatus = "Healthy";
    }
    setBodyStateClass(state.alertState);
    window.RPA.renderers.updateBanner(state);
    applyMaintenanceThresholds();
    runtime.nextRefreshAt = Date.now() + window.RPA.config.refreshMs;
    updateRefreshCountdown();
  }

  function smokeTest(model) {
    const checks = [];
    checks.push({ name: "model-valid", pass: window.RPA.data.validateModel(model).length === 0 });
    checks.push({ name: "has-slope-node", pass: !!document.getElementById("slope") });
    checks.push({ name: "has-donut-node", pass: !!document.getElementById("nestedDonut") });
    checks.push({ name: "has-funnel-node", pass: !!document.getElementById("funnelChart") });
    checks.push({ name: "has-heatmap-node", pass: !!document.getElementById("heatmapChart") });
    checks.push({ name: "has-alert-state", pass: !!document.getElementById("alertState") });
    checks.push({ name: "errors-empty", pass: state.errors.length === 0 });
    return checks;
  }

  function init() {
    if (typeof luxon === "undefined") {
      state.dependencyStatus = "luxon missing";
      state.renderStatus = "failed";
      window.RPA.renderers.updateBanner(state);
      return;
    }

    state.dependencyStatus = [
      typeof Chart !== "undefined" ? "Chart.js ok" : "Chart.js missing",
      typeof d3 !== "undefined" ? "d3 ok" : "d3 missing",
      typeof luxon !== "undefined" ? "luxon ok" : "luxon missing"
    ].join(" | ");

    renderCountdown();
    scheduleHeaderClocks();
    renderCycle();
    scheduleRefresh();

    window.rpaDashboard = {
      smokeTest: function () { return runtime.model ? smokeTest(runtime.model) : [{ name: "model-ready", pass: false }]; },
      getState: function () { return state; },
      getModel: function () { return runtime.model; },
      forceRefresh: function () { renderCycle(); }
    };

    const announcementToggle = document.getElementById("announcementToggle");
    if (announcementToggle) {
      announcementToggle.checked = !!window.RPA.config.forceCriticalAnnouncement;
      announcementToggle.addEventListener("change", function () {
        window.RPA.config.forceCriticalAnnouncement = announcementToggle.checked;
        renderCycle();
      });
    }
    const freezeToggle = document.getElementById("freezeToggle");
    if (freezeToggle) {
      freezeToggle.checked = !!window.RPA.config.forceFreezeAnnouncement;
      freezeToggle.addEventListener("change", function () {
        window.RPA.config.forceFreezeAnnouncement = freezeToggle.checked;
        renderCycle();
      });
    }

    syncSlopeButtons();
    syncExceptionsButtons();
    syncExceptionsView();
    document.querySelectorAll(".slope-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        runtime.slopeMode = btn.dataset.mode || "yesterday";
        syncSlopeButtons();
        if (!runtime.model) return;
        renderSlopeForCurrentMode("render-slope-mode-switch");
        scheduleSlopeAutoCycle();
      });
    });
    document.querySelectorAll(".exceptions-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        runtime.exceptionsMode = btn.dataset.mode || "hourly";
        syncExceptionsButtons();
        syncExceptionsView();
        scheduleExceptionsAutoCycle();
      });
    });
    scheduleSlopeAutoCycle();
    scheduleExceptionsAutoCycle();

    window.addEventListener("resize", function () {
      clearTimeout(runtime.resizeTimer);
      runtime.resizeTimer = setTimeout(function () {
        if (!runtime.model) return;
        renderSlopeForCurrentMode("rerender-slope");
        callSafe("rerender-dumbbell", function () { window.RPA.charts.drawDumbbell(runtime.model); });
        callSafe("rerender-heatmap", function () { window.RPA.charts.drawOutOfBoundsHeatmap(runtime.model); });
        callSafe("rerender-schedule-activity", function () { window.RPA.charts.drawScheduleActivityChart(runtime.model); });
      }, 150);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
