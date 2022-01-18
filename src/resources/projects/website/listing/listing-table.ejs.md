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
value = `<img src="${item[field]}" ${imgHeight ? ` style="height: ${imgHeight};"` : ''}>`;
} else {
value = `<div class="table-img" ${imgHeight ? ` style="height: ${imgHeight};"` : '' }>&nbsp;</div>`;
}
}
return listing.utilities.outputLink(item, field, value);
}
%>

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
<% for (item of items) { %>
<tr <%= listing.utilities.metadataAttrs(item) %>>
<% for (const field of fields){ %>
<td class="listing-<%- field %>">
<%= outputValue(field) %>
</td>
<% } %>
</tr>
<% } %>
</tbody>
</table>
