window.QuartoFooter = function () {
  return {
    id: "quarto-footer",
    init: function (deck) {
      const config = deck.getConfig();
      const logo = config["slide-logo"];
      /*
      if (logo) {
        const revealParent = deck.getRevealElement().parentElement;
        const logoImg = document.getElementById("quarto-slide-logo");
        if (logoImg) {
          console.log(config);
          if (config.slideNumber) {
            logoImg.classList.add("slide-number-offset");
          }
          revealParent.appendChild(logoImg);
        }
      }
      */
      console.log(deck.getConfig());
    },
  };
};
