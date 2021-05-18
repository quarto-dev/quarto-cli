window.document.addEventListener("DOMContentLoaded", function (_event) {
  
  // get table of contents (bail if we don't have one)
  var tocEl = window.document.getElementById('TOC');
  if (!tocEl)
    return;

  // function to determine whether the element has a previous sibling that is active
  const prevSiblingIsActiveLink = (el) => {
    const sibling = el.previousElementSibling;
    if (sibling && sibling.tagName === 'A') {
      return sibling.classList.contains('active');
    } else {
      return false;
    }
  }

  // Track scrolling and mark TOC links as active
  const tocLinks = [...tocEl.querySelectorAll("a[data-scroll-target]")];  
  const makeActive = (link) => tocLinks[link].classList.add("active");
  const removeActive = (link) => tocLinks[link].classList.remove("active");
  const removeAllActive = () => [...Array(tocLinks.length).keys()].forEach((link) => removeActive(link));

  const sections = tocLinks.map(link => {
    const target = link.getAttribute("data-scroll-target");
    return window.document.querySelector(`${target}`);
  });
  const sectionMargin = 200;
  let currentActive = 0;
  
  const updateActiveLink = () => {

    // The index from bottom to top (e.g. reversed list)
    let sectionIndex = -1;
    if ((window.innerHeight + window.pageYOffset) >= window.document.body.offsetHeight) {
      sectionIndex = 0;
    } else {
      sectionIndex = [...sections].reverse().findIndex((section) => {
          if (section) {
            return window.pageYOffset >= section.offsetTop - sectionMargin 
          } else {
            return -1;
          }
        });
    } 
    if (sectionIndex > -1) {
      const current = sections.length - sectionIndex - 1
      if (current !== currentActive) {
        removeAllActive();
        currentActive = current;
        makeActive(current);
      }
    }
  }
  

  // Walk the TOC and collapse/expand nodes
  // Nodes are expanded if:
  // - they are top level
  // - they have children that are 'active' links
  // - they are directly below an link that is 'active'
  const walk = (el, depth) => {

    // Tick depth when we enter a UL
    if (el.tagName === 'UL') {
      depth = depth + 1;
    }
    
    // It this is active link
    let isActiveNode = false;
    if (el.tagName === 'A' && el.classList.contains('active')) {
      isActiveNode = true;
    }

    // See if there is an active child to this element
    let hasActiveChild = false;
    for (child of el.children) {
      hasActiveChild = walk(child, depth) || hasActiveChild;
    }

    // Process the collapse state if this is an UL
    if (el.tagName === 'UL') {
      if (depth === 1 || hasActiveChild || prevSiblingIsActiveLink(el)) {
        el.classList.remove('collapse');
      } else {
        el.classList.add('collapse');
      }

      // untick depth when we leave a UL
      depth = depth - 1;
    }
    return hasActiveChild || isActiveNode;
  }

  // walk the TOC and expand / collapse any items that should be shown

  walk(tocEl, 0);
  updateActiveLink();

  // Throttle the scroll event and walk peridiocally
  window.document.addEventListener('scroll', throttle(() =>{
    updateActiveLink();
    walk(tocEl, 0);
  }, 10));
});


// TODO: Create shared throttle js function (see quarto-nav.js)
function throttle(func, wait) {
  var timeout;
  return function() {
    const context = this
    const args = arguments;
    const later = function() {
      clearTimeout(timeout);
      timeout = null;
      func.apply(context, args);
    };

    if (!timeout) {
      timeout = setTimeout(later, wait);
    }
  };
}







