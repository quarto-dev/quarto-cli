<%
const cols = listing['column-count'];
%>

:::{.list .grid .quarto-listing-cols-<%=cols%>}
<% for (const item of items) { %>
<% partial('item-grid.ejs.md', {listing, item }) %>
<% } %>
:::
