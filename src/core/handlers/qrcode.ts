/*
 * qrcode.ts
 *
 * Copyright (C) 2022-2024 Posit Software, PBC
 */

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { asMappedString, MappedString } from "../lib/mapped-text.ts";

import { DirectiveCell } from "../lib/break-quarto-md-types.ts";

import QRCode from "qrcode";

const qrHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "qr",

  type: "directive",
  stage: "pre-engine",

  async directive(
    _handlerContext: LanguageCellHandlerContext,
    directive: DirectiveCell,
  ): Promise<MappedString> {
    const param = directive.shortcode.params[0];

    const dataUrl = await (new Promise((resolve, reject) => {
      // deno-lint-ignore no-explicit-any
      QRCode.toDataURL(param, (err: any, url: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(url);
        }
      });
    }));

    let opts = directive.shortcode.rawParams.slice(1).map((param) => {
      if (param.name) {
        return ` ${param.name}="${param.value}"`;
      } else {
        return ` ${param.value}`;
      }
    }).join("");
    return asMappedString(`![](${dataUrl}){.qrcode${opts}}`);
  },
};

install(qrHandler);
