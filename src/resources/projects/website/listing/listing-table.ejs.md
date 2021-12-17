<%
const colNames = {
"date": "Date",
"title": "Title",
"description": "Description",
"author": "Author",
"filename": "File Name",
...listing.options?.["column-names"] || {}
}
%>
<% %>
<% const cols = listing.options?.columns || ["date", "title", "description", "author", "filename"] %>
<% const links = listing.options?.['column-links'] || ["title", "filename"] %>

| <% for (col of cols) { %> <%= colNames[col] ? colNames[col] : col %> | <% } %>
| <% for (col of cols) { %> ---- | <% } %>
<% for (item of items) { %>| <% for (col of cols){ %> <%= item[col] !== undefined ? links.includes(col) ? `[${item[col]}](${item.path})` : item[col] : "&nbsp;" %> | <% } %>
<% } %>
