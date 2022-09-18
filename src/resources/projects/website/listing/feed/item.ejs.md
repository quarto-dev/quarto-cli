<item>
  <title><%= escapeXml(item.title) %></title>
  <% if (item.authors) { %>
  <% for (const author of item.authors) { %>
  <dc:creator><%= escapeXml(author) %></dc:creator>
  <% } %>
  <% } %>
  <link><%= item.link %></link>
  <description><%= escapeXml(item.description) %></description>
  <% if (item.categories && Array.isArray(item.categories)) { %>
  <% for (const category of item.categories) { %>
  <category><%= escapeXml(category) %></category>
  <% } %>
  <% } %>
  <guid><%= item.guid %></guid>
  <% if (item.pubDate) { %>
  <pubDate><%= item.pubDate.toUTCString() %></pubDate>
  <% } %>
  <% if (item.image) { %>
    <% 
    const imgWidthAttr = item.imageHeight ? ` width="${item.imageWidth}"` : '';
    const imgHeightAttr = item.imageHeight ? ` height="${item.imageHeight}"` : '';
    const imgTypeAttr = item.imageContentType ? ` type="${item.imageContentType}"`: '';
    %>
  <media:content url="<%- item.image %>" medium="image"<%= imgTypeAttr %><%= imgHeightAttr %><%= imgWidthAttr %>/>
  <% } %>
</item>
