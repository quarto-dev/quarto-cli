// this is clearly a fake jsx runtime, we use it simply to other appease `deno check`
// this also means that our typechecks for TSX might be more lax than we wanted.
// We'll improve over time.

// deno-lint-ignore-file
export namespace JSX {
  export type IntrinsicElements = { [key: string]: unknown };
}
