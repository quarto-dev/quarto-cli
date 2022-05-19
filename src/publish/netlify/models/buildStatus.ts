// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type buildStatus = {
  active?: number;
  pending_concurrency?: number;
  enqueued?: number;
  build_count?: number;
  minutes?: {
    current?: number;
    current_average_sec?: number;
    previous?: number;
    period_start_date?: string;
    period_end_date?: string;
    last_updated_at?: string;
    included_minutes?: string;
    included_minutes_with_packs?: string;
  };
};
