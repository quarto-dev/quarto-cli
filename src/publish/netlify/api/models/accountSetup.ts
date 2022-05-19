// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type accountSetup = {
  name: string;
  type_id: string;
  payment_method_id?: string;
  period?: accountSetup.period;
  extra_seats_block?: number;
};

export namespace accountSetup {
  export enum period {
    MONTHLY = "monthly",
    YEARLY = "yearly",
  }
}
