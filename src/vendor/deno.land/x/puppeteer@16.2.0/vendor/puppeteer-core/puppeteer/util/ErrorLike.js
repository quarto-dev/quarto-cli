/// <reference types="./ErrorLike.d.ts" />
/**
 * @internal
 */
/**
 * @internal
 */
export function isErrorLike(obj) {
  return (typeof obj === "object" && obj !== null && "name" in obj &&
    "message" in obj);
}
//# sourceMappingURL=ErrorLike.js.map
