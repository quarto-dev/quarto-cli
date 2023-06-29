/*
 * types.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

export type User = {
  id: number;
  email: string;
};

export type Content = {
  id: number;
  url: string;
  space_id: number;
  source_id: number;
};

export type OutputRevision = {
  id: number;
  application_id: number;
};

export type Application = {
  id: number;
  content_id: number;
};

export type Bundle = {
  id: number;
  presigned_url: string;
  presigned_checksum: string;
};

export type Task = {
  task_id: number;
  finished: boolean;
  description: string;
  state: string;
  error?: string;
};
