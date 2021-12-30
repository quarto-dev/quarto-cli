<%
const allowSort = options["allow-sort"] !== false;
const allowFilter = options["allow-filter"] !== false;
const rowCount = options["row-count"];
%>

<% if (allowFilter) { %>

```{=html}
<div class="input-group input-group-sm quarto-listing-filter" style="width: 33%">
<span class="input-group-text" id="basic-addon1"><i class="bi bi-search"></i></span>
<input type="text" class="search form-control" placeholder="Filter" />
</div>
```

<% } %>
:::{.list .grid}
<% for (const item of items) { %>
  <% partial('item-grid.ejs.md', {listing, item, options}) %>
<% } %>
:::
<% if (rowCount < items.length) { %>

```{=html}
<div>
<ul class="pagination"></ul>
</div>
```

<% } %>
