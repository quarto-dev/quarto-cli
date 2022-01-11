<% 
const imageAlign = listing['image-align']  || 'left';
const imageHeight = listing['image-height'];
const cols = listing.columns;
const colNames = listing["column-names"];

const otherCols = cols.filter(col => {
return !["title", "image", "subtitle", "description"].includes(col);
});

const outputMetadata = (col, item) => {
  if (item[col] !== undefined) {
    return `<div class="metadata-value ${col}${listing.utilities.sortClass(col)}" ${listing.utilities.sortAttr(col, item)}>${listing.utilities.outputLink(col, item)}</div>`;  
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
        <h2 class="title<%-listing.utilities.sortClass('title')%>"<%-listing.utilities.sortAttr('title', item)%>><%= item.title %></h2>
      <% } %>
      <% if (cols.includes('authors') && item.authors) { %>
      <p class="authors<%-listing.utilities.sortClass('authors')%>"<%-listing.utilities.sortAttr('authors', item)%>></p>
      <% } %>
      <% if (cols.includes('description')) { %>
      <p class="description<%-listing.utilities.sortClass('description')%>"<%-listing.utilities.sortAttr('description', item)%>><%= item.description %> </p>
      <% } %>
    </a>
  </div>
  <div class="metadata">
    <% for (const col of otherCols) { %>
      <%= outputMetadata(col, item) %>
    <% } %>
  </div>
</div>
```
