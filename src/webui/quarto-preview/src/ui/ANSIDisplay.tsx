/*
 * output-container.tsx
 *
 * Copyright (C) 2023 by Posit Software, PBC
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

import * as React from 'react';

import { ANSIColor, ANSIOutputLine, ANSIOutputRun, ANSIStyle } from '../core/ansi-output';

import './ANSIDisplay.css';

export interface ANSIDisplayProps {
	readonly lines: readonly ANSIOutputLine[];
}

export const ANSIDisplay = ({ lines }: ANSIDisplayProps) => {
	let firstOutput = false;
	return (
		<div className='ansi-display'>
			{lines.map(line => {
				firstOutput = firstOutput || !!line.outputRuns.length;
				return (
					<div className='ansi-display-line'>
					{!line.outputRuns.length ?
						firstOutput ? <br /> : null :
						line.outputRuns.map(outputRun =>
							<OutputRun key={outputRun.id} outputRun={outputRun} />
						)
					}
					</div>
				)
			})}
		</div>
	);
};


interface OutputRunProps {
	readonly outputRun: ANSIOutputRun;
}

const OutputRun = ({ outputRun }: OutputRunProps) => {
	enum ColorType {
		Foreground,
		Background
	}

	const computeStyles = (styles?: ANSIStyle[]): React.CSSProperties => {
		let cssProperties: React.CSSProperties = {};
		if (styles) {
			styles.forEach(style => {
				switch (style) {
					// Bold.
					case ANSIStyle.Bold:
						cssProperties = { ...cssProperties, ...{ fontWeight: 'bold' } };
						break;

					// Dim.
					case ANSIStyle.Dim:
						cssProperties = { ...cssProperties, ...{ fontWeight: 'lighter' } };
						break;

					// Italic.
					case ANSIStyle.Italic:
						cssProperties = { ...cssProperties, ...{ fontStyle: 'italic' } };
						break;

					// Underlined.
					case ANSIStyle.Underlined:
						cssProperties = { ...cssProperties, ...{ textDecorationLine: 'underline', textDecorationStyle: 'solid' } };
						break;

					// Slow blink.
					case ANSIStyle.SlowBlink:
						cssProperties = { ...cssProperties, ...{ animation: 'ansi-display-run-blink 1s linear infinite' } };
						break;

					// Rapid blink.
					case ANSIStyle.RapidBlink:
						cssProperties = { ...cssProperties, ...{ animation: 'ansi-display-run-blink 0.5s linear infinite' } };
						break;

					// Hidden.
					case ANSIStyle.Hidden:
						cssProperties = { ...cssProperties, ...{ visibility: 'hidden' } };
						break;

					// CrossedOut.
					case ANSIStyle.CrossedOut:
						cssProperties = { ...cssProperties, ...{ textDecorationLine: 'line-through', textDecorationStyle: 'solid' } };
						break;

					// TODO Fraktur

					// DoubleUnderlined.
					case ANSIStyle.DoubleUnderlined:
						cssProperties = { ...cssProperties, ...{ textDecorationLine: 'underline', textDecorationStyle: 'double' } };
						break;

					// TODO Framed
					// TODO Encircled
					// TODO Overlined
					// TODO Superscript
					// TODO Subscript
				}
			});
		}

		return cssProperties;
	};

	const computeForegroundBackgroundColor = (colorType: ColorType, color?: ANSIColor | string): React.CSSProperties => {
		switch (color) {
			// Undefined.
			case undefined:
				return {};

			// One of the standard colors.
			case ANSIColor.Black:
			case ANSIColor.Red:
			case ANSIColor.Green:
			case ANSIColor.Yellow:
			case ANSIColor.Blue:
			case ANSIColor.Magenta:
			case ANSIColor.Cyan:
			case ANSIColor.White:
			case ANSIColor.BrightBlack:
			case ANSIColor.BrightRed:
			case ANSIColor.BrightGreen:
			case ANSIColor.BrightYellow:
			case ANSIColor.BrightBlue:
			case ANSIColor.BrightMagenta:
			case ANSIColor.BrightCyan:
			case ANSIColor.BrightWhite:
				if (colorType === ColorType.Foreground) {
					return { color: `var(--${color})` };
				} else {
					return { background: `var(--${color})` };
				}

			// TODO@softwarenerd - This isn't hooked up.
			default:
				if (colorType === ColorType.Foreground) {
					return { color: color };
				} else {
					return { background: color };
				}
		}
	};

	const computeCSSProperties = (outputRun: ANSIOutputRun): React.CSSProperties => {
		return !outputRun.format ?
			{} :
			{
				...computeStyles(outputRun.format.styles),
				...computeForegroundBackgroundColor(ColorType.Foreground, outputRun.format.foregroundColor),
				...computeForegroundBackgroundColor(ColorType.Background, outputRun.format.backgroundColor),
			};
	};

	// Render.
	return (
		<span style={computeCSSProperties(outputRun)}>{outputRun.text}</span>
	);
};
