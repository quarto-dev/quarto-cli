/*
 * navigation.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

export function navigationHandler() {

  return () => {
    const normalizeTarget = (target: string) => {
      return target.replace(/\/index\.html/, "/")
    };
    
    return (ev: MessageEvent<string>) : boolean => {
      if (ev.data.startsWith('reload')) {
        let target = normalizeTarget(ev.data.replace(/^reload/, ""));
        // prepend proxy path to target if we have one
        if (target) {
          const pathPrefix = 
            window.location.pathname.match(/^.*?\/p\/\w+\//) ||
            window.location.pathname.match(/^.*?\/user\/[\w\d]+\/proxy\/\d+\//);
          if (pathPrefix) {
            target = pathPrefix + target.slice(1);
          }
        }
        if (target && (target !== normalizeTarget(window.location.pathname))) {
          window.location.replace(target);
        } else {
          window.location.reload();
        }
        return true;
      } else {
        return false;
      }
    }
  }
}

