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

  // Set an offset if there is are fixed top navbar
  const navBar = window.document.querySelectorAll('.navbar.fixed-top');
  let offset = 0;
  for (let i=0; i< navBar.length; i++) {
    offset += navBar[i].clientHeight;
  }
  if (offset) {
    body.setAttribute("data-bs-offset", offset * 2);
  }
  
  // add nav-link class to the TOC links
  var tocLinks = window.document.querySelectorAll('nav[role="doc-toc"] a');
  for (let i=0; i<tocLinks.length; i++) {

    // Mark the toc links as nav-links
    const tocLink = tocLinks[i];
    tocLink.classList.add("nav-link");

    // move the raw href to the target attribute (need the raw value, not the full path)
    if (!tocLink.hasAttribute("data-bs-target")) {
      tocLink.setAttribute("data-bs-target", tocLink.getAttribute("href"));
    }
  }

  // Hide the title when it will appear in the secondary
  const title = window.document.querySelectorAll('header > .title');
  const sidebar = window.document.getElementById('quarto-sidebar');
  if (title.length && sidebar) {
      title[0].classList.add("d-none");
      title[0].classList.add("d-lg-block");

      // Add the title to the secondary nav bar
      const secondaryNavTitle = window.document.querySelectorAll('.quarto-secondary-nav .quarto-secondary-nav-title')
      if (secondaryNavTitle.length) {
        secondaryNavTitle[0].innerHTML = title[0].innerHTML;
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

