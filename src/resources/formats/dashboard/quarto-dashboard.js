const fillDivClasseses = ["widget-subarea", "lm-Widget", "leaflet-container"];

function requiresFill(el) {
  if (el.tagName === "DIV") {
    return fillDivClasseses.some((cls) => {
      return el.classList.contains(cls);
    });
  }
  return false;
}

function ensureWidgetFills(el) {
  if (!el.classList.contains("html-fill-item")) {
    el.classList.add("html-fill-item");
  }

  if (!el.classList.contains("html-fill-container")) {
    el.classList.add("html-fill-container");
  }
}

function ensureWidgetsFill() {
  // Find any jupyter widget containers and keep an eye on them
  const widgetNodes = document.querySelectorAll(".widget-subarea");
  for (const widgetEl of widgetNodes) {
    ensureWidgetFills(widgetEl);
  }
}

window.document.addEventListener("DOMContentLoaded", function (_event) {
  ensureWidgetsFill();

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (addedNode) {
        if (requiresFill(addedNode)) {
          ensureWidgetFills(addedNode);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
