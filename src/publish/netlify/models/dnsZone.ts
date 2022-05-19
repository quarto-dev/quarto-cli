// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type dnsZone = {
  id?: string;
  name?: string;
  errors?: Array<string>;
  supported_record_types?: Array<string>;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  records?: Array<{
    id?: string;
    hostname?: string;
    type?: string;
    value?: string;
    ttl?: number;
    priority?: number;
    dns_zone_id?: string;
    site_id?: string;
    flag?: number;
    tag?: string;
    managed?: boolean;
  }>;
  dns_servers?: Array<string>;
  account_id?: string;
  site_id?: string;
  account_slug?: string;
  account_name?: string;
  domain?: string;
  ipv6_enabled?: boolean;
  dedicated?: boolean;
};
