import { IStyle, ProgressIndicator, ThemeProvider, getTheme, mergeStyleSets } from "@fluentui/react";
import React from "react";
import { createRoot } from "react-dom/client";



export function showProgressBar() {

  const progressEl = document.createElement("div");
  document.body.appendChild(progressEl);
  const progressRoot = createRoot(progressEl);

  const styles: IStyle = {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0
    };

  progressRoot.render(
    <ThemeProvider>
      <ProgressIndicator barHeight={2} styles={{ root: styles }}></ProgressIndicator>
    </ThemeProvider>
  );

  return () => {
    progressRoot.unmount();
    progressEl.remove();
  };

}


