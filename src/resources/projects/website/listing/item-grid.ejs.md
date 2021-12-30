<%
// Column information
const cols = options.columns;
const colNames = options["column-names"];
const colSortTargets = options["column-sort-targets"];
const links = options["column-links"];
const cardColumnSpan = options['card-column-span'] || 8;
const align = options["alignment"] || "left";

// Cap Options
const capHeight = options['card-cap-height'];

const outputValue = (col) => {
const value = item[col];
const path = item.path;
if (path && value !== undefined && links.includes(col)) {
return `[${value}](${path})`;
} else {
return value;
}
}

const outputHtmlValue = (col) => {
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

:::<%=`g-col-${cardColumnSpan}`%>
:::{.quarto-grid-item .card .h-100 <%-`.card-${align}`%>}

<% if (item.image) { %>
![](<%= item.image %>){.card-img-top <%= capHeight ? `height="${capHeight}"` : '' %>}
<% } else { %>
:::{.card-img-top <%= capHeight ? `style="height: ${capHeight}px;"` : '' %>}
<%= (item['card-cap-text']) ? outputValue('card-cap-text') : "&nbsp;" %>
:::
<% } %>

:::card-body
<% if (cols.includes('title') && item.title) { %>
:::card-title
<%= outputValue('title') %>
:::
<% } %>

<% if (cols.includes('subtitle') && item.subtitle) { %>
:::card-subtitle
<%= outputValue('subtitle') %>
:::
<% } %>

<% if (cols.includes('description') && item.description) { %>
:::card-text
<%= item.description %>
:::
<% } %>

<% if (otherCols.length > 0) { %>

```{=html}
<table class="card-other-values">
<% for (const col of otherCols) { %>
  <tr>
    <td><%= colNames[col] || col %></td>
    <td><%= outputHtmlValue(col) %></td>
  </tr>
<% } %>
</table>
```

<% } %>

:::

<% if (cols.includes('filename') || cols.includes('filemodified')) { %>
:::{.card-footer .text-muted}
<% if (cols.includes('filename')) { %>

:::{.card-filename}
<%= outputHtmlValue('filename') %>
:::

<% } %>
<% if (cols.includes('filemodified')) { %>

:::{.card-filemodified}
<%= outputHtmlValue('filemodified') %>
:::

<% } %>
:::
<% } %>

:::
:::

<%

// Other columns

// Card header text
// Card footer text

// Card alignment (left, right, center)

// Listing grids at different sizes (sm, md, lg)

// Pull card item out of grid and share
%>
