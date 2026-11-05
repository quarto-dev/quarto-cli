import {when} from "./when.js";

export function tick(duration, value) {
  return when(Math.ceil((Date.now() + 1) / duration) * duration, value);
}
