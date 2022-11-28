/**
 * @internal
 */
export interface ErrorLike extends Error {
  name: string;
  message: string;
}
/**
 * @internal
 */
export declare function isErrorLike(obj: unknown): obj is ErrorLike;