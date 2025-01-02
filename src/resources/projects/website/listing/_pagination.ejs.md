::: {.listing-no-matching .d-none}
<%- listing.utilities.localizedString("listing-page-no-matches") %>
:::

```{=html}
<% if (listing["page-size"] < items.length) { %>
<nav id="<%- listing.id %>-pagination" class="listing-pagination" aria-label="Page Navigation">
  <ul class="pagination"></ul>
</nav>
<% } %>
```
