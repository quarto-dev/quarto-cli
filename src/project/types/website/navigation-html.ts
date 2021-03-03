/*
* navigation-html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

export const navTemplate = ld.template(
  `<nav class="navbar fixed-top navbar-expand-lg navbar-<%- type %> bg-<%- background %>">
<div class="container-fluid">`,
);
export const kEndNav = `</div>\n</nav>`;

export const logoTemplate = ld.template(
  `<img src="/<%- logo %>" alt="" />`,
);

export const kBeginNavCollapse = `
<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
</button>  
<div class="collapse navbar-collapse" id="navbarCollapse">    
`;
export const kEndNavCollapse = `</div>`;

export const kBeginNavBrand = `<a class="navbar-brand" href="/">`;
export const kEndNavBrand = `</a>`;

export const kBeginLeftNavItems =
  `<ul class="navbar-nav me-auto mb-2 mb-lg-0">`;
export const kBeginRightNavItems = `<ul class="navbar-nav mb-2 mb-lg-0">`;
export const kEndNavItems = `</ul>`;

export const navItemTemplate = ld.template(`<li class="nav-item">
<a class="nav-link" href="<%- href %>"><%- text %></a>
</li>
`);

export const navbarCssTemplate = ld.template(`
<style type="text/css">
.navbar-brand > img {
  max-height: 24px;
  width: auto;
  padding-right: 6px;
}
:target::before {
  content: "";
  display: block;
  height: <%= height %>px; 
  margin: -<%= height %>px 0 0;
}
body {
  padding-top: <%= height %>px;
}
</style>
`);
