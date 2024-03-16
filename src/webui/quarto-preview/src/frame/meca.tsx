/*
 * meca.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import React, { useEffect, useState } from "react";
import { FluentProvider, Label, Popover, PopoverProps, PopoverSurface, PositioningImperativeRef, webDarkTheme, webLightTheme } from "@fluentui/react-components";

import { createRoot } from "react-dom/client";

export interface DisabledLinkProps {
    darkMode: boolean;
    onClosed: () => void;
    linkEl: Element;
}

// In preview, prevent clicking a link to the meca bundle
// this is because the MECA bundle will likely not be generated
// as a part of preview.
export function handleMecaLinks(darkMode: boolean) {

    const mecaLinks = document.body.querySelectorAll('a[data-meca-link="true"]');
    for (let i=0; i < mecaLinks.length; i++) { 
      const linkEl = mecaLinks[i];
      linkEl.addEventListener("click", (e) => {
        const parent = globalThis.document.createElement("div");
        const root = createRoot(parent);
        root.render(
          <MecaLinkDisabledMessage darkMode={darkMode} linkEl={mecaLinks[i]} onClosed={() => {
            root.unmount();
            parent.remove();  
          }}/>
        );    
        e.preventDefault();
        return false;    
      });
    }
}

const MecaLinkDisabledMessage: React.FC<DisabledLinkProps> = (props: DisabledLinkProps) => {
  const [open, setOpen] = useState(true);
  const handleOpenChange: PopoverProps["onOpenChange"] = (_e, data) =>
    setOpen(data.open || false);
  
  return (
    <FluentProvider theme={props.darkMode ? webDarkTheme : webLightTheme}>
      <Popover open={open} 
              withArrow={true}
              closeOnScroll={true}
              onOpenChange={handleOpenChange} 
              positioning={{target: props.linkEl, overflowBoundaryPadding: 30}}>
        <PopoverSurface>
          <Label>
            <strong>Preview Not Available</strong>
            <p style={{marginBottom: 0}}>The MECA file is not available during preview.<br/>It will be included with the final rendered output.</p>
          </Label>
        </PopoverSurface>
      </Popover>
      
    </FluentProvider>
  );
};

