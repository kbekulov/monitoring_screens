(function () {
  function fmtInt(n) {
    return new Intl.NumberFormat().format(n);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updateBanner(state) {
    setText("renderStatus", state.renderStatus);
    setText("alertState", state.alertState || "GREEN");
    setText("errorCount", String(state.errors.length));
    setText("nextRefresh", state.nextRefreshLabel || "Next refresh: pending...");
  }

  function renderLists(model) {
    const listMost = document.getElementById("listMost");
    const listBreaching = document.getElementById("listBreaching");
    listMost.innerHTML = "";
    listBreaching.innerHTML = "";

    model.topProcesses.byExceptions.forEach(function (it, i) {
      const li = document.createElement("li");
      li.className = "d-flex justify-content-between align-items-center";
      li.innerHTML = '<div class="d-flex align-items-center gap-2"><span class="badge text-bg-dark">' + (i + 1) + '</span><span>' + it.name + '</span></div><span class="kpi-pill">' + fmtInt(it.count) + '</span>';
      listMost.appendChild(li);
    });

    model.topProcesses.byBreaching.forEach(function (it, i) {
      const li = document.createElement("li");
      li.className = "d-flex justify-content-between align-items-center";
      li.innerHTML = '<div class="d-flex align-items-center gap-2"><span class="badge text-bg-dark">' + (i + 1) + '</span><span>' + it.name + '</span></div><span class="d-flex align-items-center gap-2"><span class="status-badge ' + (it.level === "RED" ? 'red' : 'amber') + '">' + it.level + '</span><span class="kpi-pill">' + Math.round(it.exceptionRate * 100) + '%</span></span>';
      listBreaching.appendChild(li);
    });
  }

  function renderAlertsAndTickets(model) {
    const alertsGroupedList = document.getElementById("alertsGroupedList");
    const ticketsLane = document.getElementById("ticketsLane");
    const breachedCount = document.getElementById("alertsBreachedCount");
    const atRiskCount = document.getElementById("alertsAtRiskCount");
    const onTrackCount = document.getElementById("alertsOnTrackCount");
    const nextAction = document.getElementById("alertsNextAction");
    if (!alertsGroupedList || !ticketsLane) return;

    alertsGroupedList.innerHTML = "";
    ticketsLane.innerHTML = "";

    const grouped = {};
    model.alerts.forEach(function (a) {
      const parts = a.split(" - ");
      const alertType = parts[1] || a;
      grouped[alertType] = (grouped[alertType] || 0) + 1;
    });

    Object.keys(grouped)
      .sort(function (a, b) { return grouped[b] - grouped[a]; })
      .forEach(function (key, i) {
        const li = document.createElement("li");
        li.className = "d-flex justify-content-between align-items-center";
        li.innerHTML = '<div class="d-flex align-items-center gap-2"><span class="badge text-bg-dark">' + (i + 1) + '</span><span>' + key + '</span></div><span class="alert-count-chip">' + grouped[key] + '</span>';
        alertsGroupedList.appendChild(li);
      });

    function getSlaStatus(ticket) {
      if (ticket.days >= 20) return "breached";
      if (ticket.days >= 12) return "at-risk";
      return "on-track";
    }

    const enriched = model.tickets.map(function (t) {
      const status = getSlaStatus(t);
      const score = (status === "breached" ? 300 : (status === "at-risk" ? 150 : 0)) + t.days;
      return {
        key: t.key,
        title: t.title,
        days: t.days,
        owner: t.owner || "NA",
        lastUpdateHours: Number.isFinite(t.lastUpdateHours) ? t.lastUpdateHours : 0,
        status,
        score
      };
    }).sort(function (a, b) { return b.score - a.score; });

    const counts = enriched.reduce(function (acc, t) {
      if (t.status === "breached") acc.breached += 1;
      else if (t.status === "at-risk") acc.atRisk += 1;
      else acc.onTrack += 1;
      return acc;
    }, { breached: 0, atRisk: 0, onTrack: 0 });

    if (breachedCount) breachedCount.textContent = String(counts.breached);
    if (atRiskCount) atRiskCount.textContent = String(counts.atRisk);
    if (onTrackCount) onTrackCount.textContent = String(counts.onTrack);

    if (nextAction && enriched.length) {
      const top = enriched[0];
      nextAction.textContent = "Next action now: " + top.key + " (" + top.status.replace("-", " ") + "), owner " + top.owner + ", unresolved " + top.days + "d.";
    }

    enriched.forEach(function (t) {
      const row = document.createElement("div");
      row.className = "ticket-lane-row " + t.status;
      row.innerHTML = '<div class="ticket-lane-marker"></div>' +
        '<div><div class="ticket-lane-title">' + t.key + " - " + t.title + '</div><div class="ticket-lane-meta">Owner: ' + t.owner + " | Last update: " + t.lastUpdateHours + 'h ago</div></div>' +
        '<div class="ticket-lane-right"><span class="ticket-lane-status ' + t.status + '">' + (t.status === "at-risk" ? "At risk" : (t.status === "on-track" ? "On track" : "Breached")) + '</span><div class="ticket-lane-meta mt-1">' + t.days + "d unresolved</div></div>";
      ticketsLane.appendChild(row);
    });
  }

  function renderRobotCounts(model) {
    setText("todayRunning", fmtInt(model.robots.today.running));
    setText("todayRetired", fmtInt(model.robots.today.retired));
    setText("ydayRunning", fmtInt(model.robots.yesterday.running));
    setText("ydayRetired", fmtInt(model.robots.yesterday.retired));
  }

  function writeSummaries(summary) {
    setText("summarySlope", summary.slope);
    setText("summaryHourly", summary.hourly);
    setText("summaryDaily", summary.daily);
    setText("summaryQueueState", summary.queueState);
    setText("summaryDonut", summary.donut);
    setText("summaryDumbbell", summary.dumbbell);
    setText("summaryFunnel", summary.funnel);
    setText("summaryHeatmap", summary.heatmap);
    setText("summaryRootCause", summary.rootCause);
    setText("summarySessionOutcome", summary.sessionOutcome);
    setText("summaryQueueAging", summary.queueAging);
    setText("summaryBurst", summary.burst);
    setText("summaryScheduleActivity", summary.scheduleActivity);
  }

  function renderTimestamp(ts) {
    if (ts && typeof ts === "object") {
      setText("asOfVilnius", ts.vilnius || "--:--:--");
      setText("asOfCostaRica", ts.costaRica || "--:--:--");
      const vilniusIcon = document.getElementById("asOfVilniusIcon");
      const costaRicaIcon = document.getElementById("asOfCostaRicaIcon");
      if (vilniusIcon) {
        const day = !!ts.vilniusDay;
        vilniusIcon.className = "bi " + (day ? "bi-sun-fill" : "bi-moon-stars-fill") + " ms-2";
      }
      if (costaRicaIcon) {
        const day = !!ts.costaRicaDay;
        costaRicaIcon.className = "bi " + (day ? "bi-sun-fill" : "bi-moon-stars-fill") + " ms-2";
      }
      return;
    }
    setText("asOfVilnius", ts || "--:--:--");
    setText("asOfCostaRica", "--:--:--");
  }

  function renderBreachFocus(items) {
    const maintenanceHost = document.getElementById("maintenanceProcesses");
    const potentialHost = document.getElementById("potentialProcesses");

    function pickBalanced(list, count, isGroupA) {
      const groupA = list.filter(isGroupA);
      const groupB = list.filter(function (x) { return !isGroupA(x); });
      const targetA = Math.floor(count / 2);
      const targetB = count - targetA;

      const selected = [];
      selected.push.apply(selected, groupA.slice(0, targetA));
      selected.push.apply(selected, groupB.slice(0, targetB));

      if (selected.length < count) {
        const seen = new Set(selected.map(function (x) { return x.process; }));
        const rest = list.filter(function (x) { return !seen.has(x.process); });
        selected.push.apply(selected, rest.slice(0, count - selected.length));
      }

      return selected;
    }

    function renderList(target, list) {
      if (!target) return;
      target.innerHTML = "";
      if (!list.length) {
        target.innerHTML = '<span class="mini-muted">none</span>';
        return;
      }
      list.forEach(function (item) {
        const chip = document.createElement("span");
        let levelClass = item.level === "RED" ? "red" : "amber";
        if (target.id === "potentialProcesses") levelClass = "potential";
        chip.className = "breach-chip " + levelClass;
        if (target.id === "maintenanceProcesses") {
          chip.classList.add("maintenance-chip");
          const icon = document.createElement("i");
          const isRetired = (item.status || "").toLowerCase() === "retired";
          chip.classList.add(isRetired ? "maintenance-retired" : "maintenance-running");
          icon.className = "bi " + (isRetired ? "bi-pause-circle-fill status-icon status-retired" : "bi-play-circle-fill status-icon status-running");
          icon.setAttribute("aria-hidden", "true");
          chip.appendChild(icon);
        }
        if (target.id === "potentialProcesses") {
          chip.classList.add("potential-chip");
          const warning = document.createElement("i");
          const isSessionFail = item.attentionType === "SESSIONS_FAILING";
          chip.classList.add(isSessionFail ? "potential-session-fail" : "potential-many");
          warning.className = "bi " + (isSessionFail ? "bi-exclamation-octagon-fill status-icon status-session-fail" : "bi-graph-up-arrow status-icon status-many");
          warning.setAttribute("aria-hidden", "true");
          chip.appendChild(warning);
        }
        const hideRate = target.id === "maintenanceProcesses" || target.id === "potentialProcesses";
        chip.appendChild(document.createTextNode(hideRate ? item.process : (item.process + " (" + item.maxValue + "% exceptions)")));
        target.appendChild(chip);
      });
    }

    const list = items || [];
    const maintenance = list.filter(function (x) { return x.inMaintenance; });
    const potential = list.filter(function (x) { return !x.inMaintenance; });
    const sharedCount = Math.min(7, maintenance.length, potential.length);
    const balancedMaintenance = pickBalanced(maintenance, sharedCount, function (x) {
      return (x.status || "").toLowerCase() === "retired";
    });
    const balancedPotential = pickBalanced(potential, sharedCount, function (x) {
      return x.attentionType === "SESSIONS_FAILING";
    });

    renderList(maintenanceHost, balancedMaintenance);
    renderList(potentialHost, balancedPotential);
  }

  function renderQueueAction(action) {
    const badge = document.getElementById("queueActionBadge");
    const reason = document.getElementById("queueActionReason");
    if (!badge || !reason || !action) return;

    badge.classList.remove("queue-action-required", "queue-action-watch", "queue-action-stable");
    badge.classList.add(action.levelClass);
    badge.textContent = action.label;
    reason.textContent = action.reason;
  }

  function renderExceptionsAction(action) {
    const badge = document.getElementById("exceptionsActionBadge");
    const reason = document.getElementById("exceptionsActionReason");
    if (!badge || !reason || !action) return;

    badge.classList.remove("queue-action-required", "queue-action-watch", "queue-action-stable");
    badge.classList.add(action.levelClass);
    badge.textContent = action.label;
    reason.textContent = action.reason;
  }

  function renderCriticalAnnouncements(items, showFreeze) {
    const host = document.getElementById("criticalAnnouncement");
    const text = document.getElementById("criticalAnnouncementText");
    const freezeHost = document.getElementById("freezeAnnouncement");
    if (!host || !text) return;

    text.textContent = "";
    if (!items || !items.length) {
      host.classList.add("d-none");
      if (freezeHost) freezeHost.classList.toggle("d-none", !showFreeze);
      return;
    }

    const top = items[0];
    text.textContent = top.title || "";
    host.classList.remove("d-none");
    if (freezeHost) freezeHost.classList.toggle("d-none", !showFreeze);
  }

  window.RPA = window.RPA || {};
  window.RPA.renderers = {
    updateBanner,
    renderLists,
    renderAlertsAndTickets,
    renderRobotCounts,
    writeSummaries,
    renderTimestamp,
    renderBreachFocus,
    renderCriticalAnnouncements,
    renderQueueAction,
    renderExceptionsAction
  };
})();
