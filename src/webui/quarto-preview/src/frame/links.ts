/*
 * links.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */


export function handleExternalLinks(origin: string, search: string) {

  // only do this if we are in an iframe
  if (window.self === window.top) {
    return;
  }

  function isLocalHref(href: string) {
    return href.startsWith(origin);
  }

  function ensureLinkOpensInNewWindow(linkEl: HTMLAnchorElement) {
    const useOpenExternalMessage =
      search.includes("quartoPreviewReqId=") &&
      window.parent.postMessage;
  
    if (useOpenExternalMessage) {
      linkEl.addEventListener("click", function(event) {
        window.parent.postMessage({
          type: "openExternal",
          url: linkEl.href,
        }, "*");
        event.preventDefault();
        return false;
      });
    }
  
    const isRStudio = search.includes("capabilities=");
    if (isRStudio) {
      linkEl.target = "_blank";
    }
  }
 
  const linkEls = document.getElementsByTagName("a");
  for (let i = 0; i < linkEls.length; i++) {
    const linkEl = linkEls[i];
    if (linkEl.href && !isLocalHref(linkEl.href)) {
      ensureLinkOpensInNewWindow(linkEl);
    }
  }
}

