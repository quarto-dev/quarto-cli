/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { FileResponse } from "../../core/http-types.ts";
import { kProjectWatchInputs, ProjectContext } from "../../project/types.ts";

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
  port?: number;
  host?: string;
  browser?: boolean;
  [kProjectWatchInputs]?: boolean;
  timeout?: number;
  browserPath?: string;
  touchPath?: string;
  navigate?: boolean;
};
