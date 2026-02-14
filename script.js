(() => {
  const APP_CONFIG = {
    displayZone: "Europe/Vilnius"
  };

  function fmtInt(n) {
    return new Intl.NumberFormat().format(n);
  }

  function seededRandom(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function safeRun(fn, fallbackTargetId, message) {
    try {
      fn();
    } catch (_err) {
      if (fallbackTargetId) {
        const el = document.getElementById(fallbackTargetId);
        if (el) el.innerHTML = `<div class="mini-muted">${message}</div>`;
      }
    }
  }

  const luxonOk = typeof luxon !== "undefined";
  const chartOk = typeof Chart !== "undefined";
  const d3Ok = typeof d3 !== "undefined";

  if (!luxonOk) {
    document.getElementById("asOf").textContent = "Time unavailable";
    return;
  }

  const { DateTime, Duration } = luxon;
  const nowLocal = DateTime.now().setZone(APP_CONFIG.displayZone);
  document.getElementById("asOf").textContent = nowLocal.toFormat(`yyyy-LL-dd HH:mm '${APP_CONFIG.displayZone}'`);
  const rng = seededRandom(parseInt(nowLocal.toFormat("yyyyLLdd"), 10));

  const ydayTop = [
    "NullReferenceException", "TimeoutException", "AuthFailed", "DbDeadlock",
    "FileNotFound", "SchemaMismatch", "RateLimit", "ParseError",
    "SocketHangup", "DiskQuota"
  ];

  const todayTop = [
    "TimeoutException", "NullReferenceException", "DbDeadlock", "RateLimit",
    "AuthFailed", "ParseError", "SchemaMismatch", "CacheMiss",
    "DiskQuota", "SocketHangup"
  ];

  function buildRankMap(arr) {
    const m = new Map();
    arr.forEach((name, i) => m.set(name, i + 1));
    return m;
  }

  const yRank = buildRankMap(ydayTop);
  const tRank = buildRankMap(todayTop);
  const shared = todayTop.filter((n) => yRank.has(n)).map((n) => ({
    name: n,
    yday: yRank.get(n),
    today: tRank.get(n),
    elevated: tRank.get(n) < yRank.get(n)
  }));

  function renderSlope() {
    if (!d3Ok) {
      document.getElementById("slope").innerHTML = '<div class="mini-muted">Slope graph unavailable.</div>';
      return;
    }

    const container = document.getElementById("slope");
    container.innerHTML = "";

    const w = container.clientWidth || 1100;
    const h = 360;
    const margin = { top: 18, right: 18, bottom: 18, left: 18 };

    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
    const xRank = margin.left + 6;
    const xLeft = Math.max(200, w * 0.22);
    const xRight = w - Math.max(140, w * 0.2);
    const y = d3.scaleLinear().domain([1, 10]).range([margin.top, h - margin.bottom]);

    svg.append("g").selectAll("line")
      .data(d3.range(1, 11))
      .join("line")
      .attr("x1", margin.left)
      .attr("x2", w - margin.right)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "rgba(0,0,0,.06)");

    svg.append("text").attr("x", xLeft).attr("y", 14).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#64748b").text("Yesterday");
    svg.append("text").attr("x", xRight).attr("y", 14).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#64748b").text("Today");

    svg.append("g").selectAll("text")
      .data(d3.range(1, 11))
      .join("text")
      .attr("class", "slope-rank")
      .attr("x", xRank)
      .attr("y", (d) => y(d) + 4)
      .attr("text-anchor", "start")
      .text((d) => `#${d}`);

    svg.append("g").selectAll("line")
      .data(shared)
      .join("line")
      .attr("x1", xLeft)
      .attr("y1", (d) => y(d.yday))
      .attr("x2", xRight)
      .attr("y2", (d) => y(d.today))
      .attr("class", (d) => (d.elevated ? "slope-line-up" : "slope-line-stable"));

    svg.append("g").selectAll("circle")
      .data(shared)
      .join("circle")
      .attr("cx", xLeft)
      .attr("cy", (d) => y(d.yday))
      .attr("r", 4)
      .attr("class", "slope-dot");

    svg.append("g").selectAll("circle")
      .data(shared)
      .join("circle")
      .attr("cx", xRight)
      .attr("cy", (d) => y(d.today))
      .attr("r", 4)
      .attr("fill", "#0f172a");

    svg.append("g").selectAll("text.labelRight")
      .data(shared)
      .join("text")
      .attr("class", "slope-label")
      .attr("x", xRight + 10)
      .attr("y", (d) => y(d.today) + 4)
      .attr("text-anchor", "start")
      .text((d) => d.name);
  }

  function zigzagSeries(n, startMin, startMax, stepMin, stepMax, spikeChance, spikeMin, spikeMax) {
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

  function makeHourlyData() {
    const hourNow = nowLocal.hour;
    const labels = [];
    for (let h = 0; h <= hourNow; h++) labels.push(String(h).padStart(2, "0") + ":00");
    return { labels, data: zigzagSeries(labels.length, 10, 30, 6, 22, 0.28, 18, 55) };
  }

  function makeDailyData(days) {
    const labels = [];
    for (let d = 1; d <= days; d++) labels.push(String(d).padStart(2, "0"));
    return { labels, data: zigzagSeries(labels.length, 140, 260, 35, 95, 0.22, 90, 220) };
  }

  function renderLineCharts() {
    if (!chartOk) return;
    const hourly = makeHourlyData();
    const daily = makeDailyData(nowLocal.day);

    new Chart(document.getElementById("hourlyLine"), {
      type: "line",
      data: { labels: hourly.labels, datasets: [{ label: "Exceptions (hourly)", data: hourly.data, tension: 0.25, pointRadius: 2, borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
        scales: { x: { grid: { color: "rgba(0,0,0,.06)" } }, y: { grid: { color: "rgba(0,0,0,.06)" }, title: { display: true, text: "Exceptions" } } }
      }
    });

    new Chart(document.getElementById("dailyLine"), {
      type: "line",
      data: { labels: daily.labels, datasets: [{ label: "Exceptions (daily)", data: daily.data, tension: 0.25, pointRadius: 2, borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
        scales: {
          x: { grid: { color: "rgba(0,0,0,.06)" }, title: { display: true, text: "Day of month" } },
          y: { grid: { color: "rgba(0,0,0,.06)" }, title: { display: true, text: "Exceptions" } }
        }
      }
    });
  }

  function fillLists() {
    const processes = ["InvoiceBot", "PayrollRunner", "ClaimsHarvester", "EmailTriage", "SAPSync", "OrderReconciler", "KYCExtractor", "ReportMailer", "RefundProcessor", "ContractParser"];

    const most = processes.map((p) => ({ name: p, count: Math.floor(50 + rng() * 220) })).sort((a, b) => b.count - a.count).slice(0, 7);
    const variability = processes.map((p) => {
      const mean = 20 + rng() * 100;
      const sd = 5 + rng() * 60;
      return { name: p, score: Math.round((sd / mean) * 100) };
    }).sort((a, b) => b.score - a.score).slice(0, 7);

    function fillList(id, items, rightLabel) {
      const ul = document.getElementById(id);
      ul.innerHTML = "";
      items.forEach((it, i) => {
        const li = document.createElement("li");
        li.className = "d-flex justify-content-between align-items-center";
        li.innerHTML = `<div class=\"d-flex align-items-center gap-2\"><span class=\"badge text-bg-dark\">${i + 1}</span><span>${it.name}</span></div><span class=\"kpi-pill\">${rightLabel(it)}</span>`;
        ul.appendChild(li);
      });
    }

    fillList("listMost", most, (it) => `${fmtInt(it.count)} exceptions`);
    fillList("listVar", variability, (it) => `${it.score}% volatility`);
  }

  function renderDonut() {
    if (!chartOk) return;
    const yday = { running: Math.floor(60 + rng() * 30), retired: Math.floor(25 + rng() * 20) };
    const today = { running: Math.floor(60 + rng() * 30), retired: Math.floor(10 + rng() * 20) };

    document.getElementById("todayRunning").textContent = fmtInt(today.running);
    document.getElementById("todayRetired").textContent = fmtInt(today.retired);
    document.getElementById("ydayRunning").textContent = fmtInt(yday.running);
    document.getElementById("ydayRetired").textContent = fmtInt(yday.retired);

    if (window.__nestedDonutChart) window.__nestedDonutChart.destroy();

    window.__nestedDonutChart = new Chart(document.getElementById("nestedDonut"), {
      type: "doughnut",
      data: {
        labels: ["Retired", "Running"],
        datasets: [
          { label: "Today", data: [today.retired, today.running], backgroundColor: ["rgba(47, 53, 66, 1)", "rgba(79, 142, 247, 1)"], borderWidth: 0, hoverOffset: 6, radius: "52%" },
          { label: "Yesterday", data: [yday.retired, yday.running], backgroundColor: ["rgba(47, 53, 66, 0.55)", "rgba(79, 142, 247, 0.55)"], borderWidth: 0, hoverOffset: 6, radius: "98%" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "54%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.label} = ${fmtInt(ctx.parsed)}` } }
        }
      }
    });
  }

  const squads = ["Baymax", "WALL-E", "ATOM", "Awesom-O", "JARVIS", "Bender"];
  const invertSet = new Set(squads.slice().sort(() => rng() - 0.5).slice(0, 2));
  const dumbData = squads.map((s) => {
    const lastMonth = Math.floor(40 + rng() * 160);
    let todayVal = Math.max(5, Math.round(lastMonth * (0.75 + rng() * 0.7)));
    if (invertSet.has(s)) todayVal = Math.max(5, Math.round(lastMonth * (0.35 + rng() * 0.35)));
    return { squad: s, lastMonth, today: todayVal };
  });

  function renderDumbbell() {
    if (!d3Ok) {
      document.getElementById("dumbbell").innerHTML = '<div class="mini-muted">Dumbbell chart unavailable.</div>';
      return;
    }

    const host = document.getElementById("dumbbell");
    host.innerHTML = "";

    const w = host.clientWidth || 1100;
    const h = 360;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };

    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${w} ${h}`).style("width", "100%").style("height", "360px");
    const x = d3.scaleBand().domain(dumbData.map((d) => d.squad)).range([margin.left, w - margin.right]).padding(0.35);
    const yMax = d3.max(dumbData, (d) => Math.max(d.lastMonth, d.today)) || 1;
    const y = d3.scaleLinear().domain([0, yMax * 1.15]).nice().range([h - margin.bottom, margin.top]);

    svg.append("g").attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickSize(-(w - margin.left - margin.right)).tickFormat(d3.format("~s")))
      .call((g) => g.selectAll(".tick line").attr("stroke", "rgba(0,0,0,.06)"))
      .call((g) => g.select(".domain").remove());

    svg.append("text").attr("x", margin.left).attr("y", 12).attr("fill", "#64748b").attr("font-size", 12).text("total problems by squad");

    svg.append("g").attr("transform", `translate(0,${h - margin.bottom})`).call(d3.axisBottom(x)).call((g) => g.select(".domain").attr("stroke", "rgba(0,0,0,.15)"));

    svg.append("g").selectAll("line.dline").data(dumbData).join("line")
      .attr("x1", (d) => x(d.squad) + x.bandwidth() / 2)
      .attr("x2", (d) => x(d.squad) + x.bandwidth() / 2)
      .attr("y1", (d) => y(d.lastMonth))
      .attr("y2", (d) => y(d.today))
      .attr("stroke", "rgba(0,0,0,.35)")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round");

    svg.append("g").selectAll("circle.last").data(dumbData).join("circle")
      .attr("cx", (d) => x(d.squad) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d.lastMonth))
      .attr("r", 7)
      .attr("fill", "#111");

    svg.append("g").selectAll("circle.today").data(dumbData).join("circle")
      .attr("cx", (d) => x(d.squad) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d.today))
      .attr("r", 7)
      .attr("fill", "#fff")
      .attr("stroke", "#111")
      .attr("stroke-width", 2);

    svg.append("g").selectAll("text.v").data(dumbData).join("text")
      .attr("x", (d) => x(d.squad) + x.bandwidth() / 2)
      .attr("y", (d) => Math.min(y(d.lastMonth), y(d.today)) - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#64748b")
      .text((d) => `${d.today} today | ${d.lastMonth} last mo`);
  }

  function renderBarLine() {
    if (!chartOk) return;
    const weeks = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8"];
    const cases = weeks.map(() => Math.floor(120 + rng() * 220));
    const sessions = weeks.map(() => Math.floor(300 + rng() * 600));

    new Chart(document.getElementById("barLine"), {
      data: {
        labels: weeks,
        datasets: [
          { type: "bar", label: "Cases completed", data: cases, borderWidth: 1, yAxisID: "yCases" },
          { type: "line", label: "Sessions run", data: sessions, tension: 0.25, pointRadius: 3, borderWidth: 2, yAxisID: "ySessions" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { grid: { color: "rgba(0,0,0,.06)" } },
          yCases: { position: "left", title: { display: true, text: "Cases" }, grid: { color: "rgba(0,0,0,.06)" } },
          ySessions: { position: "right", title: { display: true, text: "Sessions" }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  function fillAlertsAndTickets() {
    const alerts = Array.from({ length: 10 }, (_, i) => `Alert #${i + 1} - ${["Queue backlog", "Credential lockout", "OCR mismatch", "HTTP 500 spike", "DB latency", "Vendor timeout", "Bot stuck", "Retry storm"][Math.floor(rng() * 8)]}`);

    const alertsList = document.getElementById("alertsList");
    alertsList.innerHTML = "";
    alerts.forEach((a) => {
      const li = document.createElement("li");
      const [left, right] = a.split(" - ");
      li.innerHTML = `<span class=\"fw-semibold\">${left}</span> <span class=\"mini-muted\">- ${right}</span>`;
      alertsList.appendChild(li);
    });

    const tickets = [
      { key: "RPA-6786", days: Math.floor(8 + rng() * 35), title: "InvoiceBot failing on upload step" },
      { key: "RPA-2983", days: Math.floor(8 + rng() * 35), title: "SAPSync intermittent auth errors" },
      { key: "RPA-3948", days: Math.floor(8 + rng() * 35), title: "ClaimsHarvester parse drift" },
      { key: "RPA-1022", days: Math.floor(8 + rng() * 35), title: "EmailTriage rate limit bursts" },
      { key: "RPA-5510", days: Math.floor(8 + rng() * 35), title: "OrderReconciler deadlocks" }
    ].sort((a, b) => b.days - a.days);

    const maxDays = Math.max(...tickets.map((t) => t.days));
    const tbody = document.getElementById("ticketsTbody");
    tbody.innerHTML = "";

    tickets.forEach((t) => {
      const pct = Math.round((t.days / maxDays) * 100);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><div class=\"fw-semibold\">${t.key}</div><div class=\"mini-muted\">${t.title}</div></td><td><div class=\"progress slim\" role=\"progressbar\" aria-valuenow=\"${pct}\" aria-valuemin=\"0\" aria-valuemax=\"100\"><div class=\"progress-bar\" style=\"width:${pct}%\"></div></div></td><td class=\"text-end fw-semibold\">${t.days}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderCountdown() {
    function makeTarget(zone, plusDays) {
      return DateTime.now().setZone(zone).plus({ days: plusDays }).startOf("hour").plus({ hours: 1 });
    }

    const targetReston = makeTarget("America/New_York", 2);
    const targetChicago = makeTarget("America/Chicago", 3);

    document.getElementById("restonTarget").textContent = "Target: " + targetReston.toFormat("yyyy-LL-dd HH:mm ZZZZ");
    document.getElementById("chicagoTarget").textContent = "Target: " + targetChicago.toFormat("yyyy-LL-dd HH:mm ZZZZ");

    function formatCountdown(diff) {
      const d = Math.max(0, Math.floor(diff.as("days")));
      const h = diff.minus({ days: d }).hours | 0;
      const m = diff.minus({ days: d, hours: h }).minutes | 0;
      return `<span class=\"fw-semibold\">${String(d).padStart(2, "0")}</span><span class=\"unit\">days</span><span class=\"fw-semibold\">${String(h).padStart(2, "0")}</span><span class=\"unit\">hours</span><span class=\"fw-semibold\">${String(m).padStart(2, "0")}</span><span class=\"unit\">min</span>`;
    }

    function tickCountdown() {
      const nR = DateTime.now().setZone("America/New_York");
      const nC = DateTime.now().setZone("America/Chicago");

      let diffR = targetReston.diff(nR, ["days", "hours", "minutes"]);
      let diffC = targetChicago.diff(nC, ["days", "hours", "minutes"]);

      if (diffR.as("milliseconds") < 0) diffR = Duration.fromObject({ days: 0, hours: 0, minutes: 0 });
      if (diffC.as("milliseconds") < 0) diffC = Duration.fromObject({ days: 0, hours: 0, minutes: 0 });

      document.getElementById("cdReston").innerHTML = formatCountdown(diffR);
      document.getElementById("cdChicago").innerHTML = formatCountdown(diffC);
    }

    tickCountdown();
    setInterval(tickCountdown, 30 * 1000);
  }

  function rerenderAllSvgs() {
    safeRun(renderSlope, "slope", "Slope graph failed to load.");
    safeRun(renderDumbbell, "dumbbell", "Dumbbell chart failed to load.");
  }

  safeRun(renderLineCharts, null, "");
  safeRun(fillLists, "listMost", "Failed to load list data.");
  safeRun(renderDonut, "nestedDonut", "Donut failed to load.");
  safeRun(renderBarLine, "barLine", "Bar/line failed to load.");
  safeRun(fillAlertsAndTickets, "alertsList", "Failed to load alerts and tickets.");
  safeRun(renderCountdown, null, "");
  rerenderAllSvgs();

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rerenderAllSvgs, 150);
  });
})();
