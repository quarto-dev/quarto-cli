<%
// Column information
const cols = listing.columns;
const colNames = listing["column-names"];
const colSortTargets = listing["column-sort-targets"];
const links = listing["column-links"];

const allowSort = listing["allow-sort"] !== false;
const allowFilter = listing["allow-filter"] !== false;
const rowCount = listing["row-count"];

const imgHeight = listing['image-height'];

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

<% partial('_filter.ejs.md', {listing, items}) %>

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
<% partial('_pagination.ejs.md', {listing, items}) %>
