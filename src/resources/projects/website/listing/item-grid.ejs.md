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
<div class="quarto-grid-item card h-100 <%= `card-${align}` %><%= hideBorders ? ' borderless' : '' %>">
```

<% if (fields.includes('image')) { %>

<% if (item.image) { %>

```{=html}
<p class="card-img-top">
<%= listing.utilities.img(itemNumber, item.image, "thumbnail-image card-img", item['image-alt'], item['image-lazy-loading'] ?? listing['image-lazy-loading']) %>
</p>
```

<% } else { %>

```{=html}
<%= listing.utilities.imgPlaceholder(listing.id, itemNumber, item.outputHref, item['image-lazy-loading'] ?? listing['image-lazy-loading']) %>
```

<% } %>
<% } %>

<% if (showField('title') || showField('subtitle') || showField('description') || showField('author') || showField('date') || otherFields.length > 0) { %>

::: {.card-body .post-contents}

<% if (showField('title')) { %>
<h5 class="no-anchor card-title listing-title"><%= item.title %></h5>
<% } %>

<% if (showField('subtitle')) { %>
<div class="card-subtitle listing-subtitle"><%= item.subtitle %></div>
<% } %>

<% if (showField('reading-time')) { %>

```{=html}
<div class="listing-reading-time card-text text-muted"><%= item['reading-time'] %></div>
```

<% } %>

<% if (fields.includes('categories') && item.categories) { %>

```{=html}
<div class="listing-categories">
<% for (const category of item.categories) { %>
<div class="listing-category" onclick="window.quartoListingCategory('<%= utils.b64encode(category ) %>'); return false;"><%= category %></div>
<% } %>
</div>
```

<% } %>

<% if (showField('description')) { %>

```{=html}
<div class="card-text listing-description delink">
```

<%= item.description %>

```{=html}
</div>
```

<% } %>

<%
const flexJustify = showField('author') && showField('date') ? "justify" : showField('author') ? "start" : "end";
%>

<% if (showField('author') || showField('date')) { %>

```{=html}
<div class="card-attribution card-text-small <%- flexJustify %>">
```

<% if (showField('author')) { %>
<div class="listing-author"><%= item.author %></div>
<% } %>

<% if (showField('date')) { %>
<div class="listing-date"><%= item.date %></div>
<% } %>

```{=html}
</div>
```

<% } %>

<% if (otherFields.length > 0) { %>

```{=html}
<table class="card-other-values">
<% for (const field of otherFields) {
let value = readField(item, field);
%>
<tr>
```

<td><%= listing.utilities.fieldName(field) %></td>
<td class="<%- field %>"><%= listing.utilities.outputLink(item, field, value) %></td>

```{=html}
</tr>
<% } %>
</table>
```

<% } %>

:::
<% } %>

<% if (fields.includes('filename') || fields.includes('file-modified')) { %>

::: {.card-footer}

<% if (fields.includes('filename')) { %>

```{=html}
<div class="card-filename listing-filename"><%= item.filename ? item.filename : "&nbsp;" %></div>
```

<% } %>

<% if (fields.includes('file-modified')) { %>

```{=html}
<div class="card-file-modified listing-file-modified"><%= item['file-modified'] ? item['file-modified'] : "&nbsp;" %></div>
```

<% } %>

:::
<% } %>

```{=html}
</div></a>
```

:::
