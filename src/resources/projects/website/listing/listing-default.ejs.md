<% partial('_filter.ejs.md', {listing, items}) %>
:::{.list}
<% for (const item of items) { %>
<% partial('item-default.ejs.md', {listing, item}) %>
<% } %>
:::
<% partial('_pagination.ejs.md', {listing, items}) %>
