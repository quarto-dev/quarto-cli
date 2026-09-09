# Embedded Viewer Verification (iframe / postMessage)

Use this harness for link classification, viewer `postMessage` events, and other code in
`src/webui/quarto-preview/src/frame/` that runs only in an embedded viewer (RStudio Viewer,
VS Code Simple Browser, or Posit Workbench). A top-level browser preview does not exercise it.

## Why a harness is required

- `handleExternalLinks` (and similar embedded-viewer logic) early-returns when
  `window.self === window.top`. It only runs inside an iframe.
- The client script injects embedded-viewer options only if the server's *first* HTML request
  includes `quartoPreviewReqId=`, `capabilities=`, or `vscodeBrowserReqId=` in its URL or
  referrer (`viewerIFrameURL` in `src/core/http-devserver.ts`). `injectClientInitialized`
  memoizes the result for the process lifetime; later requests do not trigger detection again.

## The host page pattern

Use a parent page that collects the viewer script's `postMessage` events and embeds the preview
URL with a marker query string:

```html
<!doctype html>
<html><body>
<pre id="log">[]</pre>
<iframe id="f" src="/?quartoPreviewReqId=1" width="1000" height="700"></iframe>
<script>
  window.__messages = [];
  addEventListener("message", (e) => {
    window.__messages.push(e.data);
    document.getElementById("log").textContent = JSON.stringify(window.__messages);
  });
</script>
</body></html>
```

Read results with `agent-browser eval`, e.g.:

```js
(() => { document.getElementById('f').contentDocument.getElementById('lnk-hash').click(); return 'clicked'; })()
(() => JSON.stringify(window.__messages))()
```

### First-request constraint

The iframe's marked request must be the first request the server injects into:

- Do not use a rendered `.qmd` parent. Its unmarked load reaches the render/inject pipeline first
  and disables option injection for later requests.
- Send no unmarked request of any kind before the iframe's, with one exception: a path that is
  already on disk as a declared static resource. A 404 is not safe either — the `on404` handler
  calls `injectClient`, so a single unmarked request to a missing path consumes the detection.
- For readiness, wait for the `Browse at` / `Listening on` lines in the preview output (both go to
  stderr) rather than polling an HTTP path. Polling is what produces the unmarked request above,
  and before the first render finishes even the parent page's own path still 404s.
- Start preview with `--no-browser`, otherwise the auto-opened browser requests `/` unmarked.
- Use a genuinely static resource for the parent page: declare it under `project.resources:` in
  `_quarto.yml`. Preview copies project resources to the output directory itself, so no separate
  `quarto render` is needed. Such a file has no corresponding input file, and the server injects the
  client script only into output files that map back to an input, so serving the parent page does
  not consume the detection.
- If `QuartoPreview.getOptions()` returns `origin: ""` and `search: ""`, restart the preview
  process. The client cannot reset the memoized state.

## The proxy pattern (simulating Workbench / RStudio Server)

To make the browser origin differ from the origin inferred by the preview server, run a temporary
reverse proxy on a second port. `127.0.0.1` and `localhost` resolve to the same host but are
distinct browser origins, so they reproduce this mismatch on one machine:

```typescript
// Browser origin is http://127.0.0.1:4445; deleting the Host header makes the preview
// server infer its own backend origin (http://localhost:4444) instead of the proxy's.
const kBackend = "http://localhost:4444";

Deno.serve({ port: 4445, hostname: "127.0.0.1" }, async (req) => {
  const url = new URL(req.url);
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("accept-encoding");
  const res = await fetch(kBackend + url.pathname + url.search, {
    method: req.method, headers, body: req.body, redirect: "manual",
  });
  // fetch() decompresses the body but preserves the original encoding and length headers.
  // Remove them or the client truncates the decompressed body, potentially dropping the
  // injected client script near the end of the page.
  const resHeaders = new Headers(res.headers);
  resHeaders.delete("content-encoding");
  resHeaders.delete("content-length");
  return new Response(res.body, { status: res.status, headers: resHeaders });
});
```

Serve the host page from a path the proxy handles locally (for example, `/__host`) so it does
not reach the backend before the iframe.

## Required precondition

Before clicking anything, confirm the intended origin relationship and injected options. Because
this snippet reads the iframe, the parent and iframe must share a browser origin (see Known limits):

```js
(() => {
  const w = document.getElementById('f').contentWindow;
  return JSON.stringify({
    parent: location.origin,
    iframe: w.location.origin,
    injected: w.QuartoPreview && w.QuartoPreview.getOptions(),
  });
})()
```

In the proxy case, `injected.origin` must differ from `location.origin`; in the direct localhost
control case, they must match. In both cases, `injected.search` must contain the marker query
string. Do not use subsequent click results if `injected` is `undefined` or `null`, either field
is empty, or the origins do not have the expected relationship.

## Known limits

- Websocket upgrades (live reload) are not proxied by the script above; a failed
  `new WebSocket(...)` does not throw synchronously, so it doesn't affect the code under test.
- A cross-origin parent cannot read the iframe's DOM. `contentDocument` returns `null` (no
  throw). Reading a property such as `contentWindow.QuartoPreview` or `contentWindow.location.origin`
  throws a `SecurityError`; on the cross-origin `Location` object specifically, only setting
  `href` and calling `replace()` are permitted. `postMessage` still works across origins, which
  is why it's the escape hatch: keep both frames on one browser origin, as in the proxy pattern
  above, or add iframe-side code that sends its location and injected options to the parent with
  `postMessage`.
