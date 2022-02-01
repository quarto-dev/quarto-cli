<?xml version="1.0" encoding="UTF-8"?>

<rss  xmlns:atom="http://www.w3.org/2005/Atom" 
      xmlns:media="http://search.yahoo.com/mrss/" 
      xmlns:content="http://purl.org/rss/1.0/modules/content/" 
      xmlns:dc="http://purl.org/dc/elements/1.1/" 
      version="2.0">
<channel>

<title><%= feed.title %></title>
<link><%- feed.link %></link>
<atom:link href="<%- feed.feedLink %>" rel="self" type="application/rss+xml"/>
<description><%= feed.description %></description>
<% if (feed.language) { %><language><%= feed.language %></language><% } %>
<generator><%= feed.generator %></generator>
<lastBuildDate><%= feed.lastBuildDate %></lastBuildDate>
