import {
  Cookie,
  CookieOptions,
  isSameDomainOrSubdomain,
  parseURL,
} from "./cookie.ts";

const strictMatchProps = [
  "value",
  "secure",
  "httpOnly",
  "maxAge",
  "expires",
  "sameSite",
];

function cookieMatches(
  options: Cookie | CookieOptions,
  comparedWith: Cookie,
  strictMatch = false,
): boolean {
  if (
    options.path !== undefined && !comparedWith.path?.startsWith(options.path)
  ) {
    return false;
  }

  if (options.domain) {
    if (!isSameDomainOrSubdomain(options.domain, comparedWith.domain)) {
      return false;
    }
  }

  if (
    options.name !== undefined &&
    options.name !== comparedWith.name
  ) {
    return false;
  }

  if (
    strictMatch &&
    strictMatchProps.some((propKey) =>
      // deno-lint-ignore ban-ts-comment
      // @ts-ignore
      options[propKey] !== undefined &&
      // deno-lint-ignore ban-ts-comment
      // @ts-ignore
      options[propKey] !== comparedWith[propKey]
    )
  ) {
    return false;
  }

  return true;
}

// cookie compare from tough-cookie
const MAX_TIME = 2147483647000; // 31-bit max
/**
 *  Cookies with longer paths are listed before cookies with
 *  shorter paths.
 *
 *  Among cookies that have equal-length path fields, cookies with
 *  earlier creation-times are listed before cookies with later
 *  creation-times."
 */
function cookieCompare(a: Cookie, b: Cookie) {
  let cmp = 0;

  // descending for length: b CMP a
  const aPathLen = a.path?.length || 0;
  const bPathLen = b.path?.length || 0;
  cmp = bPathLen - aPathLen;
  if (cmp !== 0) {
    return cmp;
  }

  // ascending for time: a CMP b
  const aTime = a.creationDate || MAX_TIME;
  const bTime = b.creationDate || MAX_TIME;
  cmp = aTime - bTime;
  if (cmp !== 0) {
    return cmp;
  }

  // tie breaker
  cmp = a.creationIndex - b.creationIndex;

  return cmp;
}

export class CookieJar {
  cookies = Array<Cookie>();

  /**
   * @param cookies - the cookies array to initialize with
   */
  constructor(cookies?: Array<Cookie> | Array<CookieOptions>) {
    this.replaceCookies(cookies);
  }

  /**
   * Sets or replaces a cookie inside the jar.
   * Only sets new cookies if cookie is valid and not expired.
   * Validation and expiration checks are not run when replacing a cookie.
   * @param url - the url that this cookie from received from. mainly used by the fetch wrapper.
   *              will automatically set domain and path if provided and it was not found inside Cookie/cookiestring.
   */
  setCookie(cookie: Cookie | string, url?: string | Request | URL) {
    let cookieObj;
    if (typeof cookie === "string") {
      cookieObj = Cookie.from(cookie);
    } else {
      cookieObj = cookie;
    }
    if (url) {
      if (!cookieObj.domain) {
        cookieObj.setDomain(url);
      }
      if (!cookieObj.path) {
        cookieObj.setPath(url);
      }
    }

    if (!cookieObj.isValid()) {
      return;
    }

    const foundCookie = this.getCookie(cookieObj);
    if (foundCookie) {
      const indexOfCookie = this.cookies.indexOf(foundCookie);
      if (!cookieObj.isExpired()) {
        this.cookies.splice(indexOfCookie, 1, cookieObj);
      } else {
        this.cookies.splice(indexOfCookie, 1);
      }
    } else if (!cookieObj.isExpired()) {
      this.cookies.push(cookieObj);
    }

    // sort by creation date, so when searching, we get the latest created cookies.
    this.cookies.sort(cookieCompare);
  }

  /**
   * Gets the first cooking matching the defined properties of a given Cookie or CookieOptions.
   * returns undefined if not found or expired. `creationDate` prop is not checked.
   * Also removes the cookie and returns undefined if cookie is expired.
   */
  getCookie(options: Cookie | CookieOptions): Cookie | undefined {
    const strictMatch = typeof (options as Cookie).isValid !== "function";
    for (const [index, cookie] of this.cookies.entries()) {
      if (cookieMatches(options, cookie, strictMatch)) {
        if (!cookie.isExpired()) {
          return cookie;
        } else {
          this.cookies.splice(index, 1);
          return undefined;
        }
      }
    }
  }

  /**
   * Returns cookies that match the options excluding expired ones, also removes expired cookies before returning.
   * @param options - the options to filter cookies with, and if not provided, returnes all cookies.
   *  if no cookie is found with given options, an empty array is returned.
   */
  getCookies(options?: CookieOptions | Cookie) {
    if (options) {
      const matchedCookies: Cookie[] = [];
      const removeCookies: Cookie[] = [];
      for (const cookie of this.cookies) {
        if (cookieMatches(options, cookie)) {
          if (!cookie.isExpired()) {
            matchedCookies.push(cookie);
          } else {
            removeCookies.push(cookie);
          }
        }
      }
      if (removeCookies.length) {
        this.cookies = this.cookies.filter((cookie) =>
          !removeCookies.includes(cookie)
        );
      }
      return matchedCookies;
    } else {
      return this.cookies;
    }
  }

  /**
   * Converts the cookies to a string that can be used in a request.
   * @param url - the url to get the cookies for. if provided, will only return cookies that match the domain and path of the url.
   * @returns string of all cookies that match the url, in the from of `<cookie-name>=<cookie-value>` seperated by `; `
   */
  getCookieString(url: string | Request | URL) {
    const searchCookie = new Cookie();
    searchCookie.setDomain(url);
    const cookiesToSend = this.getCookies(searchCookie)
      .filter((cookie) => {
        return cookie.canSendTo(parseURL(url));
      })
      .map((c) => c.getCookieString())
      .join("; ");
    return cookiesToSend;
  }

  toJSON() {
    return this.cookies;
  }

  /**
   * Removes first cookie that matches the given option.
   *
   * Returns the deleted cookie if found or undefined otherwise.
   */
  removeCookie(options: CookieOptions | Cookie): Cookie | undefined {
    for (const [index, cookie] of this.cookies.entries()) {
      if (cookieMatches(options, cookie)) {
        return this.cookies.splice(index, 1)[0];
      }
    }
  }

  /**
   * Removes all cookies that matches the given option.
   * If options is not given, all cookies will be deleted.
   *
   * Returns the deleted cookies if found or undefined otherwise.
   */
  removeCookies(options?: CookieOptions | Cookie): Array<Cookie> | undefined {
    if (options) {
      const deletedCookies: Cookie[] = [];
      this.cookies = this.cookies.filter((cookie) => {
        if (cookieMatches(options, cookie)) {
          deletedCookies.push(cookie);
          return false;
        }
        return true;
      });
      return deletedCookies.length ? deletedCookies : undefined;
    } else {
      this.cookies = [];
    }
  }

  replaceCookies(cookies?: Array<Cookie> | Array<CookieOptions>) {
    if (cookies?.length) {
      if (typeof (cookies[0] as Cookie).isValid === "function") {
        this.cookies = cookies as Array<Cookie>;
      } else {
        this.cookies = [];
        for (const option of cookies) {
          this.cookies.push(new Cookie(option));
        }
      }
    } else {
      this.cookies = [];
    }
  }
}
