window.document.addEventListener("DOMContentLoaded", function() {
  
  // move the toc if there is a sidebar
  var toc = window.document.getElementById("TOC");
  var tocSidebar = window.document.getElementById("quarto-toc-sidebar")
  if (toc && tocSidebar) {
    tocSidebar.appendChild(toc);
  }
  
  // latch active nav link
  var navLinks = window.document.querySelectorAll("a.nav-link");
  for (let i=0; i<navLinks.length; i++) {
    const navLink = navLinks[i];
    if (navLink.href === window.location.href ||
        navLink.href === (window.location.href + "index.html")) {
      navLink.classList.add("active");
      navLink.setAttribute("aria-current", "page");
    }
  }

  // add .table class to pandoc tables
  var tableHeaders = window.document.querySelectorAll("tr.header"); 
  for (let i=0; i<tableHeaders.length; i++) {
    const th = tableHeaders[i];
    th.parentNode.parentNode.classList.add("table");
  }
});

