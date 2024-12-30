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

::: {.g-col-1 <%= listing.utilities.metadataAttrs(item) %> }

```{=html}
<a href="<%- item.path %>" class="quarto-grid-link">
<div class="quarto-grid-item card h-100 <%- `card-${align}` %><%- hideBorders ? ' borderless' : '' %>">
```

<% if (fields.includes('image')) { %>
<% if (item.image) { %>
`<p class="card-img-top">`{=html}
<%= listing.utilities.img(itemNumber, item.image, "thumbnail-image card-img", item['image-alt'], item['image-lazy-loading'] ?? listing['image-lazy-loading']) %>
`</p>`{=html}
<% } else { %>
<%= listing.utilities.imgPlaceholder(listing.id, itemNumber, item.outputHref) %>
<% } %>

<% } %>
<% if (showField('title') || showField('subtitle') || showField('description') || showField('author') || showField('date') || otherFields.length > 0) { %>

`<div class="card-body post-contents">`{=html}

<% if (showField('title')) { %>
`<h5 class="no-anchor card-title listing-title">`{=html} <%= item.title %> `</h5>`{=html}
<% } %>

<% if (showField('subtitle')) { %>
`<div class="card-subtitle listing-subtitle">`{=html} <%= item.subtitle %> `</div>`{=html}
<% } %>

<% if (showField('reading-time')) { %>
`<div class="listing-reading-time card-text text-muted">`{=html} <%= item['reading-time'] %> `</div>`{=html}
<% } %>

<% if (fields.includes('categories') && item.categories) { %>
`<div class="listing-categories">`{=html}

<% for (const category of item.categories) { %>
`<div class="listing-category" onclick="window.quartoListingCategory('<%- utils.b64encode(category ) %>'); return false;">`{=html} <%= category %> `</div>`{=html}
<% } %>

`</div>`{=html}
<% } %>

<% if (showField('description')) { %>
`<div class="card-text listing-description delink">`{=html} <%= item.description %> `</div>`{=html}
<% } %>

<%
const flexJustify = showField('author') && showField('date') ? "justify" : showField('author') ? "start" : "end";
%>

<% if (showField('author') || showField('date')) { %>
`<div class="card-attribution card-text-small <%- flexJustify %>">`{=html}

<% if (showField('author')) { %>
`<div class="listing-author">`{=html} <%= item.author %> `</div>`{=html}
<% } %>

<% if (showField('date')) { %>
`<div class="listing-date">`{=html} <%= item.date %> `</div>`{=html}
<% } %>

`</div>`{=html}
<% } %>

<% if (otherFields.length > 0) { %>
`<table class="card-other-values">`{=html}
<% for (const field of otherFields) {
let value = readField(item, field);
%>
`<tr>`{=html}
`<td>`{=html} <%= listing.utilities.fieldName(field) %> `</td>`{=html}
`<td class="<%- field %>">`{=html} <%= listing.utilities.outputLink(item, field, value) %> `</td>`{=html}
`</tr>`{=html}
<% } %>
`</table>`{=html}
<% } %>

`</div>`{=html}
<% } %>

<% if (fields.includes('filename') || fields.includes('file-modified')) { %>

`<div class="card-footer">`{=html}

<% if (fields.includes('filename')) { %>
`<div class="card-filename listing-filename">`{=html} <%= item.filename ? item.filename : "&nbsp;" %> `</div>`{=html}
<% } %>

<% if (fields.includes('file-modified')) { %>
`<div class="card-file-modified listing-file-modified">`{=html} <%= item['file-modified'] ? item['file-modified'] : "&nbsp;" %> `</div>`{=html}
<% } %>

`</div>`{=html}
<% } %>
`</div></a>`{=html}

:::
