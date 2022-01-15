<% partial('\_filter.ejs.md', {listing}) %>
<% let itemNumber = 0 %>
:::{.list .quarto-listing-default}
<% for (const item of items) { %>
<% partial('item-default.ejs.md', {listing, item, itemNumber}) %>
<% itemNumber = itemNumber + 1 %>
<% } %>
:::
<% partial('\_pagination.ejs.md', {listing, items}) %>
