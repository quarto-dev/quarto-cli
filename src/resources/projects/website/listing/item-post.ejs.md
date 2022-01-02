<% 
const imageAlign = listing.options?.['image-align'] || 'left';
const imageHeight = listing.options?.['image-height'];


const outputValue = (col) => {
  const value = item[col];
  const path = item.path;
  if (path && value !== undefined && options['column-links'].includes(col)) {
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
<div class="quarto-post">
  <div class="metadata">
    <%= outputMetadata('date') %>
    <%= outputMetadata('filename') %>
    <%= outputMetadata('filemodified') %>
  </div>

  <a href="<%= item.path %>" class="post-contents image-<%= imageAlign %>">
    <div class="thumbnail">
      <% if (item.image) { %>
        <img src="<%= item.image %>"<%= imageHeight ? ` height="${imageHeight}"` : '' %> class="thumbnail-image">
      <% } else { %>
        <div class="thumbnail-image"<%= imageHeight ? ` style="height: ${imageHeight}px;"` : '' %>>
          
        </div>
      <% } %>
      

      <img src="<%= item.image %>">
    </div>
    <div class="body">
      <h2 class="title"><%= item.title %></h2>
      <p class="authors"></p>
      <p class="description"><%= item.description %> </p>
    </div>
  </a>
</div>
```
