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

import * as tar from "https://deno.land/std@0.185.0/archive/tar.ts";
import * as async from "https://deno.land/std@0.185.0/async/mod.ts";
import * as bytes from "https://deno.land/std@0.185.0/bytes/mod.ts";
import * as collections from "https://deno.land/std@0.185.0/collections/mod.ts";
import * as crypto from "https://deno.land/std@0.185.0/crypto/mod.ts";
import * as datetime from "https://deno.land/std@0.185.0/datetime/mod.ts";
import * as dotenv from "https://deno.land/std@0.185.0/dotenv/mod.ts";

// encoding has no mod.ts
import * as ascii85 from "https://deno.land/std@0.185.0/encoding/ascii85.ts";
import * as base32 from "https://deno.land/std@0.185.0/encoding/base32.ts";
import * as base58 from "https://deno.land/std@0.185.0/encoding/base58.ts";
import * as base64 from "https://deno.land/std@0.185.0/encoding/base64.ts";
import * as base64url from "https://deno.land/std@0.185.0/encoding/base64url.ts";
import * as binary from "https://deno.land/std@0.185.0/encoding/binary.ts";
import * as csv from "https://deno.land/std@0.185.0/csv/mod.ts";
import * as front_matter from "https://deno.land/std@0.185.0/front_matter/mod.ts";
import * as hex from "https://deno.land/std@0.185.0/encoding/hex.ts";
import * as jsonc from "https://deno.land/std@0.185.0/jsonc/mod.ts";
import * as toml from "https://deno.land/std@0.185.0/toml/mod.ts";
import * as varint from "https://deno.land/std@0.185.0/encoding/varint.ts";
import * as yaml from "https://deno.land/std@0.185.0/yaml/mod.ts";

import * as flags from "https://deno.land/std@0.185.0/flags/mod.ts";
import * as fmt_bytes from "https://deno.land/std@0.185.0/fmt/bytes.ts";
import * as fmt_colors from "https://deno.land/std@0.185.0/fmt/colors.ts";
import * as fmt_printf from "https://deno.land/std@0.185.0/fmt/printf.ts";
import * as fs from "https://deno.land/std@0.185.0/fs/mod.ts";
import * as http from "https://deno.land/std@0.185.0/http/mod.ts";
import * as io from "https://deno.land/std@0.185.0/io/mod.ts";
import * as log from "https://deno.land/std@0.185.0/log/mod.ts";
import * as mediaTypes from "https://deno.land/std@0.185.0/media_types/mod.ts";
import * as path from "https://deno.land/std@0.185.0/path/mod.ts";
import * as permissions from "https://deno.land/std@0.185.0/permissions/mod.ts";
import * as semver from "https://deno.land/std@0.185.0/semver/mod.ts";
import * as signal from "https://deno.land/std@0.185.0/signal/mod.ts";
import * as streams from "https://deno.land/std@0.185.0/streams/mod.ts";
import * as uuid from "https://deno.land/std@0.185.0/uuid/mod.ts";

/*

These would be useful imports to add, but they increase the
size of the download cache significantly, so we're skipping
them until they are needed.

import "https://deno.land/std@0.185.0/node/assert/strict.ts";
import "https://deno.land/std@0.185.0/node/dns/promises.ts";
import "https://deno.land/std@0.185.0/node/fs/promises.ts";
import "https://deno.land/std@0.185.0/node/path/mod.ts";
import "https://deno.land/std@0.185.0/node/readline/promises.ts";
import "https://deno.land/std@0.185.0/node/stream/web.ts";
import "https://deno.land/std@0.185.0/node/timers/promises.ts";
import "https://deno.land/std@0.185.0/node/util/types.ts";
import "https://deno.land/std@0.185.0/node/assert.ts";
import "https://deno.land/std@0.185.0/node/assertion_error.ts";
import "https://deno.land/std@0.185.0/node/async_hooks.ts";
import "https://deno.land/std@0.185.0/node/async_hooks.ts";
import "https://deno.land/std@0.185.0/node/buffer.ts";
import "https://deno.land/std@0.185.0/node/child_process.ts";
import "https://deno.land/std@0.185.0/node/cluster.ts";
import "https://deno.land/std@0.185.0/node/console.ts";
import "https://deno.land/std@0.185.0/node/constants.ts";
import "https://deno.land/std@0.185.0/node/crypto.ts";
import "https://deno.land/std@0.185.0/node/dgram.ts";
import "https://deno.land/std@0.185.0/node/diagnostics_channel.ts";
import "https://deno.land/std@0.185.0/node/dns.ts";
import "https://deno.land/std@0.185.0/node/domain.ts";
import "https://deno.land/std@0.185.0/node/events.ts";
import "https://deno.land/std@0.185.0/node/fs.ts";
import "https://deno.land/std@0.185.0/node/http.ts";
import "https://deno.land/std@0.185.0/node/http2.ts";
import "https://deno.land/std@0.185.0/node/https.ts";
import "https://deno.land/std@0.185.0/node/inspector.ts";
import "https://deno.land/std@0.185.0/node/module_all.ts";
import "https://deno.land/std@0.185.0/node/module_esm.ts";
import "https://deno.land/std@0.185.0/node/module.ts";
import "https://deno.land/std@0.185.0/node/net.ts";
import "https://deno.land/std@0.185.0/node/os.ts";
import "https://deno.land/std@0.185.0/node/path.ts";
import "https://deno.land/std@0.185.0/node/perf_hooks.ts";
import "https://deno.land/std@0.185.0/node/process.ts";
import "https://deno.land/std@0.185.0/node/punycode.ts";
import "https://deno.land/std@0.185.0/node/querystring.ts";
import "https://deno.land/std@0.185.0/node/readline.ts";
import "https://deno.land/std@0.185.0/node/repl.ts";
import "https://deno.land/std@0.185.0/node/stream.ts";
import "https://deno.land/std@0.185.0/node/string_decoder.ts";
import "https://deno.land/std@0.185.0/node/sys.ts";
import "https://deno.land/std@0.185.0/node/timers.ts";
import "https://deno.land/std@0.185.0/node/tls.ts";
import "https://deno.land/std@0.185.0/node/tty.ts";
import "https://deno.land/std@0.185.0/node/upstream_modules.ts";
import "https://deno.land/std@0.185.0/node/url.ts";
import "https://deno.land/std@0.185.0/node/util.ts";
import "https://deno.land/std@0.185.0/node/v8.ts";
import "https://deno.land/std@0.185.0/node/vm.ts";
import "https://deno.land/std@0.185.0/node/wasi.ts";
import "https://deno.land/std@0.185.0/node/worker_threads.ts";
import "https://deno.land/std@0.185.0/node/zlib.ts";
*/
