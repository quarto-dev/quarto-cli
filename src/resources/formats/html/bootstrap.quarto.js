window.document.addEventListener("DOMContentLoaded", function() {
  
  // move the toc if there is a sidebar
  var toc = window.document.querySelectorAll('nav[role="doc-toc"]');
  var tocSidebar = window.document.getElementById("quarto-toc-sidebar")
  if (toc.length > 0 && tocSidebar) {
    tocSidebar.appendChild(toc[0]);
  }

  // add scroll spy to the body
  const body = window.document.body;
  body.setAttribute("data-bs-spy", "scroll");
  body.setAttribute("data-bs-target", "#quarto-toc-sidebar");

  // add nav-link class to the TOC links
  var tocLinks = window.document.querySelectorAll('nav[role="doc-toc"] a');
  for (let i=0; i<tocLinks.length; i++) {

    // Mark the toc links as nav-links
    const tocLink = tocLinks[i];
    if (!tocLink.classList.contains('nav-link')) {
      tocLink.classList.add("nav-link");
    }

    // move the raw href to the target attribute (need the raw value, not the full path)
    if (!tocLink.hasAttribute("data-bs-target")) {
      tocLink.setAttribute("data-bs-target", tocLink.getAttribute("href"));
    }
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

