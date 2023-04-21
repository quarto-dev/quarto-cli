/*
 * fluent.ts
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

import { createTheme, loadTheme } from "@fluentui/react";

import { initializeIcons } from '@fluentui/react/lib/Icons';

import './fluent.css'

export function initializeFluent(darkMode: boolean) {

  if (darkMode) {
    const darkTheme = createTheme({
      palette: {
        themePrimary: '#85c0ed',
        themeLighterAlt: '#050809',
        themeLighter: '#151f26',
        themeLight: '#283a47',
        themeTertiary: '#50738e',
        themeSecondary: '#75a9d1',
        themeDarkAlt: '#90c6ef',
        themeDark: '#a1cef1',
        themeDarker: '#b9dbf5',
        neutralLighterAlt: '#323130',
        neutralLighter: '#31302f',
        neutralLight: '#2f2e2d',
        neutralQuaternaryAlt: '#2c2b2a',
        neutralQuaternary: '#2a2928',
        neutralTertiaryAlt: '#282726',
        neutralTertiary: '#c8c8c8',
        neutralSecondary: '#d0d0d0',
        neutralPrimaryAlt: '#dadada',
        neutralPrimary: '#ffffff',
        neutralDark: '#f4f4f4',
        black: '#f8f8f8',
        white: '#323130',
      }
    });
    loadTheme(darkTheme);
  }

  initializeIcons();
}