/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export type ProjectPublish = Record<string, Array<PublishRecord>>;

export type PublishRecord = {
  id: string;
  url: string;
};
