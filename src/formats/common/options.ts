export function standardDocOptions(fig_width = 7, fig_height = 5) {
  return [{
    name: "toc",
    description: "Include a table of contents",
    default: false,
  }, {
    name: "fig_width",
    description: "Default width (in inches) for figures",
    default: 7,
  }, {
    name: "fig_height",
    description: "Default height (in inches) for figures",
    default: 5,
  }];
}
