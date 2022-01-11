
<% partial('_filter.ejs.md', {listing, showSort: listing['show-sort'], showFilter: listing['show-filter']}) %>
:::{.list .grid}
<% for (const item of items) { %>
  <% partial('item-grid.ejs.md', {listing, item}) %>
<% } %>
:::
<% partial('_pagination.ejs.md', {listing, items}) %>
