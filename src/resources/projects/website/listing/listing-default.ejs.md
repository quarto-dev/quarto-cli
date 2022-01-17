<% partial('\_filter.ejs.md', {listing}) %>
:::{.list .quarto-listing-default}
<% for (const item of items) { %>
<% partial('item-default.ejs.md', {listing, item }) %>
<% } %>
:::
<% partial('\_pagination.ejs.md', {listing, items}) %>
