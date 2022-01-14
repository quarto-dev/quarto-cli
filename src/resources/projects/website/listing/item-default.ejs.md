<%
// Fields
const fields = listing.fields;

// Image properties
const imageAlign = listing['image-align'] || 'left';
const imageHeight = listing['image-height'];

// Fields that don't have a known place to be displayed in this template
const otherFields = fields.filter(field => {
  return !["title", "image", "author", "subtitle", "description"].includes(field);
});


// Writes a metadata value
const outputMetadata = (item, field) => {
  if (item[field] !== undefined) {
    print(`<div class="metadata-value ${field}${listing.utilities.sortClass(field)}" ${listing.utilities.sortAttr(item, field)}>${listing.utilities.outputLink(item, field)}</div>`);  
  } 
}
%>

<div class="quarto-post image-<%= imageAlign %>">
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
<h2 class="title<%-listing.utilities.sortClass('title')%>" <%=listing.utilities.sortAttr(item, 'title')%>>
<%= item.title %>
</h2>
<% } %>
<% if (fields.includes('author') && item.author) { %><p class="authors<%-listing.utilities.sortClass('author')%>"<%-listing.utilities.sortAttr(item, 'author')%>><%= item.author %></p><% } %>
<% if (fields.includes('description')) { %><p class="description<%-listing.utilities.sortClass('description')%>"<%-listing.utilities.sortAttr(item, 'description')%>>
<%= item.description %>
</p>
<% } %></a>
</div>
<div class="metadata">
<% for (const field of otherFields) { %>
<% outputMetadata(item, field) %>
<% } %>
</div>
</div>

