<%
// Fields
const fields = listing.fields;

// Image properties
const imageAlign = listing['image-align'] || 'left';
const imageHeight = listing['image-height'];

// Fields that don't have a known place to be displayed in this template
const otherFields = fields.filter(field => {
return !["title", "image", "image-alt", "date", "author", "subtitle", "description", "reading-time", "categories"].includes(field);
});

// Capture the item number for utility functions that need it
const itemNumber = listing.utilities.itemNumber();

// Writes a metadata value
const outputMetadata = (item, field) => {

const readField = (item, field) => {
let value = item[field];
if (field.includes(".") && !field.endsWith(".") && !field.startsWith(".")) {
const fields = field.split(".");
value = item;
for (const deref of fields) {
value = value[deref];
}
}
return value;
}

let value = readField(item, field);
if (value !== undefined) {
print(`<div class="metadata-value listing-${field}">${listing.utilities.outputLink(item, field, value)}</div>`);  
 }
}
%>

<div class="quarto-post image-<%= imageAlign %>" <%= listing.utilities.metadataAttrs(item) %>>
<% if (fields.includes('image')) { %>
<div class="thumbnail">
<a href="<%- item.path %>" class="no-external">
<% if (item.image) { %>
<%= listing.utilities.img(itemNumber, item.image, "thumbnail-image", item['image-alt'], item['image-lazy-loading'] ?? listing['image-lazy-loading']) %>
<% } else { %>
<%= listing.utilities.imgPlaceholder(listing.id, itemNumber, item.outputHref) %>
<% } %>
</a>
</div>
<% } %>
<div class="body">
<% if (fields.includes('title')) { %>
<h3 class="no-anchor listing-title"><a href="<%- item.path %>" class="no-external"><%= item.title %></a></h3>
<div class="listing-subtitle"><a href="<%- item.path %>" class="no-external"><%= item.subtitle %></a></div>
<% } %>
<% if (fields.includes('categories') && item.categories) { %> 
<div class="listing-categories">
<% for (const category of item.categories) { %>
<div class="listing-category" onclick="window.quartoListingCategory('<%=category%>'); return false;"><%= category %></div>
<% } %>
</div>
<% } %> 
<% if (fields.includes('description')) { %>
<div class="delink listing-description"><a href="<%- item.path %>" class="no-external"><%= item.description %></a></div>
<% } %>
</div>
<div class="metadata"><a href="<%- item.path %>" class="no-external">
<% if (fields.includes('date') && item.date) { %><div class="listing-date">`<%= item.date %>`{=html}</div><% } %>
<% if (fields.includes('author') && item.author) { %><div class="listing-author"><%= item.author %></div><% } %>
<% if (fields.includes('reading-time') && item['reading-time']) { %> <div class="listing-reading-time"><%= item['reading-time'] %></div> <% } %>
<% for (const field of otherFields) { %>
<% outputMetadata(item, field) %><% } %></a></div>

</div>
