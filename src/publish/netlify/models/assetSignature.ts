// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type assetSignature = {
  form?: {
    url?: string;
    fields?: Record<string, string>;
  };
  asset?: {
    id?: string;
    site_id?: string;
    creator_id?: string;
    name?: string;
    state?: string;
    content_type?: string;
    url?: string;
    key?: string;
    visibility?: string;
    size?: number;
    created_at?: string;
    updated_at?: string;
  };
};
