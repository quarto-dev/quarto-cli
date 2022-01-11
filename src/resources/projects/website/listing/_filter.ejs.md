<% if (showSort || showFilter) { %>

```{=html}
<div class="listing-actions-group">

  <% if (showSort) { %>
    <div class="input-group mb-3">
      <div class="input-group-prepend">
        <label class="input-group-text" for="inputGroupListingSearch">Sort By</label>
      </div>
      <select class="custom-select"
              id="inputGroupListingSearch"
              onChange="window['quarto-listings']['<%- listing.id %>'].sort(this.value, { order: 'desc'})">
        <option selected>Choose...</option>
        <% for (const col of listing.utilities.sortableColumns()) { %>
          <% if (col) { %>
          <option value="<%- listing.utilities.sortTarget(col) %>"><%= listing.utilities.columnName(col) %></option>
          <% } %>
        <% } %>
      </select>
    </div>
  <% } %>

  <% if (showFilter) { %>
    <div class="input-group input-group-sm quarto-listing-filter">
      <span class="input-group-text" id="basic-addon1"><i class="bi bi-search"></i></span>
      <input type="text" class="search form-control" placeholder="Filter" />
    </div>
  <% } %>

</div>
```

<% } %>
