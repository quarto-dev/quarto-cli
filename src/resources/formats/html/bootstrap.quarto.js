window.document.addEventListener("DOMContentLoaded", function() {
  
  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };

  function headerOffset() {
    // Set an offset if there is are fixed top navbar
    const headerEl = window.document.querySelector('header.fixed-top');
    return headerEl.clientHeight;
  }

  function updateDocumentOffset() {
    // set body offset
    const offset = headerOffset()
    const bodyEl = window.document.body;
    bodyEl.setAttribute("data-bs-offset", offset);
    bodyEl.style.paddingTop = offset + "px";  

    // deal with sidebar offsets
    const sidebars = window.document.querySelectorAll(".sidebar");
    sidebars.forEach(sidebar => { 
      if (!window.Headroom || sidebar.classList.contains("sidebar-pinned")) {
        sidebar.style.top = offset + "px";
        sidebar.style.maxHeight = 'calc(100vh - ' + offset + 'px)';   
      } else {
        sidebar.style.top = "0";
        sidebar.style.maxHeight = '100vh';   
      }
    });

    // link offset
    let linkStyle = window.document.querySelector("#quarto-target-style");
    if (!linkStyle) {
      linkStyle = window.document.createElement('style');
      window.document.head.appendChild(linkStyle);
    }
    while (linkStyle.firstChild) {
      linkStyle.removeChild(linkStyle.firstChild);
    }
    linkStyle.appendChild(window.document.createTextNode(`
      :target::before {
        content: "";
        display: block;
        height: ${offset}px;
        margin: -${offset}px 0 0;
      }`)
    );
  }

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

  // initialize headroom
  var header = window.document.querySelector("#quarto-header");
  if (header && window.Headroom) {
    const headroom  = new window.Headroom(header, 
      { tolerance: 5,
        onPin: function() {
          const sidebars = window.document.querySelectorAll(".sidebar");
          sidebars.forEach(sidebar => {
            sidebar.classList.add("sidebar-pinned");
          });
          updateDocumentOffset();
        }, 
        onUnpin: function() {
          const sidebars = window.document.querySelectorAll(".sidebar");
          sidebars.forEach(sidebar => {
            sidebar.classList.remove("sidebar-pinned");
          });
          updateDocumentOffset();
        }});
    headroom.init();
  }

  // Set an offset if there is are fixed top navbar
  updateDocumentOffset();
  window.addEventListener('resize', debounce(updateDocumentOffset, 50));  
    
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
  const title = window.document.querySelector('header > .title');
  const sidebar = window.document.getElementById('quarto-sidebar');
  if (title) {
    title.classList.add("display-6");
    if (sidebar) {
      // hide below lg
      title.classList.add("d-none");
      title.classList.add("d-lg-block");

      // Add the title to the secondary nav bar
      const secondaryNavTitle = window.document.querySelector('.quarto-secondary-nav .quarto-secondary-nav-title')
      if (secondaryNavTitle) {
        secondaryNavTitle.innerHTML = title.innerHTML;
      }
    } 
  }

  // add 'lead' to subtitle
  const subtitle = window.document.querySelector('header > .subtitle');
  if (subtitle) {
    subtitle.classList.add('lead');
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

