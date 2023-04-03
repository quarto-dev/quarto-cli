/*
 * http-types.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

export interface FileResponse {
  body: Uint8Array;
  contentType?: string;
}

export interface HttpFileRequestOptions {
  baseDir: string;
  defaultFile?: string;
  printUrls?: "all" | "404";
  onRequest?: (req: Request) => Promise<Response | undefined>;
  onFile?: (
    file: string,
    req: Request,
  ) => Promise<FileResponse | undefined>;
  on404?: (
    url: string,
    req: Request,
  ) => { print?: boolean; response: FileResponse };
}
