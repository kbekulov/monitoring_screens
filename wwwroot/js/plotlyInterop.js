window.plotlyInterop = {
  renderPlot(element, data, layout, config) {
    if (!element) {
      return;
    }

    const fallback = element.querySelector('.plotly-fallback');

    if (typeof window.Plotly === "undefined") {
      if (fallback) {
        fallback.textContent = "Plotly failed to load.";
      }
      console.error("Plotly is undefined on window.");
      return;
    }

    const safeConfig = {
      responsive: true,
      displayModeBar: false,
      ...config
    };

    try {
      window.Plotly.react(element, data ?? [], layout ?? {}, safeConfig).then(() => {
        if (fallback) {
          fallback.style.display = 'none';
        }
      });
    } catch (error) {
      if (fallback) {
        fallback.textContent = "Plotly render failed. Check console.";
      }
      console.error("Plotly render failed", error, { data, layout, config: safeConfig });
    }
  },

  disposePlot(element) {
    if (!element || typeof window.Plotly === "undefined") {
      return;
    }

    window.Plotly.purge(element);
  }
};
