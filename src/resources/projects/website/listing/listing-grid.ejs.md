
<% partial('_filter.ejs.md', {listing, items, options}) %>
:::{.list .grid}
<% for (const item of items) { %>
  <% partial('item-grid.ejs.md', {listing, item, options}) %>
<% } %>
:::
<% partial('_pagination.ejs.md', {listing, items, options}) %>
