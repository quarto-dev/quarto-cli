import { CookieJar } from "./cookie_jar.ts";

export type WrapFetchOptions = {
  /** your own fetch function. defaults to global fetch. This allows wrapping your fetch function multiple times. */
  fetch?: typeof fetch;
  /** The cookie jar to use when wrapping fetch. Will create a new one if not provided. */
  cookieJar?: CookieJar;
};

type FetchParameters = Parameters<typeof fetch>;

export function wrapFetch(options?: WrapFetchOptions): typeof fetch {
  const { cookieJar = new CookieJar(), fetch = globalThis.fetch } = options ||
    {};

  async function wrappedFetch(
    input: FetchParameters[0],
    init?: FetchParameters[1],
  ) {
    // let fetch handle the error
    if (!input) {
      return await fetch(input);
    }
    const cookieString = cookieJar.getCookieString(input);

    let interceptedInit: RequestInit;
    if (init) {
      interceptedInit = init;
    } else if (input instanceof Request) {
      interceptedInit = input;
    } else {
      interceptedInit = {};
    }

    if (!(interceptedInit.headers instanceof Headers)) {
      interceptedInit.headers = new Headers(interceptedInit.headers || {});
    }
    interceptedInit.headers.set("cookie", cookieString);

    const response = await fetch(input, interceptedInit);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        cookieJar.setCookie(value, input);
      }
    });
    return response;
  }

  return wrappedFetch;
}
