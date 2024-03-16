<%
// The Fields
const fields = listing.fields;

// Whether to enable sorting
const sortUi = listing["sort-ui"] !== false;

// The height for images
const imgHeight = listing['image-height'];

// Striped?
const stripedCls = listing['table-striped'] ? " table-striped" : "";

const sortFields = listing.utilities.sortableFieldData().map(fieldData => fieldData.listingSort.field);
const hasSort = (field) => {
if (sortFields.includes(field)){
return true;
} else if (sortFields.includes(`listing-${field}`) || sortFields.includes(`listing-${field}-sort`)) {
return true;
} else {
return false;
}
};

// hover
const hoverCls = listing['table-hover'] ? " table-hover" : "";
const onclick = (item) => {
if (listing['table-hover']) {
return ` onclick="href = this.querySelector('a').getAttribute('href');\n if (href) { window.location=href ; return false; }"`;
} else {
return "";
}
}

const readField = (item, field) => {

let value = item[field];
if (field.includes(".") && !field.endsWith(".") && !field.startsWith(".")) {
const fields = field.split(".");
value = item;
for (const deref of fields) {
value = value[deref];
}
}

if (Array.isArray(value)) {
value = value.join(", ");
}

return value;
}

const outputValue = (itemNumber, field) => {
let value = readField(item, field);

if (field === "image") {
if (item.image) {
value = listing.utilities.img(itemNumber, item[field], "", item['image-alt']);
} else {
value = listing.utilities.imgPlaceholder(itemNumber, item.outputHref);
}
}
return listing.utilities.outputLink(item, field, value, `listing-${field}`);
}
%>

<table class="quarto-listing-table table<%- stripedCls %><%- hoverCls %>">
<thead>
<tr>
<% for (const field of fields) { %>
<th>
<% if (sortUi && hasSort(field)) { %><a class="sort" data-sort="<%-listing.utilities.sortTarget(field)%>" onclick="if (this.classList.contains('sort-asc')) { this.classList.add('sort-desc'); this.classList.remove('sort-asc') } else { this.classList.add('sort-asc'); this.classList.remove('sort-desc')} return false;"><% } %><%= listing.utilities.fieldName(field) %><% if (sortUi && hasSort(field)) { %></a><% } %>
</th>
<% } %>
</tr>
</thead>
<tbody class="list">
<% for (item of items) { 
  // Capture the item number for utility functions that need it
  const itemNumber = listing.utilities.itemNumber();
%>

<tr <%= listing.utilities.metadataAttrs(item) %><%= onclick(item) %>>
<% for (const field of fields){ %>
<td>
<%= outputValue(itemNumber, field) %>
</td>
<% } %>
</tr>
<% } %>
</tbody>
</table>
