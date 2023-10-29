// import {  } from "./deps.ts";

// deno-lint-ignore no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F]/;

// with help from https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie and rfc6265
const COOKIE_NAME_BLOCKED = /[()<>@,;:\\"/[\]?={}]/;

// cookie octet should not have control characters, Whitespace, double quotes, comma, semicolon, and backslash
const COOKIE_OCTET_BLOCKED = /[\s",;\\]/;
const COOKIE_OCTET = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/;

const TERMINATORS = ["\n", "\r", "\0"];

/**
 * does not make a difference which one is domainA or domainB
 *
 * according to https://stackoverflow.com/a/30676300/3542461
 */
export function isSameDomainOrSubdomain(domainA?: string, domainB?: string) {
  if (!domainA || !domainB) {
    return false;
  }

  let longerDomain;
  let shorterDomain;
  if (domainB.length > domainA.length) {
    longerDomain = domainB;
    shorterDomain = domainA;
  } else {
    longerDomain = domainA;
    shorterDomain = domainB;
  }

  // check if it's a subdomain or only partially matched
  const indexOfDomain = longerDomain.indexOf(shorterDomain);
  if (indexOfDomain === -1) {
    return false;
  } else if (indexOfDomain > 0) {
    // if the character behind the part is not a dot, its not a subdomain
    if (longerDomain.charAt(indexOfDomain - 1) !== ".") {
      return false;
    }
  }
  // indexOfDomain === 0 is valid

  return true;
}

// from tough-cookie
function trimTerminator(str: string) {
  if (str === undefined || str === "") return str;
  for (let t = 0; t < TERMINATORS.length; t++) {
    const terminatorIdx = str.indexOf(TERMINATORS[t]);
    if (terminatorIdx !== -1) {
      str = str.substr(0, terminatorIdx);
    }
  }

  return str;
}

function isValidName(name: string | undefined) {
  if (!name) {
    return false;
  }
  if (CONTROL_CHARS.test(name) || COOKIE_NAME_BLOCKED.test(name)) {
    return false;
  }
  return true;
}

function trimWrappingDoubleQuotes(val: string) {
  // the value can be wrapped in double quotes, but can't contain double quotes within the value
  if (val.length >= 2 && val.at(0) === '"' && val.at(-1) === '"') {
    return val.slice(1, -1);
  }
  return val;
}

function isValidValue(val: string | undefined) {
  if (val === "") {
    return true;
  }
  if (!val) {
    return false;
  }
  if (
    CONTROL_CHARS.test(val) ||
    COOKIE_OCTET_BLOCKED.test(val) ||
    !COOKIE_OCTET.test(val)
  ) {
    return false;
  }

  return true;
}

export function parseURL(input: string | Request | URL) {
  let copyUrl: string;
  if (input instanceof Request) {
    copyUrl = input.url;
  } else if (input instanceof URL) {
    copyUrl = input.toString();
  } else {
    copyUrl = input;
  }
  // we *need* to replace the leading dot to simplify usage and expectations
  copyUrl = copyUrl.replace(/^\./, "");
  if (!copyUrl.includes("://")) {
    // the protocol does not matter, but we default to insecure for use inside canSendTo
    copyUrl = "http://" + copyUrl;
  }
  return new URL(copyUrl);
}

export type CookieOptions = {
  name?: string;
  value?: string;
  path?: string;
  domain?: string;
  /** in milliseconds */
  expires?: number;
  /** in seconds */
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  /** used for checking against maxAge */
  creationDate?: number;
};

export class Cookie {
  // important
  name: string | undefined;
  value: string | undefined;
  path: string | undefined;
  domain: string | undefined;
  // expire
  /** in milliseconds */
  expires: number | undefined;
  /** in seconds */
  maxAge: number | undefined;
  // other
  secure: boolean | undefined;
  httpOnly: boolean | undefined;
  sameSite: "Lax" | "Strict" | "None" | undefined;
  creationDate = Date.now();
  // deno-lint-ignore ban-ts-comment
  // @ts-ignore
  creationIndex: number;

  static cookiesCreated = 0;

  constructor(options?: CookieOptions) {
    if (options) {
      this.name = options.name;
      this.value = options.value;
      this.path = options.path;
      this.domain = options.domain;
      this.expires = options.expires;
      this.maxAge = options.maxAge;
      this.secure = options.secure;
      this.httpOnly = options.httpOnly;
      this.sameSite = options.sameSite;

      if (options.creationDate) {
        this.creationDate = options.creationDate;
      }
    }

    // used to break creation ties in cookieCompare():
    Object.defineProperty(this, "creationIndex", {
      configurable: false,
      enumerable: false, // important for assertStrictEquals checks
      writable: true,
      value: ++Cookie.cookiesCreated,
    });
  }

  static from(cookieStr: string) {
    const options = {
      name: undefined,
      value: undefined,
      path: undefined,
      domain: undefined,
      expires: undefined,
      maxAge: undefined,
      secure: undefined,
      httpOnly: undefined,
      sameSite: undefined,
      creationDate: Date.now(),
    } as CookieOptions;

    const unparsed = cookieStr.slice().trim(); // copy
    const attrAndValueList = unparsed.split(";");

    // first split is the key value pair,
    // if theres no semicolon in the string, still the first element in array is key value pair
    const keyValuePairString = trimTerminator(attrAndValueList.shift() || "")
      .trim();
    const keyValuePairEqualsIndex = keyValuePairString.indexOf("=");
    if (keyValuePairEqualsIndex < 0) {
      return new Cookie();
    }
    const name = keyValuePairString.slice(0, keyValuePairEqualsIndex);
    const value = trimWrappingDoubleQuotes(
      keyValuePairString.slice(keyValuePairEqualsIndex + 1),
    );

    if (!(isValidName(name) && isValidValue(value))) {
      return new Cookie();
    }
    options.name = name;
    options.value = value;

    // now get attributes
    while (attrAndValueList.length) {
      const cookieAV = attrAndValueList.shift()?.trim();
      if (!cookieAV) {
        // invalid attribute length
        continue;
      }

      const avSeperatorIndex = cookieAV.indexOf("=");
      let attrKey, attrValue;

      if (avSeperatorIndex === -1) {
        attrKey = cookieAV;
        attrValue = "";
      } else {
        attrKey = cookieAV.substr(0, avSeperatorIndex);
        attrValue = cookieAV.substr(avSeperatorIndex + 1);
      }

      attrKey = attrKey.trim().toLowerCase();

      if (attrValue) {
        attrValue = attrValue.trim();
      }

      switch (attrKey) {
        case "expires":
          if (attrValue) {
            const expires = new Date(attrValue).getTime();
            if (expires && !isNaN(expires)) {
              options.expires = expires;
            }
          }
          break;

        case "max-age":
          if (attrValue) {
            const maxAge = parseInt(attrValue, 10);
            if (!isNaN(maxAge)) {
              options.maxAge = maxAge;
            }
          }
          break;

        case "domain":
          if (attrValue) {
            const domain = parseURL(attrValue).hostname;
            if (domain) {
              options.domain = domain;
            }
          }
          break;

        case "path":
          if (attrValue) {
            options.path = attrValue.startsWith("/")
              ? attrValue
              : "/" + attrValue;
          }
          break;

        case "secure":
          options.secure = true;
          break;

        case "httponly":
          options.httpOnly = true;
          break;

        case "samesite": {
          const lowerCasedSameSite = attrValue.toLowerCase();
          switch (lowerCasedSameSite) {
            case "strict":
              options.sameSite = "Strict";
              break;
            case "lax":
              options.sameSite = "Lax";
              break;
            case "none":
              options.sameSite = "None";
              break;
            default:
              break;
          }
          break;
        }
        // unknown attribute
        default:
          break;
      }
    }

    return new Cookie(options);
  }

  isValid(): boolean {
    return isValidName(this.name) && isValidValue(this.value);
  }

  /**
   * @param url - the url that we are checking against
   */
  canSendTo(url: string | Request | URL) {
    const urlObj = parseURL(url);

    if (this.secure && urlObj.protocol !== "https:") {
      return false;
    }

    if (this.sameSite === "None" && !this.secure) return false;

    if (this.path) {
      if (
        this.path === urlObj.pathname // identical
      ) {
        return true;
      }
      if (
        urlObj.pathname.startsWith(this.path) &&
        this.path[this.path.length - 1] === "/" // any sub path after a '/'
      ) {
        return true;
      }
      if (
        this.path.length < urlObj.pathname.length &&
        urlObj.pathname.startsWith(this.path) &&
        urlObj.pathname[this.path.length] === "/"
      ) {
        return true;
        // this one was a bit tricky to understand for me
        // quick explain:
        // imagin two path where A is the cookie path and B and C is the requested paths:
        //    A: /foo
        //    B: /foo/bar --> true
        //    C: /foobar ---> false
        // Difference with previous if ? very slight difference, A is /foo/ instead of /foo in the example
      }

      return false;
    }

    if (this.domain) {
      // according to rfc 6265 8.5.  Weak Confidentiality,
      // port should not matter, hence the usage of 'hostname' over 'host'
      const hostname = urlObj.hostname; // 'host' includes port number, if specified, hostname does not
      if (isSameDomainOrSubdomain(this.domain, hostname)) {
        return true;
      }
    }

    return false;
  }

  getCookieString() {
    return `${this.name || ""}=${this.value || ""}`;
  }

  setDomain(url: string | Request | URL) {
    this.domain = parseURL(url).hostname;
  }

  setPath(url: string | Request | URL) {
    // https://www.rfc-editor.org/rfc/rfc6265#section-5.1.4
    const uriPath = parseURL(url).pathname; // step 1

    if (!uriPath || uriPath[0] !== "/") { // step 2
      this.path = "/";
    } else {
      const rightmostSlashIdx = uriPath.lastIndexOf("/");
      if (rightmostSlashIdx <= 0) { // step 3
        this.path = "/";
      } else { // step 4
        this.path = uriPath.slice(0, rightmostSlashIdx);
      }
    }
  }

  setExpires(exp: Date | number) {
    if (exp instanceof Date) {
      this.expires = exp.getTime();
    } else if (typeof exp === "number" && exp >= 0) {
      this.expires = exp;
    }
  }

  isExpired() {
    if (this.maxAge !== undefined) {
      if (Date.now() - this.creationDate >= this.maxAge * 1000) {
        return true;
      }
    }
    if (this.expires !== undefined) {
      // now is past beyond the expire
      if (Date.now() - this.expires >= 0) {
        return true;
      }
    }

    return false;
  }

  toString() {
    let str = this.getCookieString();

    if (this.expires && this.expires !== Infinity) {
      str += "; Expires=" + (new Date(this.expires)).toUTCString();
    }

    if (this.maxAge && this.maxAge !== Infinity) {
      str += `; Max-Age=${this.maxAge}`;
    }

    if (this.domain) {
      str += `; Domain=${this.domain}`;
    }
    if (this.path) {
      str += `; Path=${this.path}`;
    }

    if (this.secure) {
      str += "; Secure";
    }
    if (this.httpOnly) {
      str += "; HttpOnly";
    }
    if (this.sameSite) {
      str += `; SameSite=${this.sameSite}`;
    }

    return str;
  }

  clone() {
    return new Cookie(JSON.parse(JSON.stringify(this)));
  }
}
