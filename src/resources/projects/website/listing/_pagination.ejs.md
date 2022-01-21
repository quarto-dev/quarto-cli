<% if (listing["page-size"] < items.length) { %>

```{=html}
<nav id="<%- listing.id %>-pagination" class="listing-pagination" aria-label="Page Navigation">
  <ul class="pagination"></ul>
</nav>
```

<% } %>
