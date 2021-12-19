<% const imageAlign = listing.options?.['image-align'] || 'left'; %>
<% const imageWidth = listing.options?.['image-width']; %>

:::{.card .quarto-card .my-2}
<% if (item.image) { %>
:::{.card-image-<%=imageAlign%> style="background-image: url(<%= item.image %>);"}
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
