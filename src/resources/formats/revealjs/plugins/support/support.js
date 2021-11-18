// catch all plugin for various quarto features
window.QuartoSupport = function () {
  // apply styles
  function applyGlobalStyles(deck) {
    if (deck.getConfig()["smaller"] === true) {
      const revealParent = deck.getRevealElement();
      revealParent.classList.add("smaller");
    }
  }

  // add logo image
  function addLogoImage(deck) {
    const revealParent = deck.getRevealElement();
    const logoImg = document.querySelector(".slide-logo");
    if (logoImg) {
      revealParent.appendChild(logoImg);
      revealParent.classList.add("has-logo");
    }
  }

  // add footer text
  function addFooterText(deck) {
    const revealParent = deck.getRevealElement();
    const footerSpan = document.querySelector(".slide-footer");
    if (footerSpan) {
      const footerDiv = document.createElement("div");
      footerDiv.classList.add("slide-footer-container");
      footerDiv.appendChild(footerSpan);
      revealParent.appendChild(footerDiv);
    }
  }

  // add chalkboard buttons
  function addChalkboardButtons(deck) {
    const chalkboard = deck.getPlugin("RevealChalkboard");
    if (chalkboard) {
      const revealParent = deck.getRevealElement();
      const chalkboardDiv = document.createElement("div");
      chalkboardDiv.classList.add("slide-chalkboard-buttons");
      if (document.querySelector(".slide-menu-button")) {
        chalkboardDiv.classList.add("slide-menu-offset");
      }
      // add buttons if requested
      const config = deck.getConfig();
      if (config.chalkboard.buttons) {
        const buttons = [
          {
            icon: "easel2",
            title: "Toggle Chalkboard (b)",
            onclick: chalkboard.toggleChalkboard,
          },
          {
            icon: "brush",
            title: "Toggle Notes Canvas (c)",
            onclick: chalkboard.toggleNotesCanvas,
          },
        ];
        buttons.forEach(function (button) {
          const span = document.createElement("span");
          span.title = button.title;
          const icon = document.createElement("i");
          icon.classList.add("fas");
          icon.classList.add("fa-" + button.icon);
          span.appendChild(icon);
          span.onclick = function (event) {
            event.preventDefault();
            button.onclick();
          };
          chalkboardDiv.appendChild(span);
        });
        revealParent.appendChild(chalkboardDiv);
      }
    }
  }

  // Patch leaflet for compatibility with revealjs
  function patchLeaflet(deck) {
    // check if leaflet is used
    if (window.L) {
      L.Map.addInitHook(function () {
        const slides = deck.getSlidesElement();
        const scale = deck.getScale();

        const container = this.getContainer();

        // Cancel revealjs scaling on map container by doing the opposite of what it sets
        // zoom will be used for scale > 1
        // transform will be used for scale < 1
        if (slides.style.zoom) {
          container.style.zoom = 1 / scale;
        } else if (slides.style.transform) {
          // reveal.js use transform: scale(..)
          container.style.transform = "scale(" + 1 / scale + ")";
        }

        // Update the map on container size changed
        this.invalidateSize();
      });
    }
  }

  return {
    id: "quarto-support",
    init: function (deck) {
      applyGlobalStyles(deck);
      addLogoImage(deck);
      addFooterText(deck);
      addChalkboardButtons(deck);
      patchLeaflet(deck);
    },
  };
};
