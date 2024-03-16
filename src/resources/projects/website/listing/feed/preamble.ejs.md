<?xml version="1.0" encoding="UTF-8"?>

<% if (feed['xml-stylesheet']) { %><?xml-stylesheet type="text/xsl" media="screen" href="<%- feed['xml-stylesheet'] %>"?><% } %>

<rss  xmlns:atom="http://www.w3.org/2005/Atom" 
      xmlns:media="http://search.yahoo.com/mrss/" 
      xmlns:content="http://purl.org/rss/1.0/modules/content/" 
      xmlns:dc="http://purl.org/dc/elements/1.1/" 
      version="2.0">
<channel>

<title><%= escape(feed.title) %></title>
<link><%- feed.link %></link>
<atom:link href="<%- feed.feedLink %>" rel="self" type="application/rss+xml"/>
<description><%= escape(feed.description) %></description>
<% if (feed.language) { %><language><%= feed.language %></language><% } %>
<% if (feed.image) { %><image>
<url><%= feed.image.url %></url>
<title><%= escape(feed.image.title) %></title>
<link><%= feed.image.link %></link>
<% if (feed.image.height) { %><height><%= feed.image.height %></height><% } %>
<% if (feed.image.width) { %><width><%= feed.image.width %></width><% } %>
</image><% } %>
<generator><%= feed.generator %></generator>
<lastBuildDate><%= feed.lastBuildDate %></lastBuildDate>
