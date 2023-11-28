import { CookieJar } from "./cookie_jar.ts";

// Max 20 redirects is fetch default setting
const MAX_REDIRECT = 20;

export type WrapFetchOptions = {
  /** your own fetch function. defaults to global fetch. This allows wrapping your fetch function multiple times. */
  fetch?: typeof fetch;
  /** The cookie jar to use when wrapping fetch. Will create a new one if not provided. */
  cookieJar?: CookieJar;
};

interface ExtendedRequestInit extends RequestInit {
  redirectCount?: number;
}

const redirectStatus = new Set([301, 302, 303, 307, 308]);

function isRedirect(status: number): boolean {
  return redirectStatus.has(status);
}

// Credit <https://github.com/node-fetch/node-fetch/blob/5e78af3ba7555fa1e466e804b2e51c5b687ac1a2/src/utils/is.js#L68>.
function isDomainOrSubdomain(destination: string, original: string): boolean {
  const orig = new URL(original).hostname;
  const dest = new URL(destination).hostname;

  return orig === dest || orig.endsWith(`.${dest}`);
}

export function wrapFetch(options?: WrapFetchOptions): typeof fetch {
  const { cookieJar = new CookieJar(), fetch = globalThis.fetch } = options ||
    {};

  async function wrappedFetch(
    input: RequestInfo | URL,
    init?: ExtendedRequestInit,
  ): Promise<Response> {
    // let fetch handle the error
    if (!input) {
      return await fetch(input);
    }
    const cookieString = cookieJar.getCookieString(input);

    let originalRedirectOption: ExtendedRequestInit["redirect"];
    const originalRequestUrl: string = (input as Request).url ||
      input.toString();

    if (input instanceof Request) {
      originalRedirectOption = input.redirect;
    }
    if (init?.redirect) {
      originalRedirectOption = init?.redirect;
    }

    const interceptedInit: ExtendedRequestInit = {
      ...init,
      redirect: "manual",
    };

    const reqHeaders = new Headers((input as Request).headers || {});

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        reqHeaders.set(key, value);
      });
    }

    reqHeaders.set("cookie", cookieString);
    reqHeaders.delete("cookie2"); // Remove cookie2 if it exists, It's deprecated

    interceptedInit.headers = reqHeaders;

    const response = await fetch(input, interceptedInit as RequestInit);

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        cookieJar.setCookie(value, response.url);
      }
    });

    const redirectCount = interceptedInit.redirectCount ?? 0;
    const redirectUrl = response.headers.has("location")
      ? new URL(
        response.headers.get("location")!.toString(),
        originalRequestUrl,
      ).toString()
      : undefined;

    // Do this check here to allow tail recursion of redirect.
    if (redirectCount > 0) {
      Object.defineProperty(response, "redirected", { value: true });
    }

    if (
      // Return if response is not redirect
      !isRedirect(response.status) ||
      //  or location is not set
      !redirectUrl ||
      // or if it's the first request and request.redirect is set to 'manual'
      (redirectCount === 0 && originalRedirectOption === "manual")
    ) {
      return response;
    }

    if (originalRedirectOption === "error") {
      await response.body?.cancel();
      throw new TypeError(
        `URI requested responded with a redirect and redirect mode is set to error: ${response.url}`,
      );
    }

    // If maximum redirects are reached throw error
    if (redirectCount >= MAX_REDIRECT) {
      await response.body?.cancel();
      throw new TypeError(
        `Reached maximum redirect of ${MAX_REDIRECT} for URL: ${response.url}`,
      );
    }

    await response.body?.cancel();

    interceptedInit.redirectCount = redirectCount + 1;

    const filteredHeaders = new Headers(interceptedInit.headers);

    // Do not forward sensitive headers to third-party domains.
    if (!isDomainOrSubdomain(originalRequestUrl, redirectUrl)) {
      for (const name of ["authorization", "www-authenticate"]) { // cookie headers are handled differently
        filteredHeaders.delete(name);
      }
    }

    if (interceptedInit.method === "POST") {
      filteredHeaders.delete("content-length");
      interceptedInit.method = "GET";
      interceptedInit.body = undefined;
    }
    interceptedInit.headers = filteredHeaders;

    return await wrappedFetch(redirectUrl, interceptedInit as RequestInit);
  }

  return wrappedFetch;
}
