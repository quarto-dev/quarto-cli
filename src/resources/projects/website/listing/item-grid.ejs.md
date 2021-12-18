<% const imgCapHeight = listing.options?.['image-cap-height']; %>
<% const cardColumnSpan = listing.options?.['card-column-span'] || 3; %>

:::<%=`g-col-${cardColumnSpan}`%>
:::{.quarto-grid-item .card .h-100}
<% if (item.image) { %>
![](<%= item.image %>){.card-img-top <%= imgCapHeight ? `height="${imgCapHeight}"` : '' %>}
<% } else { %>
:::{.card-img-top <%= imgCapHeight ? `style="height: ${imgCapHeight};"` : '' %>}
:::
<% } %>
:::card-body
:::card-title
[<%= item.title %>](<%= item.path %>)
:::
:::card-text
<%= item.description %>
:::
:::
:::
:::
