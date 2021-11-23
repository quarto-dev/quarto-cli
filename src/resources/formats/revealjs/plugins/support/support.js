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
  function addFooter(deck) {
    const revealParent = deck.getRevealElement();
    const defaultFooterDiv = document.querySelector(".footer-default");
    if (defaultFooterDiv) {
      revealParent.appendChild(defaultFooterDiv);
      deck.on("slidechanged", function (ev) {
        const prevSlideFooter = document.querySelector(
          ".reveal > .footer:not(.footer-default)"
        );
        if (prevSlideFooter) {
          prevSlideFooter.remove();
        }
        const currentSlideFooter = ev.currentSlide.querySelector(".footer");
        if (currentSlideFooter) {
          defaultFooterDiv.style.display = "none";
          deck
            .getRevealElement()
            .appendChild(currentSlideFooter.cloneNode(true));
        } else {
          defaultFooterDiv.style.display = "block";
        }
      });
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
        function unScale(slides, scale) {
          console.log(this);
          const container = this.getContainer();

          // Cancel revealjs scaling on map container by doing the opposite of what it sets
          // * zoom will be used for scale > 1
          // * transform will be used for scale < 1
          // As we change on every resize, we remove other value if it was previously set
          if (slides.style.zoom) {
            if (slides.style.transform) slides.style.transform = null;
            container.style.zoom = 1 / scale;
          } else if (slides.style.transform) {
            // reveal.js use transform: scale(..)
            if (slides.style.zoom) slides.style.zoom = null;
            container.style.transform = "scale(" + 1 / scale + ")";
          }

          // Checks if the map container size changed and updates the map
          this.invalidateSize();
        }

        // bind the leaflet Map object to unscale
        const unScale2 = unScale.bind(this);

        // Unscale at initialization
        unScale2(deck.getSlidesElement(), deck.getScale());

        // And unscale each time presentation is resized
        deck.on("resize", function (ev) {
          unScale2(deck.getSlidesElement(), ev.scale);
        });
      });
    }
  }

  return {
    id: "quarto-support",
    init: function (deck) {
      applyGlobalStyles(deck);
      addLogoImage(deck);
      addFooter(deck);
      addChalkboardButtons(deck);
      patchLeaflet(deck);
    },
  };
};
