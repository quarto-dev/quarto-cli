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

  // Throttle the scroll event and walk peridiocally
  let ticking = false;
  window.document.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(function() {
        walk(tocEl, 0);
        ticking = false;
      });
        ticking = true;
    }
  });

});



