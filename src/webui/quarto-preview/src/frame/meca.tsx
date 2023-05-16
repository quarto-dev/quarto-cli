/*
 * meca.ts
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
      const parent = globalThis.document.createElement("div");
      const root = createRoot(parent);
      root.render(
        <MecaLinkDisabledMessage darkMode={darkMode} linkEl={mecaLinks[i]} onClosed={() => {
          root.unmount();
          parent.remove();  
        }}/>
      );  
    }
}

const MecaLinkDisabledMessage: React.FC<DisabledLinkProps> = (props: DisabledLinkProps) => {
  const [open, setOpen] = useState(false);
  const handleOpenChange: PopoverProps["onOpenChange"] = (e, data) =>
    setOpen(data.open || false);
  
  const handlePopoverClick = (event: Event) => {
    setOpen(true);
    event.preventDefault();
    return false;
  };

  useEffect(() => {
    props.linkEl.addEventListener("click", handlePopoverClick);
      return () => {
        props.linkEl.removeEventListener("click", handlePopoverClick);
      }
    }, []);

  return (
    <FluentProvider theme={props.darkMode ? webDarkTheme : webLightTheme}>
      <Popover open={open} 
              withArrow={true}
              closeOnScroll={true}
              onOpenChange={handleOpenChange} 
              positioning={{target: props.linkEl, offset: { mainAxis: 0, crossAxis: -50}}}>
        <PopoverSurface>
          <Label>This file is not available during preview (it will be included with the final rendered output).</Label>
        </PopoverSurface>
      </Popover>
      
    </FluentProvider>
  );
};

