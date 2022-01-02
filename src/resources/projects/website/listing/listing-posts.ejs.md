<% partial('\_filter.ejs.md', {listing, items, options}) %>
:::{.list}
<% for (const item of items) { %>
<% partial('item-post.ejs.md', {listing, item, options}) %>
<% } %>
:::
<% partial('\_pagination.ejs.md', {listing, items, options}) %>
