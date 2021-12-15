:::g-col-8
:::{.card .h-100}
<% if (item.image) { %>
![](<%= item.image %>){.card-top}
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
