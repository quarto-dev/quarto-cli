

window.document.addEventListener("DOMContentLoaded", function (event) {

  <% if (darkMode !== undefined) { %> 

  const disableEls = (els) => {
    for (let i=0; i < els.length; i++) {
      const el = els[i];
      el.disabled = true;
    }
  }

  const enableEls = (els) => {
    for (let i=0; i < els.length; i++) {
      const el = els[i];
      el.removeAttribute("disabled");
    }
  }

  const manageTransitions = (selector, allowTransitions) => {
    const els = window.document.querySelectorAll(selector);
    for (let i=0; i < els.length; i++) {
      const el = els[i];
      if (allowTransitions) {
        el.classList.remove('notransition');
      } else {
        el.classList.add('notransition');
      }
    }
  }

  const toggleColorMode = (dark) => {
    const toggle = window.document.getElementById('quarto-color-scheme-toggle');
    if (toggle) {
      const lightEls = window.document.querySelectorAll('link.quarto-color-scheme.light');
      const darkEls = window.document.querySelectorAll('link.quarto-color-scheme.dark');

      manageTransitions('div.sidebar-toc .nav-link', false);
      if (dark) {
        enableEls(darkEls);
        disableEls(lightEls);
        toggle.classList.remove("light");
        toggle.classList.add("dark");     
      } else {
        enableEls(lightEls);
        disableEls(darkEls);
        toggle.classList.remove("dark");
        toggle.classList.add("light");
      }
      manageTransitions('.quarto-toc-sidebar .nav-link', true);
    }
  }

  const hasDarkSentinel = () => {
    let darkSentinel = window.localStorage.getItem("quarto-color-scheme");
    if (darkSentinel !== null) {
      return darkSentinel === "dark";
    } else {
      return <%= darkMode %>;
    }
  }

  const setDarkSentinel = (toDark) => {
    if (toDark) {
      window.localStorage.setItem("quarto-color-scheme", "dark");
    } else { 
      window.localStorage.setItem("quarto-color-scheme", "light");
    }
  }

  // Switch to dark mode if need be
  if (hasDarkSentinel()) {
    toggleColorMode(true);
  } 
   
  // Dark / light mode switch
  window.quartoToggleColorScheme = () => {
    // Read the current dark / light value 
    let toDark = !hasDarkSentinel();
    toggleColorMode(toDark);
    setDarkSentinel(toDark);
  };

  <% } %>

  <% if (anchors) { %>

  const icon = "<%= anchors === true ? '' : anchors %>";
  const anchorJS = new window.AnchorJS();
  anchorJS.options = {
    placement: 'right',
    icon: icon
  };
  anchorJS.add('.anchored');
  <% } %>

  <% if (copyCode) { %>

  const clipboard = new window.ClipboardJS('.code-copy-button', {
    target: function(trigger) {
      return trigger.previousElementSibling;
    }
  });

  clipboard.on('success', function(e) {
    // button target
    const button = e.trigger;
    // don't keep focus
    button.blur();
    // flash "checked"
    button.classList.add('code-copy-button-checked');
    setTimeout(function() {
      button.classList.remove('code-copy-button-checked');
    }, 1000);
    // clear code selection
    e.clearSelection();
  });

  <% } %>

  <% if (codeTools) { %>

  const viewSource = window.document.getElementById('quarto-view-source') ||
                     window.document.getElementById('quarto-code-tools-source');
  if (viewSource) {
    const sourceUrl = viewSource.getAttribute("data-quarto-source-url");
    viewSource.addEventListener("click", function(e) {
      if (sourceUrl) {
        if (/\bviewer_pane=1\b/.test(window.location)) {
          window.open(sourceUrl);
        } else {
          window.location.href = sourceUrl;
        }
      } else {
        const modal = new bootstrap.Modal(document.getElementById('quarto-embedded-source-code-modal'));
        modal.show();
      }
      return false;
    });
  }
  function toggleCodeHandler(show) {
    return function(e) {
      const detailsSrc = window.document.querySelectorAll(".cell > details > .sourceCode");
      for (let i=0; i<detailsSrc.length; i++) {
        const details = detailsSrc[i].parentElement;
        if (show) {
          details.open = true;
        } else {
          details.removeAttribute("open");
        }
      }
      const cellCodeDivs = window.document.querySelectorAll(".cell > .sourceCode");
      const fromCls = show ? "hidden" : "unhidden";
      const toCls = show ? "unhidden" : "hidden";
      for (let i=0; i<cellCodeDivs.length; i++) {
        const codeDiv = cellCodeDivs[i];
        if (codeDiv.classList.contains(fromCls)) {
          codeDiv.classList.remove(fromCls);
          codeDiv.classList.add(toCls);
        } 
      }
      return false;
    }
  }
  const hideAllCode = window.document.getElementById("quarto-hide-all-code");
  if (hideAllCode) {
    hideAllCode.addEventListener("click", toggleCodeHandler(false));
  }
  const showAllCode = window.document.getElementById("quarto-show-all-code");
  if (showAllCode) {
    showAllCode.addEventListener("click", toggleCodeHandler(true));
  }

  <% } %>

  <% if (tippy) { %>
  function tippyHover(el, contentFn) {
    window.tippy(el, {
      allowHTML: true,
      content: contentFn,
      maxWidth: 500,
      delay: 100,
      interactive: true,
      interactiveBorder: 10,
      theme: '<%= tippyTheme %>',
      placement: 'bottom-start'
    }); 
  }
  <% } %>

  <% if (hoverFootnotes) { %>

  const noterefs = window.document.querySelectorAll('a[role="doc-noteref"]');
  for (var i=0; i<noterefs.length; i++) {
    const ref = noterefs[i];
    tippyHover(ref, function() {
      const id = new URL(ref.getAttribute('href')).hash.replace(/^#/, "");
      const note = window.document.getElementById(id);
      return note.innerHTML;
    });
  }

  <% } %>

  <% if (hoverCitations) { %>

  var bibliorefs = window.document.querySelectorAll('a[role="doc-biblioref"]');
  for (var i=0; i<bibliorefs.length; i++) {
    const ref = bibliorefs[i];
    const cites = ref.parentNode.getAttribute('data-cites').split(' ');
    tippyHover(ref, function() {
      var popup = window.document.createElement('div');
      cites.forEach(function(cite) {
        var citeDiv = window.document.createElement('div');
        citeDiv.classList.add('hanging-indent');
        citeDiv.classList.add('csl-entry');
        var biblioDiv = window.document.getElementById('ref-' + cite);
        if (biblioDiv) {
          citeDiv.innerHTML = biblioDiv.innerHTML;
        }
        popup.appendChild(citeDiv);
      });
      return popup.innerHTML;
    });
  }
  

  <% } %>
 
});