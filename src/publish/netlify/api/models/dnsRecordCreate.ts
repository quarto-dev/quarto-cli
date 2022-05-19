// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type dnsRecordCreate = {
  type?: string;
  hostname?: string;
  value?: string;
  ttl?: number;
  priority?: number;
  weight?: number;
  port?: number;
  flag?: number;
  tag?: string;
};
