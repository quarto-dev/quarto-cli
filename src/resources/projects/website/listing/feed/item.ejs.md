<item>
  <title><%= item.title %></title>
  <% for (const author of item.authors) { %>
  <dc:creator><%= author %></dc:creator>
  <% } %>
  <link><%= item.link %></link>
  <description><%= item.description %></description>
  <% for (const category of item.categories) { %>
  <category><%= category %></category>
  <% } %>
  <guid><%= item.guid %></guid>
  <pubDate><%= item.pubDate %></pubDate>
  <% if (item.image) { %>
    <% 
    const imgWidthAttr = item.imageHeight ? ` width="${item.imageWidth}` : '';
    const imgHeightAttr = item.imageHeight ? ` height="${item.imageHeight}` : '';
    %>
  <media:content url="<%- item.image %>" medium="image" type="image/png"<%- imgHeightAttr %><%- imgWidthAttr %>/>
  <% } %>
</item>
