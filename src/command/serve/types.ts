/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format } from "../../config/types.ts";

import { ProjectContext } from "../../project/types.ts";

export interface ProjectWatcher {
  handle: (req: Request) => boolean;
  connect: (req: Request) => Promise<Response | undefined>;
  injectClient: (
    file: Uint8Array,
    inputFile?: string,
    format?: Format,
  ) => Uint8Array;
  project: () => ProjectContext;
  serveProject: () => ProjectContext;
  refreshProject: () => Promise<ProjectContext>;
}

export type ServeOptions = {
  port: number;
  host: string;
  render: string;
  browse?: boolean | string;
  watchInputs?: boolean;
  navigate?: boolean;
};
