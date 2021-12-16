<% const cols = listing.options.columns || ["date", "title", "description", "author", "filename"] %>
<% const links = listing.options['link-columns'] || ["title", "filename"] %>

| <% for (col of cols) { %> <%= col %> | <% } %>
| <% for (col of cols) { %> ---- | <% } %>
<% for (item of items) { %><% for (col of cols) { %>| <%= item[col] !== undefined ? links.includes(col) ? `[${item[col]}](${item.path})` : item[col] : "&nbsp;" %> | <% } %>
<% } %>
