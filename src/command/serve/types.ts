/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ServerRequest } from "http/server.ts";

import { ProjectContext } from "../../project/types.ts";

export interface ProjectWatcher {
  handle: (req: ServerRequest) => boolean;
  connect: (req: ServerRequest) => Promise<void>;
  injectClient: (file: Uint8Array, inputFile: string) => Uint8Array;
  serveProject: () => ProjectContext;
  refreshProject: () => Promise<ProjectContext>;
}

export type ServeOptions = {
  port: number;
  host: string;
  render: string;
  browse?: boolean | string;
  watch?: boolean;
  navigate?: boolean;
};
