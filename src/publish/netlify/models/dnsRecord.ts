// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type dnsRecord = {
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
};
