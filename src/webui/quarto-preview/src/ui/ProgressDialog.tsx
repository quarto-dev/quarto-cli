/*
 * ProgressDialog.tsx
 *
 * Copyright (C) 2023 Posit Software, PBC
 */


import React, { useEffect, useMemo, useRef } from "react";

import {
  Button,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  makeStyles,
  tokens,
  shorthands,
  DialogOpenChangeData,
  DialogOpenChangeEvent,
} from "@fluentui/react-components";

import { Dismiss24Regular } from "@fluentui/react-icons";

import { ANSIOutputLine } from "ansi-output";
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
const kDialogMaxHeightOffset = 50;
const kDialogChromeHeight = 70;

export function ProgressDialog(props: ProgressDialogProps) {
  
  // classes and colors
  const classes = useStyles();
  const titleColor = tokens.colorNeutralForeground3;

  // auto-scroll to end of output
  const outputEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    outputEndRef.current?.scrollIntoView()
  }, [props.lines, props.error]);

  // close action is either canel or dismiss
  const closeAction = useMemo(() => {
    if (props.rendering) {
      return (
        <Button 
          style={{ color: titleColor }} 
          onClick={props.onCancel}>Cancel
        </Button>
      );
    } else {
      return (
        <Button
          appearance="subtle"
          aria-label="close"
          icon={<Dismiss24Regular />}
          onClick={props.onClose}
        />
      );
    }
  }, [props.rendering]);

  // handle Esc key in onOpenChange
  const onOpenChange = (_event: DialogOpenChangeEvent, data: DialogOpenChangeData) => {
    if (data.type === "escapeKeyDown") {
      if (props.rendering) {
        props.onCancel()
      } else {
        props.onClose();
      }
    } 
  }

  return (
    <Dialog 
      modalType="non-modal" 
      open={props.open}
      onOpenChange={onOpenChange}
    >
      <DialogSurface className={classes.surface} style={{
         borderTop: (props.error && !props.darkMode) ? 
         `${kTopBorderWidth}px solid ${tokens.colorPaletteDarkOrangeBorder2}` : 'none'
      }}>
        <DialogBody style={{
          gridTemplateRows: !props.error 
            ? `auto ${kMinProgressHeight}px auto`
            : 'auto auto auto'
        }}>
          <DialogTitle action={closeAction} style={{ color: titleColor }}>
            {props.error ? "Error" : "Render"}
          </DialogTitle>
          <DialogContent className={classes.content} style={{
             maxHeight: props.error 
              ? `calc(100vh - ${kDialogMaxHeightOffset + kDialogChromeHeight}px)` 
              : 'none',
          }}>
            <ANSIDisplay lines={props.lines} />
            <div ref={outputEndRef} />
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}


// styles
const useStyles = makeStyles({
  surface: {
    boxShadow: tokens.shadow4,
    ...shorthands.borderRadius(0),
    position: 'fixed',
    top: kTopBorderWidth + "px",
    left: 0,
    right: 0,
    marginTop: '1px',
    marginBottom: '0px',
    paddingTop: '12px',
    paddingBottom: '16px',
    maxWidth: 'none',
    maxHeight: `calc(100% - ${kDialogMaxHeightOffset}px)`,
  },
  content: {
    ...shorthands.border('1px', 'solid',tokens.colorNeutralStroke1),
    overflowY: 'scroll',
  }
})
