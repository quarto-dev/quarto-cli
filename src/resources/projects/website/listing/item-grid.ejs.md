<%
// Column information
const cols = listing.columns;
const colNames = listing["column-names"];
const colSortTargets = listing["column-sort-targets"];
const links = listing["column-links"];
const cardColumnSpan = listing['card-column-span'] || 12;
const align = listing["alignment"] || "left";

// Cap Options
const imgHeight = listing['image-height'];

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
  <%= (item['card-cap-text']) ? listing.utilities.outputLink('card-cap-text', item) : "&nbsp;" %>
  </div>
<% } %>

<div class="card-body">

<% if (cols.includes('title') && item.title) { %>
  <div class="card-title title<%-listing.utilities.sortClass('title')%>"<%-listing.utilities.sortAttr('title', item)%>>
  <%= listing.utilities.outputLink('title', item) %>
  </div>
<% } %>

<% if (cols.includes('subtitle') && item.subtitle) { %>
  <div class="card-subtitle subtitle<%-listing.utilities.sortClass('subtitle')%>"<%-listing.utilities.sortAttr('subtitle', item)%>>
  <%= listing.utilities.outputLink('subtitle', item) %>
  </div>
<% } %>

<% if (cols.includes('description') && item.description) { %>
  <div class="card-text description<%-listing.utilities.sortClass('description')%>"<%-listing.utilities.sortAttr('description', item)%>>
  <%= item.description %>
  </div>
<% } %>

<% if (otherCols.length > 0) { %>
  <table class="card-other-values">
  <% for (const col of otherCols) { %>
    <tr>
      <td><%= colNames[col] || col %></td>
      <td class="<%=col%><%-listing.utilities.sortClass(col)%>"<%-listing.utilities.sortAttr(col, item)%>><%= listing.utilities.outputLink(col, item) %></td>
    </tr>
  <% } %>
  </table>
<% } %>

</div>

<% if (cols.includes('filename') || cols.includes('filemodified')) { %>
<div class="card-footer text-muted">
<% if (cols.includes('filename')) { %>
  <div class="card-filename filename<%-listing.utilities.sortClass('filename')%>"<%-listing.utilities.sortAttr('filename', item)%>>
  <%= item.filename ? listing.utilities.outputLink('filename', item) : "&nbsp;" %>
  </div>
<% } %>
<% if (cols.includes('filemodified')) { %>
  <div class="card-filemodified filemodified<%-listing.utilities.sortClass('filemodified')%>"<%-listing.utilities.sortAttr('filemodified', item)%>>
  <%= item.filemodified ? listing.utilities.outputLink('filemodified', item) : "&nbsp;"%>
  </div>
<% } %>
</div>

<% } %>

</div>
</div>
```
