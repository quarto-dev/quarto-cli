/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ProjectContext } from "../project/types.ts";

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly description: string | undefined = undefined,
  ) {
    let message = `API Error: ${status} - ${statusText}`;
    if (description) {
      message = `${message} (${description})`;
    }
    super(message);
  }
}

export type PublishDeployments = {
  dir: string;
  source: string;
  records: Record<string, Array<PublishRecord>>;
};

export type PublishRecord = {
  id: string;
  url?: string;
  code?: boolean;
};

export type PublishOptions = {
  input: ProjectContext | string;
  server?: string | null;
  token?: string;
  id?: string;
  render: boolean;
  prompt: boolean;
  browser: boolean;
};
