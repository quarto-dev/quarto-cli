

window.document.addEventListener("DOMContentLoaded", function (event) {

  <% if (anchors) { %>

  const icon = "<%= anchors === true ? '' : anchors %>";
  const anchorJS = new window.AnchorJS();
  anchorJS.options = {
    placement: 'right',
    icon: icon
  };
  anchorJS.add();
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

  const popoverOptions = {
    trigger: 'hover',
    html: true,
    delay: { "show": 100, "hide": 100},
    placement: 'bottom',
  };

  <% if (hoverFootnotes) { %>

  const noterefs = window.document.querySelectorAll('a[role="doc-noteref"]');
  for (var i=0; i<noterefs.length; i++) {
    const ref = noterefs[i];
    const options = Object.assign({
      customClass: 'footnote-hover',
      content: function() {
        const id = new URL(this.getAttribute('href')).hash.replace(/^#/, "");
        const note = window.document.getElementById(id);
        return note.innerHTML;
      }}, popoverOptions);
    new window.bootstrap.Popover(ref, options);
  }

  <% } %>

  <% if (hoverCitations) { %>

  var bibliorefs = window.document.querySelectorAll('a[role="doc-biblioref"]');
  for (var i=0; i<bibliorefs.length; i++) {
    const ref = bibliorefs[i];
    const cites = ref.parentNode.getAttribute('data-cites').split(' ');
    const options = Object.assign({
      customClass: 'citation-hover hanging-indent',
      content: function() {
        var popup = window.document.createElement('div');
        cites.forEach(function(cite) {
          var citeDiv = window.document.createElement('div');
          citeDiv.classList.add('csl-entry');
          var biblioDiv = window.document.getElementById('ref-' + cite);
          if (biblioDiv) {
            citeDiv.innerHTML = biblioDiv.innerHTML;
          }
          popup.appendChild(citeDiv);
        });
        return popup.innerHTML;
      }}, popoverOptions);
     new window.bootstrap.Popover(ref, options);
  }
  

  <% } %>
 
});