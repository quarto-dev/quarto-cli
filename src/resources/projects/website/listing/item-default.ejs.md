<% 
const imageAlign = listing['image-align']  || 'left';
const imageHeight = listing['image-height'];
const cols = listing.columns;
const colNames = listing["column-names"];

const otherCols = cols.filter(col => {
return !["title", "image", "subtitle", "description", "description"].includes(col);
});

const outputValue = (col) => {
  const value = item[col];
  const path = item.path;
  if (path && value !== undefined && listing['column-links'].includes(col)) {
    return `<a href="${path}">${value}</a>`;
  } else {
    return value;
  }
}

const outputMetadata = (col) => {
  if (item[col] !== undefined) {
    return `<div class="metadata-value ${col}">${outputValue(col)}</div>`;  
  } else {
    return "";
  }
}

%>

```{=html}
<div class="quarto-post image-<%= imageAlign %>">
  <% if (cols.includes('image')) { %>
  <div class="thumbnail">
    <a href="<%= item.path %>" class="post-contents">
    <% if (item.image) { %>
      <img src="<%= item.image %>"<%= imageHeight ? ` height="${imageHeight}"` : '' %> class="thumbnail-image">
    <% } else { %>
      <div class="thumbnail-image"<%= imageHeight ? ` style="height: ${imageHeight}px;"` : '' %>>
      </div>
    <% } %>
    </a>
  </div>
  <% } %>
  <div class="body">
    <a href="<%= item.path %>" class="post-contents">
      <% if (cols.includes('title')) { %>
        <h2 class="title"><%= item.title %></h2>
      <% } %>
      <% if (cols.includes('authors') && item.authors) { %>
      <p class="authors"></p>
      <% } %>
      <% if (cols.includes('description')) { %>
      <p class="description"><%= item.description %> </p>
      <% } %>
    </a>
  </div>
  <div class="metadata">
    <% for (const col of otherCols) { %>
      <%= outputMetadata(col) %>
    <% } %>
  </div>
</div>
```
