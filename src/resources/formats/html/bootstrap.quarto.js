window.document.addEventListener("DOMContentLoaded", function() {
  
  // move the toc if there is a sidebar
  var toc = window.document.querySelectorAll('nav[role="doc-toc"]');
  var tocSidebar = window.document.getElementById("quarto-toc-sidebar")
  if (toc.length > 0 && tocSidebar) {
    tocSidebar.appendChild(toc[0]);
  }
    
  // latch active nav link
  var navLinks = window.document.querySelectorAll("a.nav-link, a.navbar-brand");
  for (let i=0; i<navLinks.length; i++) {
    const navLink = navLinks[i];
    if (navLink.href === window.location.href ||
        navLink.href === (window.location.href + "index.html")) {
      if (navLink.classList.contains("nav-link")) {
        navLink.classList.add("active");
        navLink.setAttribute("aria-current", "page");
      }
    }
    // function to fixup index.html links if we aren't on the filesystem
    if (window.location.protocol !== "file:") {
      navLink.href = navLink.href.replace(/\/index\.html/, "/");
    }
  }

  // add .table class to pandoc tables
  var tableHeaders = window.document.querySelectorAll("tr.header"); 
  for (let i=0; i<tableHeaders.length; i++) {
    const th = tableHeaders[i];
    th.parentNode.parentNode.classList.add("table");
  }
});

