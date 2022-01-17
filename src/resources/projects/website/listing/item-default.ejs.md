<%
// Fields
const fields = listing.fields;

// Image properties
const imageAlign = listing['image-align'] || 'left';
const imageHeight = listing['image-height'];

// Fields that don't have a known place to be displayed in this template
const otherFields = fields.filter(field => {
  return !["title", "image", "date", "author", "subtitle", "description"].includes(field);
});


// Writes a metadata value
const outputMetadata = (item, field) => {
  if (item[field] !== undefined) {
    print(`<div class="metadata-value ${field}${listing.utilities.sortClass(field)}" ${listing.utilities.sortAttr(item, field)}>${listing.utilities.outputLink(item, field)}</div>`);  
  } 
}
%>

<div class="quarto-post image-<%= imageAlign %>" <%- listing.utilities.metadataAttrs(item) %>>
<% if (fields.includes('image')) { %>
<div class="thumbnail"><% if (item.image) { %>
<a href="<%- item.path %>" class="post-contents">
<img src="<%- item.image %>"<%- imageHeight ? ` height="${imageHeight}"` : '' %> class="thumbnail-image">
</a>
<% } else { %>
<div class="thumbnail-image"<%= imageHeight ? ` style="height: ${imageHeight}px;"` : '' %>></div><% } %>
</div>
<% } %>
<div class="body"><a href="<%- item.path %>" class="post-contents"><% if (fields.includes('title')) { %>
<h3 class="no-anchor title<%-listing.utilities.sortClass('title')%>" <%=listing.utilities.sortAttr(item, 'title')%>>
<%= item.title %>
</h3>
<% } %>
<% if (fields.includes('description')) { %><p class="description<%-listing.utilities.sortClass('description')%>"<%-listing.utilities.sortAttr(item, 'description')%>>
<%= item.description %>
</p><% } %></a></div>
<div class="metadata">
<% if (fields.includes('date') && item.date) { %><div class="date<%-listing.utilities.sortClass('date')%>"<%-listing.utilities.sortAttr(item, 'date')%>><%= item.date %></div><% } %>
<% if (fields.includes('author') && item.author) { %><div class="author<%-listing.utilities.sortClass('author')%>"<%-listing.utilities.sortAttr(item, 'author')%>><%= item.author %></div><% } %>
<% for (const field of otherFields) { %>
<% outputMetadata(item, field) %>
<% } %>
</div>
</div>

