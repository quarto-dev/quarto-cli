export interface DocOptionsDefaults {
  fig_width?: number;
  fig_height?: number;
}

export function standardDocOptions(defaults?: DocOptionsDefaults) {
  defaults = defaults || {};
  return [{
    name: "toc",
    description: "Include a table of contents",
    default: false,
  }, {
    name: "fig_width",
    description: "Default width (in inches) for figures",
    default: defaults.fig_width || 7,
  }, {
    name: "fig_height",
    description: "Default height (in inches) for figures",
    default: defaults.fig_height || 5,
  }];
}
