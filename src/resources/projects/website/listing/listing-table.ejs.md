<%
// Column information
const cols = listing.columns;

const showSort = listing["show-sort"] !== false;
const imgHeight = listing['image-height'];

const outputValue = (col) => {
let value = item[col];
if (col === "image") {
if (item.image) {
value = `<img src="${item[col]}" ${imgHeight ? ` height="${imgHeight}"` : ''}>`;
} else {
value = `<div class="table-img" ${imgHeight ? ` style="height: ${imgHeight}px;"` : '' }>&nbsp;</div>`;
}
}
return listing.utilities.outputLink(col, item, value);
}
%>

<% partial('\_filter.ejs.md', {listing}) %>

```{=html}
<table class="quarto-listing table">
<thead>
  <tr>
  <% for (col of cols) { %>
    <th>
    <% if (showSort) { %>
    <a class="sort" data-sort="<%-listing.utilities.sortTarget(col)%>" onclick="return false;">
    <% } %>
    <%= listing.utilities.columnName(col) %>
    <% if (showSort) { %>
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
      <td class="<%- col %><%-listing.utilities.sortClass(col) %>"<%- listing.utilities.sortAttr(col, item)%>>
        <%= outputValue(col) %>
      </td>
    <% } %>
  </tr>
<% } %>
</tbody>
</table>
```

<% partial('\_pagination.ejs.md', {listing, items}) %>
