/*
 * Progress.tsx
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
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

import { ANSIOutputLine } from "../core/ansi-output";

import { ProgressDialog } from "./ProgressDialog";
import { ProgressIndicator } from "./ProgressIndicator";

export interface ProgressProps {
  rendering: boolean;
  dialog: boolean;
  error: boolean;
  lines: ANSIOutputLine[];
  onCancel: VoidFunction;
  darkMode: boolean;
}

export const Progress: React.FC<ProgressProps> = (props: ProgressProps) => {

  // track whether the user dismissed the dialog
  const [dismissed, setDismissed] = useState(false); 

  // reset the dismissed state when rendering starts back up
  useEffect(() => {
    if (props.rendering) {
      setDismissed(false);
    }
  }, [props.rendering])

  return (
    <FluentProvider theme={webLightTheme}>
      <ProgressIndicator visible={props.rendering && !dismissed} />
      <ProgressDialog 
        open={props.dialog && !dismissed} 
        rendering={props.rendering}
        error={props.error}
        lines={props.lines}
        onClose={() => setDismissed(true)}
        onCancel={() => { setDismissed(true); props.onCancel(); }}
        darkMode={props.darkMode}
      />)
    </FluentProvider>
  );
}
