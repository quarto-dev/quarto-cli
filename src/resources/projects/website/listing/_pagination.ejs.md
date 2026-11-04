```{=html}
<div class="listing-no-matching d-none"><%- listing.utilities.localizedString("listing-page-no-matches") %></div>
<% if (listing["page-size"] < items.length) { %>
<nav id="<%- listing.id %>-pagination" class="listing-pagination" aria-label="<%- listing.utilities.localizedString("listing-page-pagination") %>" data-page-label="<%- listing.utilities.localizedString("listing-page-number") %>">
  <ul class="pagination"></ul>
</nav>
<% } %>
```
