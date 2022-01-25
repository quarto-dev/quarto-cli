:::{.list .quarto-listing-default}
<% for (const item of items) { %>
<% partial('item-default.ejs.md', {listing, item }) %>
<% } %>
:::
