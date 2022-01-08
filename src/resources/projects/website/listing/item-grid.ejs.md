<%
// Column information
const cols = options.columns;
const colNames = options["column-names"];
const colSortTargets = options["column-sort-targets"];
const links = options["column-links"];
const cardColumnSpan = options['card-column-span'] || 12;
const align = options["alignment"] || "left";

// Cap Options
const imgHeight = options['image-height'];

const outputValue = (col) => {
const value = item[col];
const path = item.path;
if (path && value !== undefined && links.includes(col)) {
return `<a href="${path}">${value}</a>`;
} else {
return value;
}
}

const otherCols = cols.filter(col => {
return !["title", "image", "card-cap-text", "subtitle", "description", "filename", "filemodified"].includes(col);
});
%>

```{=html}

<div class="<%=`g-col-${cardColumnSpan}`%>">
<div class="quarto-grid-item card h-100 <%-`card-${align}`%>">

<% if (item.image) { %>
  <img src="<%= item.image %>"<%= imgHeight ? ` height="${imgHeight}"` : '' %> class="thumbnail-image">
<% } else { %>
  <div class="card-img-top"<%= imgHeight ? ` style="height: ${imgHeight}px;"` : '' %>>
  <%= (item['card-cap-text']) ? outputValue('card-cap-text') : "&nbsp;" %>
  </div>
<% } %>

<div class="card-body">

<% if (cols.includes('title') && item.title) { %>
  <div class="card-title title">
  <%= outputValue('title') %>
  </div>
<% } %>

<% if (cols.includes('subtitle') && item.subtitle) { %>
  <div class="card-subtitle subtitle">
  <%= outputValue('subtitle') %>
  </div>
<% } %>

<% if (cols.includes('description') && item.description) { %>
  <div class="card-text description">
  <%= item.description %>
  </div>
<% } %>

<% if (otherCols.length > 0) { %>
  <table class="card-other-values">
  <% for (const col of otherCols) { %>
    <tr>
      <td><%= colNames[col] || col %></td>
      <td class="<%=col%>"><%= outputValue(col) %></td>
    </tr>
  <% } %>
  </table>
<% } %>

</div>

<% if (cols.includes('filename') || cols.includes('filemodified')) { %>
<div class="card-footer text-muted">
<% if (cols.includes('filename')) { %>
  <div class="card-filename filename">
  <%= outputValue('filename') %>
  </div>
<% } %>
<% if (cols.includes('filemodified')) { %>
  <div class="card-filemodified filemodified">
  <%= outputValue('filemodified') %>
  </div>
<% } %>
</div>

<% } %>

</div>
</div>
```

<%

// Other columns

// Card header text
// Card footer text

// Card alignment (left, right, center)

// Listing grids at different sizes (sm, md, lg)

// Pull card item out of grid and share
%>
