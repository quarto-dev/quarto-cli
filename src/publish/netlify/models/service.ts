// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type service = {
  id?: string;
  name?: string;
  slug?: string;
  service_path?: string;
  long_description?: string;
  description?: string;
  events?: Array<any>;
  tags?: Array<string>;
  icon?: string;
  manifest_url?: string;
  environments?: Array<string>;
  created_at?: string;
  updated_at?: string;
};
