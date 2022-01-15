<%
// The Fields
const fields = listing.fields;

// Whether to enable sorting
const showSort = listing["show-sort"] !== false;

// The height for images
const imgHeight = listing['image-height'];

const outputValue = (field) => {
  let value = item[field];
  if (field === "image") {
    if (item.image) {
      value = `<img src="${item[field]}" ${imgHeight ? ` height="${imgHeight}"` : ''}>`;
    } else {
      value = `<div class="table-img" ${imgHeight ? ` style="height: ${imgHeight}px;"` : '' }>&nbsp;</div>`;
    }
  }
  return listing.utilities.outputLink(item, field, value);
}
%>

<% partial('\_filter.ejs.md', {listing}) %>

<table class="quarto-listing-table table">
<thead>
<tr>
<% for (const field of fields) { %>
<th>
<% if (showSort) { %><a class="sort" data-sort="<%-listing.utilities.sortTarget(field)%>" onclick="return false;"><% } %><%= listing.utilities.fieldName(field) %><% if (showSort) { %></a><% } %>
</th>
<% } %>
</tr>
</thead>
<tbody class="list">
<% let counter = 0 %>
<% for (item of items) { %>
<% let originalCls = "original-value " %>
<% let originalAttr = ` data-original-value='${counter++}'` %>
<tr>
<% for (const field of fields){ %>
<td class="<%- originalCls %><%- field %><%-listing.utilities.sortClass(field) %>"<%= originalAttr %><%=listing.utilities.sortAttr(item, field)%>>
<%= outputValue(field) %>
</td>
  <% 
  originalCls = "";
  originalAttr = "";
  %>
<% } %>
</tr>
<% } %>
</tbody>
</table>

<% partial('\_pagination.ejs.md', {listing, items}) %>
