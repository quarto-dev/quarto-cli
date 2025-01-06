:::{.list .quarto-listing-default}
``````{=html}
<% for (const item of items) { %>
<% partial('item-default.ejs.md', {listing, item, utils }) %>
<% } %>
``````
:::
