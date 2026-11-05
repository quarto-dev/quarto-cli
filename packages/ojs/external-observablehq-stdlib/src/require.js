import {require as initialRequire, requireFrom} from "external-d3-d3-require";

// TODO Allow this to be overridden using the Library’s resolver.
export const cdn = "https://cdn.observableusercontent.com/npm/";

export let requireDefault = initialRequire;

export function setDefaultRequire(require) {
  requireDefault = require;
}

export function requirer(resolver) {
  return resolver == null ? requireDefault : requireFrom(resolver);
}
