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

  // Try to process the hash and activate a tab
  const hash = window.decodeURIComponent(window.location.hash);
  if (hash.length > 0) {
    QuartoDashboardUtils.showPage(hash);
  }

  // navigate to a tab when the history changes
  window.addEventListener("popstate", function (e) {
    const hash = window.decodeURIComponent(window.location.hash);
    QuartoDashboardUtils.showPage(hash);
  });

  // Hook tabs and use that to update history / active tabs
  const navItems = document.querySelectorAll(".navbar .nav-item .nav-link");
  for (const navItem of navItems) {
    const linkHref = navItem.getAttribute("href");
    navItem.addEventListener("click", () => {
      const baseUrl = QuartoDashboardUtils.urlWithoutHash(window.location.href);
      const hash = QuartoDashboardUtils.urlHash(linkHref);
      const href = baseUrl + hash;
      QuartoDashboardUtils.setLocation(href);
      return false;
    });
  }

  // Hook links in the body so users can link to pages
  const linkEls = document.querySelectorAll(".quarto-dashboard-content a");
  for (const linkEl of linkEls) {
    const linkHref = linkEl.getAttribute("href");
    linkEl.addEventListener("click", () => {
      QuartoDashboardUtils.showPage(linkHref);
      return false;
    });
  }

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

// utils
window.QuartoDashboardUtils = {
  setLocation: function (href) {
    if (history && history.pushState) {
      history.pushState(null, null, href);
    } else {
      window.location.replace(href);
    }
    setTimeout(function () {
      window.scrollTo(0, 0);
    }, 10);
  },
  isPage: function (hash) {
    const tabPaneEl = document.querySelector(`.dashboard-page.tab-pane${hash}`);
    return tabPaneEl !== null;
  },
  showPage: function (hash) {
    // If the hash is empty, just select the first tab and activate that
    if (hash === "") {
      const firstTabPaneEl = document.querySelector(".dashboard-page.tab-pane");
      if (firstTabPaneEl !== null) {
        hash = `#${firstTabPaneEl.id}`;
      }
    }

    // Find the tab and activate it
    const tabNodes = document.querySelectorAll(".navbar .nav-item .nav-link");
    for (const tabEl of tabNodes) {
      const target = tabEl.getAttribute("data-bs-target");
      if (target === hash) {
        tabEl.classList.add("active");
      } else {
        tabEl.classList.remove("active");
      }
    }

    // Find the tabpanes and activate the hash tab
    const tabPaneNodes = document.querySelectorAll(".dashboard-page.tab-pane");
    for (const tabPaneEl of tabPaneNodes) {
      if (`#${tabPaneEl.id}` === hash) {
        tabPaneEl.classList.add("active");
      } else {
        tabPaneEl.classList.remove("active");
      }
    }
  },
  showLinkedValue: function (href) {
    // check for a page link
    if (this.isPage(href)) {
      this.showPage(href);
    } else {
      window.open(href);
    }
  },
  urlWithoutHash: function (url) {
    const hashLoc = url.indexOf("#");
    if (hashLoc != -1) return url.substring(0, hashLoc);
    else return url;
  },
  urlHash: function (url) {
    const hashLoc = url.indexOf("#");
    if (hashLoc != -1) return url.substring(hashLoc);
    else return "";
  },
};
