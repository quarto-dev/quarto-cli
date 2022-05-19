// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type paymentMethod = {
  id?: string;
  method_name?: string;
  type?: string;
  state?: string;
  data?: {
    card_type?: string;
    last4?: string;
    email?: string;
  };
  created_at?: string;
  updated_at?: string;
};
