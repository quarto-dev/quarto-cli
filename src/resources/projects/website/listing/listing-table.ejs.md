<%
// Column information
const cols = options.columns;
const colNames = options["column-names"];
const colSortTargets = options["column-sort-targets"];
const links = options["column-links"];

const allowSort = options["allow-sort"] !== false;
const allowFilter = options["allow-filter"] !== false;
const rowCount = options["row-count"];
%>

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
    <a class="sort" data-sort="<%-colSortTargets[col]%>" onclick="return false;">
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
      <td class="<%- col %><%-colSortTargets[col] !== col ? ' ' + colSortTargets[col] : '' %>" <%- colSortTargets[col] !== col ? `data-${colSortTargets[col]}=${item.sortableValues[col]}` : ""%>>
        <%= item[col] !== undefined ? links.includes(col) ? `<a href="${item.path}">${item[col]}</a>` : item[col] : "&nbsp;" %>
      </td>
    <% } %>
  </tr>
<% } %>
</tbody>
</table>
<% if (rowCount < items.length) { %>
<ul class="pagination"></ul>
<% } %>
```
