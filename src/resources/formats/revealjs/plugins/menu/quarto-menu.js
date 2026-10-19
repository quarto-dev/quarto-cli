window.revealMenuToolHandler = function (handler) {
  return function (event) {
    event.preventDefault();
    handler();
    Reveal.getPlugin("menu").closeMenu();
  };
};

window.RevealMenuToolHandlers = {
  fullscreen: revealMenuToolHandler(function () {
    const element = document.documentElement;
    const requestMethod =
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.webkitRequestFullScreen ||
      element.mozRequestFullScreen ||
      element.msRequestFullscreen;
    if (requestMethod) {
      requestMethod.apply(element);
    }
  }),
  speakerMode: revealMenuToolHandler(function () {
    Reveal.getPlugin("notes").open();
  }),
  keyboardHelp: revealMenuToolHandler(function () {
    Reveal.toggleHelp(true);
  }),
  overview: revealMenuToolHandler(function () {
    Reveal.toggleOverview(true);
  }),
  toggleChalkboard: revealMenuToolHandler(function () {
    RevealChalkboard.toggleChalkboard();
  }),
  toggleNotesCanvas: revealMenuToolHandler(function () {
    RevealChalkboard.toggleNotesCanvas();
  }),
  downloadDrawings: revealMenuToolHandler(function () {
    RevealChalkboard.download();
  }),
  togglePdfExport: revealMenuToolHandler(function () {
    PdfExport.togglePdfExport();
  }),
  toggleScrollView: revealMenuToolHandler(function() {
    Reveal.getPlugin("quarto-support").toggleScrollView();
  })
};

// The plugin's button is a bare `<a href="#">` holding only an icon, so give it
// an accessible name from the language files. The plugin builds the button and
// the menu in the same call, so the button exists whenever the menu does.
// See https://github.com/quarto-dev/quarto-cli/issues/14249
const labelMenuButton = function () {
  const label = Reveal.getConfig().menu?.openButtonLabel;
  const button = document.querySelector(".slide-menu-button a");
  if (label && button && !button.hasAttribute("aria-label")) {
    button.setAttribute("aria-label", label);
  }
};

// Keep the slide menu out of the tab order and the accessibility tree while it
// is closed. Closing only moves it off screen, so screen readers still read it,
// and Chrome and Firefox make its slide list a Tab stop once the list scrolls.
// The plugin opens and closes the menu by toggling `active` on `.slide-menu`,
// so the menu is `inert` whenever that class is absent.
// See https://github.com/quarto-dev/quarto-cli/issues/15011
document.addEventListener("menu-ready", function () {
  const followMenu = function (menu) {
    const update = function () {
      menu.toggleAttribute("inert", !menu.classList.contains("active"));
    };
    update();
    new MutationObserver(update).observe(menu, {
      attributes: true,
      attributeFilter: ["class"],
    });
  };

  const menu = document.querySelector(".slide-menu");
  if (menu) {
    labelMenuButton();
    followMenu(menu);
    return;
  }

  // With `delay-init: true`, the menu is only built when the presentation calls
  // the plugin's `initialiseMenu()`, next to the `.reveal` element.
  const container = document.querySelector(".reveal").parentElement;
  const observer = new MutationObserver(function () {
    const builtMenu = container.querySelector(".slide-menu");
    if (builtMenu) {
      observer.disconnect();
      labelMenuButton();
      followMenu(builtMenu);
    }
  });
  observer.observe(container, { childList: true });
});
