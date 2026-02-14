(function () {
  function parseSearch() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (_e) {
      return new URLSearchParams();
    }
  }

  const params = parseSearch();
  const timezone = params.get("tz") || "Europe/Vilnius";
  const explicitSeed = params.get("seed");
  const slopeCycleParam = Number(params.get("slopeCycleMs"));
  const slopeCycleMs = Number.isFinite(slopeCycleParam) && slopeCycleParam > 0 ? slopeCycleParam : 12000;
  const autoSlopeCycleParam = (params.get("autoSlopeCycle") || "").toLowerCase();
  const autoSlopeCycle = autoSlopeCycleParam !== "0" && autoSlopeCycleParam !== "false" && autoSlopeCycleParam !== "off";
  const forceCriticalAnnouncementParam = (params.get("forceCriticalAnnouncement") || "").toLowerCase();
  const forceCriticalAnnouncement = forceCriticalAnnouncementParam !== "0" && forceCriticalAnnouncementParam !== "false" && forceCriticalAnnouncementParam !== "off";
  const forceFreezeAnnouncementParam = (params.get("forceFreezeAnnouncement") || "").toLowerCase();
  const forceFreezeAnnouncement = forceFreezeAnnouncementParam !== "0" && forceFreezeAnnouncementParam !== "false" && forceFreezeAnnouncementParam !== "off";
  const forcedAnnouncementTitle = params.get("announcementTitle") || "All MS Graph APIs are down.";
  const forcedAnnouncementDetail = params.get("announcementDetail") || "";

  window.RPA = window.RPA || {};
  window.RPA.config = {
    timezone,
    seed: explicitSeed ? Number(explicitSeed) : null,
    enableConsoleTelemetry: true,
    refreshMs: 5 * 60 * 1000,
    autoSlopeCycle,
    slopeCycleMs: Math.max(3000, slopeCycleMs),
    failoverAnnouncementLeadMinutes: 60,
    forceCriticalAnnouncement,
    forceFreezeAnnouncement,
    forcedAnnouncementTitle,
    forcedAnnouncementDetail,
    maintenanceThresholds: {
      inboxEmails: 120,
      todo: 45,
      workedOn: 30
    },
    palette: {
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
    },
    windowMinutes: 5,
    redCardsForCrisis: 2,
    thresholds: {
      exceptionRate: { amber: 0.08, red: 0.10 },
      heatmap: { amber: 6, red: 10 },
      funnelDrop: { amber: 6, red: 12 },
      aging60plus: { amber: 4, red: 7 },
      burstOverBand: { amber: 1, red: 3 }
    }
  };
})();
