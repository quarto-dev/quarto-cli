

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
 
 // https://icons.getbootstrap.com/assets/js/application.min.js
});