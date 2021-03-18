window.document.addEventListener("DOMContentLoaded", function() {
  
   // add 'lead' to subtitle
  const subtitle = window.document.querySelector('header > .subtitle');
  if (subtitle) {
    subtitle.classList.add('lead');
  }

  // move the toc if there is a sidebar
  var toc = window.document.querySelectorAll('nav[role="doc-toc"]');
  var tocSidebar = window.document.getElementById("quarto-toc-sidebar")
  if (toc.length > 0 && tocSidebar) {
    tocSidebar.appendChild(toc[0]);
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

  // add scroll spy to the body
  const body = window.document.body;
  body.setAttribute("data-bs-spy", "scroll");
  body.setAttribute("data-bs-target", "#quarto-toc-sidebar"); 
    
  // add .table class to pandoc tables
  var tableHeaders = window.document.querySelectorAll("tr.header"); 
  for (let i=0; i<tableHeaders.length; i++) {
    const th = tableHeaders[i];
    th.parentNode.parentNode.classList.add("table");
  }
});

