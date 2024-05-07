/*
 * links.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
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

