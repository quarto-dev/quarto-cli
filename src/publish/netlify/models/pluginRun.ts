// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type pluginRun = ({
  package?: string;
  version?: string;
  state?: string;
  reporting_event?: string;
  title?: string;
  summary?: string;
  text?: string;
} & {
  deploy_id?: string;
});
