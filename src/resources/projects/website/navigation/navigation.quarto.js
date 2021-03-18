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
  }

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

    let frozen = false;
    window.quartoToggleHeadroom = function () {
      if (frozen) {
        headroom.unfreeze();
        frozen = false;
      } else {
        headroom.freeze();
        frozen = true;
      }
    }
  }

  // Set an offset if there is are fixed top navbar
  updateDocumentOffset();
  window.addEventListener('resize', debounce(updateDocumentOffset, 50));  

  // Hide the title when it will appear in the secondary nav
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
});

