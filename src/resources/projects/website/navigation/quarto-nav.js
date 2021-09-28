const headroomChanged = new CustomEvent("quarto-hrChanged", {
  detail: {},
  bubbles: true,
  cancelable: false,
  composed: false,
});

window.document.addEventListener("DOMContentLoaded", function () {
  let init = false;

  function throttle(func, wait) {
    var timeout;
    return function () {
      const context = this;
      const args = arguments;
      const later = function () {
        clearTimeout(timeout);
        timeout = null;
        func.apply(context, args);
      };

      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
    };
  }

  function headerOffset() {
    // Set an offset if there is are fixed top navbar
    const headerEl = window.document.querySelector("header.fixed-top");
    return headerEl.clientHeight;
  }

  function updateDocumentOffsetWithoutAnimation() {
    updateDocumentOffset(false);
  }

  function updateDocumentOffset(animated) {
    // set body offset
    const offset = headerOffset();
    const bodyEl = window.document.body;
    bodyEl.setAttribute("data-bs-offset", offset);
    bodyEl.style.paddingTop = offset + "px";

    // deal with sidebar offsets
    const sidebars = window.document.querySelectorAll(".sidebar");
    sidebars.forEach((sidebar) => {
      if (!animated) {
        sidebar.classList.add("notransition");
        // Remove the no transition class after the animation has time to complete
        setTimeout(function () {
          sidebar.classList.remove("notransition");
        }, 201);
      }

      if (window.Headroom && sidebar.classList.contains("sidebar-unpinned")) {
        sidebar.style.top = "0";
        sidebar.style.maxHeight = "100vh";
      } else {
        sidebar.style.top = offset + "px";
        sidebar.style.maxHeight = "calc(100vh - " + offset + "px)";
      }
    });

    // allow space for footer
    const mainContainer = window.document.querySelector(".quarto-container");
    if (mainContainer) {
      mainContainer.style.minHeight = "calc(100vh - " + offset + "px)";
    }

    // link offset
    let linkStyle = window.document.querySelector("#quarto-target-style");
    if (!linkStyle) {
      linkStyle = window.document.createElement("style");
      window.document.head.appendChild(linkStyle);
    }
    while (linkStyle.firstChild) {
      linkStyle.removeChild(linkStyle.firstChild);
    }
    if (offset > 0) {
      linkStyle.appendChild(
        window.document.createTextNode(`
      section:target::before {
        content: "";
        display: block;
        height: ${offset}px;
        margin: -${offset}px 0 0;
      }`)
      );
    }
    if (init) {
      window.dispatchEvent(headroomChanged);
    }
    init = true;
  }

  // initialize headroom
  var header = window.document.querySelector("#quarto-header");
  if (header && window.Headroom) {
    const headroom = new window.Headroom(header, {
      tolerance: 5,
      onPin: function () {
        const sidebars = window.document.querySelectorAll(".sidebar");
        sidebars.forEach((sidebar) => {
          sidebar.classList.remove("sidebar-unpinned");
        });
        updateDocumentOffset();
      },
      onUnpin: function () {
        const sidebars = window.document.querySelectorAll(".sidebar");
        sidebars.forEach((sidebar) => {
          sidebar.classList.add("sidebar-unpinned");
        });
        updateDocumentOffset();
      },
    });
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
    };
  }

  // Observe size changed for the header
  const headerEl = window.document.querySelector("header.fixed-top");
  if (window.ResizeObserver) {
    const observer = new window.ResizeObserver(
      throttle(updateDocumentOffsetWithoutAnimation, 50)
    );
    observer.observe(headerEl, {
      attributes: true,
      childList: true,
      characterData: true,
    });
  } else {
    window.addEventListener(
      "resize",
      throttle(updateDocumentOffsetWithoutAnimation, 50)
    );
    setTimeout(updateDocumentOffsetWithoutAnimation, 500);
  }

  // fixup index.html links if we aren't on the filesystem
  if (window.location.protocol !== "file:") {
    const links = window.document.querySelectorAll("a");
    for (let i = 0; i < links.length; i++) {
      links[i].href = links[i].href.replace(/\/index\.html/, "/");
    }

    // Fixup any sharing links that require urls
    // Append url to any sharing urls
    const sharingLinks = window.document.querySelectorAll(
      "a.sidebar-tools-main-item"
    );
    for (let i = 0; i < sharingLinks.length; i++) {
      const sharingLink = sharingLinks[i];
      const href = sharingLink.getAttribute("href");
      if (href) {
        sharingLink.setAttribute(
          "href",
          href.replace("|url|", window.location.href)
        );
      }
    }

    // Scroll the active navigation item into view, if necessary
    const navSidebars = window.document.querySelectorAll(
      "div#quarto-sidebar > nav"
    );
    if (navSidebars.length === 1) {
      // Find the active item
      const targetNode = navSidebars[0];
      const activeItems = window.document.querySelectorAll(
        "li.sidebar-item a.active"
      );
      const activeItem = activeItems[0];

      if (activeItems.length === 1) {
        // Wait for the scroll height and height to resolve by observing size changes on the
        // nav element that is scrollable
        const resizeObserver = new ResizeObserver((_entries) => {
          // The bottom of the element
          const elBottom = activeItem.offsetTop;
          const viewBottom = targetNode.scrollTop + targetNode.clientHeight;

          // The element height and scroll height are the same, then we are still loading
          if (viewBottom !== targetNode.scrollHeight) {
            // Determine if the item isn't visible and scroll to it
            if (elBottom >= viewBottom) {
              targetNode.scrollTop = elBottom;
            }

            // stop observing now since we've completed the scroll
            resizeObserver.unobserve(targetNode);
          }
        });
        resizeObserver.observe(targetNode);
      }
    }
  }
});
