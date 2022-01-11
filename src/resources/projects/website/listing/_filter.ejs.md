<%
const showFilter = listing['show-filter'];
const showSort = listing['show-sort'];
%>

<% if (showSort || showFilter) { %>

```{=html}
<div class="listing-actions-group">

  <% if (showSort) { %>
    <div class="dropdown">
      <button class="btn btn-primary btn-sm dropdown-toggle" type="button" id="listing-<%- listing.id %>-sort" data-bs-toggle="dropdown" aria-expanded="false">
        Order By
      </button>
      <ul class="dropdown-menu" aria-labelledby="listing-<%- listing.id %>-sort">
        <% for (const sortData of listing.utilities.sortableColumnData()) { %>
          <li><button class="dropdown-item" type="button" onClick="window['quarto-listings']['<%- listing.id %>'].sort('<%-listing.utilities.sortTarget(sortData.listingSort.column) %>', { order: '<%= sortData.listingSort.direction %>'})"><%= listing.utilities.columnName(sortData.description) %></button></li>
        <% } %>
      </ul>
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
