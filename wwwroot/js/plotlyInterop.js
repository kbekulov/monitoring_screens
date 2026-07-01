export async function renderPlot(element, data, layout, config) {
  if (!element || typeof Plotly === "undefined") {
    return;
  }

  const safeConfig = {
    responsive: true,
    displayModeBar: false,
    ...config
  };

  await Plotly.react(element, data ?? [], layout ?? {}, safeConfig);
}

export async function disposePlot(element) {
  if (!element || typeof Plotly === "undefined") {
    return;
  }

  await Plotly.purge(element);
}
