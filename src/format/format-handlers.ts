/*
 * format-handlers.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { Format } from "../config/types.ts";

export type WriterFormatHandler = (to: string) => {
  format: Format;
  pandocTo?: string;
} | undefined;

export const writerFormatHandlers: WriterFormatHandler[] = [];

export function registerWriterFormatHandler(
  handler: WriterFormatHandler,
): void {
  writerFormatHandlers.push(handler);
}
