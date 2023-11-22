/*
 * Progress.tsx
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import React, { useEffect, useState } from "react";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";

import { ANSIOutputLine } from "ansi-output";

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
    <FluentProvider theme={props.darkMode ? webDarkTheme : webLightTheme}>
      <ProgressIndicator visible={props.rendering && !dismissed} />
      <ProgressDialog 
        open={props.dialog && !dismissed} 
        rendering={props.rendering}
        error={props.error}
        lines={props.lines}
        onClose={() => setDismissed(true)}
        onCancel={() => { setDismissed(true); props.onCancel(); }}
        darkMode={props.darkMode}
      />
    </FluentProvider>
  );
}
