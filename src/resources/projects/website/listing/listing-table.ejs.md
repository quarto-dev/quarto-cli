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
<% const cols = listing.options?.columns || ["date", "title", "description", "author", "filename"] %>
<% const links = listing.options?.['column-links'] || ["title", "filename"] %>
<% const allowSort = listing.options?.['allow-sort'] !== false %>
<% const allowFilter = listing.options?.['allow-filter'] !== false %>
<% const allowPage = listing.options?.['allow-page'] !== false %>
<% const pageLength = listing.options?.['rows'] || 20 %>

```{=html}
<% if (allowFilter) { %>
<div class="input-group input-group-sm quarto-listing-filter" style="width: 33%; float: right;">
<span class="input-group-text" id="basic-addon1"><i class="bi bi-search"></i></span>
<input type="text" class="search form-control" placeholder="Filter" />
</div>
<% } %>
<table class="table">
<thead>
  <tr>
  | <% for (col of cols) { %>
    <th>
    <% if (allowSort) { %>
    <a class="sort" data-sort="<%= col %>" onclick="return false;">
    <% } %>
    <%= colNames[col] ? colNames[col] : col %>
    <% if (allowSort) { %>
    </a>
    <% } %>
    </th>
  <% } %>
  </tr>
</thead>
<tbody class="list">
<% for (item of items) { %>
  <tr>
    <% for (col of cols){ %>
      <td class="<%- col %>">
        <%= item[col] !== undefined ? links.includes(col) ? `<a href="${item.path}">${item[col]}</a>` : item[col] : "&nbsp;" %>
      </td>
    <% } %>
  </tr>
<% } %>
</tbody>
</table>
<% if (pageLength < items.length) { %>
<ul class="pagination"></ul>
<% } %>
```
