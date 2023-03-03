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
if (item[field] !== undefined) {
print(`<div class="metadata-value listing-${field}">${listing.utilities.outputLink(item, field)}</div>`);  
 }
}
%>

<div class="quarto-post image-<%= imageAlign %>" <%= listing.utilities.metadataAttrs(item) %>>
<% if (fields.includes('image')) { %>
<div class="thumbnail">
<a href="<%- item.path %>">
<% if (item.image) { %>
<%= listing.utilities.img(itemNumber, item.image, "thumbnail-image", item['image-alt']) %>
<% } else { %>
<%= listing.utilities.imgPlaceholder(itemNumber, item.outputHref) %>
<% } %>
</a>
</div>
<% } %>
<div class="body"><a href="<%- item.path %>">
<% if (fields.includes('title')) { %>
<h3 class="no-anchor listing-title"><%= item.title %></h3>
<div class="listing-subtitle"><%= item.subtitle %></div>
<% } %>
<% if (fields.includes('categories') && item.categories) { %> 
</a>
<div class="listing-categories">
<% for (const category of item.categories) { %>
<div class="listing-category" onclick="window.quartoListingCategory('<%=category%>'); return false;"><%= category %></div>
<% } %>
</div>
<a href="<%- item.path %>">
<% } %> 
<% if (fields.includes('description')) { %>
<div class="delink listing-description">
<%= item.description %>
</div>
<% } %>
</a></div>
<div class="metadata"><a href="<%- item.path %>">
<% if (fields.includes('date') && item.date) { %><div class="listing-date">`<%= item.date %>`{=html}</div><% } %>
<% if (fields.includes('author') && item.author) { %><div class="listing-author"><%= item.author %></div><% } %>
<% if (fields.includes('reading-time') && item['reading-time']) { %> <div class="listing-reading-time"><%= item['reading-time'] %></div> <% } %>
<% for (const field of otherFields) { %>
<% outputMetadata(item, field) %><% } %></a></div>

</div>
