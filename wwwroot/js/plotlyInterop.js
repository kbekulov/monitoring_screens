window.plotlyInterop = {
  renderPlot(element, data, layout, config) {
    if (!element || typeof window.Plotly === "undefined") {
      return;
    }

    const safeConfig = {
      responsive: true,
      displayModeBar: false,
      ...config
    };

    window.Plotly.react(element, data ?? [], layout ?? {}, safeConfig);
  },

  disposePlot(element) {
    if (!element || typeof window.Plotly === "undefined") {
      return;
    }

    window.Plotly.purge(element);
  }
};
