/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { FileResponse } from "../../core/http.ts";
import { kProjectWatchInputs, ProjectContext } from "../../project/types.ts";

export interface ProjectWatcher {
  handle: (req: Request) => boolean;
  connect: (req: Request) => Promise<Response | undefined>;
  injectClient: (
    file: Uint8Array,
    inputFile?: string,
  ) => FileResponse;
  hasClients: () => boolean;
  reloadClients: () => Promise<void>;
  project: () => ProjectContext;
  refreshProject: () => Promise<ProjectContext>;
}

export type ServeOptions = {
  render: string;
  port?: number;
  host?: string;
  browser?: boolean;
  [kProjectWatchInputs]?: boolean;
  timeout?: number;
  browserPath?: string;
  navigate?: boolean;
};
