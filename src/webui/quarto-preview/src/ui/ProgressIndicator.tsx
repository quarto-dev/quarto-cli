/*
 * ProgressBar.tsx
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



