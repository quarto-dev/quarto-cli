<%
const filterUi = listing['filter-ui'];
const sortUi = listing['sort-ui'];
%>

<% if (sortUi || filterUi) { %>

```{=html}
<div class="listing-actions-group">
  <% const sortableFields = listing.utilities.sortableFieldData(); %>
  <% if (sortUi && sortableFields.length > 0) { %>
   <div class="input-group input-group-sm quarto-listing-sort">
     <span class="input-group-text"><i class="bi bi-sort-down"></i></span>
     <select
      id="listing-<%- listing.id %>-sort"
      class="form-select"
      aria-label="<%- listing.utilities.localizedString("listing-page-order-by")%>"
      onChange="window['quarto-listings']['listing-<%- listing.id %>'].sort(this.options[this.selectedIndex].value, { order: this.options[this.selectedIndex].getAttribute('data-direction')})"
    >
       <option value="" disabled selected hidden><%- listing.utilities.localizedString("listing-page-order-by")%></option>
       <option value="index" data-direction="asc"><%- listing.utilities.localizedString("listing-page-order-by-default")%></option>
       <% for (const sortData of sortableFields) { %>
         <option
          value="<%- sortData.listingSort.field %>"
          data-direction="<%- sortData.listingSort.direction %>">
          <%= sortData.description %>
        </option>
       <% } %>
     </select>
  </div>


  <% } %>

  <% if (filterUi) { %>
    <div class="input-group input-group-sm quarto-listing-filter">
      <span class="input-group-text"><i class="bi bi-search"></i></span>
      <input type="text" class="search form-control" placeholder="<%- listing.utilities.localizedString("listing-page-filter")%>" />
    </div>
  <% } %>
</div>
```

<% } %>
