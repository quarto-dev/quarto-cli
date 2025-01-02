<%
const categories = item.categories !== undefined ? item.categories.join(',') : undefined;
%>

::: {.quarto-listing-item-metadata" style-"display:none;"}
[]{.original-value data-original-value="${itemNumber}" style="display:none;"}
<% if (categories !== undefined) { %>
[]{.categories data-categories="${categories}" style="display:none;"}
<% } %>
:::
