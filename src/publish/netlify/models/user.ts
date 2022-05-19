// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type user = {
  id?: string;
  uid?: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
  affiliate_id?: string;
  site_count?: number;
  created_at?: string;
  last_login?: string;
  login_providers?: Array<string>;
  onboarding_progress?: {
    slides?: string;
  };
};
