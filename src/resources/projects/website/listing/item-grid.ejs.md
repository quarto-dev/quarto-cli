<%
// Fields
const fields = listing.fields;

// The column span for cards
const cardColumnSpan = listing['card-column-span'] || 8;
const cardColumnSpanMd = Math.max(cardColumnSpan, 12)

// Card alignment
const align = listing["alignment"] || "left";

// Cap Options
const imgHeight = listing['image-height'];

// Borders
const hideBorders = listing['card-border'] === false;

// shorthand checks
const showField = (field) => {
  return listing.fields.includes(field) && item[field] !== undefined;
}

// Capture the item number for utility functions that need it
const itemNumber = listing.utilities.itemNumber();

// Fields that should be bucketized into the general listing at the bottom
const otherFields = fields.filter(field => {
return !["title", "image", "date", "author", "subtitle", "description", "filename", "file-modified", "reading-time", "categories"].includes(field);
});
%>


<div class="g-col-1" <%= listing.utilities.metadataAttrs(item) %>>
<div class="quarto-grid-item card h-100 <%-`card-${align}`%><%= hideBorders ? ' borderless' : '' %>">
<% if (fields.includes('image')) { %>
<% if (item.image) { %><p class="card-img-top"><a href="<%- item.path %>"><%= listing.utilities.img(itemNumber, item.image, "thumbnail-image card-img") %></a></p>
<% } else { %><a href="<%- item.path %>"><div class="card-img-top"<%= imgHeight ? ` style="height: ${imgHeight};"` : '' %>></div></a><% } %><% } %>
<% if (showField('title') || showField('subtitle') || showField('description') || showField('author') || showField('date') || otherFields.length > 0) { %><div class="card-body post-contents">
<% if (showField('title')) { %><a href="<%- item.path %>"><h5 class="no-anchor card-title listing-title"><%= listing.utilities.outputLink(item, 'title') %></h5></a><% } %>
<% if (showField('subtitle')) { %>
<div class="card-subtitle listing-subtitle"><a href="<%- item.path %>"><%= item.subtitle %></a></div>
<% } %>
<% if (showField('reading-time')) { %><div class="listing-reading-time card-text text-muted"><a href="<%- item.path %>"><%= item['reading-time'] %></a></div> <% } %>
<% if (fields.includes('categories') && item.categories) { %> 
<div class="listing-categories">
<% for (const category of item.categories) { %>
<div class="listing-category"><a href="<%- item.path %>"><%= category %></a></div>
<% } %>
</div>
<% } %> 
<% if (showField('description')) { %>
<div class="card-text listing-description"><%= item.description %></div>
<% } %>
<% 
const flexJustify = showField('author') && showField('date') ? "justify" : showField('author') ? "start" : "end";
%>
<% if (showField('author') || showField('date')) { %>
<div class="card-attribution card-text-small <%-flexJustify%>">
<% if (showField('author')) { %><div class="listing-author"><a href="<%- item.path %>"><%= item.author %></a></div><% } %>
<% if (showField('date')) { %><div class="listing-date"><a href="<%- item.path %>"><%= item.date %></a></div><% } %></div>
<% } %>

<% if (otherFields.length > 0) { %>
<table class="card-other-values">
<% for (const field of otherFields) { %>
<tr>
<td><%= listing.utilities.fieldName(field) %></td>
<td class="<%-field%>"><%= listing.utilities.outputLink(item, field) %></td>
</tr>
<% } %>
</table>
<% } %>

</a></div>
<% } %>

<% if (fields.includes('filename') || fields.includes('file-modified')) { %>
<div class="card-footer text-muted">
<% if (fields.includes('filename')) { %>
<div class="card-filename listing-filename">
<%= item.filename ? listing.utilities.outputLink(item, 'filename') : "&nbsp;" %>
</div>
<% } %>
<% if (fields.includes('file-modified')) { %>
<div class="card-file-modified listing-file-modified">
<%= item['file-modified'] ? listing.utilities.outputLink(item, 'file-modified') : "&nbsp;"%>
</div>
<% } %>
</div>

<% } %>

</div>
</div>
