import { ApiError } from "../types.ts";
import { ensureTrailingSlash } from "../../core/path.ts";
import { isHttpUrl } from "../../core/url.ts";
import { AccountToken } from "../provider.ts";

export const transformAtlassianDomain = (domain: string) => {
  return ensureTrailingSlash(
    isHttpUrl(domain) ? domain : `https://${domain}.atlassian.net`
  );
};

export const isUnauthorized = (error: Error): boolean => {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  );
};

export const isNotFound = (error: Error): boolean => {
  return error instanceof ApiError && error.status === 404;
};

const exitIfNoValue = (value: string) => {
  if (value?.length === 0) {
    throw new Error("");
  }
};

export const validateServer = (value: string): boolean | string => {
  exitIfNoValue(value);
  try {
    new URL(transformAtlassianDomain(value));
    return true;
  } catch {
    return `Not a valid URL`;
  }
};

export const validateEmail = (value: string): boolean | string => {
  exitIfNoValue(value);

  // TODO use deno validation
  // https://deno.land/x/validation@v0.4.0
  const expression: RegExp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  const isValid = expression.test(value);

  if (!isValid) {
    return "Invalid email address";
  }

  return true;
};

export const validateToken = (value: string): boolean => {
  exitIfNoValue(value);
  return true;
};

export const getMessageFromAPIError = (error: any): string => {
  if (error instanceof ApiError) {
    return `${error.status} - ${error.statusText}`;
  }

  if (error?.message) {
    return error.message;
  }

  return "Unknown error";
};

export const tokenFilterOut = (
  accessToken: AccountToken,
  token: AccountToken
) => {
  return accessToken.server !== token.server && accessToken.name !== token.name;
};
