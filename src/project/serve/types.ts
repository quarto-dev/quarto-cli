/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { FileResponse } from "../../core/http.ts";
import { kProjectWatchInputs, ProjectContext } from "../../project/types.ts";
import { ProjectPreviewServe } from "../../resources/types/schema-types.ts";

export interface ProjectWatcher {
  handle: (req: Request) => boolean;
  connect: (req: Request) => Promise<Response | undefined>;
  injectClient: (
    req: Request,
    file: Uint8Array,
    inputFile?: string,
  ) => FileResponse;
  hasClients: () => boolean;
  reloadClients: (output: boolean, reloadTarget?: string) => Promise<void>;
  project: () => ProjectContext;
  refreshProject: () => Promise<ProjectContext>;
}

export type ServeOptions = {
  render: string;
  serve?:
    | boolean
    | ProjectPreviewServe;
  port?: number;
  host?: string;
  browser?: boolean;
  [kProjectWatchInputs]?: boolean;
  timeout?: number;
  browserPath?: string;
  navigate?: boolean;
};
