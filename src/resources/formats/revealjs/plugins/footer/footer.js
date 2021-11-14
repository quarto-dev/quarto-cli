window.QuartoFooter = function () {
  return {
    id: "quarto-footer",
    init: function (deck) {
      // add logo image
      const revealParent = deck.getRevealElement();
      const logoImg = document.querySelector(".slide-logo");
      if (logoImg) {
        revealParent.appendChild(logoImg);
        revealParent.classList.add("has-logo");
      }

      // add footer text
      const footerSpan = document.querySelector(".slide-footer");
      if (footerSpan) {
        const footerDiv = document.createElement("div");
        footerDiv.classList.add("slide-footer-container");
        footerDiv.appendChild(footerSpan);
        revealParent.appendChild(footerDiv);
      }

      // if there is a chalkboard plugin then add buttons for it
      const chalkboard = deck.getPlugin("RevealChalkboard");
      if (chalkboard) {
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
    },
  };
};
