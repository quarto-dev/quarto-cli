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
  DefaultButton,
  FontWeights,
  IButtonStyles,
  IIconProps,
  IconButton,
  Modal,
  Theme,
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
  onCancel: VoidFunction;
  darkMode: boolean;
}

export function ProgressDialog(props: ProgressDialogProps) {

  const titleId = useId('title');

  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView()
  }, [props.lines, props.error]);

  // one time computation of theme/styles
  const [theme] = useState(() => getTheme());
  const styles = useMemo(() => getStyles(theme, props.darkMode), [theme, props.darkMode]);

  return (<Modal
    styles={{main: !props.error ? {height: 300 } : { minHeight: 300, height: "auto" }}}
    className={props.darkMode ? "dark-mode" : undefined}
    titleAriaId={titleId}
    isOpen={props.open}
    isDarkOverlay={props.darkMode}
    focusTrapZoneProps={{disabled: true, disableFirstFocus: true}}
    forceFocusInsideTrap={false}
    onDismiss={props.onClose}
    isModeless={false}
    isBlocking={true}
    containerClassName={styles.content.container}
    scrollableContentClassName={styles.content.scrollableContent}
    topOffsetFixed={true}
  >
    <div 
      className={styles.content.header} 
      style={{
        borderColor: props.error ? theme.palette.orangeLight : theme.palette.neutralLight,

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

}

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
      top: 60,
      width: 1000,
      maxWidth: "calc(100% - 100px)",
      maxHeight: "calc(100% - 120px)",
      boxShadow: theme.effects.elevation8
    },
    header: [
      theme.fonts.xLarge,
      {
        borderTop: `1px solid ${theme.palette.neutralLight}`,
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
      border: `2px solid ${darkMode ? "#434343" : theme.semanticColors.variantBorder}`,
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

  const iconButton = (color = theme.palette.neutralPrimary) : Partial<IButtonStyles> => ({
    root: {
      color,
      marginLeft: 'auto',
      marginTop: '4px',
      marginRight: '2px',
    },
    rootHovered: {
      color: theme.palette.neutralDark,
    },
  });

  const cancelButton : Partial<IButtonStyles> = {
    root: {
      backgroundColor: theme.semanticColors.defaultStateBackground,
      marginLeft: 'auto',
      marginRight: '12px'
    }
  }

  return {
    content,
    iconButton,
    cancelButton
  }
}

const cancelIcon: IIconProps = { iconName: 'Cancel' };



