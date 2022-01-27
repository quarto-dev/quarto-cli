<%
const categories = item.categories !== undefined ? item.categories.join(',') : undefined;
%>

<div class="quarto-listing-item-metadata" style-"display:none;">
<span class="original-value" data-original-value="${itemNumber}" style="display:none;"></span>
<% if (categories !== undefined) { %><span class="categories" data-categories="${categories}" style="display:none;"></span><% } %>
</div>
