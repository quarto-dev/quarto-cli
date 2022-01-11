<% partial('\_filter.ejs.md', {listing}) %>
:::{.list .grid}
<% for (const item of items) { %>
<% partial('item-grid.ejs.md', {listing, item}) %>
<% } %>
:::
<% partial('\_pagination.ejs.md', {listing, items}) %>
