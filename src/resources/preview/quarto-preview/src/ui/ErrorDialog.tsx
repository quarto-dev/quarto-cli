/*
 * ErrorDialog.tsx
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

import React, { useMemo } from "react";

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

import { ANSIOutput, ANSIOutputLine } from "../core/ansi-output";

import { ANSIDisplay } from "./ANSIDisplay";
import { createRoot } from "react-dom/client";


export function createErrorDialog() {
  const errorEl = document.createElement("div");
  document.body.appendChild(errorEl);
  const errorRoot = createRoot(errorEl);
  const renderErrorDialog = (open: boolean, message: string) => {
    errorRoot.render(
      <ErrorDialog 
        open={open} 
        message={message}
        onClose={() => renderErrorDialog(false, message)}
      />)
  };
  return renderErrorDialog;
}


export interface ErrorDialogProps {
  open: boolean;
  message: string;
  onClose: VoidFunction;
}

export function ErrorDialog(props: ErrorDialogProps) {
  
  const titleId = useId('title');

  const outputLines = useMemo<ANSIOutputLine[]>(() => {
    if (props.message.length > 0) {
      return ANSIOutput.processOutput(props.message);
    } else {
      return [];
    }
  }, [props.message]);
 
  
  return (<Modal
    titleAriaId={titleId}
    isOpen={props.open}
    isDarkOverlay={false}
    onDismiss={props.onClose}
    containerClassName={contentStyles.container}
  >
    <div className={contentStyles.header}>
      <h2 className={contentStyles.heading} id={titleId}>
        Error
      </h2>
      <IconButton
        styles={iconButtonStyles}
        iconProps={cancelIcon}
        ariaLabel="Close dialog"
        onClick={props.onClose}
      />
    </div>
    <div className={contentStyles.body}>
      <ANSIDisplay lines={outputLines} />
    </div>

  </Modal>);

}

const theme = getTheme();
const contentStyles = mergeStyleSets({
  container: {
    display: 'flex',
    flexFlow: 'column nowrap',
    alignItems: 'stretch',
    position: 'fixed',
    top: 80
  },
  header: [
    theme.fonts.xLarge,
    {
      flex: '1 1 auto',
      borderTop: `4px solid ${theme.palette.orangeLight}`,
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
    padding: '0 24px 24px 24px',
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


