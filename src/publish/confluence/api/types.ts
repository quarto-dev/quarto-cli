/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export type User = {
  type: "known" | "unknown" | "anonymous" | "user";
  username: string;
  userKey: string;
  accountId: string;
  accountType: "atlassian" | "app";
  email: string;
};
