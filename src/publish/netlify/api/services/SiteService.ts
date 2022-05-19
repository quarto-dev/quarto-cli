// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class SiteService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSites({
    name,
    filter,
    page,
    perPage,
  }: {
    name?: string;
    filter?: "all" | "owner" | "guest";
    page?: number;
    perPage?: number;
  }): CancelablePromise<
    Array<{
      id?: string;
      state?: string;
      plan?: string;
      name?: string;
      custom_domain?: string;
      domain_aliases?: Array<string>;
      password?: string;
      notification_email?: string;
      url?: string;
      ssl_url?: string;
      admin_url?: string;
      screenshot_url?: string;
      created_at?: string;
      updated_at?: string;
      user_id?: string;
      session_id?: string;
      ssl?: boolean;
      force_ssl?: boolean;
      managed_dns?: boolean;
      deploy_url?: string;
      published_deploy?: {
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
      account_name?: string;
      account_slug?: string;
      git_provider?: string;
      deploy_hook?: string;
      capabilities?: Record<string, any>;
      processing_settings?: {
        skip?: boolean;
        css?: {
          bundle?: boolean;
          minify?: boolean;
        };
        js?: {
          bundle?: boolean;
          minify?: boolean;
        };
        images?: {
          optimize?: boolean;
        };
        html?: {
          pretty_urls?: boolean;
        };
      };
      build_settings?: {
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
      id_domain?: string;
      default_hooks_data?: {
        access_token?: string;
      };
      build_image?: string;
      prerender?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites",
      query: {
        "name": name,
        "filter": filter,
        "page": page,
        "per_page": perPage,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createSite({
    site,
    configureDns,
  }: {
    site: {
      id?: string;
      state?: string;
      plan?: string;
      name?: string;
      custom_domain?: string;
      domain_aliases?: Array<string>;
      password?: string;
      notification_email?: string;
      url?: string;
      ssl_url?: string;
      admin_url?: string;
      screenshot_url?: string;
      created_at?: string;
      updated_at?: string;
      user_id?: string;
      session_id?: string;
      ssl?: boolean;
      force_ssl?: boolean;
      managed_dns?: boolean;
      deploy_url?: string;
      published_deploy?: {
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
      account_name?: string;
      account_slug?: string;
      git_provider?: string;
      deploy_hook?: string;
      capabilities?: Record<string, any>;
      processing_settings?: {
        skip?: boolean;
        css?: {
          bundle?: boolean;
          minify?: boolean;
        };
        js?: {
          bundle?: boolean;
          minify?: boolean;
        };
        images?: {
          optimize?: boolean;
        };
        html?: {
          pretty_urls?: boolean;
        };
      };
      build_settings?: {
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
      id_domain?: string;
      default_hooks_data?: {
        access_token?: string;
      };
      build_image?: string;
      prerender?: string;
    };
    configureDns?: boolean;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites",
      query: {
        "configure_dns": configureDns,
      },
      body: site,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSite({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<{
    id?: string;
    state?: string;
    plan?: string;
    name?: string;
    custom_domain?: string;
    domain_aliases?: Array<string>;
    password?: string;
    notification_email?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    screenshot_url?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    session_id?: string;
    ssl?: boolean;
    force_ssl?: boolean;
    managed_dns?: boolean;
    deploy_url?: string;
    published_deploy?: {
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
    account_name?: string;
    account_slug?: string;
    git_provider?: string;
    deploy_hook?: string;
    capabilities?: Record<string, any>;
    processing_settings?: {
      skip?: boolean;
      css?: {
        bundle?: boolean;
        minify?: boolean;
      };
      js?: {
        bundle?: boolean;
        minify?: boolean;
      };
      images?: {
        optimize?: boolean;
      };
      html?: {
        pretty_urls?: boolean;
      };
    };
    build_settings?: {
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
    id_domain?: string;
    default_hooks_data?: {
      access_token?: string;
    };
    build_image?: string;
    prerender?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public updateSite({
    siteId,
    site,
  }: {
    siteId: string;
    site: {
      id?: string;
      state?: string;
      plan?: string;
      name?: string;
      custom_domain?: string;
      domain_aliases?: Array<string>;
      password?: string;
      notification_email?: string;
      url?: string;
      ssl_url?: string;
      admin_url?: string;
      screenshot_url?: string;
      created_at?: string;
      updated_at?: string;
      user_id?: string;
      session_id?: string;
      ssl?: boolean;
      force_ssl?: boolean;
      managed_dns?: boolean;
      deploy_url?: string;
      published_deploy?: {
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
      account_name?: string;
      account_slug?: string;
      git_provider?: string;
      deploy_hook?: string;
      capabilities?: Record<string, any>;
      processing_settings?: {
        skip?: boolean;
        css?: {
          bundle?: boolean;
          minify?: boolean;
        };
        js?: {
          bundle?: boolean;
          minify?: boolean;
        };
        images?: {
          optimize?: boolean;
        };
        html?: {
          pretty_urls?: boolean;
        };
      };
      build_settings?: {
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
      id_domain?: string;
      default_hooks_data?: {
        access_token?: string;
      };
      build_image?: string;
      prerender?: string;
    };
  }): CancelablePromise<{
    id?: string;
    state?: string;
    plan?: string;
    name?: string;
    custom_domain?: string;
    domain_aliases?: Array<string>;
    password?: string;
    notification_email?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    screenshot_url?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    session_id?: string;
    ssl?: boolean;
    force_ssl?: boolean;
    managed_dns?: boolean;
    deploy_url?: string;
    published_deploy?: {
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
    account_name?: string;
    account_slug?: string;
    git_provider?: string;
    deploy_hook?: string;
    capabilities?: Record<string, any>;
    processing_settings?: {
      skip?: boolean;
      css?: {
        bundle?: boolean;
        minify?: boolean;
      };
      js?: {
        bundle?: boolean;
        minify?: boolean;
      };
      images?: {
        optimize?: boolean;
      };
      html?: {
        pretty_urls?: boolean;
      };
    };
    build_settings?: {
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
    id_domain?: string;
    default_hooks_data?: {
      access_token?: string;
    };
    build_image?: string;
    prerender?: string;
  }> {
    return this.httpRequest.request({
      method: "PATCH",
      url: "/sites/{site_id}",
      path: {
        "site_id": siteId,
      },
      body: site,
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteSite({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/sites/{site_id}",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * [Beta] Unlinks the repo from the site.
   *
   * This action will also:
   * - Delete associated deploy keys
   * - Delete outgoing webhooks for the repo
   * - Delete the site's build hooks
   * @returns any OK
   * @throws ApiError
   */
  public unlinkSiteRepo({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<{
    id?: string;
    state?: string;
    plan?: string;
    name?: string;
    custom_domain?: string;
    domain_aliases?: Array<string>;
    password?: string;
    notification_email?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    screenshot_url?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    session_id?: string;
    ssl?: boolean;
    force_ssl?: boolean;
    managed_dns?: boolean;
    deploy_url?: string;
    published_deploy?: {
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
    account_name?: string;
    account_slug?: string;
    git_provider?: string;
    deploy_hook?: string;
    capabilities?: Record<string, any>;
    processing_settings?: {
      skip?: boolean;
      css?: {
        bundle?: boolean;
        minify?: boolean;
      };
      js?: {
        bundle?: boolean;
        minify?: boolean;
      };
      images?: {
        optimize?: boolean;
      };
      html?: {
        pretty_urls?: boolean;
      };
    };
    build_settings?: {
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
    id_domain?: string;
    default_hooks_data?: {
      access_token?: string;
    };
    build_image?: string;
    prerender?: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/unlink_repo",
      path: {
        "site_id": siteId,
      },
      errors: {
        404: `Site not found`,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createSiteInTeam({
    accountSlug,
    site,
    configureDns,
  }: {
    accountSlug: string;
    site?: {
      id?: string;
      state?: string;
      plan?: string;
      name?: string;
      custom_domain?: string;
      domain_aliases?: Array<string>;
      password?: string;
      notification_email?: string;
      url?: string;
      ssl_url?: string;
      admin_url?: string;
      screenshot_url?: string;
      created_at?: string;
      updated_at?: string;
      user_id?: string;
      session_id?: string;
      ssl?: boolean;
      force_ssl?: boolean;
      managed_dns?: boolean;
      deploy_url?: string;
      published_deploy?: {
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
      account_name?: string;
      account_slug?: string;
      git_provider?: string;
      deploy_hook?: string;
      capabilities?: Record<string, any>;
      processing_settings?: {
        skip?: boolean;
        css?: {
          bundle?: boolean;
          minify?: boolean;
        };
        js?: {
          bundle?: boolean;
          minify?: boolean;
        };
        images?: {
          optimize?: boolean;
        };
        html?: {
          pretty_urls?: boolean;
        };
      };
      build_settings?: {
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
      id_domain?: string;
      default_hooks_data?: {
        access_token?: string;
      };
      build_image?: string;
      prerender?: string;
    };
    configureDns?: boolean;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/{account_slug}/sites",
      path: {
        "account_slug": accountSlug,
      },
      query: {
        "configure_dns": configureDns,
      },
      body: site,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSitesForAccount({
    accountSlug,
    name,
    page,
    perPage,
  }: {
    accountSlug: string;
    name?: string;
    page?: number;
    perPage?: number;
  }): CancelablePromise<
    Array<{
      id?: string;
      state?: string;
      plan?: string;
      name?: string;
      custom_domain?: string;
      domain_aliases?: Array<string>;
      password?: string;
      notification_email?: string;
      url?: string;
      ssl_url?: string;
      admin_url?: string;
      screenshot_url?: string;
      created_at?: string;
      updated_at?: string;
      user_id?: string;
      session_id?: string;
      ssl?: boolean;
      force_ssl?: boolean;
      managed_dns?: boolean;
      deploy_url?: string;
      published_deploy?: {
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
      account_name?: string;
      account_slug?: string;
      git_provider?: string;
      deploy_hook?: string;
      capabilities?: Record<string, any>;
      processing_settings?: {
        skip?: boolean;
        css?: {
          bundle?: boolean;
          minify?: boolean;
        };
        js?: {
          bundle?: boolean;
          minify?: boolean;
        };
        images?: {
          optimize?: boolean;
        };
        html?: {
          pretty_urls?: boolean;
        };
      };
      build_settings?: {
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
      id_domain?: string;
      default_hooks_data?: {
        access_token?: string;
      };
      build_image?: string;
      prerender?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/{account_slug}/sites",
      path: {
        "account_slug": accountSlug,
      },
      query: {
        "name": name,
        "page": page,
        "per_page": perPage,
      },
    });
  }
}
