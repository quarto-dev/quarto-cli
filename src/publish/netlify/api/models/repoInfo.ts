// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type repoInfo = {
  id?: number;
  provider?: string;
  deploy_key_id?: string;
  repo_path?: string;
  repo_branch?: string;
  dir?: string;
  functions_dir?: string;
  cmd?: string;
  allowed_branches?: Array<string>;
  public_repo?: boolean;
  private_logs?: boolean;
  repo_url?: string;
  env?: Record<string, string>;
  installation_id?: number;
  stop_builds?: boolean;
};
