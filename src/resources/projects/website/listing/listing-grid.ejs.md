<% partial('\_filter.ejs.md', {listing}) %>
<% let itemNumber = 0 %>
:::{.list .grid .quarto-listing-grid}
<% for (const item of items) { %>
<% partial('item-grid.ejs.md', {listing, item, itemNumber}) %>
<% itemNumber = itemNumber + 1 %>
<% } %>
:::
<% partial('\_pagination.ejs.md', {listing, items}) %>
