/*
 * ProgressBar.tsx
 *
 * Copyright (C) 2023 Posit Software, PBC
 */


import React from "react";

import { ProgressBar, makeStyles } from "@fluentui/react-components";


export interface ProgresIndicatorProps {
  visible: boolean;
}

const useStyles = makeStyles({
  root: { 
    position: "fixed",
    top: 0,
    left: 0,
    right: 0
  },
});


export const ProgressIndicator: React.FC<ProgresIndicatorProps> = (props) => {

  const classes = useStyles();

  return (
    <>
    {props.visible ? <ProgressBar className={classes.root} /> : null}
    </>
  );

}



