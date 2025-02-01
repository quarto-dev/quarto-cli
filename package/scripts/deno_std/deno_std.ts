// deno-lint-ignore-file

/*

This is the original deno_std.ts definition file, which has imports
that are no longer available in deno's stdlib.

import * as archive from "https://deno.land/std@0.159.0/archive/tar.ts";
import * as async from "https://deno.land/std@0.159.0/async/mod.ts";
import * as bytes from "https://deno.land/std@0.159.0/bytes/mod.ts";
import * as collections from "https://deno.land/std@0.159.0/collections/mod.ts";
import * as crypto from "https://deno.land/std@0.159.0/crypto/mod.ts";
import * as datetime from "https://deno.land/std@0.159.0/datetime/mod.ts";
import * as encoding_ascii85 from "https://deno.land/std@0.159.0/encoding/ascii85.ts";
import * as encoding_base32 from "https://deno.land/std@0.159.0/encoding/base32.ts";
import * as encoding_base64 from "https://deno.land/std@0.159.0/encoding/base64.ts";
import * as encoding_base64url from "https://deno.land/std@0.159.0/encoding/base64url.ts";
import * as encoding_binary from "https://deno.land/std@0.159.0/encoding/binary.ts";
import * as encoding_csv from "https://deno.land/std@0.159.0/encoding/csv.ts";
import * as encoding_hex from "https://deno.land/std@0.159.0/encoding/hex.ts";
import * as encoding_toml from "https://deno.land/std@0.159.0/encoding/toml.ts";
import * as encoding_yaml from "https://deno.land/std@0.159.0/encoding/yaml.ts";
import * as flags from "https://deno.land/std@0.159.0/flags/mod.ts";
import * as fmt_bytes from "https://deno.land/std@0.159.0/fmt/bytes.ts";
import * as fmt_colors from "https://deno.land/std@0.159.0/fmt/colors.ts";
import * as fmt_printf from "https://deno.land/std@0.159.0/fmt/printf.ts";
import * as fs from "https://deno.land/std@0.159.0/fs/mod.ts";
import * as fs_copy from "https://deno.land/std@0.159.0/fs/copy.ts";
import * as hash from "https://deno.land/std@0.159.0/hash/mod.ts";
import * as http from "https://deno.land/std@0.159.0/http/mod.ts";
import * as io from "https://deno.land/std@0.159.0/io/mod.ts";
import * as log from "https://deno.land/std@0.159.0/log/mod.ts";
import * as media_types from "https://deno.land/std@0.159.0/media_types/mod.ts";
import * as path from "https://deno.land/std@0.159.0/path/mod.ts";
import * as permissions from "https://deno.land/std@0.159.0/permissions/mod.ts";
import * as signal from "https://deno.land/std@0.159.0/signal/mod.ts";
import * as streams from "https://deno.land/std@0.159.0/streams/mod.ts";
import * as textproto from "https://deno.land/std@0.159.0/textproto/mod.ts";
import * as uuid from "https://deno.land/std@0.159.0/uuid/mod.ts";
*/

// The import map "run_import_map.json" needs to mirror these imports
// If you edit this file, you need to update the import map as well

import * as tar from "jsr:/@std/archive@0.224.3/tar";
import * as async from "jsr:/@std/async@0.224.2";
import * as bytes from "jsr:/@std/bytes@0.224.0";
import * as collections from "jsr:/@std/collections@0.224.2";
import * as crypto from "jsr:/@std/crypto@0.224.0";
import * as datetime from "jsr:/@std/datetime@0.224.5";
import * as dotenv from "jsr:/@std/dotenv@0.224.2";

// encoding has no mod.ts
import * as ascii85 from "https://deno.land/std@0.224.0/encoding/ascii85.ts";
import * as base32 from "https://deno.land/std@0.224.0/encoding/base32.ts";
import * as base58 from "https://deno.land/std@0.224.0/encoding/base58.ts";
import * as base64 from "https://deno.land/std@0.224.0/encoding/base64.ts";
import * as base64url from "https://deno.land/std@0.224.0/encoding/base64url.ts";
import * as csv from "jsr:/@std/csv@0.224.3";
import * as front_matter from "jsr:/@std/front-matter@0.224.3";
import * as hex from "https://deno.land/std@0.224.0/encoding/hex.ts";
import * as jsonc from "jsr:/@std/jsonc@0.224.3";
import * as toml from "jsr:/@std/toml@0.224.1";
import * as varint from "https://deno.land/std@0.224.0/encoding/varint.ts";
import * as yaml from "jsr:/@std/yaml@0.224.3";

import * as flags from "jsr:/@std/flags@^0.224.0";
import * as fmt_bytes from "https://deno.land/std@0.224.0/fmt/bytes.ts";
import * as fmt_colors from "https://deno.land/std@0.224.0/fmt/colors.ts";
import * as fmt_printf from "https://deno.land/std@0.224.0/fmt/printf.ts";
import * as fs from "jsr:/@std/fs@0.224.0";
import * as http from "jsr:/@std/http@0.224.5";
import * as io from "jsr:/@std/io@0.224.8";
import * as log from "jsr:/@std/log@0.224.7";
import * as mediaTypes from "jsr:/@std/media-types@0.224.1";
import * as path from "jsr:/@std/path@0.224.0";
import * as permissions from "jsr:/@std/permissions@0.224.0";
import * as semver from "jsr:/@std/semver@0.224.3";
import * as streams from "jsr:/@std/streams@0.224.5";
import * as uuid from "jsr:/@std/uuid@0.224.3";

// seems like jsr doesn't export version numbers?!
// import * as version from "jsr:/@std/version@^0.224.0";
import juice from "https://cdn.skypack.dev/juice@10.0.0";

/*

These would be useful imports to add, but they increase the
size of the download cache significantly, so we're skipping
them until they are needed.

import "https://deno.land/std@0.224.0/node/assert/strict.ts";
import "https://deno.land/std@0.224.0/node/dns/promises.ts";
import "https://deno.land/std@0.224.0/node/fs/promises.ts";
import "https://deno.land/std@0.224.0/node/path/mod.ts";
import "https://deno.land/std@0.224.0/node/readline/promises.ts";
import "https://deno.land/std@0.224.0/node/stream/web.ts";
import "https://deno.land/std@0.224.0/node/timers/promises.ts";
import "https://deno.land/std@0.224.0/node/util/types.ts";
import "https://deno.land/std@0.224.0/node/assert.ts";
import "https://deno.land/std@0.224.0/node/assertion_error.ts";
import "https://deno.land/std@0.224.0/node/async_hooks.ts";
import "https://deno.land/std@0.224.0/node/async_hooks.ts";
import "https://deno.land/std@0.224.0/node/buffer.ts";
import "https://deno.land/std@0.224.0/node/child_process.ts";
import "https://deno.land/std@0.224.0/node/cluster.ts";
import "https://deno.land/std@0.224.0/node/console.ts";
import "https://deno.land/std@0.224.0/node/constants.ts";
import "https://deno.land/std@0.224.0/node/crypto.ts";
import "https://deno.land/std@0.224.0/node/dgram.ts";
import "https://deno.land/std@0.224.0/node/diagnostics_channel.ts";
import "https://deno.land/std@0.224.0/node/dns.ts";
import "https://deno.land/std@0.224.0/node/domain.ts";
import "https://deno.land/std@0.224.0/node/events.ts";
import "https://deno.land/std@0.224.0/node/fs.ts";
import "https://deno.land/std@0.224.0/node/http.ts";
import "https://deno.land/std@0.224.0/node/http2.ts";
import "https://deno.land/std@0.224.0/node/https.ts";
import "https://deno.land/std@0.224.0/node/inspector.ts";
import "https://deno.land/std@0.224.0/node/module_all.ts";
import "https://deno.land/std@0.224.0/node/module_esm.ts";
import "https://deno.land/std@0.224.0/node/module.ts";
import "https://deno.land/std@0.224.0/node/net.ts";
import "https://deno.land/std@0.224.0/node/os.ts";
import "https://deno.land/std@0.224.0/node/path.ts";
import "https://deno.land/std@0.224.0/node/perf_hooks.ts";
import "https://deno.land/std@0.224.0/node/process.ts";
import "https://deno.land/std@0.224.0/node/punycode.ts";
import "https://deno.land/std@0.224.0/node/querystring.ts";
import "https://deno.land/std@0.224.0/node/readline.ts";
import "https://deno.land/std@0.224.0/node/repl.ts";
import "https://deno.land/std@0.224.0/node/stream.ts";
import "https://deno.land/std@0.224.0/node/string_decoder.ts";
import "https://deno.land/std@0.224.0/node/sys.ts";
import "https://deno.land/std@0.224.0/node/timers.ts";
import "https://deno.land/std@0.224.0/node/tls.ts";
import "https://deno.land/std@0.224.0/node/tty.ts";
import "https://deno.land/std@0.224.0/node/upstream_modules.ts";
import "https://deno.land/std@0.224.0/node/url.ts";
import "https://deno.land/std@0.224.0/node/util.ts";
import "https://deno.land/std@0.224.0/node/v8.ts";
import "https://deno.land/std@0.224.0/node/vm.ts";
import "https://deno.land/std@0.224.0/node/wasi.ts";
import "https://deno.land/std@0.224.0/node/worker_threads.ts";
import "https://deno.land/std@0.224.0/node/zlib.ts";
*/
