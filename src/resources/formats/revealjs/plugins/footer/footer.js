window.QuartoFooter = function () {
  return {
    id: "quarto-footer",
    init: function (deck) {
      // const config = deck.getConfig();
      const revealParent = deck.getRevealElement();
      const logoImg = document.querySelector(".slide-logo");
      if (logoImg) {
        logoImg.setAttribute("src", logoImg.getAttribute("data-src"));
        revealParent.appendChild(logoImg);
        revealParent.classList.add("has-logo");
      }
      const footerSpan = document.querySelector(".slide-footer");
      if (footerSpan) {
        const footerDiv = document.createElement("div");
        footerDiv.classList.add("slide-footer-container");
        footerDiv.appendChild(footerSpan);
        revealParent.appendChild(footerDiv);
      }
    },
  };
};
