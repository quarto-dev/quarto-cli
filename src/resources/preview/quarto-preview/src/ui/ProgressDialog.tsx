/*
 * ProgressDialog.tsx
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

import React, { useEffect, useRef } from "react";

import {
  FontWeights,
  IButtonStyles,
  IIconProps,
  IconButton,
  Modal,
  getTheme,
  mergeStyleSets
} from "@fluentui/react";
import { useId } from "@fluentui/react-hooks";

import { ANSIOutputLine } from "../core/ansi-output";

import { ANSIDisplay } from "./ANSIDisplay";

export interface ProgressDialogProps {
  open: boolean;
  rendering: boolean;
  error: boolean;
  lines: ANSIOutputLine[];
  onClose: VoidFunction;
}

export function ProgressDialog(props: ProgressDialogProps) {

  const titleId = useId('title');

  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView()
  }, [props.lines]);

  

  return (<Modal
    styles={{main: !props.error ? {height: 400} : { minHeight: 400, maxHeight: "80vh", height: "auto"}}}
    titleAriaId={titleId}
    isOpen={props.open}
    isDarkOverlay={false}
    onDismiss={props.onClose}
    containerClassName={contentStyles.container}
    
    scrollableContentClassName={contentStyles.scrollableContent}
  >
    <div className={contentStyles.header} style={{borderColor: props.error ? theme.palette.orangeLight : theme.palette.themePrimary }}>
      <h2 className={contentStyles.heading} id={titleId}>
        {props.error ? "Error" : "Render"}
      </h2>
      <IconButton
        styles={iconButtonStyles}
        iconProps={cancelIcon}
        ariaLabel="Close dialog"
        onClick={props.onClose}
      />
    </div>
    <div className={contentStyles.body}>
      <ANSIDisplay lines={props.lines} />
      <div ref={outputEndRef} />
    </div>

  </Modal>);

}

const theme = getTheme();
const contentStyles = mergeStyleSets({
  scrollableContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  container: {
    display: 'flex',
    flexFlow: 'column nowrap',
    alignItems: 'stretch',
    position: 'fixed',
    top: 80,
    width: 1000
  },
  header: [
    theme.fonts.xLarge,
    {
      borderTop: `4px solid ${theme.palette.themePrimary}`,
      color: theme.palette.neutralPrimary,
      display: 'flex',
      alignItems: 'center',
      fontWeight: FontWeights.semibold,
      padding: '12px 12px 14px 24px',
    },
  ],
  heading: {
    color: theme.palette.neutralPrimary,
    fontWeight: FontWeights.semibold,
    fontSize: 'inherit',
    margin: '0',
  },
  body: {
    border: `1px solid ${theme.semanticColors.variantBorder}`,
    flex: '1 1 auto',
    margin: '0 24px 24px 24px',
    padding: 8,
    overflowY: 'scroll',
    
    selectors: {
      p: { margin: '14px 0' },
      'p:first-child': { marginTop: 0 },
      'p:last-child': { marginBottom: 0 },
    },
  },
});

const iconButtonStyles: Partial<IButtonStyles> = {
  root: {
    color: theme.palette.neutralPrimary,
    marginLeft: 'auto',
    marginTop: '4px',
    marginRight: '2px',
  },
  rootHovered: {
    color: theme.palette.neutralDark,
  },
};

const cancelIcon: IIconProps = { iconName: 'Cancel' };


