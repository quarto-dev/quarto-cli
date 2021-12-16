Title | Description | Author 
--- | --- | ---
<% for (item of items) { %>[<%= item.title %>](<%= item.path %>) | <%= item.description %> | <%= item.author %>
<% } %>