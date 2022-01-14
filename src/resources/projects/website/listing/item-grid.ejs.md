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

// Fields that should be bucketized into the general listing at the bottom
const otherFields = fields.filter(field => {
return !["title", "image", "card-cap-text", "date", "author", "subtitle", "description", "filename", "filemodified"].includes(field);
});
%>


<div class="<%-`g-col-lg-${cardColumnSpan}`%> <%-`g-col-md-${cardColumnSpanMd}`%> g-col-24">
<div class="quarto-grid-item card h-100 <%-`card-${align}`%>">
<% if (item.image) { %><p class="card-img-top"><img src="<%- item.image %>"<%= imgHeight ? ` height="${imgHeight}"` : '' %> class="thumbnail-image card-img"></p>
<% } else { %>
<div class="card-img-top"<%= imgHeight ? ` style="height: ${imgHeight}px;"` : '' %>><%= (item['card-cap-text']) ? listing.utilities.outputLink(item, 'card-cap-text') : "&nbsp;" %></div>
<% } %>
<div class="card-body"><a href="<%- item.path %>" class="post-contents">
<% if (fields.includes('title') && item.title) { %><h5 class="no-anchor card-title title<%-listing.utilities.sortClass('title')%>"<%=listing.utilities.sortAttr(item, 'title')%>><%= listing.utilities.outputLink(item, 'title') %></h5><% } %>
<% if (fields.includes('subtitle') && item.subtitle) { %>
<div class="card-subtitle subtitle<%-listing.utilities.sortClass('subtitle')%>"<%=listing.utilities.sortAttr(item, 'subtitle')%>><%= listing.utilities.outputLink(item, 'subtitle') %></div>
<% } %>
<% if (fields.includes('description') && item.description) { %>
<div class="card-text description<%-listing.utilities.sortClass('description')%>"<%=listing.utilities.sortAttr(item, 'description')%>><%= item.description %></div>
<% } %>
<% 
const showAuthor = fields.includes('author') && item.author;
const showDate = fields.includes('date') && item.date;
const flexJustify = showAuthor && showDate ? "justify" : showAuthor ? "start" : "end";
%>
<% if (showAuthor || showDate) { %>
<div class="card-attribution card-text-small <%-flexJustify%>">
<% if (showAuthor) { %><div class="author"><%= item.author %></div><% } %>
<% if (showDate) { %><div class="date"><%= item.date %></div><% } %></div>
<% } %>

<% if (otherFields.length > 0) { %>
<table class="card-other-values">
<% for (const field of otherFields) { %>
<tr>
<td><%= listing.utilities.fieldName(field) %></td>
<td class="<%-field%><%-listing.utilities.sortClass(field)%>"<%=listing.utilities.sortAttr(item, field)%>><%= listing.utilities.outputLink(item, field) %></td>
</tr>
<% } %>
</table>
<% } %>

</a></div>

<% if (fields.includes('filename') || fields.includes('filemodified')) { %>
<div class="card-footer text-muted">
<% if (fields.includes('filename')) { %>
<div class="card-filename filename<%-listing.utilities.sortClass('filename')%>"<%=listing.utilities.sortAttr(item, 'filename')%>>
<%= item.filename ? listing.utilities.outputLink(item, 'filename') : "&nbsp;" %>
</div>
<% } %>
<% if (fields.includes('filemodified')) { %>
<div class="card-filemodified filemodified<%-listing.utilities.sortClass('filemodified')%>"<%=listing.utilities.sortAttr(item, 'filemodified')%>>
<%= item.filemodified ? listing.utilities.outputLink(item, 'filemodified') : "&nbsp;"%>
</div>
<% } %>
</div>

<% } %>

</div>
</div>
