<%
// Fields
const fields = listing.fields;

// Card alignment
const align = listing["grid-item-align"] || "left";

// Borders
const hideBorders = listing['grid-item-border'] === false;

// Cap Options
const imgHeight = listing['image-height'];

// shorthand checks
const showField = (field) => {
return listing.fields.includes(field) && item[field] !== undefined;
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
return value;
}

// Capture the item number for utility functions that need it
const itemNumber = listing.utilities.itemNumber();

// Fields that should be bucketized into the general listing at the bottom
const otherFields = fields.filter(field => {
return !["title", "image", "image-alt", "date", "author", "subtitle", "description", "filename", "file-modified", "reading-time", "categories"].includes(field);
});
%>

<div class="g-col-1" <%= listing.utilities.metadataAttrs(item) %>>
<a href="<%- item.path %>" class="quarto-grid-link">
<div class="quarto-grid-item card h-100 <%-`card-${align}`%><%= hideBorders ? ' borderless' : '' %>">

<% if (fields.includes('image')) { %>

<% if (item.image) { %>

<p class="card-img-top">
<%= listing.utilities.img(itemNumber, item.image, "thumbnail-image card-img", item['image-alt']) %>
</p>
<% } else { %>
<%= listing.utilities.imgPlaceholder(itemNumber, item.outputHref) %>
<% } %>

<% } %>
<% if (showField('title') || showField('subtitle') || showField('description') || showField('author') || showField('date') || otherFields.length > 0) { %>

<div class="card-body post-contents">
<% if (showField('title')) { %><h5 class="no-anchor card-title listing-title"><%= item.title %></h5><% } %>
<% if (showField('subtitle')) { %><div class="card-subtitle listing-subtitle"><%= item.subtitle %></div><% } %>
<% if (showField('reading-time')) { %><div class="listing-reading-time card-text text-muted"><%= item['reading-time'] %></div> <% } %>

<% if (fields.includes('categories') && item.categories) { %>

<div class="listing-categories">
  <% for (const category of item.categories) { %>
<div class="listing-category" onclick="window.quartoListingCategory('<%=category%>'); return false;"><%= category %></div>
  <% } %>
</div>

<% } %>
<% if (showField('description')) { %>

<div class="card-text listing-description delink"><%= item.description %></div>
<% } %>
<% 
const flexJustify = showField('author') && showField('date') ? "justify" : showField('author') ? "start" : "end";
%>
<% if (showField('author') || showField('date')) { %>
<div class="card-attribution card-text-small <%-flexJustify%>">
<% if (showField('author')) { %><div class="listing-author"><%= item.author %></div><% } %>
<% if (showField('date')) { %><div class="listing-date">`<%= item.date %>`{=html}</div><% } %>
</div>
<% } %>

<% if (otherFields.length > 0) { %>

<table class="card-other-values">
<% for (const field of otherFields) { 
let value = readField(item, field);  
%>
<tr>
<td><%= listing.utilities.fieldName(field) %></td>
<td class="<%-field%>"><%= listing.utilities.outputLink(item, field, value) %></td>
</tr>
<% } %>
</table>

<% } %>

</div>
<% } %>

<% if (fields.includes('filename') || fields.includes('file-modified')) { %>

<div class="card-footer">
<% if (fields.includes('filename')) { %>
<div class="card-filename listing-filename">
<%= item.filename ? item.filename : "&nbsp;" %>
</div>
<% } %>
<% if (fields.includes('file-modified')) { %>
<div class="card-file-modified listing-file-modified">
<%= item['file-modified'] ? item['file-modified'] : "&nbsp;"%>
</div>
<% } %>
</div>
<% } %>
</div></a></div>
