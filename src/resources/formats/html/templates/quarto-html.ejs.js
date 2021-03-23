

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
 

});