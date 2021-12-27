<%
const colNames = options["column-names"];
const cols = options.columns;
const colTypes = options["column-types"];

const links = options["column-links"];
const allowSort = options["allow-sort"] !== false;
const allowFilter = options["allow-filter"] !== false;
const pageLength = options["rows"];

const useDataValue = (col) => {
const colType = colTypes[col];
if (colType === 'date' || colType === 'number') {
return true;
} else {
if (links.includes(col)) {
return true;
}
}
return false;
}

const dataValue = (col, item) => {
return item.sortableValueFields[col];
}
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
    <a class="sort" data-sort="<%- useDataValue(col) ? `${col}-value` : col %>" onclick="return false;">
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
      <% console.log(item); %>
  <tr>
    <% for (col of cols){ %>
      <td class="<%- col %><%-useDataValue(col) ? ` ${col}-value` : '' %>" <%- useDataValue(col) ? `data-${col}-value=${item.sortableValues[col]}` : ""%>>
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
