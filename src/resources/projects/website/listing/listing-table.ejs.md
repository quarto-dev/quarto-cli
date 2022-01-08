<%
// Column information
const cols = options.columns;
const colNames = options["column-names"];
const colSortTargets = options["column-sort-targets"];
const links = options["column-links"];

const allowSort = options["allow-sort"] !== false;
const allowFilter = options["allow-filter"] !== false;
const rowCount = options["row-count"];

const imgHeight = options['image-height'];

const outputValue = (col) => {

const linkify = (value) => {
const path = item.path;
if (path && value !== undefined && links.includes(col)) {
return `<a href="${path}">${value}</a>`;
} else {
return value;
}
}

let value = item[col];
if (col === "image") {
if (item.image) {
value = `<img src="${item[col]}" ${imgHeight ? ` height="${imgHeight}"` : ''}>`;
} else {
value = `<div class="table-img" ${imgHeight ? ` style="height: ${imgHeight}px;"` : '' }>&nbsp;</div>`;
}
}
return linkify(value);
}

%>

<% partial('_filter.ejs.md', {listing, items, options}) %>

```{=html}
<table class="quarto-listing table">
<thead>
  <tr>
  <% for (col of cols) { %>
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
        <%= outputValue(col) %>
      </td>
    <% } %>
  </tr>
<% } %>
</tbody>
</table>
```
<% partial('_pagination.ejs.md', {listing, items, options}) %>
