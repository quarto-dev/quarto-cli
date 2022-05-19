/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class DnsZoneService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getDnsForSite({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
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
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/dns",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public configureDnsForSite({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
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
    }>
  > {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/dns",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createDnsZone({
    dnsZoneParams,
  }: {
    dnsZoneParams: {
      account_slug?: string;
      site_id?: string;
      name?: string;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/dns_zones",
      body: dnsZoneParams,
    });
  }

  /**
   * @returns any get all DNS zones the user has access to
   * @throws ApiError
   */
  public getDnsZones({
    accountSlug,
  }: {
    accountSlug?: string;
  }): CancelablePromise<
    Array<{
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
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/dns_zones",
      query: {
        "account_slug": accountSlug,
      },
    });
  }

  /**
   * @returns any get a single DNS zone
   * @throws ApiError
   */
  public getDnsZone({
    zoneId,
  }: {
    zoneId: string;
  }): CancelablePromise<{
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
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/dns_zones/{zone_id}",
      path: {
        "zone_id": zoneId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteDnsZone({
    zoneId,
  }: {
    zoneId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/dns_zones/{zone_id}",
      path: {
        "zone_id": zoneId,
      },
    });
  }

  /**
   * @returns any transfer a DNS zone to another account
   * @throws ApiError
   */
  public transferDnsZone({
    zoneId,
    accountId,
    transferAccountId,
    transferUserId,
  }: {
    zoneId: string;
    /** the account of the dns zone **/
    accountId: string;
    /** the account you want to transfer the dns zone to **/
    transferAccountId: string;
    /** the user you want to transfer the dns zone to **/
    transferUserId: string;
  }): CancelablePromise<{
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
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/dns_zones/{zone_id}/transfer",
      path: {
        "zone_id": zoneId,
      },
      query: {
        "account_id": accountId,
        "transfer_account_id": transferAccountId,
        "transfer_user_id": transferUserId,
      },
    });
  }

  /**
   * @returns any get all DNS records for a single DNS zone
   * @throws ApiError
   */
  public getDnsRecords({
    zoneId,
  }: {
    zoneId: string;
  }): CancelablePromise<
    Array<{
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
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/dns_zones/{zone_id}/dns_records",
      path: {
        "zone_id": zoneId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createDnsRecord({
    zoneId,
    dnsRecord,
  }: {
    zoneId: string;
    dnsRecord: {
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
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/dns_zones/{zone_id}/dns_records",
      path: {
        "zone_id": zoneId,
      },
      body: dnsRecord,
    });
  }

  /**
   * @returns any get a single DNS record
   * @throws ApiError
   */
  public getIndividualDnsRecord({
    zoneId,
    dnsRecordId,
  }: {
    zoneId: string;
    dnsRecordId: string;
  }): CancelablePromise<{
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
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/dns_zones/{zone_id}/dns_records/{dns_record_id}",
      path: {
        "zone_id": zoneId,
        "dns_record_id": dnsRecordId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteDnsRecord({
    zoneId,
    dnsRecordId,
  }: {
    zoneId: string;
    dnsRecordId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/dns_zones/{zone_id}/dns_records/{dns_record_id}",
      path: {
        "zone_id": zoneId,
        "dns_record_id": dnsRecordId,
      },
    });
  }
}
