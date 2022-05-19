// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type deployFiles = {
  files?: any;
  draft?: boolean;
  async?: boolean;
  functions?: any;
  function_schedules?: Array<{
    name?: string;
    cron?: string;
  }>;
  branch?: string;
  framework?: string;
};
