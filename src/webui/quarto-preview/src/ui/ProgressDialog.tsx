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

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  makeStyles,
  tokens,
  shorthands
} from "@fluentui/react-components";



import { ANSIOutputLine } from "../core/ansi-output";
import { ANSIDisplay } from "./ANSIDisplay";

export interface ProgressDialogProps {
  open: boolean;
  rendering: boolean;
  error: boolean;
  lines: ANSIOutputLine[];
  onClose: VoidFunction;
  onCancel: VoidFunction;
  darkMode: boolean;
}

// layout constants
const kTopBorderWidth = 2;
const kMinProgressHeight = 120;

const useStyles = makeStyles({
  surface: {
    boxShadow: tokens.shadow4,
    position: 'fixed',
    top: kTopBorderWidth + "px",
    left: 0,
    right: 0,
    marginTop: 'none',
    marginBottom: 'none',
    paddingTop: '12px',
    paddingBottom: '16px',
    maxWidth: 'none',
    maxHeight: "calc(100% - 50px)",
  },
  body: {
   
  },
  content: {
    ...shorthands.border('1px', 'solid',tokens.colorNeutralStroke1),
    overflowY: 'scroll',
  }
})

export function ProgressDialog(props: ProgressDialogProps) {
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView()
  }, [props.lines, props.error]);

  const classes = useStyles();

  return (
    <Dialog 
      modalType="non-modal"
      open={props.open}
      onOpenChange={(_event, data) => { if (!data.open) props.onClose() }}
    >
      <DialogSurface className={classes.surface}>
        <DialogBody className={classes.body} style={{
          gridTemplateRows: !props.error 
            ? 'auto 120px auto'
            : 'auto auto auto'
        }}>
          <DialogTitle>Render</DialogTitle>
          <DialogContent className={classes.content}>
            <ANSIDisplay lines={props.lines} />
            <div ref={outputEndRef} />
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );

  /*
  // one time computation of theme/styles
  const [theme] = useState(() => getTheme());
  const styles = useMemo(() => getStyles(theme, props.darkMode), [theme, props.darkMode]);

  return (<Modal
    styles={{
      main: !props.error 
        ? { height: kMinProgressHeight } 
        : { top: 0, minHeight: kMinProgressHeight, height: "auto" }
    }}
    className={props.darkMode ? "dark-mode" : undefined}
    titleAriaId={titleId}
    isOpen={props.open}
    focusTrapZoneProps={{disabled: true, disableFirstFocus: true}}
    onDismiss={props.onClose}
    containerClassName={styles.content.container}
    scrollableContentClassName={styles.content.scrollableContent}
    topOffsetFixed={true}
    
     // for modeless, the three properties commented out below are ignored
    // (comment them back in if we switch to isModelss={false})
    isModeless={true}
    // isBlocking={true}
    // isDarkOverlay={props.darkMode}
    // forceFocusInsideTrap={false}
  >
    <div 
      className={styles.content.header} 
      style={{
        borderTop:  props.error ? `${kTopBorderWidth}px solid ${theme.palette.orangeLight}` : 'none'
      }}
    >
      <h2 className={styles.content.heading} id={titleId}>
        {props.error ? "Error" : "Render"}
      </h2>
      {!props.error 
        ? <DefaultButton styles={styles.cancelButton} onClick={props.onCancel}>
           Cancel
          </DefaultButton>
        : <IconButton
          styles={styles.iconButton()}
          iconProps={cancelIcon}
          ariaLabel="Close dialog"
          onClick={props.onClose}
        />
      }
    </div>
    <div className={styles.content.body}>
      <ANSIDisplay lines={props.lines} />
      <div ref={outputEndRef} />
    </div>

  </Modal>);
  */

}

/*
const getStyles = (theme: Theme, darkMode: boolean) => {
 
  const content = mergeStyleSets({
    scrollableContent: {
      display: 'flex',
      flexDirection: 'column',
    },
    container: {
      display: 'flex',
      flexFlow: 'column nowrap',
      alignItems: 'stretch',
      position: 'fixed',
      top: kTopBorderWidth,
      left: 0,
      right: 0,
      maxWidth: 'none',
      maxHeight: "calc(100% - 50px)",

      // these were used when we had more of a floating dialog feel
      //width: 1000,
      //maxWidth: "calc(100% - 100px)",
      
      boxShadow: theme.effects.elevation8
    },
    header: [
      theme.fonts.mediumPlus,
      {
        borderTop: 'none',
        color: theme.palette.neutralPrimary,
        display: 'flex',
        alignItems: 'center',
        fontWeight: FontWeights.semibold,
        padding: '8px 6px 8px 12px',
      },
    ],
    heading: {
      color: theme.palette.neutralPrimary,
      fontWeight: FontWeights.semibold,
      fontSize: 'inherit',
      margin: '0',
    },
    body: {
      border: `2px solid ${darkMode ? "#434343" : theme.semanticColors.variantBorder}`,
      flex: '1 1 auto',
      margin: '0 12px 12px 12px',
      padding: 8,
      overflowY: 'scroll',
      
      selectors: {
        p: { margin: '14px 0' },
        'p:first-child': { marginTop: 0 },
        'p:last-child': { marginBottom: 0 },
      },
    },
  });

  const iconButton = (color = theme.palette.neutralPrimary) : Partial<IButtonStyles> => ({
    root: {
      color,
      marginLeft: 'auto',
      marginTop: '4px',
      marginRight: '2px',
      height: '24px',
      width: '24px'
    },
    rootHovered: {
      color: theme.palette.neutralDark,
    },
  });

  const cancelButton : Partial<IButtonStyles> = {
    root: {
      backgroundColor: theme.semanticColors.defaultStateBackground,
      marginLeft: 'auto',
      marginRight: '8px',
      height: '24px',
      padding: '0 8px'
    }
  }

  return {
    content,
    iconButton,
    cancelButton
  }
}

const cancelIcon: IIconProps = { iconName: 'Cancel' };
*/



