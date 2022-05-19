// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type deploy = {
  id?: string;
  site_id?: string;
  user_id?: string;
  build_id?: string;
  state?: string;
  name?: string;
  url?: string;
  ssl_url?: string;
  admin_url?: string;
  deploy_url?: string;
  deploy_ssl_url?: string;
  screenshot_url?: string;
  review_id?: number;
  draft?: boolean;
  required?: Array<string>;
  required_functions?: Array<string>;
  error_message?: string;
  branch?: string;
  commit_ref?: string;
  commit_url?: string;
  skipped?: boolean;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  title?: string;
  context?: string;
  locked?: boolean;
  review_url?: string;
  site_capabilities?: {
    large_media_enabled?: boolean;
  };
  framework?: string;
  function_schedules?: Array<{
    name?: string;
    cron?: string;
  }>;
};
