<%
const cols = listing['grid-columns'];
%>

:::{.list .grid .quarto-listing-cols-<%=cols%>}
```{=html}
<% for (const item of items) { %>
<% partial('item-grid.ejs.md', {listing, item, utils }) %>
<% } %>
```
:::
