// @quarto/quarto-ojs-runtime v0.0.12 Copyright 2022 undefined
var EOL = {},
    EOF = {},
    QUOTE = 34,
    NEWLINE = 10,
    RETURN = 13;

function objectConverter(columns) {
  return new Function("d", "return {" + columns.map(function(name, i) {
    return JSON.stringify(name) + ": d[" + i + "] || \"\"";
  }).join(",") + "}");
}

function customConverter(columns, f) {
  var object = objectConverter(columns);
  return function(row, i) {
    return f(object(row), i, columns);
  };
}

// Compute unique columns in order of discovery.
function inferColumns(rows) {
  var columnSet = Object.create(null),
      columns = [];

  rows.forEach(function(row) {
    for (var column in row) {
      if (!(column in columnSet)) {
        columns.push(columnSet[column] = column);
      }
    }
  });

  return columns;
}

function pad$1(value, width) {
  var s = value + "", length = s.length;
  return length < width ? new Array(width - length + 1).join(0) + s : s;
}

function formatYear$1(year) {
  return year < 0 ? "-" + pad$1(-year, 6)
    : year > 9999 ? "+" + pad$1(year, 6)
    : pad$1(year, 4);
}

function formatDate$2(date) {
  var hours = date.getUTCHours(),
      minutes = date.getUTCMinutes(),
      seconds = date.getUTCSeconds(),
      milliseconds = date.getUTCMilliseconds();
  return isNaN(date) ? "Invalid Date"
      : formatYear$1(date.getUTCFullYear()) + "-" + pad$1(date.getUTCMonth() + 1, 2) + "-" + pad$1(date.getUTCDate(), 2)
      + (milliseconds ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + ":" + pad$1(seconds, 2) + "." + pad$1(milliseconds, 3) + "Z"
      : seconds ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + ":" + pad$1(seconds, 2) + "Z"
      : minutes || hours ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + "Z"
      : "");
}

function dsv$1(delimiter) {
  var reFormat = new RegExp("[\"" + delimiter + "\n\r]"),
      DELIMITER = delimiter.charCodeAt(0);

  function parse(text, f) {
    var convert, columns, rows = parseRows(text, function(row, i) {
      if (convert) return convert(row, i - 1);
      columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
    });
    rows.columns = columns || [];
    return rows;
  }

  function parseRows(text, f) {
    var rows = [], // output rows
        N = text.length,
        I = 0, // current character index
        n = 0, // current line number
        t, // current token
        eof = N <= 0, // current token followed by EOF?
        eol = false; // current token followed by EOL?

    // Strip the trailing newline.
    if (text.charCodeAt(N - 1) === NEWLINE) --N;
    if (text.charCodeAt(N - 1) === RETURN) --N;

    function token() {
      if (eof) return EOF;
      if (eol) return eol = false, EOL;

      // Unescape quotes.
      var i, j = I, c;
      if (text.charCodeAt(j) === QUOTE) {
        while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
        if ((i = I) >= N) eof = true;
        else if ((c = text.charCodeAt(I++)) === NEWLINE) eol = true;
        else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
        return text.slice(j + 1, i - 1).replace(/""/g, "\"");
      }

      // Find next delimiter or newline.
      while (I < N) {
        if ((c = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
        else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
        else if (c !== DELIMITER) continue;
        return text.slice(j, i);
      }

      // Return last token before EOF.
      return eof = true, text.slice(j, N);
    }

    while ((t = token()) !== EOF) {
      var row = [];
      while (t !== EOL && t !== EOF) row.push(t), t = token();
      if (f && (row = f(row, n++)) == null) continue;
      rows.push(row);
    }

    return rows;
  }

  function preformatBody(rows, columns) {
    return rows.map(function(row) {
      return columns.map(function(column) {
        return formatValue(row[column]);
      }).join(delimiter);
    });
  }

  function format(rows, columns) {
    if (columns == null) columns = inferColumns(rows);
    return [columns.map(formatValue).join(delimiter)].concat(preformatBody(rows, columns)).join("\n");
  }

  function formatBody(rows, columns) {
    if (columns == null) columns = inferColumns(rows);
    return preformatBody(rows, columns).join("\n");
  }

  function formatRows(rows) {
    return rows.map(formatRow).join("\n");
  }

  function formatRow(row) {
    return row.map(formatValue).join(delimiter);
  }

  function formatValue(value) {
    return value == null ? ""
        : value instanceof Date ? formatDate$2(value)
        : reFormat.test(value += "") ? "\"" + value.replace(/"/g, "\"\"") + "\""
        : value;
  }

  return {
    parse: parse,
    parseRows: parseRows,
    format: format,
    formatBody: formatBody,
    formatRows: formatRows,
    formatRow: formatRow,
    formatValue: formatValue
  };
}

var csv = dsv$1(",");

var csvParse = csv.parse;
var csvParseRows = csv.parseRows;

var tsv = dsv$1("\t");

var tsvParse = tsv.parse;
var tsvParseRows = tsv.parseRows;

function autoType(object) {
  for (var key in object) {
    var value = object[key].trim(), number, m;
    if (!value) value = null;
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value === "NaN") value = NaN;
    else if (!isNaN(number = +value)) value = number;
    else if (m = value.match(/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/)) {
      if (fixtz && !!m[4] && !m[7]) value = value.replace(/-/g, "/").replace(/T/, " ");
      value = new Date(value);
    }
    else continue;
    object[key] = value;
  }
  return object;
}

// https://github.com/d3/d3-dsv/issues/45
const fixtz = new Date("2019-01-01T00:00").getHours() || new Date("2019-07-01T00:00").getHours();

const metas = new Map;
const queue$1 = [];
const map$2 = queue$1.map;
const some = queue$1.some;
const hasOwnProperty$2 = queue$1.hasOwnProperty;
const identifierRe = /^((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(?:\/(.*))?$/;
const versionRe = /^\d+\.\d+\.\d+(-[\w-.+]+)?$/;
const extensionRe = /(?:\.[^/]*|\/)$/;

class RequireError extends Error {
  constructor(message) {
    super(message);
  }
}

RequireError.prototype.name = RequireError.name;

function parseIdentifier(identifier) {
  const match = identifierRe.exec(identifier);
  return match && {
    name: match[1],
    version: match[2],
    path: match[3]
  };
}

function resolveFrom(origin = "https://cdn.jsdelivr.net/npm/", mains = ["unpkg", "jsdelivr", "browser", "main"]) {
  if (!/\/$/.test(origin)) throw new Error("origin lacks trailing slash");

  function main(meta) {
    for (const key of mains) {
      let value = meta[key];
      if (typeof value === "string") {
        if (value.startsWith("./")) value = value.slice(2);
        return extensionRe.test(value) ? value : `${value}.js`;
      }
    }
  }

  function resolveMeta(target) {
    const url = `${origin}${target.name}${target.version ? `@${target.version}` : ""}/package.json`;
    let meta = metas.get(url);
    if (!meta) metas.set(url, meta = fetch(url).then(response => {
      if (!response.ok) throw new RequireError("unable to load package.json");
      if (response.redirected && !metas.has(response.url)) metas.set(response.url, meta);
      return response.json();
    }));
    return meta;
  }

  return async function resolve(name, base) {
    if (name.startsWith(origin)) name = name.substring(origin.length);
    if (/^(\w+:)|\/\//i.test(name)) return name;
    if (/^[.]{0,2}\//i.test(name)) return new URL(name, base == null ? location : base).href;
    if (!name.length || /^[\s._]/.test(name) || /\s$/.test(name)) throw new RequireError("illegal name");
    const target = parseIdentifier(name);
    if (!target) return `${origin}${name}`;
    if (!target.version && base != null && base.startsWith(origin)) {
      const meta = await resolveMeta(parseIdentifier(base.substring(origin.length)));
      target.version = meta.dependencies && meta.dependencies[target.name] || meta.peerDependencies && meta.peerDependencies[target.name];
    }
    if (target.path && !extensionRe.test(target.path)) target.path += ".js";
    if (target.path && target.version && versionRe.test(target.version)) return `${origin}${target.name}@${target.version}/${target.path}`;
    const meta = await resolveMeta(target);
    return `${origin}${meta.name}@${meta.version}/${target.path || main(meta) || "index.js"}`;
  };
}

var require = requireFrom(resolveFrom());
let requestsInFlight = 0;
let prevDefine = undefined;

function requireFrom(resolver) {
  const cache = new Map;
  const requireBase = requireRelative(null);
    
  function requireAbsolute(url) {
    if (typeof url !== "string") return url;
    let module = cache.get(url);
    if (!module) cache.set(url, module = new Promise((resolve, reject) => {

      const script = document.createElement("script");
      script.onload = () => {
        try { resolve(queue$1.pop()(requireRelative(url))); }
        catch (error) { reject(new RequireError("invalid module")); }
        script.remove();
        requestsInFlight--;
        if (requestsInFlight === 0) {
          window.define = prevDefine;
        }
      };
      script.onerror = () => {
        reject(new RequireError("unable to load module"));
        script.remove();
        requestsInFlight--;
        if (requestsInFlight === 0) {
          window.define = prevDefine;
        }
      };
      script.async = true;
      script.src = url;
      if (requestsInFlight === 0) {
        prevDefine = window.define;
        window.define = define;
      }
      requestsInFlight++;
      document.head.appendChild(script);
    }));
    return module;
  }

  function requireRelative(base) {
    return name => Promise.resolve(resolver(name, base)).then(requireAbsolute);
  }

  function requireAlias(aliases) {
    return requireFrom((name, base) => {
      if (name in aliases) {
        name = aliases[name], base = null;
        if (typeof name !== "string") return name;
      }
      return resolver(name, base);
    });
  }

  function require(name) {
    return arguments.length > 1
        ? Promise.all(map$2.call(arguments, requireBase)).then(merge)
        : requireBase(name);
  }

  require.alias = requireAlias;
  require.resolve = resolver;

  return require;
}

function merge(modules) {
  const o = {};
  for (const m of modules) {
    for (const k in m) {
      if (hasOwnProperty$2.call(m, k)) {
        if (m[k] == null) Object.defineProperty(o, k, {get: getter(m, k)});
        else o[k] = m[k];
      }
    }
  }
  return o;
}

function getter(object, name) {
  return () => object[name];
}

function isbuiltin(name) {
  name = name + "";
  return name === "exports" || name === "module";
}

function define(name, dependencies, factory) {
  const n = arguments.length;
  if (n < 2) factory = name, dependencies = [];
  else if (n < 3) factory = dependencies, dependencies = typeof name === "string" ? [] : name;
  queue$1.push(some.call(dependencies, isbuiltin) ? require => {
    const exports = {};
    const module = {exports};
    return Promise.all(map$2.call(dependencies, name => {
      name = name + "";
      return name === "exports" ? exports : name === "module" ? module : require(name);
    })).then(dependencies => {
      factory.apply(null, dependencies);
      return module.exports;
    });
  } : require => {
    return Promise.all(map$2.call(dependencies, require)).then(dependencies => {
      return typeof factory === "function" ? factory.apply(null, dependencies) : factory;
    });
  });
}

define.amd = {};

let requireDefault = require;

function setDefaultRequire(require) {
  requireDefault = require;
}

function requirer(resolve) {
  return resolve == null ? requireDefault : requireFrom(resolve);
}

async function remote_fetch(file) {
  const response = await fetch(await file.url());
  if (!response.ok) throw new Error(`Unable to load file: ${file.name}`);
  return response;
}

async function dsv(file, delimiter, {array = false, typed = false} = {}) {
  const text = await file.text();
  return (delimiter === "\t"
      ? (array ? tsvParseRows : tsvParse)
      : (array ? csvParseRows : csvParse))(text, typed && autoType);
}

class AbstractFile {
  constructor(name, mimeType) {
    Object.defineProperty(this, "name", {value: name, enumerable: true});
    if (mimeType !== undefined) Object.defineProperty(this, "mimeType", {value: mimeType + "", enumerable: true});
  }
  async blob() {
    return (await remote_fetch(this)).blob();
  }
  async arrayBuffer() {
    return (await remote_fetch(this)).arrayBuffer();
  }
  async text() {
    return (await remote_fetch(this)).text();
  }
  async json() {
    return (await remote_fetch(this)).json();
  }
  async stream() {
    return (await remote_fetch(this)).body;
  }
  async csv(options) {
    return dsv(this, ",", options);
  }
  async tsv(options) {
    return dsv(this, "\t", options);
  }
  async image(props) {
    const url = await this.url();
    return new Promise((resolve, reject) => {
      const i = new Image();
      if (new URL(url, document.baseURI).origin !== new URL(location).origin) {
        i.crossOrigin = "anonymous";
      }
      Object.assign(i, props);
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`Unable to load file: ${this.name}`));
      i.src = url;
    });
  }
  async arrow() {
    const [Arrow, response] = await Promise.all([requireDefault(arrow.resolve()), remote_fetch(this)]);
    return Arrow.Table.from(response);
  }
  async sqlite() {
    return SQLiteDatabaseClient.open(remote_fetch(this));
  }
  async zip() {
    const [JSZip, buffer] = await Promise.all([requireDefault(jszip.resolve()), this.arrayBuffer()]);
    return new ZipArchive(await JSZip.loadAsync(buffer));
  }
  async xml(mimeType = "application/xml") {
    return (new DOMParser).parseFromString(await this.text(), mimeType);
  }
  async html() {
    return this.xml("text/html");
  }
  async xlsx() {
    const [ExcelJS, buffer] = await Promise.all([requireDefault(exceljs.resolve()), this.arrayBuffer()]);
    return new Workbook(await new ExcelJS.Workbook().xlsx.load(buffer));
  }
}

class FileAttachment extends AbstractFile {
  constructor(url, name, mimeType) {
    super(name, mimeType);
    Object.defineProperty(this, "_url", {value: url});
  }
  async url() {
    return (await this._url) + "";
  }
}

function NoFileAttachments(name) {
  throw new Error(`File not found: ${name}`);
}

function FileAttachments(resolve) {
  return Object.assign(
    name => {
      const result = resolve(name += "");
      if (result == null) throw new Error(`File not found: ${name}`);
      if (typeof result === "object" && "url" in result) {
        const {url, mimeType} = result;
        return new FileAttachment(url, name, mimeType);
      }
      return new FileAttachment(result, name);
    },
    {prototype: FileAttachment.prototype} // instanceof
  );
}

class ZipArchive {
  constructor(archive) {
    Object.defineProperty(this, "_", {value: archive});
    this.filenames = Object.keys(archive.files).filter(name => !archive.files[name].dir);
  }
  file(path) {
    const object = this._.file(path += "");
    if (!object || object.dir) throw new Error(`file not found: ${path}`);
    return new ZipArchiveEntry(object);
  }
}

class ZipArchiveEntry extends AbstractFile {
  constructor(object) {
    super(object.name);
    Object.defineProperty(this, "_", {value: object});
    Object.defineProperty(this, "_url", {writable: true});
  }
  async url() {
    return this._url || (this._url = this.blob().then(URL.createObjectURL));
  }
  async blob() {
    return this._.async("blob");
  }
  async arrayBuffer() {
    return this._.async("arraybuffer");
  }
  async text() {
    return this._.async("text");
  }
  async json() {
    return JSON.parse(await this.text());
  }
}

function canvas(width, height) {
  var canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(width, height, dpi) {
  if (dpi == null) dpi = devicePixelRatio;
  var canvas = document.createElement("canvas");
  canvas.width = width * dpi;
  canvas.height = height * dpi;
  canvas.style.width = width + "px";
  var context = canvas.getContext("2d");
  context.scale(dpi, dpi);
  return context;
}

function download(value, name = "untitled", label = "Save") {
  const a = document.createElement("a");
  const b = a.appendChild(document.createElement("button"));
  b.textContent = label;
  a.download = name;

  async function reset() {
    await new Promise(requestAnimationFrame);
    URL.revokeObjectURL(a.href);
    a.removeAttribute("href");
    b.textContent = label;
    b.disabled = false;
  }

  a.onclick = async event => {
    b.disabled = true;
    if (a.href) return reset(); // Already saved.
    b.textContent = "Saving…";
    try {
      const object = await (typeof value === "function" ? value() : value);
      b.textContent = "Download";
      a.href = URL.createObjectURL(object); // eslint-disable-line require-atomic-updates
    } catch (ignore) {
      b.textContent = label;
    }
    if (event.eventPhase) return reset(); // Already downloaded.
    b.disabled = false;
  };

  return a;
}

var namespaces = {
  math: "http://www.w3.org/1998/Math/MathML",
  svg: "http://www.w3.org/2000/svg",
  xhtml: "http://www.w3.org/1999/xhtml",
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

function element$1(name, attributes) {
  var prefix = name += "", i = prefix.indexOf(":"), value;
  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
  var element = namespaces.hasOwnProperty(prefix) // eslint-disable-line no-prototype-builtins
      ? document.createElementNS(namespaces[prefix], name)
      : document.createElement(name);
  if (attributes) for (var key in attributes) {
    prefix = key, i = prefix.indexOf(":"), value = attributes[key];
    if (i >= 0 && (prefix = key.slice(0, i)) !== "xmlns") key = key.slice(i + 1);
    if (namespaces.hasOwnProperty(prefix)) element.setAttributeNS(namespaces[prefix], key, value); // eslint-disable-line no-prototype-builtins
    else element.setAttribute(key, value);
  }
  return element;
}

function input$1(type) {
  var input = document.createElement("input");
  if (type != null) input.type = type;
  return input;
}

function range$1(min, max, step) {
  if (arguments.length === 1) max = min, min = null;
  var input = document.createElement("input");
  input.min = min = min == null ? 0 : +min;
  input.max = max = max == null ? 1 : +max;
  input.step = step == null ? "any" : step = +step;
  input.type = "range";
  return input;
}

function select(values) {
  var select = document.createElement("select");
  Array.prototype.forEach.call(values, function(value) {
    var option = document.createElement("option");
    option.value = option.textContent = value;
    select.appendChild(option);
  });
  return select;
}

function svg$1(width, height) {
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", [0, 0, width, height]);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  return svg;
}

function text$2(value) {
  return document.createTextNode(value);
}

var count$1 = 0;

function uid(name) {
  return new Id("O-" + (name == null ? "" : name + "-") + ++count$1);
}

function Id(id) {
  this.id = id;
  this.href = new URL(`#${id}`, location) + "";
}

Id.prototype.toString = function() {
  return "url(" + this.href + ")";
};

var DOM = {
  canvas: canvas,
  context2d: context2d,
  download: download,
  element: element$1,
  input: input$1,
  range: range$1,
  select: select,
  svg: svg$1,
  text: text$2,
  uid: uid
};

function buffer(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader;
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function text$1(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader;
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function url(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader;
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

var Files = {
  buffer: buffer,
  text: text$1,
  url: url
};

function that() {
  return this;
}

function disposable(value, dispose) {
  let done = false;
  if (typeof dispose !== "function") {
    throw new Error("dispose is not a function");
  }
  return {
    [Symbol.iterator]: that,
    next: () => done ? {done: true} : (done = true, {done: false, value}),
    return: () => (done = true, dispose(value), {done: true}),
    throw: () => ({done: done = true})
  };
}

function* filter(iterator, test) {
  var result, index = -1;
  while (!(result = iterator.next()).done) {
    if (test(result.value, ++index)) {
      yield result.value;
    }
  }
}

function observe(initialize) {
  let stale = false;
  let value;
  let resolve;
  const dispose = initialize(change);

  if (dispose != null && typeof dispose !== "function") {
    throw new Error(typeof dispose.then === "function"
        ? "async initializers are not supported"
        : "initializer returned something, but not a dispose function");
  }

  function change(x) {
    if (resolve) resolve(x), resolve = null;
    else stale = true;
    return value = x;
  }

  function next() {
    return {done: false, value: stale
        ? (stale = false, Promise.resolve(value))
        : new Promise(_ => (resolve = _))};
  }

  return {
    [Symbol.iterator]: that,
    throw: () => ({done: true}),
    return: () => (dispose != null && dispose(), {done: true}),
    next
  };
}

function input(input) {
  return observe(function(change) {
    var event = eventof(input), value = valueof$1(input);
    function inputted() { change(valueof$1(input)); }
    input.addEventListener(event, inputted);
    if (value !== undefined) change(value);
    return function() { input.removeEventListener(event, inputted); };
  });
}

function valueof$1(input) {
  switch (input.type) {
    case "range":
    case "number": return input.valueAsNumber;
    case "date": return input.valueAsDate;
    case "checkbox": return input.checked;
    case "file": return input.multiple ? input.files : input.files[0];
    case "select-multiple": return Array.from(input.selectedOptions, o => o.value);
    default: return input.value;
  }
}

function eventof(input) {
  switch (input.type) {
    case "button":
    case "submit":
    case "checkbox": return "click";
    case "file": return "change";
    default: return "input";
  }
}

function* map$1(iterator, transform) {
  var result, index = -1;
  while (!(result = iterator.next()).done) {
    yield transform(result.value, ++index);
  }
}

function queue(initialize) {
  let resolve;
  const queue = [];
  const dispose = initialize(push);

  if (dispose != null && typeof dispose !== "function") {
    throw new Error(typeof dispose.then === "function"
        ? "async initializers are not supported"
        : "initializer returned something, but not a dispose function");
  }

  function push(x) {
    queue.push(x);
    if (resolve) resolve(queue.shift()), resolve = null;
    return x;
  }

  function next() {
    return {done: false, value: queue.length
        ? Promise.resolve(queue.shift())
        : new Promise(_ => (resolve = _))};
  }

  return {
    [Symbol.iterator]: that,
    throw: () => ({done: true}),
    return: () => (dispose != null && dispose(), {done: true}),
    next
  };
}

function* range(start, stop, step) {
  start = +start;
  stop = +stop;
  step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;
  var i = -1, n = Math.max(0, Math.ceil((stop - start) / step)) | 0;
  while (++i < n) {
    yield start + i * step;
  }
}

function valueAt(iterator, i) {
  if (!isFinite(i = +i) || i < 0 || i !== i | 0) return;
  var result, index = -1;
  while (!(result = iterator.next()).done) {
    if (++index === i) {
      return result.value;
    }
  }
}

function worker(source) {
  const url = URL.createObjectURL(new Blob([source], {type: "text/javascript"}));
  const worker = new Worker(url);
  return disposable(worker, () => {
    worker.terminate();
    URL.revokeObjectURL(url);
  });
}

var Generators$1 = {
  disposable: disposable,
  filter: filter,
  input: input,
  map: map$1,
  observe: observe,
  queue: queue,
  range: range,
  valueAt: valueAt,
  worker: worker
};

function template(render, wrapper) {
  return function(strings) {
    var string = strings[0],
        parts = [], part,
        root = null,
        node, nodes,
        walker,
        i, n, j, m, k = -1;

    // Concatenate the text using comments as placeholders.
    for (i = 1, n = arguments.length; i < n; ++i) {
      part = arguments[i];
      if (part instanceof Node) {
        parts[++k] = part;
        string += "<!--o:" + k + "-->";
      } else if (Array.isArray(part)) {
        for (j = 0, m = part.length; j < m; ++j) {
          node = part[j];
          if (node instanceof Node) {
            if (root === null) {
              parts[++k] = root = document.createDocumentFragment();
              string += "<!--o:" + k + "-->";
            }
            root.appendChild(node);
          } else {
            root = null;
            string += node;
          }
        }
        root = null;
      } else {
        string += part;
      }
      string += strings[i];
    }

    // Render the text.
    root = render(string);

    // Walk the rendered content to replace comment placeholders.
    if (++k > 0) {
      nodes = new Array(k);
      walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null, false);
      while (walker.nextNode()) {
        node = walker.currentNode;
        if (/^o:/.test(node.nodeValue)) {
          nodes[+node.nodeValue.slice(2)] = node;
        }
      }
      for (i = 0; i < k; ++i) {
        if (node = nodes[i]) {
          node.parentNode.replaceChild(parts[i], node);
        }
      }
    }

    // Is the rendered content
    // … a parent of a single child? Detach and return the child.
    // … a document fragment? Replace the fragment with an element.
    // … some other node? Return it.
    return root.childNodes.length === 1 ? root.removeChild(root.firstChild)
        : root.nodeType === 11 ? ((node = wrapper()).appendChild(root), node)
        : root;
  };
}

var html$1 = template(function(string) {
  var template = document.createElement("template");
  template.innerHTML = string.trim();
  return document.importNode(template.content, true);
}, function() {
  return document.createElement("span");
});

function dependency(name, version, main) {
  return {
    resolve(path = main) {
      return `${name}@${version}/${path}`;
    }
  };
}

const d3 = dependency("d3", "7.6.1", "dist/d3.min.js");
const inputs = dependency("@observablehq/inputs", "0.10.4", "dist/inputs.min.js");
const plot = dependency("@observablehq/plot", "0.5.2", "dist/plot.umd.min.js");
const graphviz = dependency("@observablehq/graphviz", "0.2.1", "dist/graphviz.min.js");
const highlight = dependency("@observablehq/highlight.js", "2.0.0", "highlight.min.js");
const katex = dependency("@observablehq/katex", "0.11.1", "dist/katex.min.js");
const lodash = dependency("lodash", "4.17.21", "lodash.min.js");
const htl = dependency("htl", "0.3.1", "dist/htl.min.js");
const marked = dependency("marked", "0.3.12", "marked.min.js");
const sql = dependency("sql.js", "1.7.0", "dist/sql-wasm.js");
const vega = dependency("vega", "5.22.1", "build/vega.min.js");
const vegalite = dependency("vega-lite", "5.2.0", "build/vega-lite.min.js");
const vegaliteApi = dependency("vega-lite-api", "5.0.0", "build/vega-lite-api.min.js");
const arrow$1 = dependency("apache-arrow", "4.0.1", "Arrow.es2015.min.js");
const arquero = dependency("arquero", "4.8.8", "dist/arquero.min.js");
const topojson = dependency("topojson-client", "3.1.0", "dist/topojson-client.min.js");
const mermaid$1 = dependency("mermaid", "9.1.1", "dist/mermaid.min.js");
const leaflet$1 = dependency("leaflet", "1.8.0", "dist/leaflet.js");

async function leaflet(require) {
  const L = await require(leaflet$1.resolve());
  if (!L._style) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = await require.resolve(leaflet$1.resolve("dist/leaflet.css"));
    L._style = document.head.appendChild(link);
  }
  return L;
}

function md(require) {
  return require(marked.resolve()).then(function(marked) {
    return template(
      function(string) {
        var root = document.createElement("div");
        root.innerHTML = marked(string, {langPrefix: ""}).trim();
        var code = root.querySelectorAll("pre code[class]");
        if (code.length > 0) {
          require(highlight.resolve()).then(function(hl) {
            code.forEach(function(block) {
              function done() {
                hl.highlightBlock(block);
                block.parentNode.classList.add("observablehq--md-pre");
              }
              if (hl.getLanguage(block.className)) {
                done();
              } else {
                require(highlight.resolve("async-languages/index.js"))
                  .then(index => {
                    if (index.has(block.className)) {
                      return require(highlight.resolve("async-languages/" + index.get(block.className))).then(language => {
                        hl.registerLanguage(block.className, language);
                      });
                    }
                  })
                  .then(done, done);
              }
            });
          });
        }
        return root;
      },
      function() {
        return document.createElement("div");
      }
    );
  });
}

async function mermaid(require) {
  const mer = await require(mermaid$1.resolve());
  mer.initialize({securityLevel: "loose", theme: "neutral"});
  return function mermaid() {
    const root = document.createElement("div");
    root.innerHTML = mer.render(uid().id, String.raw.apply(String, arguments));
    return root.removeChild(root.firstChild);
  };
}

function Mutable(value) {
  let change;
  Object.defineProperties(this, {
    generator: {value: observe(_ => void (change = _))},
    value: {get: () => value, set: x => change(value = x)} // eslint-disable-line no-setter-return
  });
  if (value !== undefined) change(value);
}

function* now() {
  while (true) {
    yield Date.now();
  }
}

function delay(duration, value) {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve(value);
    }, duration);
  });
}

var timeouts = new Map;

function timeout(now, time) {
  var t = new Promise(function(resolve) {
    timeouts.delete(time);
    var delay = time - now;
    if (!(delay > 0)) throw new Error("invalid time");
    if (delay > 0x7fffffff) throw new Error("too long to wait");
    setTimeout(resolve, delay);
  });
  timeouts.set(time, t);
  return t;
}

function when(time, value) {
  var now;
  return (now = timeouts.get(time = +time)) ? now.then(() => value)
      : (now = Date.now()) >= time ? Promise.resolve(value)
      : timeout(now, time).then(() => value);
}

function tick(duration, value) {
  return when(Math.ceil((Date.now() + 1) / duration) * duration, value);
}

var Promises = {
  delay: delay,
  tick: tick,
  when: when
};

function resolve(name, base) {
  if (/^(\w+:)|\/\//i.test(name)) return name;
  if (/^[.]{0,2}\//i.test(name)) return new URL(name, base == null ? location : base).href;
  if (!name.length || /^[\s._]/.test(name) || /\s$/.test(name)) throw new Error("illegal name");
  return "https://unpkg.com/" + name;
}

async function sqlite(require) {
  const [init, dist] = await Promise.all([require(sql.resolve()), require.resolve(sql.resolve("dist/"))]);
  return init({locateFile: file => `${dist}${file}`});
}

class SQLiteDatabaseClient$1 {
  constructor(db) {
    Object.defineProperties(this, {
      _db: {value: db}
    });
  }
  static async open(source) {
    const [SQL, buffer] = await Promise.all([sqlite(requireDefault), Promise.resolve(source).then(load$1)]);
    return new SQLiteDatabaseClient$1(new SQL.Database(buffer));
  }
  async query(query, params) {
    return await exec(this._db, query, params);
  }
  async queryRow(query, params) {
    return (await this.query(query, params))[0] || null;
  }
  async explain(query, params) {
    const rows = await this.query(`EXPLAIN QUERY PLAN ${query}`, params);
    return element("pre", {className: "observablehq--inspect"}, [
      text(rows.map(row => row.detail).join("\n"))
    ]);
  }
  async describeTables({schema} = {}) {
    return this.query(`SELECT NULLIF(schema, 'main') AS schema, name FROM pragma_table_list() WHERE type = 'table'${schema == null ? "" : ` AND schema = ?`} AND name NOT LIKE 'sqlite_%'`, schema == null ? [] : [schema]);
  }
  async describeColumns({schema, table} = {}) {
    if (table == null) throw new Error(`missing table`);
    const rows = await this.query(`SELECT name, type, "notnull" FROM pragma_table_info(?${schema == null ? "" : `, ?`}) ORDER BY cid`, schema == null ? [table] : [table, schema]);
    if (!rows.length) throw new Error(`table not found: ${table}`);
    return rows.map(({name, type, notnull}) => ({name, type: sqliteType(type), databaseType: type, nullable: !notnull}));
  }
  async describe(object) {
    const rows = await (object === undefined
      ? this.query(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      : this.query(`SELECT * FROM pragma_table_info(?)`, [object]));
    if (!rows.length) throw new Error("Not found");
    const {columns} = rows;
    return element("table", {value: rows}, [
      element("thead", [element("tr", columns.map(c => element("th", [text(c)])))]),
      element("tbody", rows.map(r => element("tr", columns.map(c => element("td", [text(r[c])])))))
    ]);
  }
  async sql() {
    return this.query(...this.queryTag.apply(this, arguments));
  }
  queryTag(strings, ...params) {
    return [strings.join("?"), params];
  }
}

Object.defineProperty(SQLiteDatabaseClient$1.prototype, "dialect", {
  value: "sqlite"
});

// https://www.sqlite.org/datatype3.html
function sqliteType(type) {
  switch (type) {
    case "NULL":
      return "null";
    case "INT":
    case "INTEGER":
    case "TINYINT":
    case "SMALLINT":
    case "MEDIUMINT":
    case "BIGINT":
    case "UNSIGNED BIG INT":
    case "INT2":
    case "INT8":
      return "integer";
    case "TEXT":
    case "CLOB":
      return "string";
    case "REAL":
    case "DOUBLE":
    case "DOUBLE PRECISION":
    case "FLOAT":
    case "NUMERIC":
      return "number";
    case "BLOB":
      return "buffer";
    case "DATE":
    case "DATETIME":
      return "string"; // TODO convert strings to Date instances in sql.js
    default:
      return /^(?:(?:(?:VARYING|NATIVE) )?CHARACTER|(?:N|VAR|NVAR)CHAR)\(/.test(type) ? "string"
        : /^(?:DECIMAL|NUMERIC)\(/.test(type) ? "number"
        : "other";
  }
}

function load$1(source) {
  return typeof source === "string" ? fetch(source).then(load$1)
    : source instanceof Response || source instanceof Blob ? source.arrayBuffer().then(load$1)
    : source instanceof ArrayBuffer ? new Uint8Array(source)
    : source;
}

async function exec(db, query, params) {
  const [result] = await db.exec(query, params);
  if (!result) return [];
  const {columns, values} = result;
  const rows = values.map(row => fromEntries(row.map((value, i) => [columns[i], value])));
  rows.columns = columns;
  return rows;
}

function element(name, props, children) {
  if (arguments.length === 2) children = props, props = undefined;
  const element = document.createElement(name);
  if (props !== undefined) for (const p in props) element[p] = props[p];
  if (children !== undefined) for (const c of children) element.appendChild(c);
  return element;
}

function text(value) {
  return document.createTextNode(value);
}

var svg = template(function(string) {
  var root = document.createElementNS("http://www.w3.org/2000/svg", "g");
  root.innerHTML = string.trim();
  return root;
}, function() {
  return document.createElementNS("http://www.w3.org/2000/svg", "g");
});

var raw = String.raw;

function style(href) {
  return new Promise(function(resolve, reject) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onerror = reject;
    link.onload = resolve;
    document.head.appendChild(link);
  });
}

function tex(require) {
  return Promise.all([
    require(katex.resolve()),
    require.resolve(katex.resolve("dist/katex.min.css")).then(style)
  ]).then(function(values) {
    var katex = values[0], tex = renderer();

    function renderer(options) {
      return function() {
        var root = document.createElement("div");
        katex.render(raw.apply(String, arguments), root, options);
        return root.removeChild(root.firstChild);
      };
    }

    tex.options = renderer;
    tex.block = renderer({displayMode: true});
    return tex;
  });
}

async function vl(require) {
  const [v, vl, api] = await Promise.all([vega, vegalite, vegaliteApi].map(d => require(d.resolve())));
  return api.register(v, vl);
}

function width() {
  return observe(function(change) {
    var width = change(document.body.clientWidth);
    function resized() {
      var w = document.body.clientWidth;
      if (w !== width) change(width = w);
    }
    window.addEventListener("resize", resized);
    return function() {
      window.removeEventListener("resize", resized);
    };
  });
}

const __query = Object.assign(
  // This function is used by table cells.
  async (source, operations, invalidation) => {
    const args = makeQueryTemplate(operations, await source);
    if (!args) return null; // the empty state
    return evaluateQuery(await source, args, invalidation);
  },
  {
    // This function is used by SQL cells.
    sql(source, invalidation) {
      return async function () {
        return evaluateQuery(source, arguments, invalidation);
      };
    }
  }
);

async function evaluateQuery(source, args, invalidation) {
  if (!source) return;

  // If this DatabaseClient supports abort and streaming, use that.
  if (typeof source.queryTag === "function") {
    const abortController = new AbortController();
    const options = {signal: abortController.signal};
    invalidation.then(() => abortController.abort("invalidated"));
    if (typeof source.queryStream === "function") {
      return accumulateQuery(
        source.queryStream(...source.queryTag.apply(source, args), options)
      );
    }
    if (typeof source.query === "function") {
      return source.query(...source.queryTag.apply(source, args), options);
    }
  }

  // Otherwise, fallback to the basic sql tagged template literal.
  if (typeof source.sql === "function") {
    return source.sql.apply(source, args);
  }

  // TODO: test if source is a file attachment, and support CSV etc.
  throw new Error("source does not implement query, queryStream, or sql");
}

// Generator function that yields accumulated query results client.queryStream
async function* accumulateQuery(queryRequest) {
  const queryResponse = await queryRequest;
  const values = [];
  values.done = false;
  values.error = null;
  values.schema = queryResponse.schema;
  try {
    const iterator = queryResponse.readRows();
    do {
      const result = await iterator.next();
      if (result.done) {
        values.done = true;
      } else {
        for (const value of result.value) {
          values.push(value);
        }
      }
      yield values;
    } while (!values.done);
  } catch (error) {
    values.error = error;
    yield values;
  }
}

/**
 * Returns a SQL query in the form [[parts], ...params] where parts is an array
 * of sub-strings and params are the parameter values to be inserted between each
 * sub-string.
 */
 function makeQueryTemplate(operations, source) {
  const escaper =
    source && typeof source.escape === "function" ? source.escape : (i) => i;
  const {select, from, filter, sort, slice} = operations;
  if (
    from.table === null ||
    select.columns === null ||
    (select.columns && select.columns.length === 0)
  )
    return;
  const columns = select.columns.map((c) => `t.${escaper(c)}`);
  const args = [
    [`SELECT ${columns} FROM ${formatTable(from.table, escaper)} t`]
  ];
  for (let i = 0; i < filter.length; ++i) {
    appendSql(i ? `\nAND ` : `\nWHERE `, args);
    appendWhereEntry(filter[i], args);
  }
  for (let i = 0; i < sort.length; ++i) {
    appendSql(i ? `, ` : `\nORDER BY `, args);
    appendOrderBy(sort[i], args);
  }
  if (slice.to !== null || slice.from !== null) {
    appendSql(
      `\nLIMIT ${slice.to !== null ? slice.to - (slice.from || 0) : 1e9}`,
      args
    );
  }
  if (slice.from !== null) {
    appendSql(` OFFSET ${slice.from}`, args);
  }
  return args;
}

function formatTable(table, escaper) {
  if (typeof table === "object") {
    let from = "";
    if (table.database != null) from += escaper(table.database) + ".";
    if (table.schema != null) from += escaper(table.schema) + ".";
    from += escaper(table.table);
    return from;
  }
  return table;
}

function appendSql(sql, args) {
  const strings = args[0];
  strings[strings.length - 1] += sql;
}

function appendOrderBy({column, direction}, args) {
  appendSql(`t.${column} ${direction.toUpperCase()}`, args);
}

function appendWhereEntry({type, operands}, args) {
  if (operands.length < 1) throw new Error("Invalid operand length");

  // Unary operations
  if (operands.length === 1) {
    appendOperand(operands[0], args);
    switch (type) {
      case "n":
        appendSql(` IS NULL`, args);
        return;
      case "nn":
        appendSql(` IS NOT NULL`, args);
        return;
      default:
        throw new Error("Invalid filter operation");
    }
  }

  // Binary operations
  if (operands.length === 2) {
    if (["in", "nin"].includes(type)) ; else if (["c", "nc"].includes(type)) {
      // TODO: Case (in)sensitive?
      appendOperand(operands[0], args);
      switch (type) {
        case "c":
          appendSql(` LIKE `, args);
          break;
        case "nc":
          appendSql(` NOT LIKE `, args);
          break;
      }
      appendOperand(likeOperand(operands[1]), args);
      return;
    } else {
      appendOperand(operands[0], args);
      switch (type) {
        case "eq":
          appendSql(` = `, args);
          break;
        case "ne":
          appendSql(` <> `, args);
          break;
        case "gt":
          appendSql(` > `, args);
          break;
        case "lt":
          appendSql(` < `, args);
          break;
        case "gte":
          appendSql(` >= `, args);
          break;
        case "lte":
          appendSql(` <= `, args);
          break;
        default:
          throw new Error("Invalid filter operation");
      }
      appendOperand(operands[1], args);
      return;
    }
  }

  // List operations
  appendOperand(operands[0], args);
  switch (type) {
    case "in":
      appendSql(` IN (`, args);
      break;
    case "nin":
      appendSql(` NOT IN (`, args);
      break;
    default:
      throw new Error("Invalid filter operation");
  }
  appendListOperands(operands.slice(1), args);
  appendSql(")", args);
}

function appendOperand(o, args) {
  if (o.type === "column") {
    appendSql(`t.${o.value}`, args);
  } else {
    args.push(o.value);
    args[0].push("");
  }
}

// TODO: Support column operands here?
function appendListOperands(ops, args) {
  let first = true;
  for (const op of ops) {
    if (first) first = false;
    else appendSql(",", args);
    args.push(op.value);
    args[0].push("");
  }
}

function likeOperand(operand) {
  return {...operand, value: `%${operand.value}%`};
}

var Library = Object.assign(Object.defineProperties(function Library(resolver) {
  const require = requirer(resolver);
  Object.defineProperties(this, properties({
    FileAttachment: () => NoFileAttachments,
    Mutable: () => Mutable,
    now,
    width,

    // Tagged template literals
    dot: () => require(graphviz.resolve()),
    htl: () => require(htl.resolve()),
    html: () => html$1,
    md: () => md(require),
    svg: () => svg,
    tex: () => tex(require),

    // Recommended libraries
    // https://observablehq.com/@observablehq/recommended-libraries
    _: () => require(lodash.resolve()),
    aq: () => require.alias({"apache-arrow": arrow$1.resolve()})(arquero.resolve()),
    Arrow: () => require(arrow$1.resolve()),
    d3: () => require(d3.resolve()),
    Inputs: () => require(inputs.resolve()).then(Inputs => ({...Inputs, file: Inputs.fileOf(AbstractFile)})),
    L: () => leaflet(require),
    mermaid: () => mermaid(require),
    Plot: () => require(plot.resolve()),
    __query: () => __query,
    require: () => require,
    resolve: () => resolve, // deprecated; use async require.resolve instead
    SQLite: () => sqlite(require),
    SQLiteDatabaseClient: () => SQLiteDatabaseClient$1,
    topojson: () => require(topojson.resolve()),
    vl: () => vl(require),

    // Sample datasets
    // https://observablehq.com/@observablehq/datasets
    aapl: () => new FileAttachment("https://static.observableusercontent.com/files/3ccff97fd2d93da734e76829b2b066eafdaac6a1fafdec0faf6ebc443271cfc109d29e80dd217468fcb2aff1e6bffdc73f356cc48feb657f35378e6abbbb63b9").csv({typed: true}),
    alphabet: () => new FileAttachment("https://static.observableusercontent.com/files/75d52e6c3130b1cae83cda89305e17b50f33e7420ef205587a135e8562bcfd22e483cf4fa2fb5df6dff66f9c5d19740be1cfaf47406286e2eb6574b49ffc685d").csv({typed: true}),
    cars: () => new FileAttachment("https://static.observableusercontent.com/files/048ec3dfd528110c0665dfa363dd28bc516ffb7247231f3ab25005036717f5c4c232a5efc7bb74bc03037155cb72b1abe85a33d86eb9f1a336196030443be4f6").csv({typed: true}),
    citywages: () => new FileAttachment("https://static.observableusercontent.com/files/39837ec5121fcc163131dbc2fe8c1a2e0b3423a5d1e96b5ce371e2ac2e20a290d78b71a4fb08b9fa6a0107776e17fb78af313b8ea70f4cc6648fad68ddf06f7a").csv({typed: true}),
    diamonds: () => new FileAttachment("https://static.observableusercontent.com/files/87942b1f5d061a21fa4bb8f2162db44e3ef0f7391301f867ab5ba718b225a63091af20675f0bfe7f922db097b217b377135203a7eab34651e21a8d09f4e37252").csv({typed: true}),
    flare: () => new FileAttachment("https://static.observableusercontent.com/files/a6b0d94a7f5828fd133765a934f4c9746d2010e2f342d335923991f31b14120de96b5cb4f160d509d8dc627f0107d7f5b5070d2516f01e4c862b5b4867533000").csv({typed: true}),
    industries: () => new FileAttachment("https://static.observableusercontent.com/files/76f13741128340cc88798c0a0b7fa5a2df8370f57554000774ab8ee9ae785ffa2903010cad670d4939af3e9c17e5e18e7e05ed2b38b848ac2fc1a0066aa0005f").csv({typed: true}),
    miserables: () => new FileAttachment("https://static.observableusercontent.com/files/31d904f6e21d42d4963ece9c8cc4fbd75efcbdc404bf511bc79906f0a1be68b5a01e935f65123670ed04e35ca8cae3c2b943f82bf8db49c5a67c85cbb58db052").json(),
    olympians: () => new FileAttachment("https://static.observableusercontent.com/files/31ca24545a0603dce099d10ee89ee5ae72d29fa55e8fc7c9ffb5ded87ac83060d80f1d9e21f4ae8eb04c1e8940b7287d179fe8060d887fb1f055f430e210007c").csv({typed: true}),
    penguins: () => new FileAttachment("https://static.observableusercontent.com/files/715db1223e067f00500780077febc6cebbdd90c151d3d78317c802732252052ab0e367039872ab9c77d6ef99e5f55a0724b35ddc898a1c99cb14c31a379af80a").csv({typed: true}),
    weather: () => new FileAttachment("https://static.observableusercontent.com/files/693a46b22b33db0f042728700e0c73e836fa13d55446df89120682d55339c6db7cc9e574d3d73f24ecc9bc7eb9ac9a1e7e104a1ee52c00aab1e77eb102913c1f").csv({typed: true}),

    // Note: these are namespace objects, and thus exposed directly rather than
    // being wrapped in a function. This allows library.Generators to resolve,
    // rather than needing module.value.
    DOM,
    Files,
    Generators: Generators$1,
    Promises
  }));
}, {
  resolve: {
    get: () => requireDefault.resolve,
    enumerable: true,
    configurable: true
  },
  require: {
    get: () => requireDefault,
    set: setDefaultRequire,
    enumerable: true,
    configurable: true
  }
}), {
  resolveFrom,
  requireFrom
});

function properties(values) {
  return Object.fromEntries(Object.entries(values).map(property));
}

function property([key, value]) {
  return [key, ({value, writable: true, enumerable: true})];
}

// src/main.js
class PandocCodeDecorator {
  constructor(node) {
    this._node = node;
    this._spans = [];
    this.normalizeCodeRange();
    this.initializeEntryPoints();
  }
  normalizeCodeRange() {
    const n = this._node;
    const lines = n.querySelectorAll("code > span");
    for (const line of lines) {
      Array.from(line.childNodes).filter((n2) => n2.nodeType === n2.TEXT_NODE).forEach((n2) => {
        const newSpan = document.createElement("span");
        newSpan.textContent = n2.wholeText;
        n2.replaceWith(newSpan);
      });
    }
  }
  initializeEntryPoints() {
    const lines = this._node.querySelectorAll("code > span");
    let result = [];
    let offset = this._node.parentElement.dataset.sourceOffset && -Number(this._node.parentElement.dataset.sourceOffset) || 0;
    for (const line of lines) {
      let lineNumber = Number(line.id.split("-").pop());
      let column = 1;
      Array.from(line.childNodes).filter((n) => n.nodeType === n.ELEMENT_NODE && n.nodeName === "SPAN").forEach((n) => {
        result.push({
          offset,
          line: lineNumber,
          column,
          node: n
        });
        offset += n.textContent.length;
        column += n.textContent.length;
      });
      offset += 1;
    }
    this._elementEntryPoints = result;
  }
  locateEntry(offset) {
    let candidate;
    if (offset === Infinity)
      return void 0;
    for (let i = 0; i < this._elementEntryPoints.length; ++i) {
      const entry = this._elementEntryPoints[i];
      if (entry.offset > offset) {
        return { entry: candidate, index: i - 1 };
      }
      candidate = entry;
    }
    if (offset < candidate.offset + candidate.node.textContent.length) {
      return { entry: candidate, index: this._elementEntryPoints.length - 1 };
    } else {
      return void 0;
    }
  }
  offsetToLineColumn(offset) {
    let entry = this.locateEntry(offset);
    if (entry === void 0) {
      const entries = this._elementEntryPoints;
      const last = entries[entries.length - 1];
      return {
        line: last.line,
        column: last.column + Math.min(last.node.textContent.length, offset - last.offset)
      };
    }
    return {
      line: entry.entry.line,
      column: entry.entry.column + offset - entry.entry.offset
    };
  }
  *spanSelection(start, end) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === void 0) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = endEntry && endEntry.index || this._elementEntryPoints.length;
    for (let i = startIndex; i < endIndex; ++i) {
      if (this._elementEntryPoints[i] !== void 0) {
        yield this._elementEntryPoints[i];
      }
    }
  }
  decorateSpan(start, end, classes) {
    for (const entryPoint of this.spanSelection(start, end)) {
      for (const cssClass of classes) {
        entryPoint.node.classList.add(cssClass);
      }
    }
  }
  clearSpan(start, end, classes) {
    for (const entryPoint of this.spanSelection(start, end)) {
      for (const cssClass of classes) {
        entryPoint.node.classList.remove(cssClass);
      }
    }
  }
  ensureExactSpan(start, end) {
    const splitEntry = (entry, offset) => {
      const newSpan = document.createElement("span");
      for (const cssClass of entry.node.classList) {
        newSpan.classList.add(cssClass);
      }
      const beforeText = entry.node.textContent.slice(0, offset - entry.offset);
      const afterText = entry.node.textContent.slice(offset - entry.offset);
      entry.node.textContent = beforeText;
      newSpan.textContent = afterText;
      entry.node.after(newSpan);
      this._elementEntryPoints.push({
        column: entry.column + offset - entry.offset,
        line: entry.line,
        node: newSpan,
        offset
      });
      this._elementEntryPoints.sort((a, b) => a.offset - b.offset);
    };
    const startEntry = this.locateEntry(start);
    if (startEntry !== void 0 && startEntry.entry !== void 0 && startEntry.entry.offset != start) {
      splitEntry(startEntry.entry, start);
    }
    const endEntry = this.locateEntry(end);
    if (endEntry !== void 0 && startEntry.entry !== void 0 && endEntry.entry.offset !== end) {
      splitEntry(endEntry.entry, end);
    }
  }
  clearSpan(start, end, classes) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === void 0) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = endEntry && endEntry.index || this._elementEntryPoints.length;
    for (let i = startIndex; i < endIndex; ++i) {
      for (const cssClass of classes) {
        this._elementEntryPoints[i].node.classList.remove(cssClass);
      }
    }
  }
}

function dispatch(node, type, detail) {
  detail = detail || {};
  var document = node.ownerDocument, event = document.defaultView.CustomEvent;
  if (typeof event === "function") {
    event = new event(type, {detail: detail});
  } else {
    event = document.createEvent("Event");
    event.initEvent(type, false, false);
    event.detail = detail;
  }
  node.dispatchEvent(event);
}

// TODO https://twitter.com/mbostock/status/702737065121742848
function isarray(value) {
  return Array.isArray(value)
      || value instanceof Int8Array
      || value instanceof Int16Array
      || value instanceof Int32Array
      || value instanceof Uint8Array
      || value instanceof Uint8ClampedArray
      || value instanceof Uint16Array
      || value instanceof Uint32Array
      || value instanceof Float32Array
      || value instanceof Float64Array;
}

// Non-integer keys in arrays, e.g. [1, 2, 0.5: "value"].
function isindex(key) {
  return key === (key | 0) + "";
}

function inspectName(name) {
  const n = document.createElement("span");
  n.className = "observablehq--cellname";
  n.textContent = `${name} = `;
  return n;
}

const symbolToString = Symbol.prototype.toString;

// Symbols do not coerce to strings; they must be explicitly converted.
function formatSymbol(symbol) {
  return symbolToString.call(symbol);
}

const {getOwnPropertySymbols, prototype: {hasOwnProperty: hasOwnProperty$1}} = Object;
const {toStringTag} = Symbol;

const FORBIDDEN = {};

const symbolsof = getOwnPropertySymbols;

function isown(object, key) {
  return hasOwnProperty$1.call(object, key);
}

function tagof(object) {
  return object[toStringTag]
      || (object.constructor && object.constructor.name)
      || "Object";
}

function valueof(object, key) {
  try {
    const value = object[key];
    if (value) value.constructor; // Test for SecurityError.
    return value;
  } catch (ignore) {
    return FORBIDDEN;
  }
}

const SYMBOLS = [
  { symbol: "@@__IMMUTABLE_INDEXED__@@", name: "Indexed", modifier: true },
  { symbol: "@@__IMMUTABLE_KEYED__@@", name: "Keyed", modifier: true },
  { symbol: "@@__IMMUTABLE_LIST__@@", name: "List", arrayish: true },
  { symbol: "@@__IMMUTABLE_MAP__@@", name: "Map" },
  {
    symbol: "@@__IMMUTABLE_ORDERED__@@",
    name: "Ordered",
    modifier: true,
    prefix: true
  },
  { symbol: "@@__IMMUTABLE_RECORD__@@", name: "Record" },
  {
    symbol: "@@__IMMUTABLE_SET__@@",
    name: "Set",
    arrayish: true,
    setish: true
  },
  { symbol: "@@__IMMUTABLE_STACK__@@", name: "Stack", arrayish: true }
];

function immutableName(obj) {
  try {
    let symbols = SYMBOLS.filter(({ symbol }) => obj[symbol] === true);
    if (!symbols.length) return;

    const name = symbols.find(s => !s.modifier);
    const prefix =
      name.name === "Map" && symbols.find(s => s.modifier && s.prefix);

    const arrayish = symbols.some(s => s.arrayish);
    const setish = symbols.some(s => s.setish);

    return {
      name: `${prefix ? prefix.name : ""}${name.name}`,
      symbols,
      arrayish: arrayish && !setish,
      setish
    };
  } catch (e) {
    return null;
  }
}

const {getPrototypeOf, getOwnPropertyDescriptors} = Object;
const objectPrototype = getPrototypeOf({});

function inspectExpanded(object, _, name, proto) {
  let arrayish = isarray(object);
  let tag, fields, next, n;

  if (object instanceof Map) {
    if (object instanceof object.constructor) {
      tag = `Map(${object.size})`;
      fields = iterateMap$1;
    } else { // avoid incompatible receiver error for prototype
      tag = "Map()";
      fields = iterateObject$1;
    }
  } else if (object instanceof Set) {
    if (object instanceof object.constructor) {
      tag = `Set(${object.size})`;
      fields = iterateSet$1;
    } else { // avoid incompatible receiver error for prototype
      tag = "Set()";
      fields = iterateObject$1;
    }
  } else if (arrayish) {
    tag = `${object.constructor.name}(${object.length})`;
    fields = iterateArray$1;
  } else if ((n = immutableName(object))) {
    tag = `Immutable.${n.name}${n.name === "Record" ? "" : `(${object.size})`}`;
    arrayish = n.arrayish;
    fields = n.arrayish
      ? iterateImArray$1
      : n.setish
      ? iterateImSet$1
      : iterateImObject$1;
  } else if (proto) {
    tag = tagof(object);
    fields = iterateProto;
  } else {
    tag = tagof(object);
    fields = iterateObject$1;
  }

  const span = document.createElement("span");
  span.className = "observablehq--expanded";
  if (name) {
    span.appendChild(inspectName(name));
  }
  const a = span.appendChild(document.createElement("a"));
  a.innerHTML = `<svg width=8 height=8 class='observablehq--caret'>
    <path d='M4 7L0 1h8z' fill='currentColor' />
  </svg>`;
  a.appendChild(document.createTextNode(`${tag}${arrayish ? " [" : " {"}`));
  a.addEventListener("mouseup", function(event) {
    event.stopPropagation();
    replace(span, inspectCollapsed(object, null, name, proto));
  });

  fields = fields(object);
  for (let i = 0; !(next = fields.next()).done && i < 20; ++i) {
    span.appendChild(next.value);
  }

  if (!next.done) {
    const a = span.appendChild(document.createElement("a"));
    a.className = "observablehq--field";
    a.style.display = "block";
    a.appendChild(document.createTextNode(`  … more`));
    a.addEventListener("mouseup", function(event) {
      event.stopPropagation();
      span.insertBefore(next.value, span.lastChild.previousSibling);
      for (let i = 0; !(next = fields.next()).done && i < 19; ++i) {
        span.insertBefore(next.value, span.lastChild.previousSibling);
      }
      if (next.done) span.removeChild(span.lastChild.previousSibling);
      dispatch(span, "load");
    });
  }

  span.appendChild(document.createTextNode(arrayish ? "]" : "}"));

  return span;
}

function* iterateMap$1(map) {
  for (const [key, value] of map) {
    yield formatMapField$1(key, value);
  }
  yield* iterateObject$1(map);
}

function* iterateSet$1(set) {
  for (const value of set) {
    yield formatSetField(value);
  }
  yield* iterateObject$1(set);
}

function* iterateImSet$1(set) {
  for (const value of set) {
    yield formatSetField(value);
  }
}

function* iterateArray$1(array) {
  for (let i = 0, n = array.length; i < n; ++i) {
    if (i in array) {
      yield formatField$1(i, valueof(array, i), "observablehq--index");
    }
  }
  for (const key in array) {
    if (!isindex(key) && isown(array, key)) {
      yield formatField$1(key, valueof(array, key), "observablehq--key");
    }
  }
  for (const symbol of symbolsof(array)) {
    yield formatField$1(
      formatSymbol(symbol),
      valueof(array, symbol),
      "observablehq--symbol"
    );
  }
}

function* iterateImArray$1(array) {
  let i1 = 0;
  for (const n = array.size; i1 < n; ++i1) {
    yield formatField$1(i1, array.get(i1), true);
  }
}

function* iterateProto(object) {
  for (const key in getOwnPropertyDescriptors(object)) {
    yield formatField$1(key, valueof(object, key), "observablehq--key");
  }
  for (const symbol of symbolsof(object)) {
    yield formatField$1(
      formatSymbol(symbol),
      valueof(object, symbol),
      "observablehq--symbol"
    );
  }

  const proto = getPrototypeOf(object);
  if (proto && proto !== objectPrototype) {
    yield formatPrototype(proto);
  }
}

function* iterateObject$1(object) {
  for (const key in object) {
    if (isown(object, key)) {
      yield formatField$1(key, valueof(object, key), "observablehq--key");
    }
  }
  for (const symbol of symbolsof(object)) {
    yield formatField$1(
      formatSymbol(symbol),
      valueof(object, symbol),
      "observablehq--symbol"
    );
  }

  const proto = getPrototypeOf(object);
  if (proto && proto !== objectPrototype) {
    yield formatPrototype(proto);
  }
}

function* iterateImObject$1(object) {
  for (const [key, value] of object) {
    yield formatField$1(key, value, "observablehq--key");
  }
}

function formatPrototype(value) {
  const item = document.createElement("div");
  const span = item.appendChild(document.createElement("span"));
  item.className = "observablehq--field";
  span.className = "observablehq--prototype-key";
  span.textContent = `  <prototype>`;
  item.appendChild(document.createTextNode(": "));
  item.appendChild(inspect(value, undefined, undefined, undefined, true));
  return item;
}

function formatField$1(key, value, className) {
  const item = document.createElement("div");
  const span = item.appendChild(document.createElement("span"));
  item.className = "observablehq--field";
  span.className = className;
  span.textContent = `  ${key}`;
  item.appendChild(document.createTextNode(": "));
  item.appendChild(inspect(value));
  return item;
}

function formatMapField$1(key, value) {
  const item = document.createElement("div");
  item.className = "observablehq--field";
  item.appendChild(document.createTextNode("  "));
  item.appendChild(inspect(key));
  item.appendChild(document.createTextNode(" => "));
  item.appendChild(inspect(value));
  return item;
}

function formatSetField(value) {
  const item = document.createElement("div");
  item.className = "observablehq--field";
  item.appendChild(document.createTextNode("  "));
  item.appendChild(inspect(value));
  return item;
}

function hasSelection(elem) {
  const sel = window.getSelection();
  return (
    sel.type === "Range" &&
    (sel.containsNode(elem, true) ||
      sel.anchorNode.isSelfOrDescendant(elem) ||
      sel.focusNode.isSelfOrDescendant(elem))
  );
}

function inspectCollapsed(object, shallow, name, proto) {
  let arrayish = isarray(object);
  let tag, fields, next, n;

  if (object instanceof Map) {
    if (object instanceof object.constructor) {
      tag = `Map(${object.size})`;
      fields = iterateMap;
    } else { // avoid incompatible receiver error for prototype
      tag = "Map()";
      fields = iterateObject;
    }
  } else if (object instanceof Set) {
    if (object instanceof object.constructor) {
      tag = `Set(${object.size})`;
      fields = iterateSet;
    } else { // avoid incompatible receiver error for prototype
      tag = "Set()";
      fields = iterateObject;
    }
  } else if (arrayish) {
    tag = `${object.constructor.name}(${object.length})`;
    fields = iterateArray;
  } else if ((n = immutableName(object))) {
    tag = `Immutable.${n.name}${n.name === 'Record' ? '' : `(${object.size})`}`;
    arrayish = n.arrayish;
    fields = n.arrayish ? iterateImArray : n.setish ? iterateImSet : iterateImObject;
  } else {
    tag = tagof(object);
    fields = iterateObject;
  }

  if (shallow) {
    const span = document.createElement("span");
    span.className = "observablehq--shallow";
    if (name) {
      span.appendChild(inspectName(name));
    }
    span.appendChild(document.createTextNode(tag));
    span.addEventListener("mouseup", function(event) {
      if (hasSelection(span)) return;
      event.stopPropagation();
      replace(span, inspectCollapsed(object));
    });
    return span;
  }

  const span = document.createElement("span");
  span.className = "observablehq--collapsed";
  if (name) {
    span.appendChild(inspectName(name));
  }
  const a = span.appendChild(document.createElement("a"));
  a.innerHTML = `<svg width=8 height=8 class='observablehq--caret'>
    <path d='M7 4L1 8V0z' fill='currentColor' />
  </svg>`;
  a.appendChild(document.createTextNode(`${tag}${arrayish ? " [" : " {"}`));
  span.addEventListener("mouseup", function(event) {
    if (hasSelection(span)) return;
    event.stopPropagation();
    replace(span, inspectExpanded(object, null, name, proto));
  }, true);

  fields = fields(object);
  for (let i = 0; !(next = fields.next()).done && i < 20; ++i) {
    if (i > 0) span.appendChild(document.createTextNode(", "));
    span.appendChild(next.value);
  }

  if (!next.done) span.appendChild(document.createTextNode(", …"));
  span.appendChild(document.createTextNode(arrayish ? "]" : "}"));

  return span;
}

function* iterateMap(map) {
  for (const [key, value] of map) {
    yield formatMapField(key, value);
  }
  yield* iterateObject(map);
}

function* iterateSet(set) {
  for (const value of set) {
    yield inspect(value, true);
  }
  yield* iterateObject(set);
}

function* iterateImSet(set) {
  for (const value of set) {
    yield inspect(value, true);
  }
}

function* iterateImArray(array) {
  let i0 = -1, i1 = 0;
  for (const n = array.size; i1 < n; ++i1) {
    if (i1 > i0 + 1) yield formatEmpty(i1 - i0 - 1);
    yield inspect(array.get(i1), true);
    i0 = i1;
  }
  if (i1 > i0 + 1) yield formatEmpty(i1 - i0 - 1);
}

function* iterateArray(array) {
  let i0 = -1, i1 = 0;
  for (const n = array.length; i1 < n; ++i1) {
    if (i1 in array) {
      if (i1 > i0 + 1) yield formatEmpty(i1 - i0 - 1);
      yield inspect(valueof(array, i1), true);
      i0 = i1;
    }
  }
  if (i1 > i0 + 1) yield formatEmpty(i1 - i0 - 1);
  for (const key in array) {
    if (!isindex(key) && isown(array, key)) {
      yield formatField(key, valueof(array, key), "observablehq--key");
    }
  }
  for (const symbol of symbolsof(array)) {
    yield formatField(formatSymbol(symbol), valueof(array, symbol), "observablehq--symbol");
  }
}

function* iterateObject(object) {
  for (const key in object) {
    if (isown(object, key)) {
      yield formatField(key, valueof(object, key), "observablehq--key");
    }
  }
  for (const symbol of symbolsof(object)) {
    yield formatField(formatSymbol(symbol), valueof(object, symbol), "observablehq--symbol");
  }
}

function* iterateImObject(object) {
  for (const [key, value] of object) {
    yield formatField(key, value, "observablehq--key");
  }
}

function formatEmpty(e) {
  const span = document.createElement("span");
  span.className = "observablehq--empty";
  span.textContent = e === 1 ? "empty" : `empty × ${e}`;
  return span;
}

function formatField(key, value, className) {
  const fragment = document.createDocumentFragment();
  const span = fragment.appendChild(document.createElement("span"));
  span.className = className;
  span.textContent = key;
  fragment.appendChild(document.createTextNode(": "));
  fragment.appendChild(inspect(value, true));
  return fragment;
}

function formatMapField(key, value) {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(inspect(key, true));
  fragment.appendChild(document.createTextNode(" => "));
  fragment.appendChild(inspect(value, true));
  return fragment;
}

function format(date, fallback) {
  if (!(date instanceof Date)) date = new Date(+date);
  if (isNaN(date)) return typeof fallback === "function" ? fallback(date) : fallback;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();
  return `${formatYear(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}${
    hours || minutes || seconds || milliseconds ? `T${pad(hours, 2)}:${pad(minutes, 2)}${
      seconds || milliseconds ? `:${pad(seconds, 2)}${
        milliseconds ? `.${pad(milliseconds, 3)}` : ``
      }` : ``
    }Z` : ``
  }`;
}

function formatYear(year) {
  return year < 0 ? `-${pad(-year, 6)}`
    : year > 9999 ? `+${pad(year, 6)}`
    : pad(year, 4);
}

function pad(value, width) {
  return `${value}`.padStart(width, "0");
}

function formatDate$1(date) {
  return format(date, "Invalid Date");
}

var errorToString = Error.prototype.toString;

function formatError(value) {
  return value.stack || errorToString.call(value);
}

var regExpToString = RegExp.prototype.toString;

function formatRegExp(value) {
  return regExpToString.call(value);
}

/* eslint-disable no-control-regex */
const NEWLINE_LIMIT = 20;

function formatString(string, shallow, expanded, name) {
  if (shallow === false) {
    // String has fewer escapes displayed with double quotes
    if (count(string, /["\n]/g) <= count(string, /`|\${/g)) {
      const span = document.createElement("span");
      if (name) span.appendChild(inspectName(name));
      const textValue = span.appendChild(document.createElement("span"));
      textValue.className = "observablehq--string";
      textValue.textContent = JSON.stringify(string);
      return span;
    }
    const lines = string.split("\n");
    if (lines.length > NEWLINE_LIMIT && !expanded) {
      const div = document.createElement("div");
      if (name) div.appendChild(inspectName(name));
      const textValue = div.appendChild(document.createElement("span"));
      textValue.className = "observablehq--string";
      textValue.textContent = "`" + templatify(lines.slice(0, NEWLINE_LIMIT).join("\n"));
      const splitter = div.appendChild(document.createElement("span"));
      const truncatedCount = lines.length - NEWLINE_LIMIT;
      splitter.textContent = `Show ${truncatedCount} truncated line${truncatedCount > 1 ? "s": ""}`; splitter.className = "observablehq--string-expand";
      splitter.addEventListener("mouseup", function (event) {
        event.stopPropagation();
        replace(div, inspect(string, shallow, true, name));
      });
      return div;
    }
    const span = document.createElement("span");
    if (name) span.appendChild(inspectName(name));
    const textValue = span.appendChild(document.createElement("span"));
    textValue.className = `observablehq--string${expanded ? " observablehq--expanded" : ""}`;
    textValue.textContent = "`" + templatify(string) + "`";
    return span;
  }

  const span = document.createElement("span");
  if (name) span.appendChild(inspectName(name));
  const textValue = span.appendChild(document.createElement("span"));
  textValue.className = "observablehq--string";
  textValue.textContent = JSON.stringify(string.length > 100 ?
    `${string.slice(0, 50)}…${string.slice(-49)}` : string);
  return span;
}

function templatify(string) {
  return string.replace(/[\\`\x00-\x09\x0b-\x19]|\${/g, templatifyChar);
}

function templatifyChar(char) {
  var code = char.charCodeAt(0);
  switch (code) {
    case 0x8: return "\\b";
    case 0x9: return "\\t";
    case 0xb: return "\\v";
    case 0xc: return "\\f";
    case 0xd: return "\\r";
  }
  return code < 0x10 ? "\\x0" + code.toString(16)
      : code < 0x20 ? "\\x" + code.toString(16)
      : "\\" + char;
}

function count(string, re) {
  var n = 0;
  while (re.exec(string)) ++n;
  return n;
}

var toString$2 = Function.prototype.toString,
    TYPE_ASYNC = {prefix: "async ƒ"},
    TYPE_ASYNC_GENERATOR = {prefix: "async ƒ*"},
    TYPE_CLASS = {prefix: "class"},
    TYPE_FUNCTION = {prefix: "ƒ"},
    TYPE_GENERATOR = {prefix: "ƒ*"};

function inspectFunction(f, name) {
  var type, m, t = toString$2.call(f);

  switch (f.constructor && f.constructor.name) {
    case "AsyncFunction": type = TYPE_ASYNC; break;
    case "AsyncGeneratorFunction": type = TYPE_ASYNC_GENERATOR; break;
    case "GeneratorFunction": type = TYPE_GENERATOR; break;
    default: type = /^class\b/.test(t) ? TYPE_CLASS : TYPE_FUNCTION; break;
  }

  // A class, possibly named.
  // class Name
  if (type === TYPE_CLASS) {
    return formatFunction(type, "", name);
  }

  // An arrow function with a single argument.
  // foo =>
  // async foo =>
  if ((m = /^(?:async\s*)?(\w+)\s*=>/.exec(t))) {
    return formatFunction(type, "(" + m[1] + ")", name);
  }

  // An arrow function with parenthesized arguments.
  // (…)
  // async (…)
  if ((m = /^(?:async\s*)?\(\s*(\w+(?:\s*,\s*\w+)*)?\s*\)/.exec(t))) {
    return formatFunction(type, m[1] ? "(" + m[1].replace(/\s*,\s*/g, ", ") + ")" : "()", name);
  }

  // A function, possibly: async, generator, anonymous, simply arguments.
  // function name(…)
  // function* name(…)
  // async function name(…)
  // async function* name(…)
  if ((m = /^(?:async\s*)?function(?:\s*\*)?(?:\s*\w+)?\s*\(\s*(\w+(?:\s*,\s*\w+)*)?\s*\)/.exec(t))) {
    return formatFunction(type, m[1] ? "(" + m[1].replace(/\s*,\s*/g, ", ") + ")" : "()", name);
  }

  // Something else, like destructuring, comments or default values.
  return formatFunction(type, "(…)", name);
}

function formatFunction(type, args, cellname) {
  var span = document.createElement("span");
  span.className = "observablehq--function";
  if (cellname) {
    span.appendChild(inspectName(cellname));
  }
  var spanType = span.appendChild(document.createElement("span"));
  spanType.className = "observablehq--keyword";
  spanType.textContent = type.prefix;
  span.appendChild(document.createTextNode(args));
  return span;
}

const {prototype: {toString: toString$1}} = Object;

function inspect(value, shallow, expand, name, proto) {
  let type = typeof value;
  switch (type) {
    case "boolean":
    case "undefined": { value += ""; break; }
    case "number": { value = value === 0 && 1 / value < 0 ? "-0" : value + ""; break; }
    case "bigint": { value = value + "n"; break; }
    case "symbol": { value = formatSymbol(value); break; }
    case "function": { return inspectFunction(value, name); }
    case "string": { return formatString(value, shallow, expand, name); }
    default: {
      if (value === null) { type = null, value = "null"; break; }
      if (value instanceof Date) { type = "date", value = formatDate$1(value); break; }
      if (value === FORBIDDEN) { type = "forbidden", value = "[forbidden]"; break; }
      switch (toString$1.call(value)) {
        case "[object RegExp]": { type = "regexp", value = formatRegExp(value); break; }
        case "[object Error]": // https://github.com/lodash/lodash/blob/master/isError.js#L26
        case "[object DOMException]": { type = "error", value = formatError(value); break; }
        default: return (expand ? inspectExpanded : inspectCollapsed)(value, shallow, name, proto);
      }
      break;
    }
  }
  const span = document.createElement("span");
  if (name) span.appendChild(inspectName(name));
  const n = span.appendChild(document.createElement("span"));
  n.className = `observablehq--${type}`;
  n.textContent = value;
  return span;
}

function replace(spanOld, spanNew) {
  if (spanOld.classList.contains("observablehq--inspect")) spanNew.classList.add("observablehq--inspect");
  spanOld.parentNode.replaceChild(spanNew, spanOld);
  dispatch(spanNew, "load");
}

const LOCATION_MATCH = /\s+\(\d+:\d+\)$/m;

class Inspector {
  constructor(node) {
    if (!node) throw new Error("invalid node");
    this._node = node;
    node.classList.add("observablehq");
  }
  pending() {
    const {_node} = this;
    _node.classList.remove("observablehq--error");
    _node.classList.add("observablehq--running");
  }
  fulfilled(value, name) {
    const {_node} = this;
    if (!isnode(value) || (value.parentNode && value.parentNode !== _node)) {
      value = inspect(value, false, _node.firstChild // TODO Do this better.
          && _node.firstChild.classList
          && _node.firstChild.classList.contains("observablehq--expanded"), name);
      value.classList.add("observablehq--inspect");
    }
    _node.classList.remove("observablehq--running", "observablehq--error");
    if (_node.firstChild !== value) {
      if (_node.firstChild) {
        while (_node.lastChild !== _node.firstChild) _node.removeChild(_node.lastChild);
        _node.replaceChild(value, _node.firstChild);
      } else {
        _node.appendChild(value);
      }
    }
    dispatch(_node, "update");
  }
  rejected(error, name) {
    const {_node} = this;
    _node.classList.remove("observablehq--running");
    _node.classList.add("observablehq--error");
    while (_node.lastChild) _node.removeChild(_node.lastChild);
    var div = document.createElement("div");
    div.className = "observablehq--inspect";
    if (name) div.appendChild(inspectName(name));
    div.appendChild(document.createTextNode((error + "").replace(LOCATION_MATCH, "")));
    _node.appendChild(div);
    dispatch(_node, "error", {error: error});
  }
}

Inspector.into = function(container) {
  if (typeof container === "string") {
    container = document.querySelector(container);
    if (container == null) throw new Error("container not found");
  }
  return function() {
    return new Inspector(container.appendChild(document.createElement("div")));
  };
};

// Returns true if the given value is something that should be added to the DOM
// by the inspector, rather than being inspected. This deliberately excludes
// DocumentFragment since appending a fragment “dissolves” (mutates) the
// fragment, and we wish for the inspector to not have side-effects. Also,
// HTMLElement.prototype is an instanceof Element, but not an element!
function isnode(value) {
  return (value instanceof Element || value instanceof Text)
      && (value instanceof value.constructor);
}

function RuntimeError(message, input) {
  this.message = message + "";
  this.input = input;
}

RuntimeError.prototype = Object.create(Error.prototype);
RuntimeError.prototype.name = "RuntimeError";
RuntimeError.prototype.constructor = RuntimeError;

function generatorish(value) {
  return value
      && typeof value.next === "function"
      && typeof value.return === "function";
}

function load(notebook, library, observer) {
  if (typeof library == "function") observer = library, library = null;
  if (typeof observer !== "function") throw new Error("invalid observer");
  if (library == null) library = new Library();

  const {modules, id} = notebook;
  const map = new Map;
  const runtime = new Runtime(library);
  const main = runtime_module(id);

  function runtime_module(id) {
    let module = map.get(id);
    if (!module) map.set(id, module = runtime.module());
    return module;
  }

  for (const m of modules) {
    const module = runtime_module(m.id);
    let i = 0;
    for (const v of m.variables) {
      if (v.from) module.import(v.remote, v.name, runtime_module(v.from));
      else if (module === main) module.variable(observer(v, i, m.variables)).define(v.name, v.inputs, v.value);
      else module.define(v.name, v.inputs, v.value);
      ++i;
    }
  }

  return runtime;
}

var prototype = Array.prototype;
var map = prototype.map;
var forEach = prototype.forEach;

function constant(x) {
  return function() {
    return x;
  };
}

function identity$1(x) {
  return x;
}

function rethrow(e) {
  return function() {
    throw e;
  };
}

function noop() {}

var TYPE_NORMAL = 1; // a normal variable
var TYPE_IMPLICIT = 2; // created on reference
var TYPE_DUPLICATE = 3; // created on duplicate definition

var no_observer = {};

function Variable(type, module, observer) {
  if (!observer) observer = no_observer;
  Object.defineProperties(this, {
    _observer: {value: observer, writable: true},
    _definition: {value: variable_undefined, writable: true},
    _duplicate: {value: undefined, writable: true},
    _duplicates: {value: undefined, writable: true},
    _indegree: {value: NaN, writable: true}, // The number of computing inputs.
    _inputs: {value: [], writable: true},
    _invalidate: {value: noop, writable: true},
    _module: {value: module},
    _name: {value: null, writable: true},
    _outputs: {value: new Set, writable: true},
    _promise: {value: Promise.resolve(undefined), writable: true},
    _reachable: {value: observer !== no_observer, writable: true}, // Is this variable transitively visible?
    _rejector: {value: variable_rejector(this)},
    _type: {value: type},
    _value: {value: undefined, writable: true},
    _version: {value: 0, writable: true}
  });
}

Object.defineProperties(Variable.prototype, {
  _pending: {value: variable_pending, writable: true, configurable: true},
  _fulfilled: {value: variable_fulfilled, writable: true, configurable: true},
  _rejected: {value: variable_rejected, writable: true, configurable: true},
  define: {value: variable_define, writable: true, configurable: true},
  delete: {value: variable_delete, writable: true, configurable: true},
  import: {value: variable_import, writable: true, configurable: true}
});

function variable_attach(variable) {
  variable._module._runtime._dirty.add(variable);
  variable._outputs.add(this);
}

function variable_detach(variable) {
  variable._module._runtime._dirty.add(variable);
  variable._outputs.delete(this);
}

function variable_undefined() {
  throw variable_undefined;
}

function variable_stale() {
  throw variable_stale;
}

function variable_rejector(variable) {
  return function(error) {
    if (error === variable_stale) throw error;
    if (error === variable_undefined) throw new RuntimeError(variable._name + " is not defined", variable._name);
    if (error instanceof Error && error.message) throw new RuntimeError(error.message, variable._name);
    throw new RuntimeError(variable._name + " could not be resolved", variable._name);
  };
}

function variable_duplicate(name) {
  return function() {
    throw new RuntimeError(name + " is defined more than once");
  };
}

function variable_define(name, inputs, definition) {
  switch (arguments.length) {
    case 1: {
      definition = name, name = inputs = null;
      break;
    }
    case 2: {
      definition = inputs;
      if (typeof name === "string") inputs = null;
      else inputs = name, name = null;
      break;
    }
  }
  return variable_defineImpl.call(this,
    name == null ? null : name + "",
    inputs == null ? [] : map.call(inputs, this._module._resolve, this._module),
    typeof definition === "function" ? definition : constant(definition)
  );
}

function variable_defineImpl(name, inputs, definition) {
  var scope = this._module._scope, runtime = this._module._runtime;

  this._inputs.forEach(variable_detach, this);
  inputs.forEach(variable_attach, this);
  this._inputs = inputs;
  this._definition = definition;
  this._value = undefined;

  // Is this an active variable (that may require disposal)?
  if (definition === noop) runtime._variables.delete(this);
  else runtime._variables.add(this);

  // Did the variable’s name change? Time to patch references!
  if (name !== this._name || scope.get(name) !== this) {
    var error, found;

    if (this._name) { // Did this variable previously have a name?
      if (this._outputs.size) { // And did other variables reference this variable?
        scope.delete(this._name);
        found = this._module._resolve(this._name);
        found._outputs = this._outputs, this._outputs = new Set;
        found._outputs.forEach(function(output) { output._inputs[output._inputs.indexOf(this)] = found; }, this);
        found._outputs.forEach(runtime._updates.add, runtime._updates);
        runtime._dirty.add(found).add(this);
        scope.set(this._name, found);
      } else if ((found = scope.get(this._name)) === this) { // Do no other variables reference this variable?
        scope.delete(this._name); // It’s safe to delete!
      } else if (found._type === TYPE_DUPLICATE) { // Do other variables assign this name?
        found._duplicates.delete(this); // This variable no longer assigns this name.
        this._duplicate = undefined;
        if (found._duplicates.size === 1) { // Is there now only one variable assigning this name?
          found = found._duplicates.keys().next().value; // Any references are now fixed!
          error = scope.get(this._name);
          found._outputs = error._outputs, error._outputs = new Set;
          found._outputs.forEach(function(output) { output._inputs[output._inputs.indexOf(error)] = found; });
          found._definition = found._duplicate, found._duplicate = undefined;
          runtime._dirty.add(error).add(found);
          runtime._updates.add(found);
          scope.set(this._name, found);
        }
      } else {
        throw new Error;
      }
    }

    if (this._outputs.size) throw new Error;

    if (name) { // Does this variable have a new name?
      if (found = scope.get(name)) { // Do other variables reference or assign this name?
        if (found._type === TYPE_DUPLICATE) { // Do multiple other variables already define this name?
          this._definition = variable_duplicate(name), this._duplicate = definition;
          found._duplicates.add(this);
        } else if (found._type === TYPE_IMPLICIT) { // Are the variable references broken?
          this._outputs = found._outputs, found._outputs = new Set; // Now they’re fixed!
          this._outputs.forEach(function(output) { output._inputs[output._inputs.indexOf(found)] = this; }, this);
          runtime._dirty.add(found).add(this);
          scope.set(name, this);
        } else { // Does another variable define this name?
          found._duplicate = found._definition, this._duplicate = definition; // Now they’re duplicates.
          error = new Variable(TYPE_DUPLICATE, this._module);
          error._name = name;
          error._definition = this._definition = found._definition = variable_duplicate(name);
          error._outputs = found._outputs, found._outputs = new Set;
          error._outputs.forEach(function(output) { output._inputs[output._inputs.indexOf(found)] = error; });
          error._duplicates = new Set([this, found]);
          runtime._dirty.add(found).add(error);
          runtime._updates.add(found).add(error);
          scope.set(name, error);
        }
      } else {
        scope.set(name, this);
      }
    }

    this._name = name;
  }

  // If this redefined variable was previously evaluated, invalidate it. (If the
  // variable was never evaluated, then the invalidated value could never have
  // been exposed and we can avoid this extra work.)
  if (this._version > 0) ++this._version;

  runtime._updates.add(this);
  runtime._compute();
  return this;
}

function variable_import(remote, name, module) {
  if (arguments.length < 3) module = name, name = remote;
  return variable_defineImpl.call(this, name + "", [module._resolve(remote + "")], identity$1);
}

function variable_delete() {
  return variable_defineImpl.call(this, null, [], noop);
}

function variable_pending() {
  if (this._observer.pending) this._observer.pending();
}

function variable_fulfilled(value) {
  if (this._observer.fulfilled) this._observer.fulfilled(value, this._name);
}

function variable_rejected(error) {
  if (this._observer.rejected) this._observer.rejected(error, this._name);
}

function Module(runtime, builtins = []) {
  Object.defineProperties(this, {
    _runtime: {value: runtime},
    _scope: {value: new Map},
    _builtins: {value: new Map([
      ["invalidation", variable_invalidation],
      ["visibility", variable_visibility],
      ...builtins
    ])},
    _source: {value: null, writable: true}
  });
}

Object.defineProperties(Module.prototype, {
  _copy: {value: module_copy, writable: true, configurable: true},
  _resolve: {value: module_resolve, writable: true, configurable: true},
  redefine: {value: module_redefine, writable: true, configurable: true},
  define: {value: module_define, writable: true, configurable: true},
  derive: {value: module_derive, writable: true, configurable: true},
  import: {value: module_import, writable: true, configurable: true},
  value: {value: module_value, writable: true, configurable: true},
  variable: {value: module_variable, writable: true, configurable: true},
  builtin: {value: module_builtin, writable: true, configurable: true}
});

function module_redefine(name) {
  var v = this._scope.get(name);
  if (!v) throw new RuntimeError(name + " is not defined");
  if (v._type === TYPE_DUPLICATE) throw new RuntimeError(name + " is defined more than once");
  return v.define.apply(v, arguments);
}

function module_define() {
  var v = new Variable(TYPE_NORMAL, this);
  return v.define.apply(v, arguments);
}

function module_import() {
  var v = new Variable(TYPE_NORMAL, this);
  return v.import.apply(v, arguments);
}

function module_variable(observer) {
  return new Variable(TYPE_NORMAL, this, observer);
}

async function module_value(name) {
  var v = this._scope.get(name);
  if (!v) throw new RuntimeError(name + " is not defined");
  if (v._observer === no_observer) {
    v = this.variable(true).define([name], identity$1);
    try {
      return await module_revalue(this._runtime, v);
    } finally {
      v.delete();
    }
  } else {
    return module_revalue(this._runtime, v);
  }
}

// If the variable is redefined before its value resolves, try again.
async function module_revalue(runtime, variable) {
  await runtime._compute();
  try {
    return await variable._promise;
  } catch (error) {
    if (error === variable_stale) return module_revalue(runtime, variable);
    throw error;
  }
}

function module_derive(injects, injectModule) {
  var copy = new Module(this._runtime, this._builtins);
  copy._source = this;
  forEach.call(injects, function(inject) {
    if (typeof inject !== "object") inject = {name: inject + ""};
    if (inject.alias == null) inject.alias = inject.name;
    copy.import(inject.name, inject.alias, injectModule);
  });
  Promise.resolve().then(() => {
    const modules = new Set([this]);
    for (const module of modules) {
      for (const variable of module._scope.values()) {
        if (variable._definition === identity$1) { // import
          const module = variable._inputs[0]._module;
          const source = module._source || module;
          if (source === this) { // circular import-with!
            console.warn("circular module definition; ignoring"); // eslint-disable-line no-console
            return;
          }
          modules.add(source);
        }
      }
    }
    this._copy(copy, new Map);
  });
  return copy;
}

function module_copy(copy, map) {
  copy._source = this;
  map.set(this, copy);
  for (const [name, source] of this._scope) {
    var target = copy._scope.get(name);
    if (target && target._type === TYPE_NORMAL) continue; // injection
    if (source._definition === identity$1) { // import
      var sourceInput = source._inputs[0],
          sourceModule = sourceInput._module;
      copy.import(sourceInput._name, name, map.get(sourceModule)
        || (sourceModule._source
           ? sourceModule._copy(new Module(copy._runtime, copy._builtins), map) // import-with
           : sourceModule));
    } else {
      copy.define(name, source._inputs.map(variable_name), source._definition);
    }
  }
  return copy;
}

function module_resolve(name) {
  var variable = this._scope.get(name), value;
  if (!variable) {
    variable = new Variable(TYPE_IMPLICIT, this);
    if (this._builtins.has(name)) {
      variable.define(name, constant(this._builtins.get(name)));
    } else if (this._runtime._builtin._scope.has(name)) {
      variable.import(name, this._runtime._builtin);
    } else {
      try {
        value = this._runtime._global(name);
      } catch (error) {
        return variable.define(name, rethrow(error));
      }
      if (value === undefined) {
        this._scope.set(variable._name = name, variable);
      } else {
        variable.define(name, constant(value));
      }
    }
  }
  return variable;
}

function module_builtin(name, value) {
  this._builtins.set(name, value);
}

function variable_name(variable) {
  return variable._name;
}

const frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame
  : typeof setImmediate === "function" ? setImmediate
  : f => setTimeout(f, 0);

var variable_invalidation = {};
var variable_visibility = {};

function Runtime(builtins = new Library, global = window_global) {
  var builtin = this.module();
  Object.defineProperties(this, {
    _dirty: {value: new Set},
    _updates: {value: new Set},
    _precomputes: {value: [], writable: true},
    _computing: {value: null, writable: true},
    _init: {value: null, writable: true},
    _modules: {value: new Map},
    _variables: {value: new Set},
    _disposed: {value: false, writable: true},
    _builtin: {value: builtin},
    _global: {value: global}
  });
  if (builtins) for (var name in builtins) {
    (new Variable(TYPE_IMPLICIT, builtin)).define(name, [], builtins[name]);
  }
}

Object.defineProperties(Runtime, {
  load: {value: load, writable: true, configurable: true}
});

Object.defineProperties(Runtime.prototype, {
  _precompute: {value: runtime_precompute, writable: true, configurable: true},
  _compute: {value: runtime_compute, writable: true, configurable: true},
  _computeSoon: {value: runtime_computeSoon, writable: true, configurable: true},
  _computeNow: {value: runtime_computeNow, writable: true, configurable: true},
  dispose: {value: runtime_dispose, writable: true, configurable: true},
  module: {value: runtime_module, writable: true, configurable: true},
  fileAttachments: {value: FileAttachments, writable: true, configurable: true}
});

function runtime_dispose() {
  this._computing = Promise.resolve();
  this._disposed = true;
  this._variables.forEach(v => {
    v._invalidate();
    v._version = NaN;
  });
}

function runtime_module(define, observer = noop) {
  let module;
  if (define === undefined) {
    if (module = this._init) {
      this._init = null;
      return module;
    }
    return new Module(this);
  }
  module = this._modules.get(define);
  if (module) return module;
  this._init = module = new Module(this);
  this._modules.set(define, module);
  try {
    define(this, observer);
  } finally {
    this._init = null;
  }
  return module;
}

function runtime_precompute(callback) {
  this._precomputes.push(callback);
  this._compute();
}

function runtime_compute() {
  return this._computing || (this._computing = this._computeSoon());
}

function runtime_computeSoon() {
  return new Promise(frame).then(() => this._disposed ? undefined : this._computeNow());
}

async function runtime_computeNow() {
  var queue = [],
      variables,
      variable,
      precomputes = this._precomputes;

  // If there are any paused generators, resume them before computing so they
  // can update (if synchronous) before computing downstream variables.
  if (precomputes.length) {
    this._precomputes = [];
    for (const callback of precomputes) callback();
    await runtime_defer(3);
  }

  // Compute the reachability of the transitive closure of dirty variables.
  // Any newly-reachable variable must also be recomputed.
  // Any no-longer-reachable variable must be terminated.
  variables = new Set(this._dirty);
  variables.forEach(function(variable) {
    variable._inputs.forEach(variables.add, variables);
    const reachable = variable_reachable(variable);
    if (reachable > variable._reachable) {
      this._updates.add(variable);
    } else if (reachable < variable._reachable) {
      variable._invalidate();
    }
    variable._reachable = reachable;
  }, this);

  // Compute the transitive closure of updating, reachable variables.
  variables = new Set(this._updates);
  variables.forEach(function(variable) {
    if (variable._reachable) {
      variable._indegree = 0;
      variable._outputs.forEach(variables.add, variables);
    } else {
      variable._indegree = NaN;
      variables.delete(variable);
    }
  });

  this._computing = null;
  this._updates.clear();
  this._dirty.clear();

  // Compute the indegree of updating variables.
  variables.forEach(function(variable) {
    variable._outputs.forEach(variable_increment);
  });

  do {
    // Identify the root variables (those with no updating inputs).
    variables.forEach(function(variable) {
      if (variable._indegree === 0) {
        queue.push(variable);
      }
    });

    // Compute the variables in topological order.
    while (variable = queue.pop()) {
      variable_compute(variable);
      variable._outputs.forEach(postqueue);
      variables.delete(variable);
    }

    // Any remaining variables are circular, or depend on them.
    variables.forEach(function(variable) {
      if (variable_circular(variable)) {
        variable_error(variable, new RuntimeError("circular definition"));
        variable._outputs.forEach(variable_decrement);
        variables.delete(variable);
      }
    });
  } while (variables.size);

  function postqueue(variable) {
    if (--variable._indegree === 0) {
      queue.push(variable);
    }
  }
}

// We want to give generators, if they’re defined synchronously, a chance to
// update before computing downstream variables. This creates a synchronous
// promise chain of the given depth that we’ll await before recomputing
// downstream variables.
function runtime_defer(depth = 0) {
  let p = Promise.resolve();
  for (let i = 0; i < depth; ++i) p = p.then(() => {});
  return p;
}

function variable_circular(variable) {
  const inputs = new Set(variable._inputs);
  for (const i of inputs) {
    if (i === variable) return true;
    i._inputs.forEach(inputs.add, inputs);
  }
  return false;
}

function variable_increment(variable) {
  ++variable._indegree;
}

function variable_decrement(variable) {
  --variable._indegree;
}

function variable_value(variable) {
  return variable._promise.catch(variable._rejector);
}

function variable_invalidator(variable) {
  return new Promise(function(resolve) {
    variable._invalidate = resolve;
  });
}

function variable_intersector(invalidation, variable) {
  let node = typeof IntersectionObserver === "function" && variable._observer && variable._observer._node;
  let visible = !node, resolve = noop, reject = noop, promise, observer;
  if (node) {
    observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting) && (promise = null, resolve()));
    observer.observe(node);
    invalidation.then(() => (observer.disconnect(), observer = null, reject()));
  }
  return function(value) {
    if (visible) return Promise.resolve(value);
    if (!observer) return Promise.reject();
    if (!promise) promise = new Promise((y, n) => (resolve = y, reject = n));
    return promise.then(() => value);
  };
}

function variable_compute(variable) {
  variable._invalidate();
  variable._invalidate = noop;
  variable._pending();

  const value0 = variable._value;
  const version = ++variable._version;

  // Lazily-constructed invalidation variable; only constructed if referenced as an input.
  let invalidation = null;

  // If the variable doesn’t have any inputs, we can optimize slightly.
  const promise = variable._promise = (variable._inputs.length
      ? Promise.all(variable._inputs.map(variable_value)).then(define)
      : new Promise(resolve => resolve(variable._definition.call(value0))))
    .then(generate);

  // Compute the initial value of the variable.
  function define(inputs) {
    if (variable._version !== version) throw variable_stale;

    // Replace any reference to invalidation with the promise, lazily.
    for (var i = 0, n = inputs.length; i < n; ++i) {
      switch (inputs[i]) {
        case variable_invalidation: {
          inputs[i] = invalidation = variable_invalidator(variable);
          break;
        }
        case variable_visibility: {
          if (!invalidation) invalidation = variable_invalidator(variable);
          inputs[i] = variable_intersector(invalidation, variable);
          break;
        }
      }
    }

    return variable._definition.apply(value0, inputs);
  }

  // If the value is a generator, then retrieve its first value, and dispose of
  // the generator if the variable is invalidated. Note that the cell may
  // already have been invalidated here, in which case we need to terminate the
  // generator immediately!
  function generate(value) {
    if (variable._version !== version) throw variable_stale;
    if (generatorish(value)) {
      (invalidation || variable_invalidator(variable)).then(variable_return(value));
      return variable_generate(variable, version, value);
    }
    return value;
  }

  promise.then((value) => {
    variable._value = value;
    variable._fulfilled(value);
  }, (error) => {
    if (error === variable_stale) return;
    variable._value = undefined;
    variable._rejected(error);
  });
}

function variable_generate(variable, version, generator) {
  const runtime = variable._module._runtime;
  let currentValue; // so that yield resolves to the yielded value

  // Retrieve the next value from the generator; if successful, invoke the
  // specified callback. The returned promise resolves to the yielded value, or
  // to undefined if the generator is done.
  function compute(onfulfilled) {
    return new Promise(resolve => resolve(generator.next(currentValue))).then(({done, value}) => {
      return done ? undefined : Promise.resolve(value).then(onfulfilled);
    });
  }

  // Retrieve the next value from the generator; if successful, fulfill the
  // variable, compute downstream variables, and schedule the next value to be
  // pulled from the generator at the start of the next animation frame. If not
  // successful, reject the variable, compute downstream variables, and return.
  function recompute() {
    const promise = compute((value) => {
      if (variable._version !== version) throw variable_stale;
      currentValue = value;
      postcompute(value, promise).then(() => runtime._precompute(recompute));
      variable._fulfilled(value);
      return value;
    });
    promise.catch((error) => {
      if (error === variable_stale) throw error;
      if (variable._version !== version) throw variable_stale;
      postcompute(undefined, promise);
      variable._rejected(error);
    });
  }

  // After the generator fulfills or rejects, set its current value, promise,
  // and schedule any downstream variables for update.
  function postcompute(value, promise) {
    variable._value = value;
    variable._promise = promise;
    variable._outputs.forEach(runtime._updates.add, runtime._updates);
    return runtime._compute();
  }

  // When retrieving the first value from the generator, the promise graph is
  // already established, so we only need to queue the next pull.
  return compute((value) => {
    if (variable._version !== version) throw variable_stale;
    currentValue = value;
    runtime._precompute(recompute);
    return value;
  });
}

function variable_error(variable, error) {
  variable._invalidate();
  variable._invalidate = noop;
  variable._pending();
  ++variable._version;
  variable._indegree = NaN;
  (variable._promise = Promise.reject(error)).catch(noop);
  variable._value = undefined;
  variable._rejected(error);
}

function variable_return(generator) {
  return function() {
    generator.return();
  };
}

function variable_reachable(variable) {
  if (variable._observer !== no_observer) return true; // Directly reachable.
  var outputs = new Set(variable._outputs);
  for (const output of outputs) {
    if (output._observer !== no_observer) return true;
    output._outputs.forEach(outputs.add, outputs);
  }
  return false;
}

function window_global(name) {
  return window[name];
}

function renderHtml(string) {
  const template = document.createElement("template");
  template.innerHTML = string;
  return document.importNode(template.content, true);
}

function renderSvg(string) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.innerHTML = string;
  return g;
}

const html = Object.assign(hypertext(renderHtml, fragment => {
  if (fragment.firstChild === null) return null;
  if (fragment.firstChild === fragment.lastChild) return fragment.removeChild(fragment.firstChild);
  const span = document.createElement("span");
  span.appendChild(fragment);
  return span;
}), {fragment: hypertext(renderHtml, fragment => fragment)});

Object.assign(hypertext(renderSvg, g => {
  if (g.firstChild === null) return null;
  if (g.firstChild === g.lastChild) return g.removeChild(g.firstChild);
  return g;
}), {fragment: hypertext(renderSvg, g => {
  const fragment = document.createDocumentFragment();
  while (g.firstChild) fragment.appendChild(g.firstChild);
  return fragment;
})});

const
CODE_TAB = 9,
CODE_LF = 10,
CODE_FF = 12,
CODE_CR = 13,
CODE_SPACE = 32,
CODE_UPPER_A = 65,
CODE_UPPER_Z = 90,
CODE_LOWER_A = 97,
CODE_LOWER_Z = 122,
CODE_LT = 60,
CODE_GT = 62,
CODE_SLASH = 47,
CODE_DASH = 45,
CODE_BANG = 33,
CODE_EQ = 61,
CODE_DQUOTE = 34,
CODE_SQUOTE = 39,
CODE_QUESTION = 63,
STATE_DATA = 1,
STATE_TAG_OPEN = 2,
STATE_END_TAG_OPEN = 3,
STATE_TAG_NAME = 4,
STATE_BOGUS_COMMENT = 5,
STATE_BEFORE_ATTRIBUTE_NAME = 6,
STATE_AFTER_ATTRIBUTE_NAME = 7,
STATE_ATTRIBUTE_NAME = 8,
STATE_BEFORE_ATTRIBUTE_VALUE = 9,
STATE_ATTRIBUTE_VALUE_DOUBLE_QUOTED = 10,
STATE_ATTRIBUTE_VALUE_SINGLE_QUOTED = 11,
STATE_ATTRIBUTE_VALUE_UNQUOTED = 12,
STATE_AFTER_ATTRIBUTE_VALUE_QUOTED = 13,
STATE_SELF_CLOSING_START_TAG = 14,
STATE_COMMENT_START = 15,
STATE_COMMENT_START_DASH = 16,
STATE_COMMENT = 17,
STATE_COMMENT_LESS_THAN_SIGN = 18,
STATE_COMMENT_LESS_THAN_SIGN_BANG = 19,
STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH = 20,
STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH = 21,
STATE_COMMENT_END_DASH = 22,
STATE_COMMENT_END = 23,
STATE_COMMENT_END_BANG = 24,
STATE_MARKUP_DECLARATION_OPEN = 25,
STATE_RAWTEXT = 26,
STATE_RAWTEXT_LESS_THAN_SIGN = 27,
STATE_RAWTEXT_END_TAG_OPEN = 28,
STATE_RAWTEXT_END_TAG_NAME = 29,
SHOW_COMMENT = 128,
SHOW_ELEMENT = 1,
TYPE_COMMENT = 8,
TYPE_ELEMENT = 1,
NS_SVG = "http://www.w3.org/2000/svg",
NS_XLINK = "http://www.w3.org/1999/xlink",
NS_XML = "http://www.w3.org/XML/1998/namespace",
NS_XMLNS = "http://www.w3.org/2000/xmlns/";

const svgAdjustAttributes = new Map([
  "attributeName",
  "attributeType",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "clipPathUnits",
  "diffuseConstant",
  "edgeMode",
  "filterUnits",
  "glyphRef",
  "gradientTransform",
  "gradientUnits",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "markerUnits",
  "markerWidth",
  "maskContentUnits",
  "maskUnits",
  "numOctaves",
  "pathLength",
  "patternContentUnits",
  "patternTransform",
  "patternUnits",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "preserveAspectRatio",
  "primitiveUnits",
  "refX",
  "refY",
  "repeatCount",
  "repeatDur",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewBox",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan"
].map(name => [name.toLowerCase(), name]));

const svgForeignAttributes = new Map([
  ["xlink:actuate", NS_XLINK],
  ["xlink:arcrole", NS_XLINK],
  ["xlink:href", NS_XLINK],
  ["xlink:role", NS_XLINK],
  ["xlink:show", NS_XLINK],
  ["xlink:title", NS_XLINK],
  ["xlink:type", NS_XLINK],
  ["xml:lang", NS_XML],
  ["xml:space", NS_XML],
  ["xmlns", NS_XMLNS],
  ["xmlns:xlink", NS_XMLNS]
]);

function hypertext(render, postprocess) {
  return function({raw: strings}) {
    let state = STATE_DATA;
    let string = "";
    let tagNameStart; // either an open tag or an end tag
    let tagName; // only open; beware nesting! used only for rawtext
    let attributeNameStart;
    let attributeNameEnd;
    let nodeFilter = 0;

    for (let j = 0, m = arguments.length; j < m; ++j) {
      const input = strings[j];

      if (j > 0) {
        const value = arguments[j];
        switch (state) {
          case STATE_RAWTEXT: {
            if (value != null) {
              const text = `${value}`;
              if (isEscapableRawText(tagName)) {
                string += text.replace(/[<]/g, entity);
              } else if (new RegExp(`</${tagName}[\\s>/]`, "i").test(string.slice(-tagName.length - 2) + text)) {
                throw new Error("unsafe raw text"); // appropriate end tag
              } else {
                string += text;
              }
            }
            break;
          }
          case STATE_DATA: {
            if (value == null) ; else if (value instanceof Node
                || (typeof value !== "string" && value[Symbol.iterator])
                || (/(?:^|>)$/.test(strings[j - 1]) && /^(?:<|$)/.test(input))) {
              string += "<!--::" + j + "-->";
              nodeFilter |= SHOW_COMMENT;
            } else {
              string += `${value}`.replace(/[<&]/g, entity);
            }
            break;
          }
          case STATE_BEFORE_ATTRIBUTE_VALUE: {
            state = STATE_ATTRIBUTE_VALUE_UNQUOTED;
            let text;
            if (/^[\s>]/.test(input)) {
              if (value == null || value === false) {
                string = string.slice(0, attributeNameStart - strings[j - 1].length);
                break;
              }
              if (value === true || (text = `${value}`) === "") {
                string += "''";
                break;
              }
              const name = strings[j - 1].slice(attributeNameStart, attributeNameEnd);
              if ((name === "style" && isObjectLiteral(value)) || typeof value === "function") {
                string += "::" + j;
                nodeFilter |= SHOW_ELEMENT;
                break;
              }
            }
            if (text === undefined) text = `${value}`;
            if (text === "") throw new Error("unsafe unquoted empty string");
            string += text.replace(/^['"]|[\s>&]/g, entity);
            break;
          }
          case STATE_ATTRIBUTE_VALUE_UNQUOTED: {
            string += `${value}`.replace(/[\s>&]/g, entity);
            break;
          }
          case STATE_ATTRIBUTE_VALUE_SINGLE_QUOTED: {
            string += `${value}`.replace(/['&]/g, entity);
            break;
          }
          case STATE_ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
            string += `${value}`.replace(/["&]/g, entity);
            break;
          }
          case STATE_BEFORE_ATTRIBUTE_NAME: {
            if (isObjectLiteral(value)) {
              string += "::" + j + "=''";
              nodeFilter |= SHOW_ELEMENT;
              break;
            }
            throw new Error("invalid binding");
          }
          case STATE_COMMENT: break;
          default: throw new Error("invalid binding");
        }
      }

      for (let i = 0, n = input.length; i < n; ++i) {
        const code = input.charCodeAt(i);

        switch (state) {
          case STATE_DATA: {
            if (code === CODE_LT) {
              state = STATE_TAG_OPEN;
            }
            break;
          }
          case STATE_TAG_OPEN: {
            if (code === CODE_BANG) {
              state = STATE_MARKUP_DECLARATION_OPEN;
            } else if (code === CODE_SLASH) {
              state = STATE_END_TAG_OPEN;
            } else if (isAsciiAlphaCode(code)) {
              tagNameStart = i, tagName = undefined;
              state = STATE_TAG_NAME, --i;
            } else if (code === CODE_QUESTION) {
              state = STATE_BOGUS_COMMENT, --i;
            } else {
              state = STATE_DATA, --i;
            }
            break;
          }
          case STATE_END_TAG_OPEN: {
            if (isAsciiAlphaCode(code)) {
              state = STATE_TAG_NAME, --i;
            } else if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_BOGUS_COMMENT, --i;
            }
            break;
          }
          case STATE_TAG_NAME: {
            if (isSpaceCode(code)) {
              state = STATE_BEFORE_ATTRIBUTE_NAME;
              tagName = lower(input, tagNameStart, i);
            } else if (code === CODE_SLASH) {
              state = STATE_SELF_CLOSING_START_TAG;
            } else if (code === CODE_GT) {
              tagName = lower(input, tagNameStart, i);
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            }
            break;
          }
          case STATE_BEFORE_ATTRIBUTE_NAME: {
            if (isSpaceCode(code)) ; else if (code === CODE_SLASH || code === CODE_GT) {
              state = STATE_AFTER_ATTRIBUTE_NAME, --i;
            } else if (code === CODE_EQ) {
              state = STATE_ATTRIBUTE_NAME;
              attributeNameStart = i + 1, attributeNameEnd = undefined;
            } else {
              state = STATE_ATTRIBUTE_NAME, --i;
              attributeNameStart = i + 1, attributeNameEnd = undefined;
            }
            break;
          }
          case STATE_ATTRIBUTE_NAME: {
            if (isSpaceCode(code) || code === CODE_SLASH || code === CODE_GT) {
              state = STATE_AFTER_ATTRIBUTE_NAME, --i;
              attributeNameEnd = i;
            } else if (code === CODE_EQ) {
              state = STATE_BEFORE_ATTRIBUTE_VALUE;
              attributeNameEnd = i;
            }
            break;
          }
          case STATE_AFTER_ATTRIBUTE_NAME: {
            if (isSpaceCode(code)) ; else if (code === CODE_SLASH) {
              state = STATE_SELF_CLOSING_START_TAG;
            } else if (code === CODE_EQ) {
              state = STATE_BEFORE_ATTRIBUTE_VALUE;
            } else if (code === CODE_GT) {
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            } else {
              state = STATE_ATTRIBUTE_NAME, --i;
              attributeNameStart = i + 1, attributeNameEnd = undefined;
            }
            break;
          }
          case STATE_BEFORE_ATTRIBUTE_VALUE: {
            if (isSpaceCode(code)) ; else if (code === CODE_DQUOTE) {
              state = STATE_ATTRIBUTE_VALUE_DOUBLE_QUOTED;
            } else if (code === CODE_SQUOTE) {
              state = STATE_ATTRIBUTE_VALUE_SINGLE_QUOTED;
            } else if (code === CODE_GT) {
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            } else {
              state = STATE_ATTRIBUTE_VALUE_UNQUOTED, --i;
            }
            break;
          }
          case STATE_ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
            if (code === CODE_DQUOTE) {
              state = STATE_AFTER_ATTRIBUTE_VALUE_QUOTED;
            }
            break;
          }
          case STATE_ATTRIBUTE_VALUE_SINGLE_QUOTED: {
            if (code === CODE_SQUOTE) {
              state = STATE_AFTER_ATTRIBUTE_VALUE_QUOTED;
            }
            break;
          }
          case STATE_ATTRIBUTE_VALUE_UNQUOTED: {
            if (isSpaceCode(code)) {
              state = STATE_BEFORE_ATTRIBUTE_NAME;
            } else if (code === CODE_GT) {
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            }
            break;
          }
          case STATE_AFTER_ATTRIBUTE_VALUE_QUOTED: {
            if (isSpaceCode(code)) {
              state = STATE_BEFORE_ATTRIBUTE_NAME;
            } else if (code === CODE_SLASH) {
              state = STATE_SELF_CLOSING_START_TAG;
            } else if (code === CODE_GT) {
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            } else {
              state = STATE_BEFORE_ATTRIBUTE_NAME, --i;
            }
            break;
          }
          case STATE_SELF_CLOSING_START_TAG: {
            if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_BEFORE_ATTRIBUTE_NAME, --i;
            }
            break;
          }
          case STATE_BOGUS_COMMENT: {
            if (code === CODE_GT) {
              state = STATE_DATA;
            }
            break;
          }
          case STATE_COMMENT_START: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_START_DASH;
            } else if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_COMMENT, --i;
            }
            break;
          }
          case STATE_COMMENT_START_DASH: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_END;
            } else if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_COMMENT, --i;
            }
            break;
          }
          case STATE_COMMENT: {
            if (code === CODE_LT) {
              state = STATE_COMMENT_LESS_THAN_SIGN;
            } else if (code === CODE_DASH) {
              state = STATE_COMMENT_END_DASH;
            }
            break;
          }
          case STATE_COMMENT_LESS_THAN_SIGN: {
            if (code === CODE_BANG) {
              state = STATE_COMMENT_LESS_THAN_SIGN_BANG;
            } else if (code !== CODE_LT) {
              state = STATE_COMMENT, --i;
            }
            break;
          }
          case STATE_COMMENT_LESS_THAN_SIGN_BANG: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH;
            } else {
              state = STATE_COMMENT, --i;
            }
            break;
          }
          case STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
            } else {
              state = STATE_COMMENT_END, --i;
            }
            break;
          }
          case STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH: {
            state = STATE_COMMENT_END, --i;
            break;
          }
          case STATE_COMMENT_END_DASH: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_END;
            } else {
              state = STATE_COMMENT, --i;
            }
            break;
          }
          case STATE_COMMENT_END: {
            if (code === CODE_GT) {
              state = STATE_DATA;
            } else if (code === CODE_BANG) {
              state = STATE_COMMENT_END_BANG;
            } else if (code !== CODE_DASH) {
              state = STATE_COMMENT, --i;
            }
            break;
          }
          case STATE_COMMENT_END_BANG: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_END_DASH;
            } else if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_COMMENT, --i;
            }
            break;
          }
          case STATE_MARKUP_DECLARATION_OPEN: {
            if (code === CODE_DASH && input.charCodeAt(i + 1) === CODE_DASH) {
              state = STATE_COMMENT_START, ++i;
            } else { // Note: CDATA and DOCTYPE unsupported!
              state = STATE_BOGUS_COMMENT, --i;
            }
            break;
          }
          case STATE_RAWTEXT: {
            if (code === CODE_LT) {
              state = STATE_RAWTEXT_LESS_THAN_SIGN;
            }
            break;
          }
          case STATE_RAWTEXT_LESS_THAN_SIGN: {
            if (code === CODE_SLASH) {
              state = STATE_RAWTEXT_END_TAG_OPEN;
            } else {
              state = STATE_RAWTEXT, --i;
            }
            break;
          }
          case STATE_RAWTEXT_END_TAG_OPEN: {
            if (isAsciiAlphaCode(code)) {
              tagNameStart = i;
              state = STATE_RAWTEXT_END_TAG_NAME, --i;
            } else {
              state = STATE_RAWTEXT, --i;
            }
            break;
          }
          case STATE_RAWTEXT_END_TAG_NAME: {
            if (isSpaceCode(code) && tagName === lower(input, tagNameStart, i)) {
              state = STATE_BEFORE_ATTRIBUTE_NAME;
            } else if (code === CODE_SLASH && tagName === lower(input, tagNameStart, i)) {
              state = STATE_SELF_CLOSING_START_TAG;
            } else if (code === CODE_GT && tagName === lower(input, tagNameStart, i)) {
              state = STATE_DATA;
            } else if (!isAsciiAlphaCode(code)) {
              state = STATE_RAWTEXT, --i;
            }
            break;
          }
          default: {
            state = undefined;
            break;
          }
        }
      }

      string += input;
    }

    const root = render(string);

    const walker = document.createTreeWalker(root, nodeFilter, null, false);
    const removeNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      switch (node.nodeType) {
        case TYPE_ELEMENT: {
          const attributes = node.attributes;
          for (let i = 0, n = attributes.length; i < n; ++i) {
            const {name, value: currentValue} = attributes[i];
            if (/^::/.test(name)) {
              const value = arguments[+name.slice(2)];
              removeAttribute(node, name), --i, --n;
              for (const key in value) {
                const subvalue = value[key];
                if (subvalue == null || subvalue === false) ; else if (typeof subvalue === "function") {
                  node[key] = subvalue;
                } else if (key === "style" && isObjectLiteral(subvalue)) {
                  setStyles(node[key], subvalue);
                } else {
                  setAttribute(node, key, subvalue === true ? "" : subvalue);
                }
              }
            } else if (/^::/.test(currentValue)) {
              const value = arguments[+currentValue.slice(2)];
              removeAttribute(node, name), --i, --n;
              if (typeof value === "function") {
                node[name] = value;
              } else { // style
                setStyles(node[name], value);
              }
            }
          }
          break;
        }
        case TYPE_COMMENT: {
          if (/^::/.test(node.data)) {
            const parent = node.parentNode;
            const value = arguments[+node.data.slice(2)];
            if (value instanceof Node) {
              parent.insertBefore(value, node);
            } else if (typeof value !== "string" && value[Symbol.iterator]) {
              if (value instanceof NodeList || value instanceof HTMLCollection) {
                for (let i = value.length - 1, r = node; i >= 0; --i) {
                  r = parent.insertBefore(value[i], r);
                }
              } else {
                for (const subvalue of value) {
                  if (subvalue == null) continue;
                  parent.insertBefore(subvalue instanceof Node ? subvalue : document.createTextNode(subvalue), node);
                }
              }
            } else {
              parent.insertBefore(document.createTextNode(value), node);
            }
            removeNodes.push(node);
          }
          break;
        }
      }
    }

    for (const node of removeNodes) {
      node.parentNode.removeChild(node);
    }

    return postprocess(root);
  };
}

function entity(character) {
  return `&#${character.charCodeAt(0).toString()};`;
}

function isAsciiAlphaCode(code) {
  return (CODE_UPPER_A <= code && code <= CODE_UPPER_Z)
      || (CODE_LOWER_A <= code && code <= CODE_LOWER_Z);
}

function isSpaceCode(code) {
  return code === CODE_TAB
      || code === CODE_LF
      || code === CODE_FF
      || code === CODE_SPACE
      || code === CODE_CR; // normalize newlines
}

function isObjectLiteral(value) {
  return value && value.toString === Object.prototype.toString;
}

function isRawText(tagName) {
  return tagName === "script" || tagName === "style" || isEscapableRawText(tagName);
}

function isEscapableRawText(tagName) {
  return tagName === "textarea" || tagName === "title";
}

function lower(input, start, end) {
  return input.slice(start, end).toLowerCase();
}

function setAttribute(node, name, value) {
  if (node.namespaceURI === NS_SVG) {
    name = name.toLowerCase();
    name = svgAdjustAttributes.get(name) || name;
    if (svgForeignAttributes.has(name)) {
      node.setAttributeNS(svgForeignAttributes.get(name), name, value);
      return;
    }
  }
  node.setAttribute(name, value);
}

function removeAttribute(node, name) {
  if (node.namespaceURI === NS_SVG) {
    name = name.toLowerCase();
    name = svgAdjustAttributes.get(name) || name;
    if (svgForeignAttributes.has(name)) {
      node.removeAttributeNS(svgForeignAttributes.get(name), name);
      return;
    }
  }
  node.removeAttribute(name);
}

// We can’t use Object.assign because custom properties…
function setStyles(style, values) {
  for (const name in values) {
    const value = values[name];
    if (name.startsWith("--")) style.setProperty(name, value);
    else style[name] = value;
  }
}

function length(x) {
  return x == null ? null : typeof x === "number" ? `${x}px` : `${x}`;
}

const bubbles = {bubbles: true};

function preventDefault(event) {
  event.preventDefault();
}

function dispatchInput({currentTarget}) {
  (currentTarget.form || currentTarget).dispatchEvent(new Event("input", bubbles));
}

function identity(x) {
  return x;
}

let nextId = 0;

function newId() {
  return `__ns__-${++nextId}`;
}

function maybeLabel(label, input) {
  if (!label) return;
  label = html`<label>${label}`;
  if (input !== undefined) label.htmlFor = input.id = newId();
  return label;
}

function button(content = "≡", {
  label = "",
  value,
  reduce,
  disabled,
  required = false,
  width
} = {}) {
  const solitary = typeof content === "string" || content instanceof Node;
  if (solitary) {
    if (!required && value === undefined) value = 0;
    if (reduce === undefined) reduce = (value = 0) => value + 1;
    disabled = new Set(disabled ? [content] : []);
    content = [[content, reduce]];
  } else {
    if (!required && value === undefined) value = null;
    disabled = new Set(disabled === true ? Array.from(content, ([content]) => content) : disabled || undefined);
  }
  const form = html`<form class=__ns__ onsubmit=${preventDefault}>`;
  const style = {width: length(width)};
  const buttons = Array.from(content, ([content, reduce = identity]) => {
    if (typeof reduce !== "function") throw new TypeError("reduce is not a function");
    return html`<button disabled=${disabled.has(content)} style=${style} onclick=${event => {
      form.value = reduce(form.value);
      dispatchInput(event);
    }}>${content}`;
  });
  if (label = maybeLabel(label, solitary ? buttons[0] : undefined)) form.append(label);
  form.append(...buttons);
  form.value = value;
  return form;
}

const formatLocaleAuto = localize(locale => {
  const formatNumber = formatLocaleNumber(locale);
  return value => value == null ? ""
    : typeof value === "number" ? formatNumber(value)
    : value instanceof Date ? formatDate(value)
    : `${value}`;
});

const formatLocaleNumber = localize(locale => {
  return value => value === 0 ? "0" : value.toLocaleString(locale); // handle negative zero
});

formatLocaleAuto();

formatLocaleNumber();

function formatDate(date) {
  return format(date, "Invalid Date");
}

// Memoize the last-returned locale.
function localize(f) {
  let key = localize, value;
  return (locale = "en") => locale === key ? value : (value = f(key = locale));
}

/*
* quarto-inspector.js
*
* Copyright (C) 2022 RStudio, PBC
*
*/

class QuartoInspector extends Inspector {
  constructor(node, cellAst) {
    super(node);
    this._cellAst = cellAst;
  }
  rejected(error) {
    return super.rejected(error);
  }
}

/*global Shiny, $
*
* quarto-observable-shiny.js
*
* Copyright (C) 2022 RStudio, PBC
*/

const shinyInputVars = new Set();
let shinyInitialValue = {};

function extendObservableStdlib(lib) {
  class NamedVariableOutputBinding extends Shiny.OutputBinding {
    constructor(name, change) {
      super();
      this._name = name;
      this._change = change;
    }
    find(scope) {
      return $(scope).find("#" + this._name);
    }
    getId(el) {
      return el.id;
    }
    renderValue(_el, data) {
      this._change(data);
    }
    onValueError(el, err) {
      const group = `Shiny error in ${el.id}`;
      console.groupCollapsed(`%c${group}`, "color:red");
      console.log(`${err.message}`);
      console.log(`call: ${err.call}`);
      console.groupEnd(group);
    }
  }

  $(document).on("shiny:connected", function (_event) {
    Object.entries(shinyInitialValue).map(([k, v]) => {
      window.Shiny.setInputValue(k, v);
    });
    shinyInitialValue = {};
  });

  lib.shinyInput = function () {
    return (name) => {
      shinyInputVars.add(name);
      window._ojs.ojsConnector.mainModule.value(name)
        .then((val) => {
          if (window.Shiny && window.Shiny.setInputValue) {
            window.Shiny.setInputValue(name, val);
          } else {
            shinyInitialValue[name] = val;
          }
        });
    };
  };

  lib.shinyOutput = function () {
    return function (name) {
      const dummySpan = document.createElement("div");
      dummySpan.id = name;
      dummySpan.classList.add("ojs-variable-writer");
      window._ojs.shinyElementRoot.appendChild(dummySpan);
      return lib.Generators.observe((change) => {
        Shiny.outputBindings.register(
          new NamedVariableOutputBinding(name, change),
        );
      });
    };
  };
}

class ShinyInspector extends QuartoInspector {
  constructor(node) {
    super(node);
  }
  fulfilled(value, name) {
    if (shinyInputVars.has(name) && window.Shiny) {
      if (window.Shiny.setInputValue === undefined) {
        shinyInitialValue[name] = value;
      } else {
        window.Shiny.setInputValue(name, value);
      }
    }
    return super.fulfilled(value, name);
  }
}

const { Generators } = new Library();

class OjsButtonInput /*extends ShinyInput*/ {
  find(_scope) {
    return document.querySelectorAll(".ojs-inputs-button");
  }

  init(el, change) {
    const btn = button(el.textContent);
    el.innerHTML = "";
    el.appendChild(btn);

    const obs = Generators.input(el.firstChild);
    (async function () {
      // throw away the first value, it doesn't count for buttons
      await obs.next().value;
      for (const x of obs) {
        change(await x);
      }
    })();
    // TODO: error handling

    return {
      onSetValue: (_value) => {
      },
      dispose: () => {
        obs.return();
      },
    };
  }
}

function initOjsShinyRuntime() {
  const valueSym = Symbol("value");
  const callbackSym = Symbol("callback");
  const instanceSym = Symbol("instance");
  // const values = new WeakMap(); // unused?

  class BindingAdapter extends Shiny.InputBinding {
    constructor(x) {
      super();
      this.x = x;
    }

    find(scope) {
      const matches = this.x.find(scope);
      return $(matches);
    }
    getId(el) {
      if (this.x.getId) {
        return this.x.getId(el);
      } else {
        return super.getId(el);
      }
    }
    initialize(el) {
      const changeHandler = (value) => {
        el[valueSym] = value;
        el[callbackSym]();
      };
      const instance = this.x.init(el, changeHandler);
      el[instanceSym] = instance;
    }
    getValue(el) {
      return el[valueSym];
    }
    setValue(el, value) {
      el[valueSym] = value;
      el[instanceSym].onSetValue(value);
    }
    subscribe(el, callback) {
      el[callbackSym] = callback;
    }
    unsubscribe(el) {
      el[instanceSym].dispose();
    }
  }

  class InspectorOutputBinding extends Shiny.OutputBinding {
    find(scope) {
      return $(scope).find(".observablehq-inspector");
    }
    getId(el) {
      return el.id;
    }
    renderValue(el, data) {
      (new Inspector(el)).fulfilled(data);
    }
  }

  if (window.Shiny === undefined) {
    console.warn("Shiny runtime not found; Shiny features won't work.");
    return false;
  }

  Shiny.inputBindings.register(new BindingAdapter(new OjsButtonInput()));
  Shiny.outputBindings.register(new InspectorOutputBinding());

  // Handle requests from the server to export Shiny outputs to ojs.
  Shiny.addCustomMessageHandler("ojs-export", ({ name }) => {
    window._ojs.ojsConnector.mainModule.redefine(
      name,
      window._ojs.ojsConnector.library.shinyOutput()(name),
    );
    // shinyOutput() creates an output DOM element, but we have to cause it to
    // be actually bound. I don't love this code being here, I'd prefer if we
    // could receive Shiny outputs without using output bindings at all (for
    // this case, not for things that truly are DOM-oriented outputs).
    Shiny.bindAll(document.body);
  });

  return true;
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var dist = {exports: {}};

(function (module, exports) {
	(function(g,f){f(exports);}(commonjsGlobal,(function(exports){
	var reservedWords = {
	  3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
	  5: "class enum extends super const export import",
	  6: "enum",
	  strict: "implements interface let package private protected public static yield",
	  strictBind: "eval arguments"
	};

	// And the keywords

	var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";

	var keywords = {
	  5: ecma5AndLessKeywords,
	  "5module": ecma5AndLessKeywords + " export import",
	  6: ecma5AndLessKeywords + " const class extends export import super"
	};

	var keywordRelationalOperator = /^in(stanceof)?$/;

	// ## Character categories

	// Big ugly regular expressions that match characters in the
	// whitespace, identifier, and identifier-start categories. These
	// are only applied when a character is found to actually have a
	// code point above 128.
	// Generated by `bin/generate-identifier-regex.js`.
	var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u05d0-\u05ea\u05ef-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u0860-\u086a\u08a0-\u08b4\u08b6-\u08c7\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u09fc\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0af9\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d04-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5\u0ea7-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1878\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1c90-\u1cba\u1cbd-\u1cbf\u1ce9-\u1cec\u1cee-\u1cf3\u1cf5\u1cf6\u1cfa\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309b-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u31a0-\u31bf\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9ffc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua7bf\ua7c2-\ua7ca\ua7f5-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua8fe\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab69\uab70-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc";
	var nonASCIIidentifierChars = "\u200c\u200d\xb7\u0300-\u036f\u0387\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u07fd\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08d3-\u08e1\u08e3-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u09fe\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0afa-\u0aff\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b55-\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c00-\u0c04\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c81-\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d00-\u0d03\u0d3b\u0d3c\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d81-\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0de6-\u0def\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1369-\u1371\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19d0-\u19da\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1ab0-\u1abd\u1abf\u1ac0\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf4\u1cf7-\u1cf9\u1dc0-\u1df9\u1dfb-\u1dff\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69e\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua82c\ua880\ua881\ua8b4-\ua8c5\ua8d0-\ua8d9\ua8e0-\ua8f1\ua8ff-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\ua9e5\ua9f0-\ua9f9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b-\uaa7d\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe2f\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f";

	var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
	var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

	nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;

	// These are a run-length and offset encoded representation of the
	// >0xffff code points that are a valid part of identifiers. The
	// offset starts at 0x10000, and each pair of numbers represents an
	// offset to the next range, and then a size of the range. They were
	// generated by bin/generate-identifier-regex.js

	// eslint-disable-next-line comma-spacing
	var astralIdentifierStartCodes = [0,11,2,25,2,18,2,1,2,14,3,13,35,122,70,52,268,28,4,48,48,31,14,29,6,37,11,29,3,35,5,7,2,4,43,157,19,35,5,35,5,39,9,51,157,310,10,21,11,7,153,5,3,0,2,43,2,1,4,0,3,22,11,22,10,30,66,18,2,1,11,21,11,25,71,55,7,1,65,0,16,3,2,2,2,28,43,28,4,28,36,7,2,27,28,53,11,21,11,18,14,17,111,72,56,50,14,50,14,35,349,41,7,1,79,28,11,0,9,21,107,20,28,22,13,52,76,44,33,24,27,35,30,0,3,0,9,34,4,0,13,47,15,3,22,0,2,0,36,17,2,24,85,6,2,0,2,3,2,14,2,9,8,46,39,7,3,1,3,21,2,6,2,1,2,4,4,0,19,0,13,4,159,52,19,3,21,2,31,47,21,1,2,0,185,46,42,3,37,47,21,0,60,42,14,0,72,26,230,43,117,63,32,7,3,0,3,7,2,1,2,23,16,0,2,0,95,7,3,38,17,0,2,0,29,0,11,39,8,0,22,0,12,45,20,0,35,56,264,8,2,36,18,0,50,29,113,6,2,1,2,37,22,0,26,5,2,1,2,31,15,0,328,18,190,0,80,921,103,110,18,195,2749,1070,4050,582,8634,568,8,30,114,29,19,47,17,3,32,20,6,18,689,63,129,74,6,0,67,12,65,1,2,0,29,6135,9,1237,43,8,8952,286,50,2,18,3,9,395,2309,106,6,12,4,8,8,9,5991,84,2,70,2,1,3,0,3,1,3,3,2,11,2,0,2,6,2,64,2,3,3,7,2,6,2,27,2,3,2,4,2,0,4,6,2,339,3,24,2,24,2,30,2,24,2,30,2,24,2,30,2,24,2,30,2,24,2,7,2357,44,11,6,17,0,370,43,1301,196,60,67,8,0,1205,3,2,26,2,1,2,0,3,0,2,9,2,3,2,0,2,0,7,0,5,0,2,0,2,0,2,2,2,1,2,0,3,0,2,0,2,0,2,0,2,0,2,1,2,0,3,3,2,6,2,3,2,3,2,0,2,9,2,16,6,2,2,4,2,16,4421,42717,35,4148,12,221,3,5761,15,7472,3104,541,1507,4938];

	// eslint-disable-next-line comma-spacing
	var astralIdentifierCodes = [509,0,227,0,150,4,294,9,1368,2,2,1,6,3,41,2,5,0,166,1,574,3,9,9,370,1,154,10,176,2,54,14,32,9,16,3,46,10,54,9,7,2,37,13,2,9,6,1,45,0,13,2,49,13,9,3,2,11,83,11,7,0,161,11,6,9,7,3,56,1,2,6,3,1,3,2,10,0,11,1,3,6,4,4,193,17,10,9,5,0,82,19,13,9,214,6,3,8,28,1,83,16,16,9,82,12,9,9,84,14,5,9,243,14,166,9,71,5,2,1,3,3,2,0,2,1,13,9,120,6,3,6,4,0,29,9,41,6,2,3,9,0,10,10,47,15,406,7,2,7,17,9,57,21,2,13,123,5,4,0,2,1,2,6,2,0,9,9,49,4,2,1,2,4,9,9,330,3,19306,9,135,4,60,6,26,9,1014,0,2,54,8,3,82,0,12,1,19628,1,5319,4,4,5,9,7,3,6,31,3,149,2,1418,49,513,54,5,49,9,0,15,0,23,4,2,14,1361,6,2,16,3,6,2,1,2,4,262,6,10,9,419,13,1495,6,110,6,6,9,4759,9,787719,239];

	// This has a complexity linear to the value of the code. The
	// assumption is that looking up astral identifier characters is
	// rare.
	function isInAstralSet(code, set) {
	  var pos = 0x10000;
	  for (var i = 0; i < set.length; i += 2) {
	    pos += set[i];
	    if (pos > code) { return false }
	    pos += set[i + 1];
	    if (pos >= code) { return true }
	  }
	}

	// Test whether a given character code starts an identifier.

	function isIdentifierStart(code, astral) {
	  if (code < 65) { return code === 36 }
	  if (code < 91) { return true }
	  if (code < 97) { return code === 95 }
	  if (code < 123) { return true }
	  if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code)) }
	  if (astral === false) { return false }
	  return isInAstralSet(code, astralIdentifierStartCodes)
	}

	// Test whether a given character is part of an identifier.

	function isIdentifierChar(code, astral) {
	  if (code < 48) { return code === 36 }
	  if (code < 58) { return true }
	  if (code < 65) { return false }
	  if (code < 91) { return true }
	  if (code < 97) { return code === 95 }
	  if (code < 123) { return true }
	  if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code)) }
	  if (astral === false) { return false }
	  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes)
	}

	// ## Token types

	// The assignment of fine-grained, information-carrying type objects
	// allows the tokenizer to store the information it has about a
	// token in a way that is very cheap for the parser to look up.

	// All token type variables start with an underscore, to make them
	// easy to recognize.

	// The `beforeExpr` property is used to disambiguate between regular
	// expressions and divisions. It is set on all token types that can
	// be followed by an expression (thus, a slash after them would be a
	// regular expression).
	//
	// The `startsExpr` property is used to check if the token ends a
	// `yield` expression. It is set on all token types that either can
	// directly start an expression (like a quotation mark) or can
	// continue an expression (like the body of a string).
	//
	// `isLoop` marks a keyword as starting a loop, which is important
	// to know when parsing a label, in order to allow or disallow
	// continue jumps to that label.

	var TokenType = function TokenType(label, conf) {
	  if ( conf === void 0 ) conf = {};

	  this.label = label;
	  this.keyword = conf.keyword;
	  this.beforeExpr = !!conf.beforeExpr;
	  this.startsExpr = !!conf.startsExpr;
	  this.isLoop = !!conf.isLoop;
	  this.isAssign = !!conf.isAssign;
	  this.prefix = !!conf.prefix;
	  this.postfix = !!conf.postfix;
	  this.binop = conf.binop || null;
	  this.updateContext = null;
	};

	function binop(name, prec) {
	  return new TokenType(name, {beforeExpr: true, binop: prec})
	}
	var beforeExpr = {beforeExpr: true}, startsExpr = {startsExpr: true};

	// Map keyword names to token types.

	var keywords$1 = {};

	// Succinct definitions of keyword token types
	function kw(name, options) {
	  if ( options === void 0 ) options = {};

	  options.keyword = name;
	  return keywords$1[name] = new TokenType(name, options)
	}

	var types = {
	  num: new TokenType("num", startsExpr),
	  regexp: new TokenType("regexp", startsExpr),
	  string: new TokenType("string", startsExpr),
	  name: new TokenType("name", startsExpr),
	  eof: new TokenType("eof"),

	  // Punctuation token types.
	  bracketL: new TokenType("[", {beforeExpr: true, startsExpr: true}),
	  bracketR: new TokenType("]"),
	  braceL: new TokenType("{", {beforeExpr: true, startsExpr: true}),
	  braceR: new TokenType("}"),
	  parenL: new TokenType("(", {beforeExpr: true, startsExpr: true}),
	  parenR: new TokenType(")"),
	  comma: new TokenType(",", beforeExpr),
	  semi: new TokenType(";", beforeExpr),
	  colon: new TokenType(":", beforeExpr),
	  dot: new TokenType("."),
	  question: new TokenType("?", beforeExpr),
	  questionDot: new TokenType("?."),
	  arrow: new TokenType("=>", beforeExpr),
	  template: new TokenType("template"),
	  invalidTemplate: new TokenType("invalidTemplate"),
	  ellipsis: new TokenType("...", beforeExpr),
	  backQuote: new TokenType("`", startsExpr),
	  dollarBraceL: new TokenType("${", {beforeExpr: true, startsExpr: true}),

	  // Operators. These carry several kinds of properties to help the
	  // parser use them properly (the presence of these properties is
	  // what categorizes them as operators).
	  //
	  // `binop`, when present, specifies that this operator is a binary
	  // operator, and will refer to its precedence.
	  //
	  // `prefix` and `postfix` mark the operator as a prefix or postfix
	  // unary operator.
	  //
	  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
	  // binary operators with a very low precedence, that should result
	  // in AssignmentExpression nodes.

	  eq: new TokenType("=", {beforeExpr: true, isAssign: true}),
	  assign: new TokenType("_=", {beforeExpr: true, isAssign: true}),
	  incDec: new TokenType("++/--", {prefix: true, postfix: true, startsExpr: true}),
	  prefix: new TokenType("!/~", {beforeExpr: true, prefix: true, startsExpr: true}),
	  logicalOR: binop("||", 1),
	  logicalAND: binop("&&", 2),
	  bitwiseOR: binop("|", 3),
	  bitwiseXOR: binop("^", 4),
	  bitwiseAND: binop("&", 5),
	  equality: binop("==/!=/===/!==", 6),
	  relational: binop("</>/<=/>=", 7),
	  bitShift: binop("<</>>/>>>", 8),
	  plusMin: new TokenType("+/-", {beforeExpr: true, binop: 9, prefix: true, startsExpr: true}),
	  modulo: binop("%", 10),
	  star: binop("*", 10),
	  slash: binop("/", 10),
	  starstar: new TokenType("**", {beforeExpr: true}),
	  coalesce: binop("??", 1),

	  // Keyword token types.
	  _break: kw("break"),
	  _case: kw("case", beforeExpr),
	  _catch: kw("catch"),
	  _continue: kw("continue"),
	  _debugger: kw("debugger"),
	  _default: kw("default", beforeExpr),
	  _do: kw("do", {isLoop: true, beforeExpr: true}),
	  _else: kw("else", beforeExpr),
	  _finally: kw("finally"),
	  _for: kw("for", {isLoop: true}),
	  _function: kw("function", startsExpr),
	  _if: kw("if"),
	  _return: kw("return", beforeExpr),
	  _switch: kw("switch"),
	  _throw: kw("throw", beforeExpr),
	  _try: kw("try"),
	  _var: kw("var"),
	  _const: kw("const"),
	  _while: kw("while", {isLoop: true}),
	  _with: kw("with"),
	  _new: kw("new", {beforeExpr: true, startsExpr: true}),
	  _this: kw("this", startsExpr),
	  _super: kw("super", startsExpr),
	  _class: kw("class", startsExpr),
	  _extends: kw("extends", beforeExpr),
	  _export: kw("export"),
	  _import: kw("import", startsExpr),
	  _null: kw("null", startsExpr),
	  _true: kw("true", startsExpr),
	  _false: kw("false", startsExpr),
	  _in: kw("in", {beforeExpr: true, binop: 7}),
	  _instanceof: kw("instanceof", {beforeExpr: true, binop: 7}),
	  _typeof: kw("typeof", {beforeExpr: true, prefix: true, startsExpr: true}),
	  _void: kw("void", {beforeExpr: true, prefix: true, startsExpr: true}),
	  _delete: kw("delete", {beforeExpr: true, prefix: true, startsExpr: true})
	};

	// Matches a whole line break (where CRLF is considered a single
	// line break). Used to count lines.

	var lineBreak = /\r\n?|\n|\u2028|\u2029/;
	var lineBreakG = new RegExp(lineBreak.source, "g");

	function isNewLine(code, ecma2019String) {
	  return code === 10 || code === 13 || (!ecma2019String && (code === 0x2028 || code === 0x2029))
	}

	var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;

	var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;

	var ref = Object.prototype;
	var hasOwnProperty = ref.hasOwnProperty;
	var toString = ref.toString;

	// Checks if an object has a property.

	function has(obj, propName) {
	  return hasOwnProperty.call(obj, propName)
	}

	var isArray = Array.isArray || (function (obj) { return (
	  toString.call(obj) === "[object Array]"
	); });

	function wordsRegexp(words) {
	  return new RegExp("^(?:" + words.replace(/ /g, "|") + ")$")
	}

	// These are used when `options.locations` is on, for the
	// `startLoc` and `endLoc` properties.

	var Position = function Position(line, col) {
	  this.line = line;
	  this.column = col;
	};

	Position.prototype.offset = function offset (n) {
	  return new Position(this.line, this.column + n)
	};

	var SourceLocation = function SourceLocation(p, start, end) {
	  this.start = start;
	  this.end = end;
	  if (p.sourceFile !== null) { this.source = p.sourceFile; }
	};

	// The `getLineInfo` function is mostly useful when the
	// `locations` option is off (for performance reasons) and you
	// want to find the line/column position for a given character
	// offset. `input` should be the code string that the offset refers
	// into.

	function getLineInfo(input, offset) {
	  for (var line = 1, cur = 0;;) {
	    lineBreakG.lastIndex = cur;
	    var match = lineBreakG.exec(input);
	    if (match && match.index < offset) {
	      ++line;
	      cur = match.index + match[0].length;
	    } else {
	      return new Position(line, offset - cur)
	    }
	  }
	}

	// A second optional argument can be given to further configure
	// the parser process. These options are recognized:

	var defaultOptions = {
	  // `ecmaVersion` indicates the ECMAScript version to parse. Must be
	  // either 3, 5, 6 (2015), 7 (2016), 8 (2017), 9 (2018), or 10
	  // (2019). This influences support for strict mode, the set of
	  // reserved words, and support for new syntax features. The default
	  // is 10.
	  ecmaVersion: 10,
	  // `sourceType` indicates the mode the code should be parsed in.
	  // Can be either `"script"` or `"module"`. This influences global
	  // strict mode and parsing of `import` and `export` declarations.
	  sourceType: "script",
	  // `onInsertedSemicolon` can be a callback that will be called
	  // when a semicolon is automatically inserted. It will be passed
	  // the position of the comma as an offset, and if `locations` is
	  // enabled, it is given the location as a `{line, column}` object
	  // as second argument.
	  onInsertedSemicolon: null,
	  // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
	  // trailing commas.
	  onTrailingComma: null,
	  // By default, reserved words are only enforced if ecmaVersion >= 5.
	  // Set `allowReserved` to a boolean value to explicitly turn this on
	  // an off. When this option has the value "never", reserved words
	  // and keywords can also not be used as property names.
	  allowReserved: null,
	  // When enabled, a return at the top level is not considered an
	  // error.
	  allowReturnOutsideFunction: false,
	  // When enabled, import/export statements are not constrained to
	  // appearing at the top of the program.
	  allowImportExportEverywhere: false,
	  // When enabled, await identifiers are allowed to appear at the top-level scope,
	  // but they are still not allowed in non-async functions.
	  allowAwaitOutsideFunction: false,
	  // When enabled, hashbang directive in the beginning of file
	  // is allowed and treated as a line comment.
	  allowHashBang: false,
	  // When `locations` is on, `loc` properties holding objects with
	  // `start` and `end` properties in `{line, column}` form (with
	  // line being 1-based and column 0-based) will be attached to the
	  // nodes.
	  locations: false,
	  // A function can be passed as `onToken` option, which will
	  // cause Acorn to call that function with object in the same
	  // format as tokens returned from `tokenizer().getToken()`. Note
	  // that you are not allowed to call the parser from the
	  // callback—that will corrupt its internal state.
	  onToken: null,
	  // A function can be passed as `onComment` option, which will
	  // cause Acorn to call that function with `(block, text, start,
	  // end)` parameters whenever a comment is skipped. `block` is a
	  // boolean indicating whether this is a block (`/* */`) comment,
	  // `text` is the content of the comment, and `start` and `end` are
	  // character offsets that denote the start and end of the comment.
	  // When the `locations` option is on, two more parameters are
	  // passed, the full `{line, column}` locations of the start and
	  // end of the comments. Note that you are not allowed to call the
	  // parser from the callback—that will corrupt its internal state.
	  onComment: null,
	  // Nodes have their start and end characters offsets recorded in
	  // `start` and `end` properties (directly on the node, rather than
	  // the `loc` object, which holds line/column data. To also add a
	  // [semi-standardized][range] `range` property holding a `[start,
	  // end]` array with the same numbers, set the `ranges` option to
	  // `true`.
	  //
	  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
	  ranges: false,
	  // It is possible to parse multiple files into a single AST by
	  // passing the tree produced by parsing the first file as
	  // `program` option in subsequent parses. This will add the
	  // toplevel forms of the parsed file to the `Program` (top) node
	  // of an existing parse tree.
	  program: null,
	  // When `locations` is on, you can pass this to record the source
	  // file in every node's `loc` object.
	  sourceFile: null,
	  // This value, if given, is stored in every node, whether
	  // `locations` is on or off.
	  directSourceFile: null,
	  // When enabled, parenthesized expressions are represented by
	  // (non-standard) ParenthesizedExpression nodes
	  preserveParens: false
	};

	// Interpret and default an options object

	function getOptions(opts) {
	  var options = {};

	  for (var opt in defaultOptions)
	    { options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt]; }

	  if (options.ecmaVersion >= 2015)
	    { options.ecmaVersion -= 2009; }

	  if (options.allowReserved == null)
	    { options.allowReserved = options.ecmaVersion < 5; }

	  if (isArray(options.onToken)) {
	    var tokens = options.onToken;
	    options.onToken = function (token) { return tokens.push(token); };
	  }
	  if (isArray(options.onComment))
	    { options.onComment = pushComment(options, options.onComment); }

	  return options
	}

	function pushComment(options, array) {
	  return function(block, text, start, end, startLoc, endLoc) {
	    var comment = {
	      type: block ? "Block" : "Line",
	      value: text,
	      start: start,
	      end: end
	    };
	    if (options.locations)
	      { comment.loc = new SourceLocation(this, startLoc, endLoc); }
	    if (options.ranges)
	      { comment.range = [start, end]; }
	    array.push(comment);
	  }
	}

	// Each scope gets a bitset that may contain these flags
	var
	    SCOPE_TOP = 1,
	    SCOPE_FUNCTION = 2,
	    SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION,
	    SCOPE_ASYNC = 4,
	    SCOPE_GENERATOR = 8,
	    SCOPE_ARROW = 16,
	    SCOPE_SIMPLE_CATCH = 32,
	    SCOPE_SUPER = 64,
	    SCOPE_DIRECT_SUPER = 128;

	function functionFlags(async, generator) {
	  return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0)
	}

	// Used in checkLVal and declareName to determine the type of a binding
	var
	    BIND_NONE = 0, // Not a binding
	    BIND_VAR = 1, // Var-style binding
	    BIND_LEXICAL = 2, // Let- or const-style binding
	    BIND_FUNCTION = 3, // Function declaration
	    BIND_SIMPLE_CATCH = 4, // Simple (identifier pattern) catch binding
	    BIND_OUTSIDE = 5; // Special case for function names as bound inside the function

	var Parser = function Parser(options, input, startPos) {
	  this.options = options = getOptions(options);
	  this.sourceFile = options.sourceFile;
	  this.keywords = wordsRegexp(keywords[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
	  var reserved = "";
	  if (options.allowReserved !== true) {
	    for (var v = options.ecmaVersion;; v--)
	      { if (reserved = reservedWords[v]) { break } }
	    if (options.sourceType === "module") { reserved += " await"; }
	  }
	  this.reservedWords = wordsRegexp(reserved);
	  var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
	  this.reservedWordsStrict = wordsRegexp(reservedStrict);
	  this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
	  this.input = String(input);

	  // Used to signal to callers of `readWord1` whether the word
	  // contained any escape sequences. This is needed because words with
	  // escape sequences must not be interpreted as keywords.
	  this.containsEsc = false;

	  // Set up token state

	  // The current position of the tokenizer in the input.
	  if (startPos) {
	    this.pos = startPos;
	    this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
	    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
	  } else {
	    this.pos = this.lineStart = 0;
	    this.curLine = 1;
	  }

	  // Properties of the current token:
	  // Its type
	  this.type = types.eof;
	  // For tokens that include more information than their type, the value
	  this.value = null;
	  // Its start and end offset
	  this.start = this.end = this.pos;
	  // And, if locations are used, the {line, column} object
	  // corresponding to those offsets
	  this.startLoc = this.endLoc = this.curPosition();

	  // Position information for the previous token
	  this.lastTokEndLoc = this.lastTokStartLoc = null;
	  this.lastTokStart = this.lastTokEnd = this.pos;

	  // The context stack is used to superficially track syntactic
	  // context to predict whether a regular expression is allowed in a
	  // given position.
	  this.context = this.initialContext();
	  this.exprAllowed = true;

	  // Figure out if it's a module code.
	  this.inModule = options.sourceType === "module";
	  this.strict = this.inModule || this.strictDirective(this.pos);

	  // Used to signify the start of a potential arrow function
	  this.potentialArrowAt = -1;

	  // Positions to delayed-check that yield/await does not exist in default parameters.
	  this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
	  // Labels in scope.
	  this.labels = [];
	  // Thus-far undefined exports.
	  this.undefinedExports = {};

	  // If enabled, skip leading hashbang line.
	  if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!")
	    { this.skipLineComment(2); }

	  // Scope tracking for duplicate variable names (see scope.js)
	  this.scopeStack = [];
	  this.enterScope(SCOPE_TOP);

	  // For RegExp validation
	  this.regexpState = null;
	};

	var prototypeAccessors = { inFunction: { configurable: true },inGenerator: { configurable: true },inAsync: { configurable: true },allowSuper: { configurable: true },allowDirectSuper: { configurable: true },treatFunctionsAsVar: { configurable: true } };

	Parser.prototype.parse = function parse () {
	  var node = this.options.program || this.startNode();
	  this.nextToken();
	  return this.parseTopLevel(node)
	};

	prototypeAccessors.inFunction.get = function () { return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0 };
	prototypeAccessors.inGenerator.get = function () { return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0 };
	prototypeAccessors.inAsync.get = function () { return (this.currentVarScope().flags & SCOPE_ASYNC) > 0 };
	prototypeAccessors.allowSuper.get = function () { return (this.currentThisScope().flags & SCOPE_SUPER) > 0 };
	prototypeAccessors.allowDirectSuper.get = function () { return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0 };
	prototypeAccessors.treatFunctionsAsVar.get = function () { return this.treatFunctionsAsVarInScope(this.currentScope()) };

	// Switch to a getter for 7.0.0.
	Parser.prototype.inNonArrowFunction = function inNonArrowFunction () { return (this.currentThisScope().flags & SCOPE_FUNCTION) > 0 };

	Parser.extend = function extend () {
	    var plugins = [], len = arguments.length;
	    while ( len-- ) plugins[ len ] = arguments[ len ];

	  var cls = this;
	  for (var i = 0; i < plugins.length; i++) { cls = plugins[i](cls); }
	  return cls
	};

	Parser.parse = function parse (input, options) {
	  return new this(options, input).parse()
	};

	Parser.parseExpressionAt = function parseExpressionAt (input, pos, options) {
	  var parser = new this(options, input, pos);
	  parser.nextToken();
	  return parser.parseExpression()
	};

	Parser.tokenizer = function tokenizer (input, options) {
	  return new this(options, input)
	};

	Object.defineProperties( Parser.prototype, prototypeAccessors );

	var pp = Parser.prototype;

	// ## Parser utilities

	var literal = /^(?:'((?:\\.|[^'\\])*?)'|"((?:\\.|[^"\\])*?)")/;
	pp.strictDirective = function(start) {
	  for (;;) {
	    // Try to find string literal.
	    skipWhiteSpace.lastIndex = start;
	    start += skipWhiteSpace.exec(this.input)[0].length;
	    var match = literal.exec(this.input.slice(start));
	    if (!match) { return false }
	    if ((match[1] || match[2]) === "use strict") {
	      skipWhiteSpace.lastIndex = start + match[0].length;
	      var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
	      var next = this.input.charAt(end);
	      return next === ";" || next === "}" ||
	        (lineBreak.test(spaceAfter[0]) &&
	         !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "="))
	    }
	    start += match[0].length;

	    // Skip semicolon, if any.
	    skipWhiteSpace.lastIndex = start;
	    start += skipWhiteSpace.exec(this.input)[0].length;
	    if (this.input[start] === ";")
	      { start++; }
	  }
	};

	// Predicate that tests whether the next token is of the given
	// type, and if yes, consumes it as a side effect.

	pp.eat = function(type) {
	  if (this.type === type) {
	    this.next();
	    return true
	  } else {
	    return false
	  }
	};

	// Tests whether parsed token is a contextual keyword.

	pp.isContextual = function(name) {
	  return this.type === types.name && this.value === name && !this.containsEsc
	};

	// Consumes contextual keyword if possible.

	pp.eatContextual = function(name) {
	  if (!this.isContextual(name)) { return false }
	  this.next();
	  return true
	};

	// Asserts that following token is given contextual keyword.

	pp.expectContextual = function(name) {
	  if (!this.eatContextual(name)) { this.unexpected(); }
	};

	// Test whether a semicolon can be inserted at the current position.

	pp.canInsertSemicolon = function() {
	  return this.type === types.eof ||
	    this.type === types.braceR ||
	    lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
	};

	pp.insertSemicolon = function() {
	  if (this.canInsertSemicolon()) {
	    if (this.options.onInsertedSemicolon)
	      { this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc); }
	    return true
	  }
	};

	// Consume a semicolon, or, failing that, see if we are allowed to
	// pretend that there is a semicolon at this position.

	pp.semicolon = function() {
	  if (!this.eat(types.semi) && !this.insertSemicolon()) { this.unexpected(); }
	};

	pp.afterTrailingComma = function(tokType, notNext) {
	  if (this.type === tokType) {
	    if (this.options.onTrailingComma)
	      { this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc); }
	    if (!notNext)
	      { this.next(); }
	    return true
	  }
	};

	// Expect a token of a given type. If found, consume it, otherwise,
	// raise an unexpected token error.

	pp.expect = function(type) {
	  this.eat(type) || this.unexpected();
	};

	// Raise an unexpected token error.

	pp.unexpected = function(pos) {
	  this.raise(pos != null ? pos : this.start, "Unexpected token");
	};

	function DestructuringErrors() {
	  this.shorthandAssign =
	  this.trailingComma =
	  this.parenthesizedAssign =
	  this.parenthesizedBind =
	  this.doubleProto =
	    -1;
	}

	pp.checkPatternErrors = function(refDestructuringErrors, isAssign) {
	  if (!refDestructuringErrors) { return }
	  if (refDestructuringErrors.trailingComma > -1)
	    { this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element"); }
	  var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
	  if (parens > -1) { this.raiseRecoverable(parens, "Parenthesized pattern"); }
	};

	pp.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
	  if (!refDestructuringErrors) { return false }
	  var shorthandAssign = refDestructuringErrors.shorthandAssign;
	  var doubleProto = refDestructuringErrors.doubleProto;
	  if (!andThrow) { return shorthandAssign >= 0 || doubleProto >= 0 }
	  if (shorthandAssign >= 0)
	    { this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns"); }
	  if (doubleProto >= 0)
	    { this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property"); }
	};

	pp.checkYieldAwaitInDefaultParams = function() {
	  if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos))
	    { this.raise(this.yieldPos, "Yield expression cannot be a default value"); }
	  if (this.awaitPos)
	    { this.raise(this.awaitPos, "Await expression cannot be a default value"); }
	};

	pp.isSimpleAssignTarget = function(expr) {
	  if (expr.type === "ParenthesizedExpression")
	    { return this.isSimpleAssignTarget(expr.expression) }
	  return expr.type === "Identifier" || expr.type === "MemberExpression"
	};

	var pp$1 = Parser.prototype;

	// ### Statement parsing

	// Parse a program. Initializes the parser, reads any number of
	// statements, and wraps them in a Program node.  Optionally takes a
	// `program` argument.  If present, the statements will be appended
	// to its body instead of creating a new node.

	pp$1.parseTopLevel = function(node) {
	  var exports = {};
	  if (!node.body) { node.body = []; }
	  while (this.type !== types.eof) {
	    var stmt = this.parseStatement(null, true, exports);
	    node.body.push(stmt);
	  }
	  if (this.inModule)
	    { for (var i = 0, list = Object.keys(this.undefinedExports); i < list.length; i += 1)
	      {
	        var name = list[i];

	        this.raiseRecoverable(this.undefinedExports[name].start, ("Export '" + name + "' is not defined"));
	      } }
	  this.adaptDirectivePrologue(node.body);
	  this.next();
	  node.sourceType = this.options.sourceType;
	  return this.finishNode(node, "Program")
	};

	var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

	pp$1.isLet = function(context) {
	  if (this.options.ecmaVersion < 6 || !this.isContextual("let")) { return false }
	  skipWhiteSpace.lastIndex = this.pos;
	  var skip = skipWhiteSpace.exec(this.input);
	  var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
	  // For ambiguous cases, determine if a LexicalDeclaration (or only a
	  // Statement) is allowed here. If context is not empty then only a Statement
	  // is allowed. However, `let [` is an explicit negative lookahead for
	  // ExpressionStatement, so special-case it first.
	  if (nextCh === 91) { return true } // '['
	  if (context) { return false }

	  if (nextCh === 123) { return true } // '{'
	  if (isIdentifierStart(nextCh, true)) {
	    var pos = next + 1;
	    while (isIdentifierChar(this.input.charCodeAt(pos), true)) { ++pos; }
	    var ident = this.input.slice(next, pos);
	    if (!keywordRelationalOperator.test(ident)) { return true }
	  }
	  return false
	};

	// check 'async [no LineTerminator here] function'
	// - 'async /*foo*/ function' is OK.
	// - 'async /*\n*/ function' is invalid.
	pp$1.isAsyncFunction = function() {
	  if (this.options.ecmaVersion < 8 || !this.isContextual("async"))
	    { return false }

	  skipWhiteSpace.lastIndex = this.pos;
	  var skip = skipWhiteSpace.exec(this.input);
	  var next = this.pos + skip[0].length;
	  return !lineBreak.test(this.input.slice(this.pos, next)) &&
	    this.input.slice(next, next + 8) === "function" &&
	    (next + 8 === this.input.length || !isIdentifierChar(this.input.charAt(next + 8)))
	};

	// Parse a single statement.
	//
	// If expecting a statement and finding a slash operator, parse a
	// regular expression literal. This is to handle cases like
	// `if (foo) /blah/.exec(foo)`, where looking at the previous token
	// does not help.

	pp$1.parseStatement = function(context, topLevel, exports) {
	  var starttype = this.type, node = this.startNode(), kind;

	  if (this.isLet(context)) {
	    starttype = types._var;
	    kind = "let";
	  }

	  // Most types of statements are recognized by the keyword they
	  // start with. Many are trivial to parse, some require a bit of
	  // complexity.

	  switch (starttype) {
	  case types._break: case types._continue: return this.parseBreakContinueStatement(node, starttype.keyword)
	  case types._debugger: return this.parseDebuggerStatement(node)
	  case types._do: return this.parseDoStatement(node)
	  case types._for: return this.parseForStatement(node)
	  case types._function:
	    // Function as sole body of either an if statement or a labeled statement
	    // works, but not when it is part of a labeled statement that is the sole
	    // body of an if statement.
	    if ((context && (this.strict || context !== "if" && context !== "label")) && this.options.ecmaVersion >= 6) { this.unexpected(); }
	    return this.parseFunctionStatement(node, false, !context)
	  case types._class:
	    if (context) { this.unexpected(); }
	    return this.parseClass(node, true)
	  case types._if: return this.parseIfStatement(node)
	  case types._return: return this.parseReturnStatement(node)
	  case types._switch: return this.parseSwitchStatement(node)
	  case types._throw: return this.parseThrowStatement(node)
	  case types._try: return this.parseTryStatement(node)
	  case types._const: case types._var:
	    kind = kind || this.value;
	    if (context && kind !== "var") { this.unexpected(); }
	    return this.parseVarStatement(node, kind)
	  case types._while: return this.parseWhileStatement(node)
	  case types._with: return this.parseWithStatement(node)
	  case types.braceL: return this.parseBlock(true, node)
	  case types.semi: return this.parseEmptyStatement(node)
	  case types._export:
	  case types._import:
	    if (this.options.ecmaVersion > 10 && starttype === types._import) {
	      skipWhiteSpace.lastIndex = this.pos;
	      var skip = skipWhiteSpace.exec(this.input);
	      var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
	      if (nextCh === 40 || nextCh === 46) // '(' or '.'
	        { return this.parseExpressionStatement(node, this.parseExpression()) }
	    }

	    if (!this.options.allowImportExportEverywhere) {
	      if (!topLevel)
	        { this.raise(this.start, "'import' and 'export' may only appear at the top level"); }
	      if (!this.inModule)
	        { this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'"); }
	    }
	    return starttype === types._import ? this.parseImport(node) : this.parseExport(node, exports)

	    // If the statement does not start with a statement keyword or a
	    // brace, it's an ExpressionStatement or LabeledStatement. We
	    // simply start parsing an expression, and afterwards, if the
	    // next token is a colon and the expression was a simple
	    // Identifier node, we switch to interpreting it as a label.
	  default:
	    if (this.isAsyncFunction()) {
	      if (context) { this.unexpected(); }
	      this.next();
	      return this.parseFunctionStatement(node, true, !context)
	    }

	    var maybeName = this.value, expr = this.parseExpression();
	    if (starttype === types.name && expr.type === "Identifier" && this.eat(types.colon))
	      { return this.parseLabeledStatement(node, maybeName, expr, context) }
	    else { return this.parseExpressionStatement(node, expr) }
	  }
	};

	pp$1.parseBreakContinueStatement = function(node, keyword) {
	  var isBreak = keyword === "break";
	  this.next();
	  if (this.eat(types.semi) || this.insertSemicolon()) { node.label = null; }
	  else if (this.type !== types.name) { this.unexpected(); }
	  else {
	    node.label = this.parseIdent();
	    this.semicolon();
	  }

	  // Verify that there is an actual destination to break or
	  // continue to.
	  var i = 0;
	  for (; i < this.labels.length; ++i) {
	    var lab = this.labels[i];
	    if (node.label == null || lab.name === node.label.name) {
	      if (lab.kind != null && (isBreak || lab.kind === "loop")) { break }
	      if (node.label && isBreak) { break }
	    }
	  }
	  if (i === this.labels.length) { this.raise(node.start, "Unsyntactic " + keyword); }
	  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement")
	};

	pp$1.parseDebuggerStatement = function(node) {
	  this.next();
	  this.semicolon();
	  return this.finishNode(node, "DebuggerStatement")
	};

	pp$1.parseDoStatement = function(node) {
	  this.next();
	  this.labels.push(loopLabel);
	  node.body = this.parseStatement("do");
	  this.labels.pop();
	  this.expect(types._while);
	  node.test = this.parseParenExpression();
	  if (this.options.ecmaVersion >= 6)
	    { this.eat(types.semi); }
	  else
	    { this.semicolon(); }
	  return this.finishNode(node, "DoWhileStatement")
	};

	// Disambiguating between a `for` and a `for`/`in` or `for`/`of`
	// loop is non-trivial. Basically, we have to parse the init `var`
	// statement or expression, disallowing the `in` operator (see
	// the second parameter to `parseExpression`), and then check
	// whether the next token is `in` or `of`. When there is no init
	// part (semicolon immediately after the opening parenthesis), it
	// is a regular `for` loop.

	pp$1.parseForStatement = function(node) {
	  this.next();
	  var awaitAt = (this.options.ecmaVersion >= 9 && (this.inAsync || (!this.inFunction && this.options.allowAwaitOutsideFunction)) && this.eatContextual("await")) ? this.lastTokStart : -1;
	  this.labels.push(loopLabel);
	  this.enterScope(0);
	  this.expect(types.parenL);
	  if (this.type === types.semi) {
	    if (awaitAt > -1) { this.unexpected(awaitAt); }
	    return this.parseFor(node, null)
	  }
	  var isLet = this.isLet();
	  if (this.type === types._var || this.type === types._const || isLet) {
	    var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
	    this.next();
	    this.parseVar(init$1, true, kind);
	    this.finishNode(init$1, "VariableDeclaration");
	    if ((this.type === types._in || (this.options.ecmaVersion >= 6 && this.isContextual("of"))) && init$1.declarations.length === 1) {
	      if (this.options.ecmaVersion >= 9) {
	        if (this.type === types._in) {
	          if (awaitAt > -1) { this.unexpected(awaitAt); }
	        } else { node.await = awaitAt > -1; }
	      }
	      return this.parseForIn(node, init$1)
	    }
	    if (awaitAt > -1) { this.unexpected(awaitAt); }
	    return this.parseFor(node, init$1)
	  }
	  var refDestructuringErrors = new DestructuringErrors;
	  var init = this.parseExpression(true, refDestructuringErrors);
	  if (this.type === types._in || (this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
	    if (this.options.ecmaVersion >= 9) {
	      if (this.type === types._in) {
	        if (awaitAt > -1) { this.unexpected(awaitAt); }
	      } else { node.await = awaitAt > -1; }
	    }
	    this.toAssignable(init, false, refDestructuringErrors);
	    this.checkLVal(init);
	    return this.parseForIn(node, init)
	  } else {
	    this.checkExpressionErrors(refDestructuringErrors, true);
	  }
	  if (awaitAt > -1) { this.unexpected(awaitAt); }
	  return this.parseFor(node, init)
	};

	pp$1.parseFunctionStatement = function(node, isAsync, declarationPosition) {
	  this.next();
	  return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync)
	};

	pp$1.parseIfStatement = function(node) {
	  this.next();
	  node.test = this.parseParenExpression();
	  // allow function declarations in branches, but only in non-strict mode
	  node.consequent = this.parseStatement("if");
	  node.alternate = this.eat(types._else) ? this.parseStatement("if") : null;
	  return this.finishNode(node, "IfStatement")
	};

	pp$1.parseReturnStatement = function(node) {
	  if (!this.inFunction && !this.options.allowReturnOutsideFunction)
	    { this.raise(this.start, "'return' outside of function"); }
	  this.next();

	  // In `return` (and `break`/`continue`), the keywords with
	  // optional arguments, we eagerly look for a semicolon or the
	  // possibility to insert one.

	  if (this.eat(types.semi) || this.insertSemicolon()) { node.argument = null; }
	  else { node.argument = this.parseExpression(); this.semicolon(); }
	  return this.finishNode(node, "ReturnStatement")
	};

	pp$1.parseSwitchStatement = function(node) {
	  this.next();
	  node.discriminant = this.parseParenExpression();
	  node.cases = [];
	  this.expect(types.braceL);
	  this.labels.push(switchLabel);
	  this.enterScope(0);

	  // Statements under must be grouped (by label) in SwitchCase
	  // nodes. `cur` is used to keep the node that we are currently
	  // adding statements to.

	  var cur;
	  for (var sawDefault = false; this.type !== types.braceR;) {
	    if (this.type === types._case || this.type === types._default) {
	      var isCase = this.type === types._case;
	      if (cur) { this.finishNode(cur, "SwitchCase"); }
	      node.cases.push(cur = this.startNode());
	      cur.consequent = [];
	      this.next();
	      if (isCase) {
	        cur.test = this.parseExpression();
	      } else {
	        if (sawDefault) { this.raiseRecoverable(this.lastTokStart, "Multiple default clauses"); }
	        sawDefault = true;
	        cur.test = null;
	      }
	      this.expect(types.colon);
	    } else {
	      if (!cur) { this.unexpected(); }
	      cur.consequent.push(this.parseStatement(null));
	    }
	  }
	  this.exitScope();
	  if (cur) { this.finishNode(cur, "SwitchCase"); }
	  this.next(); // Closing brace
	  this.labels.pop();
	  return this.finishNode(node, "SwitchStatement")
	};

	pp$1.parseThrowStatement = function(node) {
	  this.next();
	  if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))
	    { this.raise(this.lastTokEnd, "Illegal newline after throw"); }
	  node.argument = this.parseExpression();
	  this.semicolon();
	  return this.finishNode(node, "ThrowStatement")
	};

	// Reused empty array added for node fields that are always empty.

	var empty = [];

	pp$1.parseTryStatement = function(node) {
	  this.next();
	  node.block = this.parseBlock();
	  node.handler = null;
	  if (this.type === types._catch) {
	    var clause = this.startNode();
	    this.next();
	    if (this.eat(types.parenL)) {
	      clause.param = this.parseBindingAtom();
	      var simple = clause.param.type === "Identifier";
	      this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);
	      this.checkLVal(clause.param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
	      this.expect(types.parenR);
	    } else {
	      if (this.options.ecmaVersion < 10) { this.unexpected(); }
	      clause.param = null;
	      this.enterScope(0);
	    }
	    clause.body = this.parseBlock(false);
	    this.exitScope();
	    node.handler = this.finishNode(clause, "CatchClause");
	  }
	  node.finalizer = this.eat(types._finally) ? this.parseBlock() : null;
	  if (!node.handler && !node.finalizer)
	    { this.raise(node.start, "Missing catch or finally clause"); }
	  return this.finishNode(node, "TryStatement")
	};

	pp$1.parseVarStatement = function(node, kind) {
	  this.next();
	  this.parseVar(node, false, kind);
	  this.semicolon();
	  return this.finishNode(node, "VariableDeclaration")
	};

	pp$1.parseWhileStatement = function(node) {
	  this.next();
	  node.test = this.parseParenExpression();
	  this.labels.push(loopLabel);
	  node.body = this.parseStatement("while");
	  this.labels.pop();
	  return this.finishNode(node, "WhileStatement")
	};

	pp$1.parseWithStatement = function(node) {
	  if (this.strict) { this.raise(this.start, "'with' in strict mode"); }
	  this.next();
	  node.object = this.parseParenExpression();
	  node.body = this.parseStatement("with");
	  return this.finishNode(node, "WithStatement")
	};

	pp$1.parseEmptyStatement = function(node) {
	  this.next();
	  return this.finishNode(node, "EmptyStatement")
	};

	pp$1.parseLabeledStatement = function(node, maybeName, expr, context) {
	  for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1)
	    {
	    var label = list[i$1];

	    if (label.name === maybeName)
	      { this.raise(expr.start, "Label '" + maybeName + "' is already declared");
	  } }
	  var kind = this.type.isLoop ? "loop" : this.type === types._switch ? "switch" : null;
	  for (var i = this.labels.length - 1; i >= 0; i--) {
	    var label$1 = this.labels[i];
	    if (label$1.statementStart === node.start) {
	      // Update information about previous labels on this node
	      label$1.statementStart = this.start;
	      label$1.kind = kind;
	    } else { break }
	  }
	  this.labels.push({name: maybeName, kind: kind, statementStart: this.start});
	  node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
	  this.labels.pop();
	  node.label = expr;
	  return this.finishNode(node, "LabeledStatement")
	};

	pp$1.parseExpressionStatement = function(node, expr) {
	  node.expression = expr;
	  this.semicolon();
	  return this.finishNode(node, "ExpressionStatement")
	};

	// Parse a semicolon-enclosed block of statements, handling `"use
	// strict"` declarations when `allowStrict` is true (used for
	// function bodies).

	pp$1.parseBlock = function(createNewLexicalScope, node, exitStrict) {
	  if ( createNewLexicalScope === void 0 ) createNewLexicalScope = true;
	  if ( node === void 0 ) node = this.startNode();

	  node.body = [];
	  this.expect(types.braceL);
	  if (createNewLexicalScope) { this.enterScope(0); }
	  while (this.type !== types.braceR) {
	    var stmt = this.parseStatement(null);
	    node.body.push(stmt);
	  }
	  if (exitStrict) { this.strict = false; }
	  this.next();
	  if (createNewLexicalScope) { this.exitScope(); }
	  return this.finishNode(node, "BlockStatement")
	};

	// Parse a regular `for` loop. The disambiguation code in
	// `parseStatement` will already have parsed the init statement or
	// expression.

	pp$1.parseFor = function(node, init) {
	  node.init = init;
	  this.expect(types.semi);
	  node.test = this.type === types.semi ? null : this.parseExpression();
	  this.expect(types.semi);
	  node.update = this.type === types.parenR ? null : this.parseExpression();
	  this.expect(types.parenR);
	  node.body = this.parseStatement("for");
	  this.exitScope();
	  this.labels.pop();
	  return this.finishNode(node, "ForStatement")
	};

	// Parse a `for`/`in` and `for`/`of` loop, which are almost
	// same from parser's perspective.

	pp$1.parseForIn = function(node, init) {
	  var isForIn = this.type === types._in;
	  this.next();

	  if (
	    init.type === "VariableDeclaration" &&
	    init.declarations[0].init != null &&
	    (
	      !isForIn ||
	      this.options.ecmaVersion < 8 ||
	      this.strict ||
	      init.kind !== "var" ||
	      init.declarations[0].id.type !== "Identifier"
	    )
	  ) {
	    this.raise(
	      init.start,
	      ((isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer")
	    );
	  } else if (init.type === "AssignmentPattern") {
	    this.raise(init.start, "Invalid left-hand side in for-loop");
	  }
	  node.left = init;
	  node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
	  this.expect(types.parenR);
	  node.body = this.parseStatement("for");
	  this.exitScope();
	  this.labels.pop();
	  return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement")
	};

	// Parse a list of variable declarations.

	pp$1.parseVar = function(node, isFor, kind) {
	  node.declarations = [];
	  node.kind = kind;
	  for (;;) {
	    var decl = this.startNode();
	    this.parseVarId(decl, kind);
	    if (this.eat(types.eq)) {
	      decl.init = this.parseMaybeAssign(isFor);
	    } else if (kind === "const" && !(this.type === types._in || (this.options.ecmaVersion >= 6 && this.isContextual("of")))) {
	      this.unexpected();
	    } else if (decl.id.type !== "Identifier" && !(isFor && (this.type === types._in || this.isContextual("of")))) {
	      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
	    } else {
	      decl.init = null;
	    }
	    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
	    if (!this.eat(types.comma)) { break }
	  }
	  return node
	};

	pp$1.parseVarId = function(decl, kind) {
	  decl.id = this.parseBindingAtom();
	  this.checkLVal(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
	};

	var FUNC_STATEMENT = 1, FUNC_HANGING_STATEMENT = 2, FUNC_NULLABLE_ID = 4;

	// Parse a function declaration or literal (depending on the
	// `statement & FUNC_STATEMENT`).

	// Remove `allowExpressionBody` for 7.0.0, as it is only called with false
	pp$1.parseFunction = function(node, statement, allowExpressionBody, isAsync) {
	  this.initFunction(node);
	  if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
	    if (this.type === types.star && (statement & FUNC_HANGING_STATEMENT))
	      { this.unexpected(); }
	    node.generator = this.eat(types.star);
	  }
	  if (this.options.ecmaVersion >= 8)
	    { node.async = !!isAsync; }

	  if (statement & FUNC_STATEMENT) {
	    node.id = (statement & FUNC_NULLABLE_ID) && this.type !== types.name ? null : this.parseIdent();
	    if (node.id && !(statement & FUNC_HANGING_STATEMENT))
	      // If it is a regular function declaration in sloppy mode, then it is
	      // subject to Annex B semantics (BIND_FUNCTION). Otherwise, the binding
	      // mode depends on properties of the current scope (see
	      // treatFunctionsAsVar).
	      { this.checkLVal(node.id, (this.strict || node.generator || node.async) ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION); }
	  }

	  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
	  this.yieldPos = 0;
	  this.awaitPos = 0;
	  this.awaitIdentPos = 0;
	  this.enterScope(functionFlags(node.async, node.generator));

	  if (!(statement & FUNC_STATEMENT))
	    { node.id = this.type === types.name ? this.parseIdent() : null; }

	  this.parseFunctionParams(node);
	  this.parseFunctionBody(node, allowExpressionBody, false);

	  this.yieldPos = oldYieldPos;
	  this.awaitPos = oldAwaitPos;
	  this.awaitIdentPos = oldAwaitIdentPos;
	  return this.finishNode(node, (statement & FUNC_STATEMENT) ? "FunctionDeclaration" : "FunctionExpression")
	};

	pp$1.parseFunctionParams = function(node) {
	  this.expect(types.parenL);
	  node.params = this.parseBindingList(types.parenR, false, this.options.ecmaVersion >= 8);
	  this.checkYieldAwaitInDefaultParams();
	};

	// Parse a class declaration or literal (depending on the
	// `isStatement` parameter).

	pp$1.parseClass = function(node, isStatement) {
	  this.next();

	  // ecma-262 14.6 Class Definitions
	  // A class definition is always strict mode code.
	  var oldStrict = this.strict;
	  this.strict = true;

	  this.parseClassId(node, isStatement);
	  this.parseClassSuper(node);
	  var classBody = this.startNode();
	  var hadConstructor = false;
	  classBody.body = [];
	  this.expect(types.braceL);
	  while (this.type !== types.braceR) {
	    var element = this.parseClassElement(node.superClass !== null);
	    if (element) {
	      classBody.body.push(element);
	      if (element.type === "MethodDefinition" && element.kind === "constructor") {
	        if (hadConstructor) { this.raise(element.start, "Duplicate constructor in the same class"); }
	        hadConstructor = true;
	      }
	    }
	  }
	  this.strict = oldStrict;
	  this.next();
	  node.body = this.finishNode(classBody, "ClassBody");
	  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression")
	};

	pp$1.parseClassElement = function(constructorAllowsSuper) {
	  var this$1$1 = this;

	  if (this.eat(types.semi)) { return null }

	  var method = this.startNode();
	  var tryContextual = function (k, noLineBreak) {
	    if ( noLineBreak === void 0 ) noLineBreak = false;

	    var start = this$1$1.start, startLoc = this$1$1.startLoc;
	    if (!this$1$1.eatContextual(k)) { return false }
	    if (this$1$1.type !== types.parenL && (!noLineBreak || !this$1$1.canInsertSemicolon())) { return true }
	    if (method.key) { this$1$1.unexpected(); }
	    method.computed = false;
	    method.key = this$1$1.startNodeAt(start, startLoc);
	    method.key.name = k;
	    this$1$1.finishNode(method.key, "Identifier");
	    return false
	  };

	  method.kind = "method";
	  method.static = tryContextual("static");
	  var isGenerator = this.eat(types.star);
	  var isAsync = false;
	  if (!isGenerator) {
	    if (this.options.ecmaVersion >= 8 && tryContextual("async", true)) {
	      isAsync = true;
	      isGenerator = this.options.ecmaVersion >= 9 && this.eat(types.star);
	    } else if (tryContextual("get")) {
	      method.kind = "get";
	    } else if (tryContextual("set")) {
	      method.kind = "set";
	    }
	  }
	  if (!method.key) { this.parsePropertyName(method); }
	  var key = method.key;
	  var allowsDirectSuper = false;
	  if (!method.computed && !method.static && (key.type === "Identifier" && key.name === "constructor" ||
	      key.type === "Literal" && key.value === "constructor")) {
	    if (method.kind !== "method") { this.raise(key.start, "Constructor can't have get/set modifier"); }
	    if (isGenerator) { this.raise(key.start, "Constructor can't be a generator"); }
	    if (isAsync) { this.raise(key.start, "Constructor can't be an async method"); }
	    method.kind = "constructor";
	    allowsDirectSuper = constructorAllowsSuper;
	  } else if (method.static && key.type === "Identifier" && key.name === "prototype") {
	    this.raise(key.start, "Classes may not have a static property named prototype");
	  }
	  this.parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper);
	  if (method.kind === "get" && method.value.params.length !== 0)
	    { this.raiseRecoverable(method.value.start, "getter should have no params"); }
	  if (method.kind === "set" && method.value.params.length !== 1)
	    { this.raiseRecoverable(method.value.start, "setter should have exactly one param"); }
	  if (method.kind === "set" && method.value.params[0].type === "RestElement")
	    { this.raiseRecoverable(method.value.params[0].start, "Setter cannot use rest params"); }
	  return method
	};

	pp$1.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
	  method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
	  return this.finishNode(method, "MethodDefinition")
	};

	pp$1.parseClassId = function(node, isStatement) {
	  if (this.type === types.name) {
	    node.id = this.parseIdent();
	    if (isStatement)
	      { this.checkLVal(node.id, BIND_LEXICAL, false); }
	  } else {
	    if (isStatement === true)
	      { this.unexpected(); }
	    node.id = null;
	  }
	};

	pp$1.parseClassSuper = function(node) {
	  node.superClass = this.eat(types._extends) ? this.parseExprSubscripts() : null;
	};

	// Parses module export declaration.

	pp$1.parseExport = function(node, exports) {
	  this.next();
	  // export * from '...'
	  if (this.eat(types.star)) {
	    if (this.options.ecmaVersion >= 11) {
	      if (this.eatContextual("as")) {
	        node.exported = this.parseIdent(true);
	        this.checkExport(exports, node.exported.name, this.lastTokStart);
	      } else {
	        node.exported = null;
	      }
	    }
	    this.expectContextual("from");
	    if (this.type !== types.string) { this.unexpected(); }
	    node.source = this.parseExprAtom();
	    this.semicolon();
	    return this.finishNode(node, "ExportAllDeclaration")
	  }
	  if (this.eat(types._default)) { // export default ...
	    this.checkExport(exports, "default", this.lastTokStart);
	    var isAsync;
	    if (this.type === types._function || (isAsync = this.isAsyncFunction())) {
	      var fNode = this.startNode();
	      this.next();
	      if (isAsync) { this.next(); }
	      node.declaration = this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
	    } else if (this.type === types._class) {
	      var cNode = this.startNode();
	      node.declaration = this.parseClass(cNode, "nullableID");
	    } else {
	      node.declaration = this.parseMaybeAssign();
	      this.semicolon();
	    }
	    return this.finishNode(node, "ExportDefaultDeclaration")
	  }
	  // export var|const|let|function|class ...
	  if (this.shouldParseExportStatement()) {
	    node.declaration = this.parseStatement(null);
	    if (node.declaration.type === "VariableDeclaration")
	      { this.checkVariableExport(exports, node.declaration.declarations); }
	    else
	      { this.checkExport(exports, node.declaration.id.name, node.declaration.id.start); }
	    node.specifiers = [];
	    node.source = null;
	  } else { // export { x, y as z } [from '...']
	    node.declaration = null;
	    node.specifiers = this.parseExportSpecifiers(exports);
	    if (this.eatContextual("from")) {
	      if (this.type !== types.string) { this.unexpected(); }
	      node.source = this.parseExprAtom();
	    } else {
	      for (var i = 0, list = node.specifiers; i < list.length; i += 1) {
	        // check for keywords used as local names
	        var spec = list[i];

	        this.checkUnreserved(spec.local);
	        // check if export is defined
	        this.checkLocalExport(spec.local);
	      }

	      node.source = null;
	    }
	    this.semicolon();
	  }
	  return this.finishNode(node, "ExportNamedDeclaration")
	};

	pp$1.checkExport = function(exports, name, pos) {
	  if (!exports) { return }
	  if (has(exports, name))
	    { this.raiseRecoverable(pos, "Duplicate export '" + name + "'"); }
	  exports[name] = true;
	};

	pp$1.checkPatternExport = function(exports, pat) {
	  var type = pat.type;
	  if (type === "Identifier")
	    { this.checkExport(exports, pat.name, pat.start); }
	  else if (type === "ObjectPattern")
	    { for (var i = 0, list = pat.properties; i < list.length; i += 1)
	      {
	        var prop = list[i];

	        this.checkPatternExport(exports, prop);
	      } }
	  else if (type === "ArrayPattern")
	    { for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
	      var elt = list$1[i$1];

	        if (elt) { this.checkPatternExport(exports, elt); }
	    } }
	  else if (type === "Property")
	    { this.checkPatternExport(exports, pat.value); }
	  else if (type === "AssignmentPattern")
	    { this.checkPatternExport(exports, pat.left); }
	  else if (type === "RestElement")
	    { this.checkPatternExport(exports, pat.argument); }
	  else if (type === "ParenthesizedExpression")
	    { this.checkPatternExport(exports, pat.expression); }
	};

	pp$1.checkVariableExport = function(exports, decls) {
	  if (!exports) { return }
	  for (var i = 0, list = decls; i < list.length; i += 1)
	    {
	    var decl = list[i];

	    this.checkPatternExport(exports, decl.id);
	  }
	};

	pp$1.shouldParseExportStatement = function() {
	  return this.type.keyword === "var" ||
	    this.type.keyword === "const" ||
	    this.type.keyword === "class" ||
	    this.type.keyword === "function" ||
	    this.isLet() ||
	    this.isAsyncFunction()
	};

	// Parses a comma-separated list of module exports.

	pp$1.parseExportSpecifiers = function(exports) {
	  var nodes = [], first = true;
	  // export { x, y as z } [from '...']
	  this.expect(types.braceL);
	  while (!this.eat(types.braceR)) {
	    if (!first) {
	      this.expect(types.comma);
	      if (this.afterTrailingComma(types.braceR)) { break }
	    } else { first = false; }

	    var node = this.startNode();
	    node.local = this.parseIdent(true);
	    node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
	    this.checkExport(exports, node.exported.name, node.exported.start);
	    nodes.push(this.finishNode(node, "ExportSpecifier"));
	  }
	  return nodes
	};

	// Parses import declaration.

	pp$1.parseImport = function(node) {
	  this.next();
	  // import '...'
	  if (this.type === types.string) {
	    node.specifiers = empty;
	    node.source = this.parseExprAtom();
	  } else {
	    node.specifiers = this.parseImportSpecifiers();
	    this.expectContextual("from");
	    node.source = this.type === types.string ? this.parseExprAtom() : this.unexpected();
	  }
	  this.semicolon();
	  return this.finishNode(node, "ImportDeclaration")
	};

	// Parses a comma-separated list of module imports.

	pp$1.parseImportSpecifiers = function() {
	  var nodes = [], first = true;
	  if (this.type === types.name) {
	    // import defaultObj, { x, y as z } from '...'
	    var node = this.startNode();
	    node.local = this.parseIdent();
	    this.checkLVal(node.local, BIND_LEXICAL);
	    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
	    if (!this.eat(types.comma)) { return nodes }
	  }
	  if (this.type === types.star) {
	    var node$1 = this.startNode();
	    this.next();
	    this.expectContextual("as");
	    node$1.local = this.parseIdent();
	    this.checkLVal(node$1.local, BIND_LEXICAL);
	    nodes.push(this.finishNode(node$1, "ImportNamespaceSpecifier"));
	    return nodes
	  }
	  this.expect(types.braceL);
	  while (!this.eat(types.braceR)) {
	    if (!first) {
	      this.expect(types.comma);
	      if (this.afterTrailingComma(types.braceR)) { break }
	    } else { first = false; }

	    var node$2 = this.startNode();
	    node$2.imported = this.parseIdent(true);
	    if (this.eatContextual("as")) {
	      node$2.local = this.parseIdent();
	    } else {
	      this.checkUnreserved(node$2.imported);
	      node$2.local = node$2.imported;
	    }
	    this.checkLVal(node$2.local, BIND_LEXICAL);
	    nodes.push(this.finishNode(node$2, "ImportSpecifier"));
	  }
	  return nodes
	};

	// Set `ExpressionStatement#directive` property for directive prologues.
	pp$1.adaptDirectivePrologue = function(statements) {
	  for (var i = 0; i < statements.length && this.isDirectiveCandidate(statements[i]); ++i) {
	    statements[i].directive = statements[i].expression.raw.slice(1, -1);
	  }
	};
	pp$1.isDirectiveCandidate = function(statement) {
	  return (
	    statement.type === "ExpressionStatement" &&
	    statement.expression.type === "Literal" &&
	    typeof statement.expression.value === "string" &&
	    // Reject parenthesized strings.
	    (this.input[statement.start] === "\"" || this.input[statement.start] === "'")
	  )
	};

	var pp$2 = Parser.prototype;

	// Convert existing expression atom to assignable pattern
	// if possible.

	pp$2.toAssignable = function(node, isBinding, refDestructuringErrors) {
	  if (this.options.ecmaVersion >= 6 && node) {
	    switch (node.type) {
	    case "Identifier":
	      if (this.inAsync && node.name === "await")
	        { this.raise(node.start, "Cannot use 'await' as identifier inside an async function"); }
	      break

	    case "ObjectPattern":
	    case "ArrayPattern":
	    case "RestElement":
	      break

	    case "ObjectExpression":
	      node.type = "ObjectPattern";
	      if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
	      for (var i = 0, list = node.properties; i < list.length; i += 1) {
	        var prop = list[i];

	      this.toAssignable(prop, isBinding);
	        // Early error:
	        //   AssignmentRestProperty[Yield, Await] :
	        //     `...` DestructuringAssignmentTarget[Yield, Await]
	        //
	        //   It is a Syntax Error if |DestructuringAssignmentTarget| is an |ArrayLiteral| or an |ObjectLiteral|.
	        if (
	          prop.type === "RestElement" &&
	          (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")
	        ) {
	          this.raise(prop.argument.start, "Unexpected token");
	        }
	      }
	      break

	    case "Property":
	      // AssignmentProperty has type === "Property"
	      if (node.kind !== "init") { this.raise(node.key.start, "Object pattern can't contain getter or setter"); }
	      this.toAssignable(node.value, isBinding);
	      break

	    case "ArrayExpression":
	      node.type = "ArrayPattern";
	      if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
	      this.toAssignableList(node.elements, isBinding);
	      break

	    case "SpreadElement":
	      node.type = "RestElement";
	      this.toAssignable(node.argument, isBinding);
	      if (node.argument.type === "AssignmentPattern")
	        { this.raise(node.argument.start, "Rest elements cannot have a default value"); }
	      break

	    case "AssignmentExpression":
	      if (node.operator !== "=") { this.raise(node.left.end, "Only '=' operator can be used for specifying default value."); }
	      node.type = "AssignmentPattern";
	      delete node.operator;
	      this.toAssignable(node.left, isBinding);
	      // falls through to AssignmentPattern

	    case "AssignmentPattern":
	      break

	    case "ParenthesizedExpression":
	      this.toAssignable(node.expression, isBinding, refDestructuringErrors);
	      break

	    case "ChainExpression":
	      this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
	      break

	    case "MemberExpression":
	      if (!isBinding) { break }

	    default:
	      this.raise(node.start, "Assigning to rvalue");
	    }
	  } else if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
	  return node
	};

	// Convert list of expression atoms to binding list.

	pp$2.toAssignableList = function(exprList, isBinding) {
	  var end = exprList.length;
	  for (var i = 0; i < end; i++) {
	    var elt = exprList[i];
	    if (elt) { this.toAssignable(elt, isBinding); }
	  }
	  if (end) {
	    var last = exprList[end - 1];
	    if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier")
	      { this.unexpected(last.argument.start); }
	  }
	  return exprList
	};

	// Parses spread element.

	pp$2.parseSpread = function(refDestructuringErrors) {
	  var node = this.startNode();
	  this.next();
	  node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
	  return this.finishNode(node, "SpreadElement")
	};

	pp$2.parseRestBinding = function() {
	  var node = this.startNode();
	  this.next();

	  // RestElement inside of a function parameter must be an identifier
	  if (this.options.ecmaVersion === 6 && this.type !== types.name)
	    { this.unexpected(); }

	  node.argument = this.parseBindingAtom();

	  return this.finishNode(node, "RestElement")
	};

	// Parses lvalue (assignable) atom.

	pp$2.parseBindingAtom = function() {
	  if (this.options.ecmaVersion >= 6) {
	    switch (this.type) {
	    case types.bracketL:
	      var node = this.startNode();
	      this.next();
	      node.elements = this.parseBindingList(types.bracketR, true, true);
	      return this.finishNode(node, "ArrayPattern")

	    case types.braceL:
	      return this.parseObj(true)
	    }
	  }
	  return this.parseIdent()
	};

	pp$2.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
	  var elts = [], first = true;
	  while (!this.eat(close)) {
	    if (first) { first = false; }
	    else { this.expect(types.comma); }
	    if (allowEmpty && this.type === types.comma) {
	      elts.push(null);
	    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
	      break
	    } else if (this.type === types.ellipsis) {
	      var rest = this.parseRestBinding();
	      this.parseBindingListItem(rest);
	      elts.push(rest);
	      if (this.type === types.comma) { this.raise(this.start, "Comma is not permitted after the rest element"); }
	      this.expect(close);
	      break
	    } else {
	      var elem = this.parseMaybeDefault(this.start, this.startLoc);
	      this.parseBindingListItem(elem);
	      elts.push(elem);
	    }
	  }
	  return elts
	};

	pp$2.parseBindingListItem = function(param) {
	  return param
	};

	// Parses assignment pattern around given atom if possible.

	pp$2.parseMaybeDefault = function(startPos, startLoc, left) {
	  left = left || this.parseBindingAtom();
	  if (this.options.ecmaVersion < 6 || !this.eat(types.eq)) { return left }
	  var node = this.startNodeAt(startPos, startLoc);
	  node.left = left;
	  node.right = this.parseMaybeAssign();
	  return this.finishNode(node, "AssignmentPattern")
	};

	// Verify that a node is an lval — something that can be assigned
	// to.
	// bindingType can be either:
	// 'var' indicating that the lval creates a 'var' binding
	// 'let' indicating that the lval creates a lexical ('let' or 'const') binding
	// 'none' indicating that the binding should be checked for illegal identifiers, but not for duplicate references

	pp$2.checkLVal = function(expr, bindingType, checkClashes) {
	  if ( bindingType === void 0 ) bindingType = BIND_NONE;

	  switch (expr.type) {
	  case "Identifier":
	    if (bindingType === BIND_LEXICAL && expr.name === "let")
	      { this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name"); }
	    if (this.strict && this.reservedWordsStrictBind.test(expr.name))
	      { this.raiseRecoverable(expr.start, (bindingType ? "Binding " : "Assigning to ") + expr.name + " in strict mode"); }
	    if (checkClashes) {
	      if (has(checkClashes, expr.name))
	        { this.raiseRecoverable(expr.start, "Argument name clash"); }
	      checkClashes[expr.name] = true;
	    }
	    if (bindingType !== BIND_NONE && bindingType !== BIND_OUTSIDE) { this.declareName(expr.name, bindingType, expr.start); }
	    break

	  case "ChainExpression":
	    this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
	    break

	  case "MemberExpression":
	    if (bindingType) { this.raiseRecoverable(expr.start, "Binding member expression"); }
	    break

	  case "ObjectPattern":
	    for (var i = 0, list = expr.properties; i < list.length; i += 1)
	      {
	    var prop = list[i];

	    this.checkLVal(prop, bindingType, checkClashes);
	  }
	    break

	  case "Property":
	    // AssignmentProperty has type === "Property"
	    this.checkLVal(expr.value, bindingType, checkClashes);
	    break

	  case "ArrayPattern":
	    for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
	      var elem = list$1[i$1];

	    if (elem) { this.checkLVal(elem, bindingType, checkClashes); }
	    }
	    break

	  case "AssignmentPattern":
	    this.checkLVal(expr.left, bindingType, checkClashes);
	    break

	  case "RestElement":
	    this.checkLVal(expr.argument, bindingType, checkClashes);
	    break

	  case "ParenthesizedExpression":
	    this.checkLVal(expr.expression, bindingType, checkClashes);
	    break

	  default:
	    this.raise(expr.start, (bindingType ? "Binding" : "Assigning to") + " rvalue");
	  }
	};

	// A recursive descent parser operates by defining functions for all

	var pp$3 = Parser.prototype;

	// Check if property name clashes with already added.
	// Object/class getters and setters are not allowed to clash —
	// either with each other or with an init property — and in
	// strict mode, init properties are also not allowed to be repeated.

	pp$3.checkPropClash = function(prop, propHash, refDestructuringErrors) {
	  if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement")
	    { return }
	  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand))
	    { return }
	  var key = prop.key;
	  var name;
	  switch (key.type) {
	  case "Identifier": name = key.name; break
	  case "Literal": name = String(key.value); break
	  default: return
	  }
	  var kind = prop.kind;
	  if (this.options.ecmaVersion >= 6) {
	    if (name === "__proto__" && kind === "init") {
	      if (propHash.proto) {
	        if (refDestructuringErrors) {
	          if (refDestructuringErrors.doubleProto < 0)
	            { refDestructuringErrors.doubleProto = key.start; }
	          // Backwards-compat kludge. Can be removed in version 6.0
	        } else { this.raiseRecoverable(key.start, "Redefinition of __proto__ property"); }
	      }
	      propHash.proto = true;
	    }
	    return
	  }
	  name = "$" + name;
	  var other = propHash[name];
	  if (other) {
	    var redefinition;
	    if (kind === "init") {
	      redefinition = this.strict && other.init || other.get || other.set;
	    } else {
	      redefinition = other.init || other[kind];
	    }
	    if (redefinition)
	      { this.raiseRecoverable(key.start, "Redefinition of property"); }
	  } else {
	    other = propHash[name] = {
	      init: false,
	      get: false,
	      set: false
	    };
	  }
	  other[kind] = true;
	};

	// ### Expression parsing

	// These nest, from the most general expression type at the top to
	// 'atomic', nondivisible expression types at the bottom. Most of
	// the functions will simply let the function(s) below them parse,
	// and, *if* the syntactic construct they handle is present, wrap
	// the AST node that the inner parser gave them in another node.

	// Parse a full expression. The optional arguments are used to
	// forbid the `in` operator (in for loops initalization expressions)
	// and provide reference for storing '=' operator inside shorthand
	// property assignment in contexts where both object expression
	// and object pattern might appear (so it's possible to raise
	// delayed syntax error at correct position).

	pp$3.parseExpression = function(noIn, refDestructuringErrors) {
	  var startPos = this.start, startLoc = this.startLoc;
	  var expr = this.parseMaybeAssign(noIn, refDestructuringErrors);
	  if (this.type === types.comma) {
	    var node = this.startNodeAt(startPos, startLoc);
	    node.expressions = [expr];
	    while (this.eat(types.comma)) { node.expressions.push(this.parseMaybeAssign(noIn, refDestructuringErrors)); }
	    return this.finishNode(node, "SequenceExpression")
	  }
	  return expr
	};

	// Parse an assignment expression. This includes applications of
	// operators like `+=`.

	pp$3.parseMaybeAssign = function(noIn, refDestructuringErrors, afterLeftParse) {
	  if (this.isContextual("yield")) {
	    if (this.inGenerator) { return this.parseYield(noIn) }
	    // The tokenizer will assume an expression is allowed after
	    // `yield`, but this isn't that kind of yield
	    else { this.exprAllowed = false; }
	  }

	  var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1;
	  if (refDestructuringErrors) {
	    oldParenAssign = refDestructuringErrors.parenthesizedAssign;
	    oldTrailingComma = refDestructuringErrors.trailingComma;
	    refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
	  } else {
	    refDestructuringErrors = new DestructuringErrors;
	    ownDestructuringErrors = true;
	  }

	  var startPos = this.start, startLoc = this.startLoc;
	  if (this.type === types.parenL || this.type === types.name)
	    { this.potentialArrowAt = this.start; }
	  var left = this.parseMaybeConditional(noIn, refDestructuringErrors);
	  if (afterLeftParse) { left = afterLeftParse.call(this, left, startPos, startLoc); }
	  if (this.type.isAssign) {
	    var node = this.startNodeAt(startPos, startLoc);
	    node.operator = this.value;
	    node.left = this.type === types.eq ? this.toAssignable(left, false, refDestructuringErrors) : left;
	    if (!ownDestructuringErrors) {
	      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
	    }
	    if (refDestructuringErrors.shorthandAssign >= node.left.start)
	      { refDestructuringErrors.shorthandAssign = -1; } // reset because shorthand default was used correctly
	    this.checkLVal(left);
	    this.next();
	    node.right = this.parseMaybeAssign(noIn);
	    return this.finishNode(node, "AssignmentExpression")
	  } else {
	    if (ownDestructuringErrors) { this.checkExpressionErrors(refDestructuringErrors, true); }
	  }
	  if (oldParenAssign > -1) { refDestructuringErrors.parenthesizedAssign = oldParenAssign; }
	  if (oldTrailingComma > -1) { refDestructuringErrors.trailingComma = oldTrailingComma; }
	  return left
	};

	// Parse a ternary conditional (`?:`) operator.

	pp$3.parseMaybeConditional = function(noIn, refDestructuringErrors) {
	  var startPos = this.start, startLoc = this.startLoc;
	  var expr = this.parseExprOps(noIn, refDestructuringErrors);
	  if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
	  if (this.eat(types.question)) {
	    var node = this.startNodeAt(startPos, startLoc);
	    node.test = expr;
	    node.consequent = this.parseMaybeAssign();
	    this.expect(types.colon);
	    node.alternate = this.parseMaybeAssign(noIn);
	    return this.finishNode(node, "ConditionalExpression")
	  }
	  return expr
	};

	// Start the precedence parser.

	pp$3.parseExprOps = function(noIn, refDestructuringErrors) {
	  var startPos = this.start, startLoc = this.startLoc;
	  var expr = this.parseMaybeUnary(refDestructuringErrors, false);
	  if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
	  return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, noIn)
	};

	// Parse binary operators with the operator precedence parsing
	// algorithm. `left` is the left-hand side of the operator.
	// `minPrec` provides context that allows the function to stop and
	// defer further parser to one of its callers when it encounters an
	// operator that has a lower precedence than the set it is parsing.

	pp$3.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, noIn) {
	  var prec = this.type.binop;
	  if (prec != null && (!noIn || this.type !== types._in)) {
	    if (prec > minPrec) {
	      var logical = this.type === types.logicalOR || this.type === types.logicalAND;
	      var coalesce = this.type === types.coalesce;
	      if (coalesce) {
	        // Handle the precedence of `tt.coalesce` as equal to the range of logical expressions.
	        // In other words, `node.right` shouldn't contain logical expressions in order to check the mixed error.
	        prec = types.logicalAND.binop;
	      }
	      var op = this.value;
	      this.next();
	      var startPos = this.start, startLoc = this.startLoc;
	      var right = this.parseExprOp(this.parseMaybeUnary(null, false), startPos, startLoc, prec, noIn);
	      var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);
	      if ((logical && this.type === types.coalesce) || (coalesce && (this.type === types.logicalOR || this.type === types.logicalAND))) {
	        this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
	      }
	      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn)
	    }
	  }
	  return left
	};

	pp$3.buildBinary = function(startPos, startLoc, left, right, op, logical) {
	  var node = this.startNodeAt(startPos, startLoc);
	  node.left = left;
	  node.operator = op;
	  node.right = right;
	  return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression")
	};

	// Parse unary operators, both prefix and postfix.

	pp$3.parseMaybeUnary = function(refDestructuringErrors, sawUnary) {
	  var startPos = this.start, startLoc = this.startLoc, expr;
	  if (this.isContextual("await") && (this.inAsync || (!this.inFunction && this.options.allowAwaitOutsideFunction))) {
	    expr = this.parseAwait();
	    sawUnary = true;
	  } else if (this.type.prefix) {
	    var node = this.startNode(), update = this.type === types.incDec;
	    node.operator = this.value;
	    node.prefix = true;
	    this.next();
	    node.argument = this.parseMaybeUnary(null, true);
	    this.checkExpressionErrors(refDestructuringErrors, true);
	    if (update) { this.checkLVal(node.argument); }
	    else if (this.strict && node.operator === "delete" &&
	             node.argument.type === "Identifier")
	      { this.raiseRecoverable(node.start, "Deleting local variable in strict mode"); }
	    else { sawUnary = true; }
	    expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
	  } else {
	    expr = this.parseExprSubscripts(refDestructuringErrors);
	    if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
	    while (this.type.postfix && !this.canInsertSemicolon()) {
	      var node$1 = this.startNodeAt(startPos, startLoc);
	      node$1.operator = this.value;
	      node$1.prefix = false;
	      node$1.argument = expr;
	      this.checkLVal(expr);
	      this.next();
	      expr = this.finishNode(node$1, "UpdateExpression");
	    }
	  }

	  if (!sawUnary && this.eat(types.starstar))
	    { return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false), "**", false) }
	  else
	    { return expr }
	};

	// Parse call, dot, and `[]`-subscript expressions.

	pp$3.parseExprSubscripts = function(refDestructuringErrors) {
	  var startPos = this.start, startLoc = this.startLoc;
	  var expr = this.parseExprAtom(refDestructuringErrors);
	  if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")")
	    { return expr }
	  var result = this.parseSubscripts(expr, startPos, startLoc);
	  if (refDestructuringErrors && result.type === "MemberExpression") {
	    if (refDestructuringErrors.parenthesizedAssign >= result.start) { refDestructuringErrors.parenthesizedAssign = -1; }
	    if (refDestructuringErrors.parenthesizedBind >= result.start) { refDestructuringErrors.parenthesizedBind = -1; }
	  }
	  return result
	};

	pp$3.parseSubscripts = function(base, startPos, startLoc, noCalls) {
	  var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" &&
	      this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 &&
	      this.potentialArrowAt === base.start;
	  var optionalChained = false;

	  while (true) {
	    var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained);

	    if (element.optional) { optionalChained = true; }
	    if (element === base || element.type === "ArrowFunctionExpression") {
	      if (optionalChained) {
	        var chainNode = this.startNodeAt(startPos, startLoc);
	        chainNode.expression = element;
	        element = this.finishNode(chainNode, "ChainExpression");
	      }
	      return element
	    }

	    base = element;
	  }
	};

	pp$3.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained) {
	  var optionalSupported = this.options.ecmaVersion >= 11;
	  var optional = optionalSupported && this.eat(types.questionDot);
	  if (noCalls && optional) { this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions"); }

	  var computed = this.eat(types.bracketL);
	  if (computed || (optional && this.type !== types.parenL && this.type !== types.backQuote) || this.eat(types.dot)) {
	    var node = this.startNodeAt(startPos, startLoc);
	    node.object = base;
	    node.property = computed ? this.parseExpression() : this.parseIdent(this.options.allowReserved !== "never");
	    node.computed = !!computed;
	    if (computed) { this.expect(types.bracketR); }
	    if (optionalSupported) {
	      node.optional = optional;
	    }
	    base = this.finishNode(node, "MemberExpression");
	  } else if (!noCalls && this.eat(types.parenL)) {
	    var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
	    this.yieldPos = 0;
	    this.awaitPos = 0;
	    this.awaitIdentPos = 0;
	    var exprList = this.parseExprList(types.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
	    if (maybeAsyncArrow && !optional && !this.canInsertSemicolon() && this.eat(types.arrow)) {
	      this.checkPatternErrors(refDestructuringErrors, false);
	      this.checkYieldAwaitInDefaultParams();
	      if (this.awaitIdentPos > 0)
	        { this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function"); }
	      this.yieldPos = oldYieldPos;
	      this.awaitPos = oldAwaitPos;
	      this.awaitIdentPos = oldAwaitIdentPos;
	      return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true)
	    }
	    this.checkExpressionErrors(refDestructuringErrors, true);
	    this.yieldPos = oldYieldPos || this.yieldPos;
	    this.awaitPos = oldAwaitPos || this.awaitPos;
	    this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
	    var node$1 = this.startNodeAt(startPos, startLoc);
	    node$1.callee = base;
	    node$1.arguments = exprList;
	    if (optionalSupported) {
	      node$1.optional = optional;
	    }
	    base = this.finishNode(node$1, "CallExpression");
	  } else if (this.type === types.backQuote) {
	    if (optional || optionalChained) {
	      this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
	    }
	    var node$2 = this.startNodeAt(startPos, startLoc);
	    node$2.tag = base;
	    node$2.quasi = this.parseTemplate({isTagged: true});
	    base = this.finishNode(node$2, "TaggedTemplateExpression");
	  }
	  return base
	};

	// Parse an atomic expression — either a single token that is an
	// expression, an expression started by a keyword like `function` or
	// `new`, or an expression wrapped in punctuation like `()`, `[]`,
	// or `{}`.

	pp$3.parseExprAtom = function(refDestructuringErrors) {
	  // If a division operator appears in an expression position, the
	  // tokenizer got confused, and we force it to read a regexp instead.
	  if (this.type === types.slash) { this.readRegexp(); }

	  var node, canBeArrow = this.potentialArrowAt === this.start;
	  switch (this.type) {
	  case types._super:
	    if (!this.allowSuper)
	      { this.raise(this.start, "'super' keyword outside a method"); }
	    node = this.startNode();
	    this.next();
	    if (this.type === types.parenL && !this.allowDirectSuper)
	      { this.raise(node.start, "super() call outside constructor of a subclass"); }
	    // The `super` keyword can appear at below:
	    // SuperProperty:
	    //     super [ Expression ]
	    //     super . IdentifierName
	    // SuperCall:
	    //     super ( Arguments )
	    if (this.type !== types.dot && this.type !== types.bracketL && this.type !== types.parenL)
	      { this.unexpected(); }
	    return this.finishNode(node, "Super")

	  case types._this:
	    node = this.startNode();
	    this.next();
	    return this.finishNode(node, "ThisExpression")

	  case types.name:
	    var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
	    var id = this.parseIdent(false);
	    if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(types._function))
	      { return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true) }
	    if (canBeArrow && !this.canInsertSemicolon()) {
	      if (this.eat(types.arrow))
	        { return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false) }
	      if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === types.name && !containsEsc) {
	        id = this.parseIdent(false);
	        if (this.canInsertSemicolon() || !this.eat(types.arrow))
	          { this.unexpected(); }
	        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true)
	      }
	    }
	    return id

	  case types.regexp:
	    var value = this.value;
	    node = this.parseLiteral(value.value);
	    node.regex = {pattern: value.pattern, flags: value.flags};
	    return node

	  case types.num: case types.string:
	    return this.parseLiteral(this.value)

	  case types._null: case types._true: case types._false:
	    node = this.startNode();
	    node.value = this.type === types._null ? null : this.type === types._true;
	    node.raw = this.type.keyword;
	    this.next();
	    return this.finishNode(node, "Literal")

	  case types.parenL:
	    var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow);
	    if (refDestructuringErrors) {
	      if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr))
	        { refDestructuringErrors.parenthesizedAssign = start; }
	      if (refDestructuringErrors.parenthesizedBind < 0)
	        { refDestructuringErrors.parenthesizedBind = start; }
	    }
	    return expr

	  case types.bracketL:
	    node = this.startNode();
	    this.next();
	    node.elements = this.parseExprList(types.bracketR, true, true, refDestructuringErrors);
	    return this.finishNode(node, "ArrayExpression")

	  case types.braceL:
	    return this.parseObj(false, refDestructuringErrors)

	  case types._function:
	    node = this.startNode();
	    this.next();
	    return this.parseFunction(node, 0)

	  case types._class:
	    return this.parseClass(this.startNode(), false)

	  case types._new:
	    return this.parseNew()

	  case types.backQuote:
	    return this.parseTemplate()

	  case types._import:
	    if (this.options.ecmaVersion >= 11) {
	      return this.parseExprImport()
	    } else {
	      return this.unexpected()
	    }

	  default:
	    this.unexpected();
	  }
	};

	pp$3.parseExprImport = function() {
	  var node = this.startNode();

	  // Consume `import` as an identifier for `import.meta`.
	  // Because `this.parseIdent(true)` doesn't check escape sequences, it needs the check of `this.containsEsc`.
	  if (this.containsEsc) { this.raiseRecoverable(this.start, "Escape sequence in keyword import"); }
	  var meta = this.parseIdent(true);

	  switch (this.type) {
	  case types.parenL:
	    return this.parseDynamicImport(node)
	  case types.dot:
	    node.meta = meta;
	    return this.parseImportMeta(node)
	  default:
	    this.unexpected();
	  }
	};

	pp$3.parseDynamicImport = function(node) {
	  this.next(); // skip `(`

	  // Parse node.source.
	  node.source = this.parseMaybeAssign();

	  // Verify ending.
	  if (!this.eat(types.parenR)) {
	    var errorPos = this.start;
	    if (this.eat(types.comma) && this.eat(types.parenR)) {
	      this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
	    } else {
	      this.unexpected(errorPos);
	    }
	  }

	  return this.finishNode(node, "ImportExpression")
	};

	pp$3.parseImportMeta = function(node) {
	  this.next(); // skip `.`

	  var containsEsc = this.containsEsc;
	  node.property = this.parseIdent(true);

	  if (node.property.name !== "meta")
	    { this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'"); }
	  if (containsEsc)
	    { this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters"); }
	  if (this.options.sourceType !== "module")
	    { this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module"); }

	  return this.finishNode(node, "MetaProperty")
	};

	pp$3.parseLiteral = function(value) {
	  var node = this.startNode();
	  node.value = value;
	  node.raw = this.input.slice(this.start, this.end);
	  if (node.raw.charCodeAt(node.raw.length - 1) === 110) { node.bigint = node.raw.slice(0, -1).replace(/_/g, ""); }
	  this.next();
	  return this.finishNode(node, "Literal")
	};

	pp$3.parseParenExpression = function() {
	  this.expect(types.parenL);
	  var val = this.parseExpression();
	  this.expect(types.parenR);
	  return val
	};

	pp$3.parseParenAndDistinguishExpression = function(canBeArrow) {
	  var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
	  if (this.options.ecmaVersion >= 6) {
	    this.next();

	    var innerStartPos = this.start, innerStartLoc = this.startLoc;
	    var exprList = [], first = true, lastIsComma = false;
	    var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
	    this.yieldPos = 0;
	    this.awaitPos = 0;
	    // Do not save awaitIdentPos to allow checking awaits nested in parameters
	    while (this.type !== types.parenR) {
	      first ? first = false : this.expect(types.comma);
	      if (allowTrailingComma && this.afterTrailingComma(types.parenR, true)) {
	        lastIsComma = true;
	        break
	      } else if (this.type === types.ellipsis) {
	        spreadStart = this.start;
	        exprList.push(this.parseParenItem(this.parseRestBinding()));
	        if (this.type === types.comma) { this.raise(this.start, "Comma is not permitted after the rest element"); }
	        break
	      } else {
	        exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
	      }
	    }
	    var innerEndPos = this.start, innerEndLoc = this.startLoc;
	    this.expect(types.parenR);

	    if (canBeArrow && !this.canInsertSemicolon() && this.eat(types.arrow)) {
	      this.checkPatternErrors(refDestructuringErrors, false);
	      this.checkYieldAwaitInDefaultParams();
	      this.yieldPos = oldYieldPos;
	      this.awaitPos = oldAwaitPos;
	      return this.parseParenArrowList(startPos, startLoc, exprList)
	    }

	    if (!exprList.length || lastIsComma) { this.unexpected(this.lastTokStart); }
	    if (spreadStart) { this.unexpected(spreadStart); }
	    this.checkExpressionErrors(refDestructuringErrors, true);
	    this.yieldPos = oldYieldPos || this.yieldPos;
	    this.awaitPos = oldAwaitPos || this.awaitPos;

	    if (exprList.length > 1) {
	      val = this.startNodeAt(innerStartPos, innerStartLoc);
	      val.expressions = exprList;
	      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
	    } else {
	      val = exprList[0];
	    }
	  } else {
	    val = this.parseParenExpression();
	  }

	  if (this.options.preserveParens) {
	    var par = this.startNodeAt(startPos, startLoc);
	    par.expression = val;
	    return this.finishNode(par, "ParenthesizedExpression")
	  } else {
	    return val
	  }
	};

	pp$3.parseParenItem = function(item) {
	  return item
	};

	pp$3.parseParenArrowList = function(startPos, startLoc, exprList) {
	  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList)
	};

	// New's precedence is slightly tricky. It must allow its argument to
	// be a `[]` or dot subscript expression, but not a call — at least,
	// not without wrapping it in parentheses. Thus, it uses the noCalls
	// argument to parseSubscripts to prevent it from consuming the
	// argument list.

	var empty$1 = [];

	pp$3.parseNew = function() {
	  if (this.containsEsc) { this.raiseRecoverable(this.start, "Escape sequence in keyword new"); }
	  var node = this.startNode();
	  var meta = this.parseIdent(true);
	  if (this.options.ecmaVersion >= 6 && this.eat(types.dot)) {
	    node.meta = meta;
	    var containsEsc = this.containsEsc;
	    node.property = this.parseIdent(true);
	    if (node.property.name !== "target")
	      { this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'"); }
	    if (containsEsc)
	      { this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters"); }
	    if (!this.inNonArrowFunction())
	      { this.raiseRecoverable(node.start, "'new.target' can only be used in functions"); }
	    return this.finishNode(node, "MetaProperty")
	  }
	  var startPos = this.start, startLoc = this.startLoc, isImport = this.type === types._import;
	  node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
	  if (isImport && node.callee.type === "ImportExpression") {
	    this.raise(startPos, "Cannot use new with import()");
	  }
	  if (this.eat(types.parenL)) { node.arguments = this.parseExprList(types.parenR, this.options.ecmaVersion >= 8, false); }
	  else { node.arguments = empty$1; }
	  return this.finishNode(node, "NewExpression")
	};

	// Parse template expression.

	pp$3.parseTemplateElement = function(ref) {
	  var isTagged = ref.isTagged;

	  var elem = this.startNode();
	  if (this.type === types.invalidTemplate) {
	    if (!isTagged) {
	      this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
	    }
	    elem.value = {
	      raw: this.value,
	      cooked: null
	    };
	  } else {
	    elem.value = {
	      raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
	      cooked: this.value
	    };
	  }
	  this.next();
	  elem.tail = this.type === types.backQuote;
	  return this.finishNode(elem, "TemplateElement")
	};

	pp$3.parseTemplate = function(ref) {
	  if ( ref === void 0 ) ref = {};
	  var isTagged = ref.isTagged; if ( isTagged === void 0 ) isTagged = false;

	  var node = this.startNode();
	  this.next();
	  node.expressions = [];
	  var curElt = this.parseTemplateElement({isTagged: isTagged});
	  node.quasis = [curElt];
	  while (!curElt.tail) {
	    if (this.type === types.eof) { this.raise(this.pos, "Unterminated template literal"); }
	    this.expect(types.dollarBraceL);
	    node.expressions.push(this.parseExpression());
	    this.expect(types.braceR);
	    node.quasis.push(curElt = this.parseTemplateElement({isTagged: isTagged}));
	  }
	  this.next();
	  return this.finishNode(node, "TemplateLiteral")
	};

	pp$3.isAsyncProp = function(prop) {
	  return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" &&
	    (this.type === types.name || this.type === types.num || this.type === types.string || this.type === types.bracketL || this.type.keyword || (this.options.ecmaVersion >= 9 && this.type === types.star)) &&
	    !lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
	};

	// Parse an object literal or binding pattern.

	pp$3.parseObj = function(isPattern, refDestructuringErrors) {
	  var node = this.startNode(), first = true, propHash = {};
	  node.properties = [];
	  this.next();
	  while (!this.eat(types.braceR)) {
	    if (!first) {
	      this.expect(types.comma);
	      if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types.braceR)) { break }
	    } else { first = false; }

	    var prop = this.parseProperty(isPattern, refDestructuringErrors);
	    if (!isPattern) { this.checkPropClash(prop, propHash, refDestructuringErrors); }
	    node.properties.push(prop);
	  }
	  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression")
	};

	pp$3.parseProperty = function(isPattern, refDestructuringErrors) {
	  var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
	  if (this.options.ecmaVersion >= 9 && this.eat(types.ellipsis)) {
	    if (isPattern) {
	      prop.argument = this.parseIdent(false);
	      if (this.type === types.comma) {
	        this.raise(this.start, "Comma is not permitted after the rest element");
	      }
	      return this.finishNode(prop, "RestElement")
	    }
	    // To disallow parenthesized identifier via `this.toAssignable()`.
	    if (this.type === types.parenL && refDestructuringErrors) {
	      if (refDestructuringErrors.parenthesizedAssign < 0) {
	        refDestructuringErrors.parenthesizedAssign = this.start;
	      }
	      if (refDestructuringErrors.parenthesizedBind < 0) {
	        refDestructuringErrors.parenthesizedBind = this.start;
	      }
	    }
	    // Parse argument.
	    prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
	    // To disallow trailing comma via `this.toAssignable()`.
	    if (this.type === types.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
	      refDestructuringErrors.trailingComma = this.start;
	    }
	    // Finish
	    return this.finishNode(prop, "SpreadElement")
	  }
	  if (this.options.ecmaVersion >= 6) {
	    prop.method = false;
	    prop.shorthand = false;
	    if (isPattern || refDestructuringErrors) {
	      startPos = this.start;
	      startLoc = this.startLoc;
	    }
	    if (!isPattern)
	      { isGenerator = this.eat(types.star); }
	  }
	  var containsEsc = this.containsEsc;
	  this.parsePropertyName(prop);
	  if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
	    isAsync = true;
	    isGenerator = this.options.ecmaVersion >= 9 && this.eat(types.star);
	    this.parsePropertyName(prop, refDestructuringErrors);
	  } else {
	    isAsync = false;
	  }
	  this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
	  return this.finishNode(prop, "Property")
	};

	pp$3.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
	  if ((isGenerator || isAsync) && this.type === types.colon)
	    { this.unexpected(); }

	  if (this.eat(types.colon)) {
	    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
	    prop.kind = "init";
	  } else if (this.options.ecmaVersion >= 6 && this.type === types.parenL) {
	    if (isPattern) { this.unexpected(); }
	    prop.kind = "init";
	    prop.method = true;
	    prop.value = this.parseMethod(isGenerator, isAsync);
	  } else if (!isPattern && !containsEsc &&
	             this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" &&
	             (prop.key.name === "get" || prop.key.name === "set") &&
	             (this.type !== types.comma && this.type !== types.braceR && this.type !== types.eq)) {
	    if (isGenerator || isAsync) { this.unexpected(); }
	    prop.kind = prop.key.name;
	    this.parsePropertyName(prop);
	    prop.value = this.parseMethod(false);
	    var paramCount = prop.kind === "get" ? 0 : 1;
	    if (prop.value.params.length !== paramCount) {
	      var start = prop.value.start;
	      if (prop.kind === "get")
	        { this.raiseRecoverable(start, "getter should have no params"); }
	      else
	        { this.raiseRecoverable(start, "setter should have exactly one param"); }
	    } else {
	      if (prop.kind === "set" && prop.value.params[0].type === "RestElement")
	        { this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params"); }
	    }
	  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
	    if (isGenerator || isAsync) { this.unexpected(); }
	    this.checkUnreserved(prop.key);
	    if (prop.key.name === "await" && !this.awaitIdentPos)
	      { this.awaitIdentPos = startPos; }
	    prop.kind = "init";
	    if (isPattern) {
	      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
	    } else if (this.type === types.eq && refDestructuringErrors) {
	      if (refDestructuringErrors.shorthandAssign < 0)
	        { refDestructuringErrors.shorthandAssign = this.start; }
	      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
	    } else {
	      prop.value = prop.key;
	    }
	    prop.shorthand = true;
	  } else { this.unexpected(); }
	};

	pp$3.parsePropertyName = function(prop) {
	  if (this.options.ecmaVersion >= 6) {
	    if (this.eat(types.bracketL)) {
	      prop.computed = true;
	      prop.key = this.parseMaybeAssign();
	      this.expect(types.bracketR);
	      return prop.key
	    } else {
	      prop.computed = false;
	    }
	  }
	  return prop.key = this.type === types.num || this.type === types.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never")
	};

	// Initialize empty function node.

	pp$3.initFunction = function(node) {
	  node.id = null;
	  if (this.options.ecmaVersion >= 6) { node.generator = node.expression = false; }
	  if (this.options.ecmaVersion >= 8) { node.async = false; }
	};

	// Parse object or class method.

	pp$3.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
	  var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;

	  this.initFunction(node);
	  if (this.options.ecmaVersion >= 6)
	    { node.generator = isGenerator; }
	  if (this.options.ecmaVersion >= 8)
	    { node.async = !!isAsync; }

	  this.yieldPos = 0;
	  this.awaitPos = 0;
	  this.awaitIdentPos = 0;
	  this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));

	  this.expect(types.parenL);
	  node.params = this.parseBindingList(types.parenR, false, this.options.ecmaVersion >= 8);
	  this.checkYieldAwaitInDefaultParams();
	  this.parseFunctionBody(node, false, true);

	  this.yieldPos = oldYieldPos;
	  this.awaitPos = oldAwaitPos;
	  this.awaitIdentPos = oldAwaitIdentPos;
	  return this.finishNode(node, "FunctionExpression")
	};

	// Parse arrow function expression with given parameters.

	pp$3.parseArrowExpression = function(node, params, isAsync) {
	  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;

	  this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
	  this.initFunction(node);
	  if (this.options.ecmaVersion >= 8) { node.async = !!isAsync; }

	  this.yieldPos = 0;
	  this.awaitPos = 0;
	  this.awaitIdentPos = 0;

	  node.params = this.toAssignableList(params, true);
	  this.parseFunctionBody(node, true, false);

	  this.yieldPos = oldYieldPos;
	  this.awaitPos = oldAwaitPos;
	  this.awaitIdentPos = oldAwaitIdentPos;
	  return this.finishNode(node, "ArrowFunctionExpression")
	};

	// Parse function body and check parameters.

	pp$3.parseFunctionBody = function(node, isArrowFunction, isMethod) {
	  var isExpression = isArrowFunction && this.type !== types.braceL;
	  var oldStrict = this.strict, useStrict = false;

	  if (isExpression) {
	    node.body = this.parseMaybeAssign();
	    node.expression = true;
	    this.checkParams(node, false);
	  } else {
	    var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
	    if (!oldStrict || nonSimple) {
	      useStrict = this.strictDirective(this.end);
	      // If this is a strict mode function, verify that argument names
	      // are not repeated, and it does not try to bind the words `eval`
	      // or `arguments`.
	      if (useStrict && nonSimple)
	        { this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list"); }
	    }
	    // Start a new scope with regard to labels and the `inFunction`
	    // flag (restore them to their old value afterwards).
	    var oldLabels = this.labels;
	    this.labels = [];
	    if (useStrict) { this.strict = true; }

	    // Add the params to varDeclaredNames to ensure that an error is thrown
	    // if a let/const declaration in the function clashes with one of the params.
	    this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
	    // Ensure the function name isn't a forbidden identifier in strict mode, e.g. 'eval'
	    if (this.strict && node.id) { this.checkLVal(node.id, BIND_OUTSIDE); }
	    node.body = this.parseBlock(false, undefined, useStrict && !oldStrict);
	    node.expression = false;
	    this.adaptDirectivePrologue(node.body.body);
	    this.labels = oldLabels;
	  }
	  this.exitScope();
	};

	pp$3.isSimpleParamList = function(params) {
	  for (var i = 0, list = params; i < list.length; i += 1)
	    {
	    var param = list[i];

	    if (param.type !== "Identifier") { return false
	  } }
	  return true
	};

	// Checks function params for various disallowed patterns such as using "eval"
	// or "arguments" and duplicate parameters.

	pp$3.checkParams = function(node, allowDuplicates) {
	  var nameHash = {};
	  for (var i = 0, list = node.params; i < list.length; i += 1)
	    {
	    var param = list[i];

	    this.checkLVal(param, BIND_VAR, allowDuplicates ? null : nameHash);
	  }
	};

	// Parses a comma-separated list of expressions, and returns them as
	// an array. `close` is the token type that ends the list, and
	// `allowEmpty` can be turned on to allow subsequent commas with
	// nothing in between them to be parsed as `null` (which is needed
	// for array literals).

	pp$3.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
	  var elts = [], first = true;
	  while (!this.eat(close)) {
	    if (!first) {
	      this.expect(types.comma);
	      if (allowTrailingComma && this.afterTrailingComma(close)) { break }
	    } else { first = false; }

	    var elt = (void 0);
	    if (allowEmpty && this.type === types.comma)
	      { elt = null; }
	    else if (this.type === types.ellipsis) {
	      elt = this.parseSpread(refDestructuringErrors);
	      if (refDestructuringErrors && this.type === types.comma && refDestructuringErrors.trailingComma < 0)
	        { refDestructuringErrors.trailingComma = this.start; }
	    } else {
	      elt = this.parseMaybeAssign(false, refDestructuringErrors);
	    }
	    elts.push(elt);
	  }
	  return elts
	};

	pp$3.checkUnreserved = function(ref) {
	  var start = ref.start;
	  var end = ref.end;
	  var name = ref.name;

	  if (this.inGenerator && name === "yield")
	    { this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator"); }
	  if (this.inAsync && name === "await")
	    { this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function"); }
	  if (this.keywords.test(name))
	    { this.raise(start, ("Unexpected keyword '" + name + "'")); }
	  if (this.options.ecmaVersion < 6 &&
	    this.input.slice(start, end).indexOf("\\") !== -1) { return }
	  var re = this.strict ? this.reservedWordsStrict : this.reservedWords;
	  if (re.test(name)) {
	    if (!this.inAsync && name === "await")
	      { this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function"); }
	    this.raiseRecoverable(start, ("The keyword '" + name + "' is reserved"));
	  }
	};

	// Parse the next token as an identifier. If `liberal` is true (used
	// when parsing properties), it will also convert keywords into
	// identifiers.

	pp$3.parseIdent = function(liberal, isBinding) {
	  var node = this.startNode();
	  if (this.type === types.name) {
	    node.name = this.value;
	  } else if (this.type.keyword) {
	    node.name = this.type.keyword;

	    // To fix https://github.com/acornjs/acorn/issues/575
	    // `class` and `function` keywords push new context into this.context.
	    // But there is no chance to pop the context if the keyword is consumed as an identifier such as a property name.
	    // If the previous token is a dot, this does not apply because the context-managing code already ignored the keyword
	    if ((node.name === "class" || node.name === "function") &&
	        (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
	      this.context.pop();
	    }
	  } else {
	    this.unexpected();
	  }
	  this.next(!!liberal);
	  this.finishNode(node, "Identifier");
	  if (!liberal) {
	    this.checkUnreserved(node);
	    if (node.name === "await" && !this.awaitIdentPos)
	      { this.awaitIdentPos = node.start; }
	  }
	  return node
	};

	// Parses yield expression inside generator.

	pp$3.parseYield = function(noIn) {
	  if (!this.yieldPos) { this.yieldPos = this.start; }

	  var node = this.startNode();
	  this.next();
	  if (this.type === types.semi || this.canInsertSemicolon() || (this.type !== types.star && !this.type.startsExpr)) {
	    node.delegate = false;
	    node.argument = null;
	  } else {
	    node.delegate = this.eat(types.star);
	    node.argument = this.parseMaybeAssign(noIn);
	  }
	  return this.finishNode(node, "YieldExpression")
	};

	pp$3.parseAwait = function() {
	  if (!this.awaitPos) { this.awaitPos = this.start; }

	  var node = this.startNode();
	  this.next();
	  node.argument = this.parseMaybeUnary(null, false);
	  return this.finishNode(node, "AwaitExpression")
	};

	var pp$4 = Parser.prototype;

	// This function is used to raise exceptions on parse errors. It
	// takes an offset integer (into the current `input`) to indicate
	// the location of the error, attaches the position to the end
	// of the error message, and then raises a `SyntaxError` with that
	// message.

	pp$4.raise = function(pos, message) {
	  var loc = getLineInfo(this.input, pos);
	  message += " (" + loc.line + ":" + loc.column + ")";
	  var err = new SyntaxError(message);
	  err.pos = pos; err.loc = loc; err.raisedAt = this.pos;
	  throw err
	};

	pp$4.raiseRecoverable = pp$4.raise;

	pp$4.curPosition = function() {
	  if (this.options.locations) {
	    return new Position(this.curLine, this.pos - this.lineStart)
	  }
	};

	var pp$5 = Parser.prototype;

	var Scope = function Scope(flags) {
	  this.flags = flags;
	  // A list of var-declared names in the current lexical scope
	  this.var = [];
	  // A list of lexically-declared names in the current lexical scope
	  this.lexical = [];
	  // A list of lexically-declared FunctionDeclaration names in the current lexical scope
	  this.functions = [];
	};

	// The functions in this module keep track of declared variables in the current scope in order to detect duplicate variable names.

	pp$5.enterScope = function(flags) {
	  this.scopeStack.push(new Scope(flags));
	};

	pp$5.exitScope = function() {
	  this.scopeStack.pop();
	};

	// The spec says:
	// > At the top level of a function, or script, function declarations are
	// > treated like var declarations rather than like lexical declarations.
	pp$5.treatFunctionsAsVarInScope = function(scope) {
	  return (scope.flags & SCOPE_FUNCTION) || !this.inModule && (scope.flags & SCOPE_TOP)
	};

	pp$5.declareName = function(name, bindingType, pos) {
	  var redeclared = false;
	  if (bindingType === BIND_LEXICAL) {
	    var scope = this.currentScope();
	    redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
	    scope.lexical.push(name);
	    if (this.inModule && (scope.flags & SCOPE_TOP))
	      { delete this.undefinedExports[name]; }
	  } else if (bindingType === BIND_SIMPLE_CATCH) {
	    var scope$1 = this.currentScope();
	    scope$1.lexical.push(name);
	  } else if (bindingType === BIND_FUNCTION) {
	    var scope$2 = this.currentScope();
	    if (this.treatFunctionsAsVar)
	      { redeclared = scope$2.lexical.indexOf(name) > -1; }
	    else
	      { redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1; }
	    scope$2.functions.push(name);
	  } else {
	    for (var i = this.scopeStack.length - 1; i >= 0; --i) {
	      var scope$3 = this.scopeStack[i];
	      if (scope$3.lexical.indexOf(name) > -1 && !((scope$3.flags & SCOPE_SIMPLE_CATCH) && scope$3.lexical[0] === name) ||
	          !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
	        redeclared = true;
	        break
	      }
	      scope$3.var.push(name);
	      if (this.inModule && (scope$3.flags & SCOPE_TOP))
	        { delete this.undefinedExports[name]; }
	      if (scope$3.flags & SCOPE_VAR) { break }
	    }
	  }
	  if (redeclared) { this.raiseRecoverable(pos, ("Identifier '" + name + "' has already been declared")); }
	};

	pp$5.checkLocalExport = function(id) {
	  // scope.functions must be empty as Module code is always strict.
	  if (this.scopeStack[0].lexical.indexOf(id.name) === -1 &&
	      this.scopeStack[0].var.indexOf(id.name) === -1) {
	    this.undefinedExports[id.name] = id;
	  }
	};

	pp$5.currentScope = function() {
	  return this.scopeStack[this.scopeStack.length - 1]
	};

	pp$5.currentVarScope = function() {
	  for (var i = this.scopeStack.length - 1;; i--) {
	    var scope = this.scopeStack[i];
	    if (scope.flags & SCOPE_VAR) { return scope }
	  }
	};

	// Could be useful for `this`, `new.target`, `super()`, `super.property`, and `super[property]`.
	pp$5.currentThisScope = function() {
	  for (var i = this.scopeStack.length - 1;; i--) {
	    var scope = this.scopeStack[i];
	    if (scope.flags & SCOPE_VAR && !(scope.flags & SCOPE_ARROW)) { return scope }
	  }
	};

	var Node = function Node(parser, pos, loc) {
	  this.type = "";
	  this.start = pos;
	  this.end = 0;
	  if (parser.options.locations)
	    { this.loc = new SourceLocation(parser, loc); }
	  if (parser.options.directSourceFile)
	    { this.sourceFile = parser.options.directSourceFile; }
	  if (parser.options.ranges)
	    { this.range = [pos, 0]; }
	};

	// Start an AST node, attaching a start offset.

	var pp$6 = Parser.prototype;

	pp$6.startNode = function() {
	  return new Node(this, this.start, this.startLoc)
	};

	pp$6.startNodeAt = function(pos, loc) {
	  return new Node(this, pos, loc)
	};

	// Finish an AST node, adding `type` and `end` properties.

	function finishNodeAt(node, type, pos, loc) {
	  node.type = type;
	  node.end = pos;
	  if (this.options.locations)
	    { node.loc.end = loc; }
	  if (this.options.ranges)
	    { node.range[1] = pos; }
	  return node
	}

	pp$6.finishNode = function(node, type) {
	  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc)
	};

	// Finish node at given position

	pp$6.finishNodeAt = function(node, type, pos, loc) {
	  return finishNodeAt.call(this, node, type, pos, loc)
	};

	// The algorithm used to determine whether a regexp can appear at a

	var TokContext = function TokContext(token, isExpr, preserveSpace, override, generator) {
	  this.token = token;
	  this.isExpr = !!isExpr;
	  this.preserveSpace = !!preserveSpace;
	  this.override = override;
	  this.generator = !!generator;
	};

	var types$1 = {
	  b_stat: new TokContext("{", false),
	  b_expr: new TokContext("{", true),
	  b_tmpl: new TokContext("${", false),
	  p_stat: new TokContext("(", false),
	  p_expr: new TokContext("(", true),
	  q_tmpl: new TokContext("`", true, true, function (p) { return p.tryReadTemplateToken(); }),
	  f_stat: new TokContext("function", false),
	  f_expr: new TokContext("function", true),
	  f_expr_gen: new TokContext("function", true, false, null, true),
	  f_gen: new TokContext("function", false, false, null, true)
	};

	var pp$7 = Parser.prototype;

	pp$7.initialContext = function() {
	  return [types$1.b_stat]
	};

	pp$7.braceIsBlock = function(prevType) {
	  var parent = this.curContext();
	  if (parent === types$1.f_expr || parent === types$1.f_stat)
	    { return true }
	  if (prevType === types.colon && (parent === types$1.b_stat || parent === types$1.b_expr))
	    { return !parent.isExpr }

	  // The check for `tt.name && exprAllowed` detects whether we are
	  // after a `yield` or `of` construct. See the `updateContext` for
	  // `tt.name`.
	  if (prevType === types._return || prevType === types.name && this.exprAllowed)
	    { return lineBreak.test(this.input.slice(this.lastTokEnd, this.start)) }
	  if (prevType === types._else || prevType === types.semi || prevType === types.eof || prevType === types.parenR || prevType === types.arrow)
	    { return true }
	  if (prevType === types.braceL)
	    { return parent === types$1.b_stat }
	  if (prevType === types._var || prevType === types._const || prevType === types.name)
	    { return false }
	  return !this.exprAllowed
	};

	pp$7.inGeneratorContext = function() {
	  for (var i = this.context.length - 1; i >= 1; i--) {
	    var context = this.context[i];
	    if (context.token === "function")
	      { return context.generator }
	  }
	  return false
	};

	pp$7.updateContext = function(prevType) {
	  var update, type = this.type;
	  if (type.keyword && prevType === types.dot)
	    { this.exprAllowed = false; }
	  else if (update = type.updateContext)
	    { update.call(this, prevType); }
	  else
	    { this.exprAllowed = type.beforeExpr; }
	};

	// Token-specific context update code

	types.parenR.updateContext = types.braceR.updateContext = function() {
	  if (this.context.length === 1) {
	    this.exprAllowed = true;
	    return
	  }
	  var out = this.context.pop();
	  if (out === types$1.b_stat && this.curContext().token === "function") {
	    out = this.context.pop();
	  }
	  this.exprAllowed = !out.isExpr;
	};

	types.braceL.updateContext = function(prevType) {
	  this.context.push(this.braceIsBlock(prevType) ? types$1.b_stat : types$1.b_expr);
	  this.exprAllowed = true;
	};

	types.dollarBraceL.updateContext = function() {
	  this.context.push(types$1.b_tmpl);
	  this.exprAllowed = true;
	};

	types.parenL.updateContext = function(prevType) {
	  var statementParens = prevType === types._if || prevType === types._for || prevType === types._with || prevType === types._while;
	  this.context.push(statementParens ? types$1.p_stat : types$1.p_expr);
	  this.exprAllowed = true;
	};

	types.incDec.updateContext = function() {
	  // tokExprAllowed stays unchanged
	};

	types._function.updateContext = types._class.updateContext = function(prevType) {
	  if (prevType.beforeExpr && prevType !== types.semi && prevType !== types._else &&
	      !(prevType === types._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) &&
	      !((prevType === types.colon || prevType === types.braceL) && this.curContext() === types$1.b_stat))
	    { this.context.push(types$1.f_expr); }
	  else
	    { this.context.push(types$1.f_stat); }
	  this.exprAllowed = false;
	};

	types.backQuote.updateContext = function() {
	  if (this.curContext() === types$1.q_tmpl)
	    { this.context.pop(); }
	  else
	    { this.context.push(types$1.q_tmpl); }
	  this.exprAllowed = false;
	};

	types.star.updateContext = function(prevType) {
	  if (prevType === types._function) {
	    var index = this.context.length - 1;
	    if (this.context[index] === types$1.f_expr)
	      { this.context[index] = types$1.f_expr_gen; }
	    else
	      { this.context[index] = types$1.f_gen; }
	  }
	  this.exprAllowed = true;
	};

	types.name.updateContext = function(prevType) {
	  var allowed = false;
	  if (this.options.ecmaVersion >= 6 && prevType !== types.dot) {
	    if (this.value === "of" && !this.exprAllowed ||
	        this.value === "yield" && this.inGeneratorContext())
	      { allowed = true; }
	  }
	  this.exprAllowed = allowed;
	};

	// This file contains Unicode properties extracted from the ECMAScript
	// specification. The lists are extracted like so:
	// $$('#table-binary-unicode-properties > figure > table > tbody > tr > td:nth-child(1) code').map(el => el.innerText)

	// #table-binary-unicode-properties
	var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
	var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
	var ecma11BinaryProperties = ecma10BinaryProperties;
	var unicodeBinaryProperties = {
	  9: ecma9BinaryProperties,
	  10: ecma10BinaryProperties,
	  11: ecma11BinaryProperties
	};

	// #table-unicode-general-category-values
	var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";

	// #table-unicode-script-values
	var ecma9ScriptValues = "Adlam Adlm Ahom Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
	var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
	var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
	var unicodeScriptValues = {
	  9: ecma9ScriptValues,
	  10: ecma10ScriptValues,
	  11: ecma11ScriptValues
	};

	var data = {};
	function buildUnicodeData(ecmaVersion) {
	  var d = data[ecmaVersion] = {
	    binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion] + " " + unicodeGeneralCategoryValues),
	    nonBinary: {
	      General_Category: wordsRegexp(unicodeGeneralCategoryValues),
	      Script: wordsRegexp(unicodeScriptValues[ecmaVersion])
	    }
	  };
	  d.nonBinary.Script_Extensions = d.nonBinary.Script;

	  d.nonBinary.gc = d.nonBinary.General_Category;
	  d.nonBinary.sc = d.nonBinary.Script;
	  d.nonBinary.scx = d.nonBinary.Script_Extensions;
	}
	buildUnicodeData(9);
	buildUnicodeData(10);
	buildUnicodeData(11);

	var pp$8 = Parser.prototype;

	var RegExpValidationState = function RegExpValidationState(parser) {
	  this.parser = parser;
	  this.validFlags = "gim" + (parser.options.ecmaVersion >= 6 ? "uy" : "") + (parser.options.ecmaVersion >= 9 ? "s" : "");
	  this.unicodeProperties = data[parser.options.ecmaVersion >= 11 ? 11 : parser.options.ecmaVersion];
	  this.source = "";
	  this.flags = "";
	  this.start = 0;
	  this.switchU = false;
	  this.switchN = false;
	  this.pos = 0;
	  this.lastIntValue = 0;
	  this.lastStringValue = "";
	  this.lastAssertionIsQuantifiable = false;
	  this.numCapturingParens = 0;
	  this.maxBackReference = 0;
	  this.groupNames = [];
	  this.backReferenceNames = [];
	};

	RegExpValidationState.prototype.reset = function reset (start, pattern, flags) {
	  var unicode = flags.indexOf("u") !== -1;
	  this.start = start | 0;
	  this.source = pattern + "";
	  this.flags = flags;
	  this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
	  this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
	};

	RegExpValidationState.prototype.raise = function raise (message) {
	  this.parser.raiseRecoverable(this.start, ("Invalid regular expression: /" + (this.source) + "/: " + message));
	};

	// If u flag is given, this returns the code point at the index (it combines a surrogate pair).
	// Otherwise, this returns the code unit of the index (can be a part of a surrogate pair).
	RegExpValidationState.prototype.at = function at (i, forceU) {
	    if ( forceU === void 0 ) forceU = false;

	  var s = this.source;
	  var l = s.length;
	  if (i >= l) {
	    return -1
	  }
	  var c = s.charCodeAt(i);
	  if (!(forceU || this.switchU) || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l) {
	    return c
	  }
	  var next = s.charCodeAt(i + 1);
	  return next >= 0xDC00 && next <= 0xDFFF ? (c << 10) + next - 0x35FDC00 : c
	};

	RegExpValidationState.prototype.nextIndex = function nextIndex (i, forceU) {
	    if ( forceU === void 0 ) forceU = false;

	  var s = this.source;
	  var l = s.length;
	  if (i >= l) {
	    return l
	  }
	  var c = s.charCodeAt(i), next;
	  if (!(forceU || this.switchU) || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l ||
	      (next = s.charCodeAt(i + 1)) < 0xDC00 || next > 0xDFFF) {
	    return i + 1
	  }
	  return i + 2
	};

	RegExpValidationState.prototype.current = function current (forceU) {
	    if ( forceU === void 0 ) forceU = false;

	  return this.at(this.pos, forceU)
	};

	RegExpValidationState.prototype.lookahead = function lookahead (forceU) {
	    if ( forceU === void 0 ) forceU = false;

	  return this.at(this.nextIndex(this.pos, forceU), forceU)
	};

	RegExpValidationState.prototype.advance = function advance (forceU) {
	    if ( forceU === void 0 ) forceU = false;

	  this.pos = this.nextIndex(this.pos, forceU);
	};

	RegExpValidationState.prototype.eat = function eat (ch, forceU) {
	    if ( forceU === void 0 ) forceU = false;

	  if (this.current(forceU) === ch) {
	    this.advance(forceU);
	    return true
	  }
	  return false
	};

	function codePointToString(ch) {
	  if (ch <= 0xFFFF) { return String.fromCharCode(ch) }
	  ch -= 0x10000;
	  return String.fromCharCode((ch >> 10) + 0xD800, (ch & 0x03FF) + 0xDC00)
	}

	/**
	 * Validate the flags part of a given RegExpLiteral.
	 *
	 * @param {RegExpValidationState} state The state to validate RegExp.
	 * @returns {void}
	 */
	pp$8.validateRegExpFlags = function(state) {
	  var validFlags = state.validFlags;
	  var flags = state.flags;

	  for (var i = 0; i < flags.length; i++) {
	    var flag = flags.charAt(i);
	    if (validFlags.indexOf(flag) === -1) {
	      this.raise(state.start, "Invalid regular expression flag");
	    }
	    if (flags.indexOf(flag, i + 1) > -1) {
	      this.raise(state.start, "Duplicate regular expression flag");
	    }
	  }
	};

	/**
	 * Validate the pattern part of a given RegExpLiteral.
	 *
	 * @param {RegExpValidationState} state The state to validate RegExp.
	 * @returns {void}
	 */
	pp$8.validateRegExpPattern = function(state) {
	  this.regexp_pattern(state);

	  // The goal symbol for the parse is |Pattern[~U, ~N]|. If the result of
	  // parsing contains a |GroupName|, reparse with the goal symbol
	  // |Pattern[~U, +N]| and use this result instead. Throw a *SyntaxError*
	  // exception if _P_ did not conform to the grammar, if any elements of _P_
	  // were not matched by the parse, or if any Early Error conditions exist.
	  if (!state.switchN && this.options.ecmaVersion >= 9 && state.groupNames.length > 0) {
	    state.switchN = true;
	    this.regexp_pattern(state);
	  }
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-Pattern
	pp$8.regexp_pattern = function(state) {
	  state.pos = 0;
	  state.lastIntValue = 0;
	  state.lastStringValue = "";
	  state.lastAssertionIsQuantifiable = false;
	  state.numCapturingParens = 0;
	  state.maxBackReference = 0;
	  state.groupNames.length = 0;
	  state.backReferenceNames.length = 0;

	  this.regexp_disjunction(state);

	  if (state.pos !== state.source.length) {
	    // Make the same messages as V8.
	    if (state.eat(0x29 /* ) */)) {
	      state.raise("Unmatched ')'");
	    }
	    if (state.eat(0x5D /* ] */) || state.eat(0x7D /* } */)) {
	      state.raise("Lone quantifier brackets");
	    }
	  }
	  if (state.maxBackReference > state.numCapturingParens) {
	    state.raise("Invalid escape");
	  }
	  for (var i = 0, list = state.backReferenceNames; i < list.length; i += 1) {
	    var name = list[i];

	    if (state.groupNames.indexOf(name) === -1) {
	      state.raise("Invalid named capture referenced");
	    }
	  }
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-Disjunction
	pp$8.regexp_disjunction = function(state) {
	  this.regexp_alternative(state);
	  while (state.eat(0x7C /* | */)) {
	    this.regexp_alternative(state);
	  }

	  // Make the same message as V8.
	  if (this.regexp_eatQuantifier(state, true)) {
	    state.raise("Nothing to repeat");
	  }
	  if (state.eat(0x7B /* { */)) {
	    state.raise("Lone quantifier brackets");
	  }
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-Alternative
	pp$8.regexp_alternative = function(state) {
	  while (state.pos < state.source.length && this.regexp_eatTerm(state))
	    { }
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Term
	pp$8.regexp_eatTerm = function(state) {
	  if (this.regexp_eatAssertion(state)) {
	    // Handle `QuantifiableAssertion Quantifier` alternative.
	    // `state.lastAssertionIsQuantifiable` is true if the last eaten Assertion
	    // is a QuantifiableAssertion.
	    if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
	      // Make the same message as V8.
	      if (state.switchU) {
	        state.raise("Invalid quantifier");
	      }
	    }
	    return true
	  }

	  if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
	    this.regexp_eatQuantifier(state);
	    return true
	  }

	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Assertion
	pp$8.regexp_eatAssertion = function(state) {
	  var start = state.pos;
	  state.lastAssertionIsQuantifiable = false;

	  // ^, $
	  if (state.eat(0x5E /* ^ */) || state.eat(0x24 /* $ */)) {
	    return true
	  }

	  // \b \B
	  if (state.eat(0x5C /* \ */)) {
	    if (state.eat(0x42 /* B */) || state.eat(0x62 /* b */)) {
	      return true
	    }
	    state.pos = start;
	  }

	  // Lookahead / Lookbehind
	  if (state.eat(0x28 /* ( */) && state.eat(0x3F /* ? */)) {
	    var lookbehind = false;
	    if (this.options.ecmaVersion >= 9) {
	      lookbehind = state.eat(0x3C /* < */);
	    }
	    if (state.eat(0x3D /* = */) || state.eat(0x21 /* ! */)) {
	      this.regexp_disjunction(state);
	      if (!state.eat(0x29 /* ) */)) {
	        state.raise("Unterminated group");
	      }
	      state.lastAssertionIsQuantifiable = !lookbehind;
	      return true
	    }
	  }

	  state.pos = start;
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-Quantifier
	pp$8.regexp_eatQuantifier = function(state, noError) {
	  if ( noError === void 0 ) noError = false;

	  if (this.regexp_eatQuantifierPrefix(state, noError)) {
	    state.eat(0x3F /* ? */);
	    return true
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-QuantifierPrefix
	pp$8.regexp_eatQuantifierPrefix = function(state, noError) {
	  return (
	    state.eat(0x2A /* * */) ||
	    state.eat(0x2B /* + */) ||
	    state.eat(0x3F /* ? */) ||
	    this.regexp_eatBracedQuantifier(state, noError)
	  )
	};
	pp$8.regexp_eatBracedQuantifier = function(state, noError) {
	  var start = state.pos;
	  if (state.eat(0x7B /* { */)) {
	    var min = 0, max = -1;
	    if (this.regexp_eatDecimalDigits(state)) {
	      min = state.lastIntValue;
	      if (state.eat(0x2C /* , */) && this.regexp_eatDecimalDigits(state)) {
	        max = state.lastIntValue;
	      }
	      if (state.eat(0x7D /* } */)) {
	        // SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-term
	        if (max !== -1 && max < min && !noError) {
	          state.raise("numbers out of order in {} quantifier");
	        }
	        return true
	      }
	    }
	    if (state.switchU && !noError) {
	      state.raise("Incomplete quantifier");
	    }
	    state.pos = start;
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-Atom
	pp$8.regexp_eatAtom = function(state) {
	  return (
	    this.regexp_eatPatternCharacters(state) ||
	    state.eat(0x2E /* . */) ||
	    this.regexp_eatReverseSolidusAtomEscape(state) ||
	    this.regexp_eatCharacterClass(state) ||
	    this.regexp_eatUncapturingGroup(state) ||
	    this.regexp_eatCapturingGroup(state)
	  )
	};
	pp$8.regexp_eatReverseSolidusAtomEscape = function(state) {
	  var start = state.pos;
	  if (state.eat(0x5C /* \ */)) {
	    if (this.regexp_eatAtomEscape(state)) {
	      return true
	    }
	    state.pos = start;
	  }
	  return false
	};
	pp$8.regexp_eatUncapturingGroup = function(state) {
	  var start = state.pos;
	  if (state.eat(0x28 /* ( */)) {
	    if (state.eat(0x3F /* ? */) && state.eat(0x3A /* : */)) {
	      this.regexp_disjunction(state);
	      if (state.eat(0x29 /* ) */)) {
	        return true
	      }
	      state.raise("Unterminated group");
	    }
	    state.pos = start;
	  }
	  return false
	};
	pp$8.regexp_eatCapturingGroup = function(state) {
	  if (state.eat(0x28 /* ( */)) {
	    if (this.options.ecmaVersion >= 9) {
	      this.regexp_groupSpecifier(state);
	    } else if (state.current() === 0x3F /* ? */) {
	      state.raise("Invalid group");
	    }
	    this.regexp_disjunction(state);
	    if (state.eat(0x29 /* ) */)) {
	      state.numCapturingParens += 1;
	      return true
	    }
	    state.raise("Unterminated group");
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedAtom
	pp$8.regexp_eatExtendedAtom = function(state) {
	  return (
	    state.eat(0x2E /* . */) ||
	    this.regexp_eatReverseSolidusAtomEscape(state) ||
	    this.regexp_eatCharacterClass(state) ||
	    this.regexp_eatUncapturingGroup(state) ||
	    this.regexp_eatCapturingGroup(state) ||
	    this.regexp_eatInvalidBracedQuantifier(state) ||
	    this.regexp_eatExtendedPatternCharacter(state)
	  )
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-InvalidBracedQuantifier
	pp$8.regexp_eatInvalidBracedQuantifier = function(state) {
	  if (this.regexp_eatBracedQuantifier(state, true)) {
	    state.raise("Nothing to repeat");
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-SyntaxCharacter
	pp$8.regexp_eatSyntaxCharacter = function(state) {
	  var ch = state.current();
	  if (isSyntaxCharacter(ch)) {
	    state.lastIntValue = ch;
	    state.advance();
	    return true
	  }
	  return false
	};
	function isSyntaxCharacter(ch) {
	  return (
	    ch === 0x24 /* $ */ ||
	    ch >= 0x28 /* ( */ && ch <= 0x2B /* + */ ||
	    ch === 0x2E /* . */ ||
	    ch === 0x3F /* ? */ ||
	    ch >= 0x5B /* [ */ && ch <= 0x5E /* ^ */ ||
	    ch >= 0x7B /* { */ && ch <= 0x7D /* } */
	  )
	}

	// https://www.ecma-international.org/ecma-262/8.0/#prod-PatternCharacter
	// But eat eager.
	pp$8.regexp_eatPatternCharacters = function(state) {
	  var start = state.pos;
	  var ch = 0;
	  while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {
	    state.advance();
	  }
	  return state.pos !== start
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedPatternCharacter
	pp$8.regexp_eatExtendedPatternCharacter = function(state) {
	  var ch = state.current();
	  if (
	    ch !== -1 &&
	    ch !== 0x24 /* $ */ &&
	    !(ch >= 0x28 /* ( */ && ch <= 0x2B /* + */) &&
	    ch !== 0x2E /* . */ &&
	    ch !== 0x3F /* ? */ &&
	    ch !== 0x5B /* [ */ &&
	    ch !== 0x5E /* ^ */ &&
	    ch !== 0x7C /* | */
	  ) {
	    state.advance();
	    return true
	  }
	  return false
	};

	// GroupSpecifier ::
	//   [empty]
	//   `?` GroupName
	pp$8.regexp_groupSpecifier = function(state) {
	  if (state.eat(0x3F /* ? */)) {
	    if (this.regexp_eatGroupName(state)) {
	      if (state.groupNames.indexOf(state.lastStringValue) !== -1) {
	        state.raise("Duplicate capture group name");
	      }
	      state.groupNames.push(state.lastStringValue);
	      return
	    }
	    state.raise("Invalid group");
	  }
	};

	// GroupName ::
	//   `<` RegExpIdentifierName `>`
	// Note: this updates `state.lastStringValue` property with the eaten name.
	pp$8.regexp_eatGroupName = function(state) {
	  state.lastStringValue = "";
	  if (state.eat(0x3C /* < */)) {
	    if (this.regexp_eatRegExpIdentifierName(state) && state.eat(0x3E /* > */)) {
	      return true
	    }
	    state.raise("Invalid capture group name");
	  }
	  return false
	};

	// RegExpIdentifierName ::
	//   RegExpIdentifierStart
	//   RegExpIdentifierName RegExpIdentifierPart
	// Note: this updates `state.lastStringValue` property with the eaten name.
	pp$8.regexp_eatRegExpIdentifierName = function(state) {
	  state.lastStringValue = "";
	  if (this.regexp_eatRegExpIdentifierStart(state)) {
	    state.lastStringValue += codePointToString(state.lastIntValue);
	    while (this.regexp_eatRegExpIdentifierPart(state)) {
	      state.lastStringValue += codePointToString(state.lastIntValue);
	    }
	    return true
	  }
	  return false
	};

	// RegExpIdentifierStart ::
	//   UnicodeIDStart
	//   `$`
	//   `_`
	//   `\` RegExpUnicodeEscapeSequence[+U]
	pp$8.regexp_eatRegExpIdentifierStart = function(state) {
	  var start = state.pos;
	  var forceU = this.options.ecmaVersion >= 11;
	  var ch = state.current(forceU);
	  state.advance(forceU);

	  if (ch === 0x5C /* \ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
	    ch = state.lastIntValue;
	  }
	  if (isRegExpIdentifierStart(ch)) {
	    state.lastIntValue = ch;
	    return true
	  }

	  state.pos = start;
	  return false
	};
	function isRegExpIdentifierStart(ch) {
	  return isIdentifierStart(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */
	}

	// RegExpIdentifierPart ::
	//   UnicodeIDContinue
	//   `$`
	//   `_`
	//   `\` RegExpUnicodeEscapeSequence[+U]
	//   <ZWNJ>
	//   <ZWJ>
	pp$8.regexp_eatRegExpIdentifierPart = function(state) {
	  var start = state.pos;
	  var forceU = this.options.ecmaVersion >= 11;
	  var ch = state.current(forceU);
	  state.advance(forceU);

	  if (ch === 0x5C /* \ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
	    ch = state.lastIntValue;
	  }
	  if (isRegExpIdentifierPart(ch)) {
	    state.lastIntValue = ch;
	    return true
	  }

	  state.pos = start;
	  return false
	};
	function isRegExpIdentifierPart(ch) {
	  return isIdentifierChar(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */ || ch === 0x200C /* <ZWNJ> */ || ch === 0x200D /* <ZWJ> */
	}

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-AtomEscape
	pp$8.regexp_eatAtomEscape = function(state) {
	  if (
	    this.regexp_eatBackReference(state) ||
	    this.regexp_eatCharacterClassEscape(state) ||
	    this.regexp_eatCharacterEscape(state) ||
	    (state.switchN && this.regexp_eatKGroupName(state))
	  ) {
	    return true
	  }
	  if (state.switchU) {
	    // Make the same message as V8.
	    if (state.current() === 0x63 /* c */) {
	      state.raise("Invalid unicode escape");
	    }
	    state.raise("Invalid escape");
	  }
	  return false
	};
	pp$8.regexp_eatBackReference = function(state) {
	  var start = state.pos;
	  if (this.regexp_eatDecimalEscape(state)) {
	    var n = state.lastIntValue;
	    if (state.switchU) {
	      // For SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-atomescape
	      if (n > state.maxBackReference) {
	        state.maxBackReference = n;
	      }
	      return true
	    }
	    if (n <= state.numCapturingParens) {
	      return true
	    }
	    state.pos = start;
	  }
	  return false
	};
	pp$8.regexp_eatKGroupName = function(state) {
	  if (state.eat(0x6B /* k */)) {
	    if (this.regexp_eatGroupName(state)) {
	      state.backReferenceNames.push(state.lastStringValue);
	      return true
	    }
	    state.raise("Invalid named reference");
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-CharacterEscape
	pp$8.regexp_eatCharacterEscape = function(state) {
	  return (
	    this.regexp_eatControlEscape(state) ||
	    this.regexp_eatCControlLetter(state) ||
	    this.regexp_eatZero(state) ||
	    this.regexp_eatHexEscapeSequence(state) ||
	    this.regexp_eatRegExpUnicodeEscapeSequence(state, false) ||
	    (!state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state)) ||
	    this.regexp_eatIdentityEscape(state)
	  )
	};
	pp$8.regexp_eatCControlLetter = function(state) {
	  var start = state.pos;
	  if (state.eat(0x63 /* c */)) {
	    if (this.regexp_eatControlLetter(state)) {
	      return true
	    }
	    state.pos = start;
	  }
	  return false
	};
	pp$8.regexp_eatZero = function(state) {
	  if (state.current() === 0x30 /* 0 */ && !isDecimalDigit(state.lookahead())) {
	    state.lastIntValue = 0;
	    state.advance();
	    return true
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-ControlEscape
	pp$8.regexp_eatControlEscape = function(state) {
	  var ch = state.current();
	  if (ch === 0x74 /* t */) {
	    state.lastIntValue = 0x09; /* \t */
	    state.advance();
	    return true
	  }
	  if (ch === 0x6E /* n */) {
	    state.lastIntValue = 0x0A; /* \n */
	    state.advance();
	    return true
	  }
	  if (ch === 0x76 /* v */) {
	    state.lastIntValue = 0x0B; /* \v */
	    state.advance();
	    return true
	  }
	  if (ch === 0x66 /* f */) {
	    state.lastIntValue = 0x0C; /* \f */
	    state.advance();
	    return true
	  }
	  if (ch === 0x72 /* r */) {
	    state.lastIntValue = 0x0D; /* \r */
	    state.advance();
	    return true
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-ControlLetter
	pp$8.regexp_eatControlLetter = function(state) {
	  var ch = state.current();
	  if (isControlLetter(ch)) {
	    state.lastIntValue = ch % 0x20;
	    state.advance();
	    return true
	  }
	  return false
	};
	function isControlLetter(ch) {
	  return (
	    (ch >= 0x41 /* A */ && ch <= 0x5A /* Z */) ||
	    (ch >= 0x61 /* a */ && ch <= 0x7A /* z */)
	  )
	}

	// https://www.ecma-international.org/ecma-262/8.0/#prod-RegExpUnicodeEscapeSequence
	pp$8.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
	  if ( forceU === void 0 ) forceU = false;

	  var start = state.pos;
	  var switchU = forceU || state.switchU;

	  if (state.eat(0x75 /* u */)) {
	    if (this.regexp_eatFixedHexDigits(state, 4)) {
	      var lead = state.lastIntValue;
	      if (switchU && lead >= 0xD800 && lead <= 0xDBFF) {
	        var leadSurrogateEnd = state.pos;
	        if (state.eat(0x5C /* \ */) && state.eat(0x75 /* u */) && this.regexp_eatFixedHexDigits(state, 4)) {
	          var trail = state.lastIntValue;
	          if (trail >= 0xDC00 && trail <= 0xDFFF) {
	            state.lastIntValue = (lead - 0xD800) * 0x400 + (trail - 0xDC00) + 0x10000;
	            return true
	          }
	        }
	        state.pos = leadSurrogateEnd;
	        state.lastIntValue = lead;
	      }
	      return true
	    }
	    if (
	      switchU &&
	      state.eat(0x7B /* { */) &&
	      this.regexp_eatHexDigits(state) &&
	      state.eat(0x7D /* } */) &&
	      isValidUnicode(state.lastIntValue)
	    ) {
	      return true
	    }
	    if (switchU) {
	      state.raise("Invalid unicode escape");
	    }
	    state.pos = start;
	  }

	  return false
	};
	function isValidUnicode(ch) {
	  return ch >= 0 && ch <= 0x10FFFF
	}

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-IdentityEscape
	pp$8.regexp_eatIdentityEscape = function(state) {
	  if (state.switchU) {
	    if (this.regexp_eatSyntaxCharacter(state)) {
	      return true
	    }
	    if (state.eat(0x2F /* / */)) {
	      state.lastIntValue = 0x2F; /* / */
	      return true
	    }
	    return false
	  }

	  var ch = state.current();
	  if (ch !== 0x63 /* c */ && (!state.switchN || ch !== 0x6B /* k */)) {
	    state.lastIntValue = ch;
	    state.advance();
	    return true
	  }

	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalEscape
	pp$8.regexp_eatDecimalEscape = function(state) {
	  state.lastIntValue = 0;
	  var ch = state.current();
	  if (ch >= 0x31 /* 1 */ && ch <= 0x39 /* 9 */) {
	    do {
	      state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);
	      state.advance();
	    } while ((ch = state.current()) >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */)
	    return true
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClassEscape
	pp$8.regexp_eatCharacterClassEscape = function(state) {
	  var ch = state.current();

	  if (isCharacterClassEscape(ch)) {
	    state.lastIntValue = -1;
	    state.advance();
	    return true
	  }

	  if (
	    state.switchU &&
	    this.options.ecmaVersion >= 9 &&
	    (ch === 0x50 /* P */ || ch === 0x70 /* p */)
	  ) {
	    state.lastIntValue = -1;
	    state.advance();
	    if (
	      state.eat(0x7B /* { */) &&
	      this.regexp_eatUnicodePropertyValueExpression(state) &&
	      state.eat(0x7D /* } */)
	    ) {
	      return true
	    }
	    state.raise("Invalid property name");
	  }

	  return false
	};
	function isCharacterClassEscape(ch) {
	  return (
	    ch === 0x64 /* d */ ||
	    ch === 0x44 /* D */ ||
	    ch === 0x73 /* s */ ||
	    ch === 0x53 /* S */ ||
	    ch === 0x77 /* w */ ||
	    ch === 0x57 /* W */
	  )
	}

	// UnicodePropertyValueExpression ::
	//   UnicodePropertyName `=` UnicodePropertyValue
	//   LoneUnicodePropertyNameOrValue
	pp$8.regexp_eatUnicodePropertyValueExpression = function(state) {
	  var start = state.pos;

	  // UnicodePropertyName `=` UnicodePropertyValue
	  if (this.regexp_eatUnicodePropertyName(state) && state.eat(0x3D /* = */)) {
	    var name = state.lastStringValue;
	    if (this.regexp_eatUnicodePropertyValue(state)) {
	      var value = state.lastStringValue;
	      this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
	      return true
	    }
	  }
	  state.pos = start;

	  // LoneUnicodePropertyNameOrValue
	  if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
	    var nameOrValue = state.lastStringValue;
	    this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
	    return true
	  }
	  return false
	};
	pp$8.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
	  if (!has(state.unicodeProperties.nonBinary, name))
	    { state.raise("Invalid property name"); }
	  if (!state.unicodeProperties.nonBinary[name].test(value))
	    { state.raise("Invalid property value"); }
	};
	pp$8.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
	  if (!state.unicodeProperties.binary.test(nameOrValue))
	    { state.raise("Invalid property name"); }
	};

	// UnicodePropertyName ::
	//   UnicodePropertyNameCharacters
	pp$8.regexp_eatUnicodePropertyName = function(state) {
	  var ch = 0;
	  state.lastStringValue = "";
	  while (isUnicodePropertyNameCharacter(ch = state.current())) {
	    state.lastStringValue += codePointToString(ch);
	    state.advance();
	  }
	  return state.lastStringValue !== ""
	};
	function isUnicodePropertyNameCharacter(ch) {
	  return isControlLetter(ch) || ch === 0x5F /* _ */
	}

	// UnicodePropertyValue ::
	//   UnicodePropertyValueCharacters
	pp$8.regexp_eatUnicodePropertyValue = function(state) {
	  var ch = 0;
	  state.lastStringValue = "";
	  while (isUnicodePropertyValueCharacter(ch = state.current())) {
	    state.lastStringValue += codePointToString(ch);
	    state.advance();
	  }
	  return state.lastStringValue !== ""
	};
	function isUnicodePropertyValueCharacter(ch) {
	  return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch)
	}

	// LoneUnicodePropertyNameOrValue ::
	//   UnicodePropertyValueCharacters
	pp$8.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
	  return this.regexp_eatUnicodePropertyValue(state)
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClass
	pp$8.regexp_eatCharacterClass = function(state) {
	  if (state.eat(0x5B /* [ */)) {
	    state.eat(0x5E /* ^ */);
	    this.regexp_classRanges(state);
	    if (state.eat(0x5D /* ] */)) {
	      return true
	    }
	    // Unreachable since it threw "unterminated regular expression" error before.
	    state.raise("Unterminated character class");
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassRanges
	// https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRanges
	// https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRangesNoDash
	pp$8.regexp_classRanges = function(state) {
	  while (this.regexp_eatClassAtom(state)) {
	    var left = state.lastIntValue;
	    if (state.eat(0x2D /* - */) && this.regexp_eatClassAtom(state)) {
	      var right = state.lastIntValue;
	      if (state.switchU && (left === -1 || right === -1)) {
	        state.raise("Invalid character class");
	      }
	      if (left !== -1 && right !== -1 && left > right) {
	        state.raise("Range out of order in character class");
	      }
	    }
	  }
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtom
	// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtomNoDash
	pp$8.regexp_eatClassAtom = function(state) {
	  var start = state.pos;

	  if (state.eat(0x5C /* \ */)) {
	    if (this.regexp_eatClassEscape(state)) {
	      return true
	    }
	    if (state.switchU) {
	      // Make the same message as V8.
	      var ch$1 = state.current();
	      if (ch$1 === 0x63 /* c */ || isOctalDigit(ch$1)) {
	        state.raise("Invalid class escape");
	      }
	      state.raise("Invalid escape");
	    }
	    state.pos = start;
	  }

	  var ch = state.current();
	  if (ch !== 0x5D /* ] */) {
	    state.lastIntValue = ch;
	    state.advance();
	    return true
	  }

	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassEscape
	pp$8.regexp_eatClassEscape = function(state) {
	  var start = state.pos;

	  if (state.eat(0x62 /* b */)) {
	    state.lastIntValue = 0x08; /* <BS> */
	    return true
	  }

	  if (state.switchU && state.eat(0x2D /* - */)) {
	    state.lastIntValue = 0x2D; /* - */
	    return true
	  }

	  if (!state.switchU && state.eat(0x63 /* c */)) {
	    if (this.regexp_eatClassControlLetter(state)) {
	      return true
	    }
	    state.pos = start;
	  }

	  return (
	    this.regexp_eatCharacterClassEscape(state) ||
	    this.regexp_eatCharacterEscape(state)
	  )
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassControlLetter
	pp$8.regexp_eatClassControlLetter = function(state) {
	  var ch = state.current();
	  if (isDecimalDigit(ch) || ch === 0x5F /* _ */) {
	    state.lastIntValue = ch % 0x20;
	    state.advance();
	    return true
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence
	pp$8.regexp_eatHexEscapeSequence = function(state) {
	  var start = state.pos;
	  if (state.eat(0x78 /* x */)) {
	    if (this.regexp_eatFixedHexDigits(state, 2)) {
	      return true
	    }
	    if (state.switchU) {
	      state.raise("Invalid escape");
	    }
	    state.pos = start;
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalDigits
	pp$8.regexp_eatDecimalDigits = function(state) {
	  var start = state.pos;
	  var ch = 0;
	  state.lastIntValue = 0;
	  while (isDecimalDigit(ch = state.current())) {
	    state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);
	    state.advance();
	  }
	  return state.pos !== start
	};
	function isDecimalDigit(ch) {
	  return ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */
	}

	// https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigits
	pp$8.regexp_eatHexDigits = function(state) {
	  var start = state.pos;
	  var ch = 0;
	  state.lastIntValue = 0;
	  while (isHexDigit(ch = state.current())) {
	    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
	    state.advance();
	  }
	  return state.pos !== start
	};
	function isHexDigit(ch) {
	  return (
	    (ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */) ||
	    (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) ||
	    (ch >= 0x61 /* a */ && ch <= 0x66 /* f */)
	  )
	}
	function hexToInt(ch) {
	  if (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) {
	    return 10 + (ch - 0x41 /* A */)
	  }
	  if (ch >= 0x61 /* a */ && ch <= 0x66 /* f */) {
	    return 10 + (ch - 0x61 /* a */)
	  }
	  return ch - 0x30 /* 0 */
	}

	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-LegacyOctalEscapeSequence
	// Allows only 0-377(octal) i.e. 0-255(decimal).
	pp$8.regexp_eatLegacyOctalEscapeSequence = function(state) {
	  if (this.regexp_eatOctalDigit(state)) {
	    var n1 = state.lastIntValue;
	    if (this.regexp_eatOctalDigit(state)) {
	      var n2 = state.lastIntValue;
	      if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
	        state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
	      } else {
	        state.lastIntValue = n1 * 8 + n2;
	      }
	    } else {
	      state.lastIntValue = n1;
	    }
	    return true
	  }
	  return false
	};

	// https://www.ecma-international.org/ecma-262/8.0/#prod-OctalDigit
	pp$8.regexp_eatOctalDigit = function(state) {
	  var ch = state.current();
	  if (isOctalDigit(ch)) {
	    state.lastIntValue = ch - 0x30; /* 0 */
	    state.advance();
	    return true
	  }
	  state.lastIntValue = 0;
	  return false
	};
	function isOctalDigit(ch) {
	  return ch >= 0x30 /* 0 */ && ch <= 0x37 /* 7 */
	}

	// https://www.ecma-international.org/ecma-262/8.0/#prod-Hex4Digits
	// https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigit
	// And HexDigit HexDigit in https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence
	pp$8.regexp_eatFixedHexDigits = function(state, length) {
	  var start = state.pos;
	  state.lastIntValue = 0;
	  for (var i = 0; i < length; ++i) {
	    var ch = state.current();
	    if (!isHexDigit(ch)) {
	      state.pos = start;
	      return false
	    }
	    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
	    state.advance();
	  }
	  return true
	};

	// Object type used to represent tokens. Note that normally, tokens
	// simply exist as properties on the parser object. This is only
	// used for the onToken callback and the external tokenizer.

	var Token = function Token(p) {
	  this.type = p.type;
	  this.value = p.value;
	  this.start = p.start;
	  this.end = p.end;
	  if (p.options.locations)
	    { this.loc = new SourceLocation(p, p.startLoc, p.endLoc); }
	  if (p.options.ranges)
	    { this.range = [p.start, p.end]; }
	};

	// ## Tokenizer

	var pp$9 = Parser.prototype;

	// Move to the next token

	pp$9.next = function(ignoreEscapeSequenceInKeyword) {
	  if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc)
	    { this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword); }
	  if (this.options.onToken)
	    { this.options.onToken(new Token(this)); }

	  this.lastTokEnd = this.end;
	  this.lastTokStart = this.start;
	  this.lastTokEndLoc = this.endLoc;
	  this.lastTokStartLoc = this.startLoc;
	  this.nextToken();
	};

	pp$9.getToken = function() {
	  this.next();
	  return new Token(this)
	};

	// If we're in an ES6 environment, make parsers iterable
	if (typeof Symbol !== "undefined")
	  { pp$9[Symbol.iterator] = function() {
	    var this$1$1 = this;

	    return {
	      next: function () {
	        var token = this$1$1.getToken();
	        return {
	          done: token.type === types.eof,
	          value: token
	        }
	      }
	    }
	  }; }

	// Toggle strict mode. Re-reads the next number or string to please
	// pedantic tests (`"use strict"; 010;` should fail).

	pp$9.curContext = function() {
	  return this.context[this.context.length - 1]
	};

	// Read a single token, updating the parser object's token-related
	// properties.

	pp$9.nextToken = function() {
	  var curContext = this.curContext();
	  if (!curContext || !curContext.preserveSpace) { this.skipSpace(); }

	  this.start = this.pos;
	  if (this.options.locations) { this.startLoc = this.curPosition(); }
	  if (this.pos >= this.input.length) { return this.finishToken(types.eof) }

	  if (curContext.override) { return curContext.override(this) }
	  else { this.readToken(this.fullCharCodeAtPos()); }
	};

	pp$9.readToken = function(code) {
	  // Identifier or keyword. '\uXXXX' sequences are allowed in
	  // identifiers, so '\' also dispatches to that.
	  if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */)
	    { return this.readWord() }

	  return this.getTokenFromCode(code)
	};

	pp$9.fullCharCodeAtPos = function() {
	  var code = this.input.charCodeAt(this.pos);
	  if (code <= 0xd7ff || code >= 0xe000) { return code }
	  var next = this.input.charCodeAt(this.pos + 1);
	  return (code << 10) + next - 0x35fdc00
	};

	pp$9.skipBlockComment = function() {
	  var startLoc = this.options.onComment && this.curPosition();
	  var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
	  if (end === -1) { this.raise(this.pos - 2, "Unterminated comment"); }
	  this.pos = end + 2;
	  if (this.options.locations) {
	    lineBreakG.lastIndex = start;
	    var match;
	    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
	      ++this.curLine;
	      this.lineStart = match.index + match[0].length;
	    }
	  }
	  if (this.options.onComment)
	    { this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos,
	                           startLoc, this.curPosition()); }
	};

	pp$9.skipLineComment = function(startSkip) {
	  var start = this.pos;
	  var startLoc = this.options.onComment && this.curPosition();
	  var ch = this.input.charCodeAt(this.pos += startSkip);
	  while (this.pos < this.input.length && !isNewLine(ch)) {
	    ch = this.input.charCodeAt(++this.pos);
	  }
	  if (this.options.onComment)
	    { this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos,
	                           startLoc, this.curPosition()); }
	};

	// Called at the start of the parse and after every token. Skips
	// whitespace and comments, and.

	pp$9.skipSpace = function() {
	  loop: while (this.pos < this.input.length) {
	    var ch = this.input.charCodeAt(this.pos);
	    switch (ch) {
	    case 32: case 160: // ' '
	      ++this.pos;
	      break
	    case 13:
	      if (this.input.charCodeAt(this.pos + 1) === 10) {
	        ++this.pos;
	      }
	    case 10: case 8232: case 8233:
	      ++this.pos;
	      if (this.options.locations) {
	        ++this.curLine;
	        this.lineStart = this.pos;
	      }
	      break
	    case 47: // '/'
	      switch (this.input.charCodeAt(this.pos + 1)) {
	      case 42: // '*'
	        this.skipBlockComment();
	        break
	      case 47:
	        this.skipLineComment(2);
	        break
	      default:
	        break loop
	      }
	      break
	    default:
	      if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
	        ++this.pos;
	      } else {
	        break loop
	      }
	    }
	  }
	};

	// Called at the end of every token. Sets `end`, `val`, and
	// maintains `context` and `exprAllowed`, and skips the space after
	// the token, so that the next one's `start` will point at the
	// right position.

	pp$9.finishToken = function(type, val) {
	  this.end = this.pos;
	  if (this.options.locations) { this.endLoc = this.curPosition(); }
	  var prevType = this.type;
	  this.type = type;
	  this.value = val;

	  this.updateContext(prevType);
	};

	// ### Token reading

	// This is the function that is called to fetch the next token. It
	// is somewhat obscure, because it works in character codes rather
	// than characters, and because operator parsing has been inlined
	// into it.
	//
	// All in the name of speed.
	//
	pp$9.readToken_dot = function() {
	  var next = this.input.charCodeAt(this.pos + 1);
	  if (next >= 48 && next <= 57) { return this.readNumber(true) }
	  var next2 = this.input.charCodeAt(this.pos + 2);
	  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) { // 46 = dot '.'
	    this.pos += 3;
	    return this.finishToken(types.ellipsis)
	  } else {
	    ++this.pos;
	    return this.finishToken(types.dot)
	  }
	};

	pp$9.readToken_slash = function() { // '/'
	  var next = this.input.charCodeAt(this.pos + 1);
	  if (this.exprAllowed) { ++this.pos; return this.readRegexp() }
	  if (next === 61) { return this.finishOp(types.assign, 2) }
	  return this.finishOp(types.slash, 1)
	};

	pp$9.readToken_mult_modulo_exp = function(code) { // '%*'
	  var next = this.input.charCodeAt(this.pos + 1);
	  var size = 1;
	  var tokentype = code === 42 ? types.star : types.modulo;

	  // exponentiation operator ** and **=
	  if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
	    ++size;
	    tokentype = types.starstar;
	    next = this.input.charCodeAt(this.pos + 2);
	  }

	  if (next === 61) { return this.finishOp(types.assign, size + 1) }
	  return this.finishOp(tokentype, size)
	};

	pp$9.readToken_pipe_amp = function(code) { // '|&'
	  var next = this.input.charCodeAt(this.pos + 1);
	  if (next === code) {
	    if (this.options.ecmaVersion >= 12) {
	      var next2 = this.input.charCodeAt(this.pos + 2);
	      if (next2 === 61) { return this.finishOp(types.assign, 3) }
	    }
	    return this.finishOp(code === 124 ? types.logicalOR : types.logicalAND, 2)
	  }
	  if (next === 61) { return this.finishOp(types.assign, 2) }
	  return this.finishOp(code === 124 ? types.bitwiseOR : types.bitwiseAND, 1)
	};

	pp$9.readToken_caret = function() { // '^'
	  var next = this.input.charCodeAt(this.pos + 1);
	  if (next === 61) { return this.finishOp(types.assign, 2) }
	  return this.finishOp(types.bitwiseXOR, 1)
	};

	pp$9.readToken_plus_min = function(code) { // '+-'
	  var next = this.input.charCodeAt(this.pos + 1);
	  if (next === code) {
	    if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 &&
	        (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
	      // A `-->` line comment
	      this.skipLineComment(3);
	      this.skipSpace();
	      return this.nextToken()
	    }
	    return this.finishOp(types.incDec, 2)
	  }
	  if (next === 61) { return this.finishOp(types.assign, 2) }
	  return this.finishOp(types.plusMin, 1)
	};

	pp$9.readToken_lt_gt = function(code) { // '<>'
	  var next = this.input.charCodeAt(this.pos + 1);
	  var size = 1;
	  if (next === code) {
	    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
	    if (this.input.charCodeAt(this.pos + size) === 61) { return this.finishOp(types.assign, size + 1) }
	    return this.finishOp(types.bitShift, size)
	  }
	  if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 &&
	      this.input.charCodeAt(this.pos + 3) === 45) {
	    // `<!--`, an XML-style comment that should be interpreted as a line comment
	    this.skipLineComment(4);
	    this.skipSpace();
	    return this.nextToken()
	  }
	  if (next === 61) { size = 2; }
	  return this.finishOp(types.relational, size)
	};

	pp$9.readToken_eq_excl = function(code) { // '=!'
	  var next = this.input.charCodeAt(this.pos + 1);
	  if (next === 61) { return this.finishOp(types.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2) }
	  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) { // '=>'
	    this.pos += 2;
	    return this.finishToken(types.arrow)
	  }
	  return this.finishOp(code === 61 ? types.eq : types.prefix, 1)
	};

	pp$9.readToken_question = function() { // '?'
	  var ecmaVersion = this.options.ecmaVersion;
	  if (ecmaVersion >= 11) {
	    var next = this.input.charCodeAt(this.pos + 1);
	    if (next === 46) {
	      var next2 = this.input.charCodeAt(this.pos + 2);
	      if (next2 < 48 || next2 > 57) { return this.finishOp(types.questionDot, 2) }
	    }
	    if (next === 63) {
	      if (ecmaVersion >= 12) {
	        var next2$1 = this.input.charCodeAt(this.pos + 2);
	        if (next2$1 === 61) { return this.finishOp(types.assign, 3) }
	      }
	      return this.finishOp(types.coalesce, 2)
	    }
	  }
	  return this.finishOp(types.question, 1)
	};

	pp$9.getTokenFromCode = function(code) {
	  switch (code) {
	  // The interpretation of a dot depends on whether it is followed
	  // by a digit or another two dots.
	  case 46: // '.'
	    return this.readToken_dot()

	  // Punctuation tokens.
	  case 40: ++this.pos; return this.finishToken(types.parenL)
	  case 41: ++this.pos; return this.finishToken(types.parenR)
	  case 59: ++this.pos; return this.finishToken(types.semi)
	  case 44: ++this.pos; return this.finishToken(types.comma)
	  case 91: ++this.pos; return this.finishToken(types.bracketL)
	  case 93: ++this.pos; return this.finishToken(types.bracketR)
	  case 123: ++this.pos; return this.finishToken(types.braceL)
	  case 125: ++this.pos; return this.finishToken(types.braceR)
	  case 58: ++this.pos; return this.finishToken(types.colon)

	  case 96: // '`'
	    if (this.options.ecmaVersion < 6) { break }
	    ++this.pos;
	    return this.finishToken(types.backQuote)

	  case 48: // '0'
	    var next = this.input.charCodeAt(this.pos + 1);
	    if (next === 120 || next === 88) { return this.readRadixNumber(16) } // '0x', '0X' - hex number
	    if (this.options.ecmaVersion >= 6) {
	      if (next === 111 || next === 79) { return this.readRadixNumber(8) } // '0o', '0O' - octal number
	      if (next === 98 || next === 66) { return this.readRadixNumber(2) } // '0b', '0B' - binary number
	    }

	  // Anything else beginning with a digit is an integer, octal
	  // number, or float.
	  case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
	    return this.readNumber(false)

	  // Quotes produce strings.
	  case 34: case 39: // '"', "'"
	    return this.readString(code)

	  // Operators are parsed inline in tiny state machines. '=' (61) is
	  // often referred to. `finishOp` simply skips the amount of
	  // characters it is given as second argument, and returns a token
	  // of the type given by its first argument.

	  case 47: // '/'
	    return this.readToken_slash()

	  case 37: case 42: // '%*'
	    return this.readToken_mult_modulo_exp(code)

	  case 124: case 38: // '|&'
	    return this.readToken_pipe_amp(code)

	  case 94: // '^'
	    return this.readToken_caret()

	  case 43: case 45: // '+-'
	    return this.readToken_plus_min(code)

	  case 60: case 62: // '<>'
	    return this.readToken_lt_gt(code)

	  case 61: case 33: // '=!'
	    return this.readToken_eq_excl(code)

	  case 63: // '?'
	    return this.readToken_question()

	  case 126: // '~'
	    return this.finishOp(types.prefix, 1)
	  }

	  this.raise(this.pos, "Unexpected character '" + codePointToString$1(code) + "'");
	};

	pp$9.finishOp = function(type, size) {
	  var str = this.input.slice(this.pos, this.pos + size);
	  this.pos += size;
	  return this.finishToken(type, str)
	};

	pp$9.readRegexp = function() {
	  var escaped, inClass, start = this.pos;
	  for (;;) {
	    if (this.pos >= this.input.length) { this.raise(start, "Unterminated regular expression"); }
	    var ch = this.input.charAt(this.pos);
	    if (lineBreak.test(ch)) { this.raise(start, "Unterminated regular expression"); }
	    if (!escaped) {
	      if (ch === "[") { inClass = true; }
	      else if (ch === "]" && inClass) { inClass = false; }
	      else if (ch === "/" && !inClass) { break }
	      escaped = ch === "\\";
	    } else { escaped = false; }
	    ++this.pos;
	  }
	  var pattern = this.input.slice(start, this.pos);
	  ++this.pos;
	  var flagsStart = this.pos;
	  var flags = this.readWord1();
	  if (this.containsEsc) { this.unexpected(flagsStart); }

	  // Validate pattern
	  var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
	  state.reset(start, pattern, flags);
	  this.validateRegExpFlags(state);
	  this.validateRegExpPattern(state);

	  // Create Literal#value property value.
	  var value = null;
	  try {
	    value = new RegExp(pattern, flags);
	  } catch (e) {
	    // ESTree requires null if it failed to instantiate RegExp object.
	    // https://github.com/estree/estree/blob/a27003adf4fd7bfad44de9cef372a2eacd527b1c/es5.md#regexpliteral
	  }

	  return this.finishToken(types.regexp, {pattern: pattern, flags: flags, value: value})
	};

	// Read an integer in the given radix. Return null if zero digits
	// were read, the integer value otherwise. When `len` is given, this
	// will return `null` unless the integer has exactly `len` digits.

	pp$9.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
	  // `len` is used for character escape sequences. In that case, disallow separators.
	  var allowSeparators = this.options.ecmaVersion >= 12 && len === undefined;

	  // `maybeLegacyOctalNumericLiteral` is true if it doesn't have prefix (0x,0o,0b)
	  // and isn't fraction part nor exponent part. In that case, if the first digit
	  // is zero then disallow separators.
	  var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;

	  var start = this.pos, total = 0, lastCode = 0;
	  for (var i = 0, e = len == null ? Infinity : len; i < e; ++i, ++this.pos) {
	    var code = this.input.charCodeAt(this.pos), val = (void 0);

	    if (allowSeparators && code === 95) {
	      if (isLegacyOctalNumericLiteral) { this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals"); }
	      if (lastCode === 95) { this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore"); }
	      if (i === 0) { this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits"); }
	      lastCode = code;
	      continue
	    }

	    if (code >= 97) { val = code - 97 + 10; } // a
	    else if (code >= 65) { val = code - 65 + 10; } // A
	    else if (code >= 48 && code <= 57) { val = code - 48; } // 0-9
	    else { val = Infinity; }
	    if (val >= radix) { break }
	    lastCode = code;
	    total = total * radix + val;
	  }

	  if (allowSeparators && lastCode === 95) { this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits"); }
	  if (this.pos === start || len != null && this.pos - start !== len) { return null }

	  return total
	};

	function stringToNumber(str, isLegacyOctalNumericLiteral) {
	  if (isLegacyOctalNumericLiteral) {
	    return parseInt(str, 8)
	  }

	  // `parseFloat(value)` stops parsing at the first numeric separator then returns a wrong value.
	  return parseFloat(str.replace(/_/g, ""))
	}

	function stringToBigInt(str) {
	  if (typeof BigInt !== "function") {
	    return null
	  }

	  // `BigInt(value)` throws syntax error if the string contains numeric separators.
	  return BigInt(str.replace(/_/g, ""))
	}

	pp$9.readRadixNumber = function(radix) {
	  var start = this.pos;
	  this.pos += 2; // 0x
	  var val = this.readInt(radix);
	  if (val == null) { this.raise(this.start + 2, "Expected number in radix " + radix); }
	  if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
	    val = stringToBigInt(this.input.slice(start, this.pos));
	    ++this.pos;
	  } else if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }
	  return this.finishToken(types.num, val)
	};

	// Read an integer, octal integer, or floating-point number.

	pp$9.readNumber = function(startsWithDot) {
	  var start = this.pos;
	  if (!startsWithDot && this.readInt(10, undefined, true) === null) { this.raise(start, "Invalid number"); }
	  var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
	  if (octal && this.strict) { this.raise(start, "Invalid number"); }
	  var next = this.input.charCodeAt(this.pos);
	  if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
	    var val$1 = stringToBigInt(this.input.slice(start, this.pos));
	    ++this.pos;
	    if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }
	    return this.finishToken(types.num, val$1)
	  }
	  if (octal && /[89]/.test(this.input.slice(start, this.pos))) { octal = false; }
	  if (next === 46 && !octal) { // '.'
	    ++this.pos;
	    this.readInt(10);
	    next = this.input.charCodeAt(this.pos);
	  }
	  if ((next === 69 || next === 101) && !octal) { // 'eE'
	    next = this.input.charCodeAt(++this.pos);
	    if (next === 43 || next === 45) { ++this.pos; } // '+-'
	    if (this.readInt(10) === null) { this.raise(start, "Invalid number"); }
	  }
	  if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }

	  var val = stringToNumber(this.input.slice(start, this.pos), octal);
	  return this.finishToken(types.num, val)
	};

	// Read a string value, interpreting backslash-escapes.

	pp$9.readCodePoint = function() {
	  var ch = this.input.charCodeAt(this.pos), code;

	  if (ch === 123) { // '{'
	    if (this.options.ecmaVersion < 6) { this.unexpected(); }
	    var codePos = ++this.pos;
	    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
	    ++this.pos;
	    if (code > 0x10FFFF) { this.invalidStringToken(codePos, "Code point out of bounds"); }
	  } else {
	    code = this.readHexChar(4);
	  }
	  return code
	};

	function codePointToString$1(code) {
	  // UTF-16 Decoding
	  if (code <= 0xFFFF) { return String.fromCharCode(code) }
	  code -= 0x10000;
	  return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00)
	}

	pp$9.readString = function(quote) {
	  var out = "", chunkStart = ++this.pos;
	  for (;;) {
	    if (this.pos >= this.input.length) { this.raise(this.start, "Unterminated string constant"); }
	    var ch = this.input.charCodeAt(this.pos);
	    if (ch === quote) { break }
	    if (ch === 92) { // '\'
	      out += this.input.slice(chunkStart, this.pos);
	      out += this.readEscapedChar(false);
	      chunkStart = this.pos;
	    } else {
	      if (isNewLine(ch, this.options.ecmaVersion >= 10)) { this.raise(this.start, "Unterminated string constant"); }
	      ++this.pos;
	    }
	  }
	  out += this.input.slice(chunkStart, this.pos++);
	  return this.finishToken(types.string, out)
	};

	// Reads template string tokens.

	var INVALID_TEMPLATE_ESCAPE_ERROR = {};

	pp$9.tryReadTemplateToken = function() {
	  this.inTemplateElement = true;
	  try {
	    this.readTmplToken();
	  } catch (err) {
	    if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {
	      this.readInvalidTemplateToken();
	    } else {
	      throw err
	    }
	  }

	  this.inTemplateElement = false;
	};

	pp$9.invalidStringToken = function(position, message) {
	  if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
	    throw INVALID_TEMPLATE_ESCAPE_ERROR
	  } else {
	    this.raise(position, message);
	  }
	};

	pp$9.readTmplToken = function() {
	  var out = "", chunkStart = this.pos;
	  for (;;) {
	    if (this.pos >= this.input.length) { this.raise(this.start, "Unterminated template"); }
	    var ch = this.input.charCodeAt(this.pos);
	    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) { // '`', '${'
	      if (this.pos === this.start && (this.type === types.template || this.type === types.invalidTemplate)) {
	        if (ch === 36) {
	          this.pos += 2;
	          return this.finishToken(types.dollarBraceL)
	        } else {
	          ++this.pos;
	          return this.finishToken(types.backQuote)
	        }
	      }
	      out += this.input.slice(chunkStart, this.pos);
	      return this.finishToken(types.template, out)
	    }
	    if (ch === 92) { // '\'
	      out += this.input.slice(chunkStart, this.pos);
	      out += this.readEscapedChar(true);
	      chunkStart = this.pos;
	    } else if (isNewLine(ch)) {
	      out += this.input.slice(chunkStart, this.pos);
	      ++this.pos;
	      switch (ch) {
	      case 13:
	        if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; }
	      case 10:
	        out += "\n";
	        break
	      default:
	        out += String.fromCharCode(ch);
	        break
	      }
	      if (this.options.locations) {
	        ++this.curLine;
	        this.lineStart = this.pos;
	      }
	      chunkStart = this.pos;
	    } else {
	      ++this.pos;
	    }
	  }
	};

	// Reads a template token to search for the end, without validating any escape sequences
	pp$9.readInvalidTemplateToken = function() {
	  for (; this.pos < this.input.length; this.pos++) {
	    switch (this.input[this.pos]) {
	    case "\\":
	      ++this.pos;
	      break

	    case "$":
	      if (this.input[this.pos + 1] !== "{") {
	        break
	      }
	    // falls through

	    case "`":
	      return this.finishToken(types.invalidTemplate, this.input.slice(this.start, this.pos))

	    // no default
	    }
	  }
	  this.raise(this.start, "Unterminated template");
	};

	// Used to read escaped characters

	pp$9.readEscapedChar = function(inTemplate) {
	  var ch = this.input.charCodeAt(++this.pos);
	  ++this.pos;
	  switch (ch) {
	  case 110: return "\n" // 'n' -> '\n'
	  case 114: return "\r" // 'r' -> '\r'
	  case 120: return String.fromCharCode(this.readHexChar(2)) // 'x'
	  case 117: return codePointToString$1(this.readCodePoint()) // 'u'
	  case 116: return "\t" // 't' -> '\t'
	  case 98: return "\b" // 'b' -> '\b'
	  case 118: return "\u000b" // 'v' -> '\u000b'
	  case 102: return "\f" // 'f' -> '\f'
	  case 13: if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; } // '\r\n'
	  case 10: // ' \n'
	    if (this.options.locations) { this.lineStart = this.pos; ++this.curLine; }
	    return ""
	  case 56:
	  case 57:
	    if (inTemplate) {
	      var codePos = this.pos - 1;

	      this.invalidStringToken(
	        codePos,
	        "Invalid escape sequence in template string"
	      );

	      return null
	    }
	  default:
	    if (ch >= 48 && ch <= 55) {
	      var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
	      var octal = parseInt(octalStr, 8);
	      if (octal > 255) {
	        octalStr = octalStr.slice(0, -1);
	        octal = parseInt(octalStr, 8);
	      }
	      this.pos += octalStr.length - 1;
	      ch = this.input.charCodeAt(this.pos);
	      if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
	        this.invalidStringToken(
	          this.pos - 1 - octalStr.length,
	          inTemplate
	            ? "Octal literal in template string"
	            : "Octal literal in strict mode"
	        );
	      }
	      return String.fromCharCode(octal)
	    }
	    if (isNewLine(ch)) {
	      // Unicode new line characters after \ get removed from output in both
	      // template literals and strings
	      return ""
	    }
	    return String.fromCharCode(ch)
	  }
	};

	// Used to read character escape sequences ('\x', '\u', '\U').

	pp$9.readHexChar = function(len) {
	  var codePos = this.pos;
	  var n = this.readInt(16, len);
	  if (n === null) { this.invalidStringToken(codePos, "Bad character escape sequence"); }
	  return n
	};

	// Read an identifier, and return it as a string. Sets `this.containsEsc`
	// to whether the word contained a '\u' escape.
	//
	// Incrementally adds only escaped chars, adding other chunks as-is
	// as a micro-optimization.

	pp$9.readWord1 = function() {
	  this.containsEsc = false;
	  var word = "", first = true, chunkStart = this.pos;
	  var astral = this.options.ecmaVersion >= 6;
	  while (this.pos < this.input.length) {
	    var ch = this.fullCharCodeAtPos();
	    if (isIdentifierChar(ch, astral)) {
	      this.pos += ch <= 0xffff ? 1 : 2;
	    } else if (ch === 92) { // "\"
	      this.containsEsc = true;
	      word += this.input.slice(chunkStart, this.pos);
	      var escStart = this.pos;
	      if (this.input.charCodeAt(++this.pos) !== 117) // "u"
	        { this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX"); }
	      ++this.pos;
	      var esc = this.readCodePoint();
	      if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral))
	        { this.invalidStringToken(escStart, "Invalid Unicode escape"); }
	      word += codePointToString$1(esc);
	      chunkStart = this.pos;
	    } else {
	      break
	    }
	    first = false;
	  }
	  return word + this.input.slice(chunkStart, this.pos)
	};

	// Read an identifier or keyword token. Will check for reserved
	// words when necessary.

	pp$9.readWord = function() {
	  var word = this.readWord1();
	  var type = types.name;
	  if (this.keywords.test(word)) {
	    type = keywords$1[word];
	  }
	  return this.finishToken(type, word)
	};

	// Acorn is a tiny, fast JavaScript parser written in JavaScript.

	var version = "7.4.1";

	Parser.acorn = {
	  Parser: Parser,
	  version: version,
	  defaultOptions: defaultOptions,
	  Position: Position,
	  SourceLocation: SourceLocation,
	  getLineInfo: getLineInfo,
	  Node: Node,
	  TokenType: TokenType,
	  tokTypes: types,
	  keywordTypes: keywords$1,
	  TokContext: TokContext,
	  tokContexts: types$1,
	  isIdentifierChar: isIdentifierChar,
	  isIdentifierStart: isIdentifierStart,
	  Token: Token,
	  isNewLine: isNewLine,
	  lineBreak: lineBreak,
	  lineBreakG: lineBreakG,
	  nonASCIIwhitespace: nonASCIIwhitespace
	};var defaultGlobals = new Set([
	  "Array",
	  "ArrayBuffer",
	  "atob",
	  "AudioContext",
	  "Blob",
	  "Boolean",
	  "BigInt",
	  "btoa",
	  "clearInterval",
	  "clearTimeout",
	  "console",
	  "crypto",
	  "CustomEvent",
	  "DataView",
	  "Date",
	  "decodeURI",
	  "decodeURIComponent",
	  "devicePixelRatio",
	  "document",
	  "encodeURI",
	  "encodeURIComponent",
	  "Error",
	  "escape",
	  "eval",
	  "fetch",
	  "File",
	  "FileList",
	  "FileReader",
	  "Float32Array",
	  "Float64Array",
	  "Function",
	  "Headers",
	  "Image",
	  "ImageData",
	  "Infinity",
	  "Int16Array",
	  "Int32Array",
	  "Int8Array",
	  "Intl",
	  "isFinite",
	  "isNaN",
	  "JSON",
	  "Map",
	  "Math",
	  "NaN",
	  "Number",
	  "navigator",
	  "Object",
	  "parseFloat",
	  "parseInt",
	  "performance",
	  "Path2D",
	  "Promise",
	  "Proxy",
	  "RangeError",
	  "ReferenceError",
	  "Reflect",
	  "RegExp",
	  "cancelAnimationFrame",
	  "requestAnimationFrame",
	  "Set",
	  "setInterval",
	  "setTimeout",
	  "String",
	  "Symbol",
	  "SyntaxError",
	  "TextDecoder",
	  "TextEncoder",
	  "this",
	  "TypeError",
	  "Uint16Array",
	  "Uint32Array",
	  "Uint8Array",
	  "Uint8ClampedArray",
	  "undefined",
	  "unescape",
	  "URIError",
	  "URL",
	  "WeakMap",
	  "WeakSet",
	  "WebSocket",
	  "Worker",
	  "window"
	]);// AST walker module for Mozilla Parser API compatible trees

	// A simple walk is one where you simply specify callbacks to be
	// called on specific nodes. The last two arguments are optional. A
	// simple use would be
	//
	//     walk.simple(myTree, {
	//         Expression: function(node) { ... }
	//     });
	//
	// to do something with all expressions. All Parser API node types
	// can be used to identify node types, as well as Expression and
	// Statement, which denote categories of nodes.
	//
	// The base argument can be used to pass a custom (recursive)
	// walker, and state can be used to give this walked an initial
	// state.

	function simple(node, visitors, baseVisitor, state, override) {
	  if (!baseVisitor) { baseVisitor = base
	  ; }(function c(node, st, override) {
	    var type = override || node.type, found = visitors[type];
	    baseVisitor[type](node, st, c);
	    if (found) { found(node, st); }
	  })(node, state, override);
	}

	// An ancestor walk keeps an array of ancestor nodes (including the
	// current node) and passes them to the callback as third parameter
	// (and also as state parameter when no other state is present).
	function ancestor(node, visitors, baseVisitor, state) {
	  var ancestors = [];
	  if (!baseVisitor) { baseVisitor = base
	  ; }(function c(node, st, override) {
	    var type = override || node.type, found = visitors[type];
	    var isNew = node !== ancestors[ancestors.length - 1];
	    if (isNew) { ancestors.push(node); }
	    baseVisitor[type](node, st, c);
	    if (found) { found(node, st || ancestors, ancestors); }
	    if (isNew) { ancestors.pop(); }
	  })(node, state);
	}

	// A full walk triggers the callback on each node
	function full(node, callback, baseVisitor, state, override) {
	  if (!baseVisitor) { baseVisitor = base
	  ; }(function c(node, st, override) {
	    var type = override || node.type;
	    baseVisitor[type](node, st, c);
	    if (!override) { callback(node, st, type); }
	  })(node, state, override);
	}

	// Fallback to an Object.create polyfill for older environments.
	var create = Object.create || function(proto) {
	  function Ctor() {}
	  Ctor.prototype = proto;
	  return new Ctor
	};

	// Used to create a custom walker. Will fill in all missing node
	// type properties with the defaults.
	function make(funcs, baseVisitor) {
	  var visitor = create(baseVisitor || base);
	  for (var type in funcs) { visitor[type] = funcs[type]; }
	  return visitor
	}

	function skipThrough(node, st, c) { c(node, st); }
	function ignore(_node, _st, _c) {}

	// Node walkers.

	var base = {};

	base.Program = base.BlockStatement = function (node, st, c) {
	  for (var i = 0, list = node.body; i < list.length; i += 1)
	    {
	    var stmt = list[i];

	    c(stmt, st, "Statement");
	  }
	};
	base.Statement = skipThrough;
	base.EmptyStatement = ignore;
	base.ExpressionStatement = base.ParenthesizedExpression =
	  function (node, st, c) { return c(node.expression, st, "Expression"); };
	base.IfStatement = function (node, st, c) {
	  c(node.test, st, "Expression");
	  c(node.consequent, st, "Statement");
	  if (node.alternate) { c(node.alternate, st, "Statement"); }
	};
	base.LabeledStatement = function (node, st, c) { return c(node.body, st, "Statement"); };
	base.BreakStatement = base.ContinueStatement = ignore;
	base.WithStatement = function (node, st, c) {
	  c(node.object, st, "Expression");
	  c(node.body, st, "Statement");
	};
	base.SwitchStatement = function (node, st, c) {
	  c(node.discriminant, st, "Expression");
	  for (var i$1 = 0, list$1 = node.cases; i$1 < list$1.length; i$1 += 1) {
	    var cs = list$1[i$1];

	    if (cs.test) { c(cs.test, st, "Expression"); }
	    for (var i = 0, list = cs.consequent; i < list.length; i += 1)
	      {
	      var cons = list[i];

	      c(cons, st, "Statement");
	    }
	  }
	};
	base.SwitchCase = function (node, st, c) {
	  if (node.test) { c(node.test, st, "Expression"); }
	  for (var i = 0, list = node.consequent; i < list.length; i += 1)
	    {
	    var cons = list[i];

	    c(cons, st, "Statement");
	  }
	};
	base.ReturnStatement = base.YieldExpression = base.AwaitExpression = function (node, st, c) {
	  if (node.argument) { c(node.argument, st, "Expression"); }
	};
	base.ThrowStatement = base.SpreadElement =
	  function (node, st, c) { return c(node.argument, st, "Expression"); };
	base.TryStatement = function (node, st, c) {
	  c(node.block, st, "Statement");
	  if (node.handler) { c(node.handler, st); }
	  if (node.finalizer) { c(node.finalizer, st, "Statement"); }
	};
	base.CatchClause = function (node, st, c) {
	  if (node.param) { c(node.param, st, "Pattern"); }
	  c(node.body, st, "Statement");
	};
	base.WhileStatement = base.DoWhileStatement = function (node, st, c) {
	  c(node.test, st, "Expression");
	  c(node.body, st, "Statement");
	};
	base.ForStatement = function (node, st, c) {
	  if (node.init) { c(node.init, st, "ForInit"); }
	  if (node.test) { c(node.test, st, "Expression"); }
	  if (node.update) { c(node.update, st, "Expression"); }
	  c(node.body, st, "Statement");
	};
	base.ForInStatement = base.ForOfStatement = function (node, st, c) {
	  c(node.left, st, "ForInit");
	  c(node.right, st, "Expression");
	  c(node.body, st, "Statement");
	};
	base.ForInit = function (node, st, c) {
	  if (node.type === "VariableDeclaration") { c(node, st); }
	  else { c(node, st, "Expression"); }
	};
	base.DebuggerStatement = ignore;

	base.FunctionDeclaration = function (node, st, c) { return c(node, st, "Function"); };
	base.VariableDeclaration = function (node, st, c) {
	  for (var i = 0, list = node.declarations; i < list.length; i += 1)
	    {
	    var decl = list[i];

	    c(decl, st);
	  }
	};
	base.VariableDeclarator = function (node, st, c) {
	  c(node.id, st, "Pattern");
	  if (node.init) { c(node.init, st, "Expression"); }
	};

	base.Function = function (node, st, c) {
	  if (node.id) { c(node.id, st, "Pattern"); }
	  for (var i = 0, list = node.params; i < list.length; i += 1)
	    {
	    var param = list[i];

	    c(param, st, "Pattern");
	  }
	  c(node.body, st, node.expression ? "Expression" : "Statement");
	};

	base.Pattern = function (node, st, c) {
	  if (node.type === "Identifier")
	    { c(node, st, "VariablePattern"); }
	  else if (node.type === "MemberExpression")
	    { c(node, st, "MemberPattern"); }
	  else
	    { c(node, st); }
	};
	base.VariablePattern = ignore;
	base.MemberPattern = skipThrough;
	base.RestElement = function (node, st, c) { return c(node.argument, st, "Pattern"); };
	base.ArrayPattern = function (node, st, c) {
	  for (var i = 0, list = node.elements; i < list.length; i += 1) {
	    var elt = list[i];

	    if (elt) { c(elt, st, "Pattern"); }
	  }
	};
	base.ObjectPattern = function (node, st, c) {
	  for (var i = 0, list = node.properties; i < list.length; i += 1) {
	    var prop = list[i];

	    if (prop.type === "Property") {
	      if (prop.computed) { c(prop.key, st, "Expression"); }
	      c(prop.value, st, "Pattern");
	    } else if (prop.type === "RestElement") {
	      c(prop.argument, st, "Pattern");
	    }
	  }
	};

	base.Expression = skipThrough;
	base.ThisExpression = base.Super = base.MetaProperty = ignore;
	base.ArrayExpression = function (node, st, c) {
	  for (var i = 0, list = node.elements; i < list.length; i += 1) {
	    var elt = list[i];

	    if (elt) { c(elt, st, "Expression"); }
	  }
	};
	base.ObjectExpression = function (node, st, c) {
	  for (var i = 0, list = node.properties; i < list.length; i += 1)
	    {
	    var prop = list[i];

	    c(prop, st);
	  }
	};
	base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
	base.SequenceExpression = function (node, st, c) {
	  for (var i = 0, list = node.expressions; i < list.length; i += 1)
	    {
	    var expr = list[i];

	    c(expr, st, "Expression");
	  }
	};
	base.TemplateLiteral = function (node, st, c) {
	  for (var i = 0, list = node.quasis; i < list.length; i += 1)
	    {
	    var quasi = list[i];

	    c(quasi, st);
	  }

	  for (var i$1 = 0, list$1 = node.expressions; i$1 < list$1.length; i$1 += 1)
	    {
	    var expr = list$1[i$1];

	    c(expr, st, "Expression");
	  }
	};
	base.TemplateElement = ignore;
	base.UnaryExpression = base.UpdateExpression = function (node, st, c) {
	  c(node.argument, st, "Expression");
	};
	base.BinaryExpression = base.LogicalExpression = function (node, st, c) {
	  c(node.left, st, "Expression");
	  c(node.right, st, "Expression");
	};
	base.AssignmentExpression = base.AssignmentPattern = function (node, st, c) {
	  c(node.left, st, "Pattern");
	  c(node.right, st, "Expression");
	};
	base.ConditionalExpression = function (node, st, c) {
	  c(node.test, st, "Expression");
	  c(node.consequent, st, "Expression");
	  c(node.alternate, st, "Expression");
	};
	base.NewExpression = base.CallExpression = function (node, st, c) {
	  c(node.callee, st, "Expression");
	  if (node.arguments)
	    { for (var i = 0, list = node.arguments; i < list.length; i += 1)
	      {
	        var arg = list[i];

	        c(arg, st, "Expression");
	      } }
	};
	base.MemberExpression = function (node, st, c) {
	  c(node.object, st, "Expression");
	  if (node.computed) { c(node.property, st, "Expression"); }
	};
	base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function (node, st, c) {
	  if (node.declaration)
	    { c(node.declaration, st, node.type === "ExportNamedDeclaration" || node.declaration.id ? "Statement" : "Expression"); }
	  if (node.source) { c(node.source, st, "Expression"); }
	};
	base.ExportAllDeclaration = function (node, st, c) {
	  c(node.source, st, "Expression");
	};
	base.ImportDeclaration = function (node, st, c) {
	  for (var i = 0, list = node.specifiers; i < list.length; i += 1)
	    {
	    var spec = list[i];

	    c(spec, st);
	  }
	  c(node.source, st, "Expression");
	};
	base.ImportExpression = function (node, st, c) {
	  c(node.source, st, "Expression");
	};
	base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.Literal = ignore;

	base.TaggedTemplateExpression = function (node, st, c) {
	  c(node.tag, st, "Expression");
	  c(node.quasi, st, "Expression");
	};
	base.ClassDeclaration = base.ClassExpression = function (node, st, c) { return c(node, st, "Class"); };
	base.Class = function (node, st, c) {
	  if (node.id) { c(node.id, st, "Pattern"); }
	  if (node.superClass) { c(node.superClass, st, "Expression"); }
	  c(node.body, st);
	};
	base.ClassBody = function (node, st, c) {
	  for (var i = 0, list = node.body; i < list.length; i += 1)
	    {
	    var elt = list[i];

	    c(elt, st);
	  }
	};
	base.MethodDefinition = base.Property = function (node, st, c) {
	  if (node.computed) { c(node.key, st, "Expression"); }
	  c(node.value, st, "Expression");
	};var walk = make({
	  Import() {},
	  ViewExpression(node, st, c) {
	    c(node.id, st, "Identifier");
	  },
	  MutableExpression(node, st, c) {
	    c(node.id, st, "Identifier");
	  }
	});// Based on https://github.com/ForbesLindesay/acorn-globals

	function isScope(node) {
	  return node.type === "FunctionExpression"
	      || node.type === "FunctionDeclaration"
	      || node.type === "ArrowFunctionExpression"
	      || node.type === "Program";
	}

	function isBlockScope(node) {
	  return node.type === "BlockStatement"
	      || node.type === "ForInStatement"
	      || node.type === "ForOfStatement"
	      || node.type === "ForStatement"
	      || isScope(node);
	}

	function declaresArguments(node) {
	  return node.type === "FunctionExpression"
	      || node.type === "FunctionDeclaration";
	}

	function findReferences(cell, globals) {
	  const ast = {type: "Program", body: [cell.body]};
	  const locals = new Map;
	  const globalSet = new Set(globals);
	  const references = [];

	  function hasLocal(node, name) {
	    const l = locals.get(node);
	    return l ? l.has(name) : false;
	  }

	  function declareLocal(node, id) {
	    const l = locals.get(node);
	    if (l) l.add(id.name);
	    else locals.set(node, new Set([id.name]));
	  }

	  function declareClass(node) {
	    if (node.id) declareLocal(node, node.id);
	  }

	  function declareFunction(node) {
	    node.params.forEach(param => declarePattern(param, node));
	    if (node.id) declareLocal(node, node.id);
	  }

	  function declareCatchClause(node) {
	    if (node.param) declarePattern(node.param, node);
	  }

	  function declarePattern(node, parent) {
	    switch (node.type) {
	      case "Identifier":
	        declareLocal(parent, node);
	        break;
	      case "ObjectPattern":
	        node.properties.forEach(node => declarePattern(node, parent));
	        break;
	      case "ArrayPattern":
	        node.elements.forEach(node => node && declarePattern(node, parent));
	        break;
	      case "Property":
	        declarePattern(node.value, parent);
	        break;
	      case "RestElement":
	        declarePattern(node.argument, parent);
	        break;
	      case "AssignmentPattern":
	        declarePattern(node.left, parent);
	        break;
	      default:
	        throw new Error("Unrecognized pattern type: " + node.type);
	    }
	  }

	  function declareModuleSpecifier(node) {
	    declareLocal(ast, node.local);
	  }

	  ancestor(
	    ast,
	    {
	      VariableDeclaration: (node, parents) => {
	        let parent = null;
	        for (let i = parents.length - 1; i >= 0 && parent === null; --i) {
	          if (node.kind === "var" ? isScope(parents[i]) : isBlockScope(parents[i])) {
	            parent = parents[i];
	          }
	        }
	        node.declarations.forEach(declaration => declarePattern(declaration.id, parent));
	      },
	      FunctionDeclaration: (node, parents) => {
	        let parent = null;
	        for (let i = parents.length - 2; i >= 0 && parent === null; --i) {
	          if (isScope(parents[i])) {
	            parent = parents[i];
	          }
	        }
	        declareLocal(parent, node.id);
	        declareFunction(node);
	      },
	      Function: declareFunction,
	      ClassDeclaration: (node, parents) => {
	        let parent = null;
	        for (let i = parents.length - 2; i >= 0 && parent === null; i--) {
	          if (isScope(parents[i])) {
	            parent = parents[i];
	          }
	        }
	        declareLocal(parent, node.id);
	      },
	      Class: declareClass,
	      CatchClause: declareCatchClause,
	      ImportDefaultSpecifier: declareModuleSpecifier,
	      ImportSpecifier: declareModuleSpecifier,
	      ImportNamespaceSpecifier: declareModuleSpecifier
	    },
	    walk
	  );

	  function identifier(node, parents) {
	    let name = node.name;
	    if (name === "undefined") return;
	    for (let i = parents.length - 2; i >= 0; --i) {
	      if (name === "arguments") {
	        if (declaresArguments(parents[i])) {
	          return;
	        }
	      }
	      if (hasLocal(parents[i], name)) {
	        return;
	      }
	      if (parents[i].type === "ViewExpression") {
	        node = parents[i];
	        name = `viewof ${node.id.name}`;
	      }
	      if (parents[i].type === "MutableExpression") {
	        node = parents[i];
	        name = `mutable ${node.id.name}`;
	      }
	    }
	    if (!globalSet.has(name)) {
	      if (name === "arguments") {
	        throw Object.assign(new SyntaxError(`arguments is not allowed`), {node});
	      }
	      references.push(node);
	    }
	  }

	  ancestor(
	    ast,
	    {
	      VariablePattern: identifier,
	      Identifier: identifier
	    },
	    walk
	  );

	  function checkConst(node, parents) {
	    switch (node.type) {
	      case "Identifier":
	      case "VariablePattern": {
	        identifier(node, parents);
	        break;
	      }
	      case "ArrayPattern":
	      case "ObjectPattern": {
	        ancestor(
	          node,
	          {
	            Identifier: identifier,
	            VariablePattern: identifier
	          },
	          walk
	        );
	        break;
	      }
	    }
	    function identifier(node, nodeParents) {
	      for (const parent of parents) {
	        if (hasLocal(parent, node.name)) {
	          return;
	        }
	      }
	      if (nodeParents[nodeParents.length - 2].type === "MutableExpression") {
	        return;
	      }
	      throw Object.assign(new SyntaxError(`Assignment to constant variable ${node.name}`), {node});
	    }
	  }

	  function checkConstArgument(node, parents) {
	    checkConst(node.argument, parents);
	  }

	  function checkConstLeft(node, parents) {
	    checkConst(node.left, parents);
	  }

	  ancestor(
	    ast,
	    {
	      AssignmentExpression: checkConstLeft,
	      UpdateExpression: checkConstArgument,
	      ForOfStatement: checkConstLeft,
	      ForInStatement: checkConstLeft
	    },
	    walk
	  );

	  return references;
	}function findFeatures(cell, featureName) {
	  const ast = {type: "Program", body: [cell.body]};
	  const features = new Map();
	  const {references} = cell;

	  simple(
	    ast,
	    {
	      CallExpression: node => {
	        const {callee, arguments: args} = node;

	        // Ignore function calls that are not references to the feature.
	        if (
	          callee.type !== "Identifier" ||
	          callee.name !== featureName ||
	          references.indexOf(callee) < 0
	        ) return;

	        // Forbid dynamic calls.
	        if (
	          args.length !== 1 ||
	          !((args[0].type === "Literal" && /^['"]/.test(args[0].raw)) ||
	            (args[0].type === "TemplateLiteral" && args[0].expressions.length === 0))
	        ) {
	          throw Object.assign(new SyntaxError(`${featureName} requires a single literal string argument`), {node});
	        }

	        const [arg] = args;
	        const name = arg.type === "Literal" ? arg.value : arg.quasis[0].value.cooked;
	        const location = {start: arg.start, end: arg.end};
	        if (features.has(name)) features.get(name).push(location);
	        else features.set(name, [location]);
	      }
	    },
	    walk
	  );

	  return features;
	}const SCOPE_FUNCTION$1 = 2;
	const SCOPE_ASYNC$1 = 4;
	const SCOPE_GENERATOR$1 = 8;

	const STATE_START = Symbol("start");
	const STATE_MODIFIER = Symbol("modifier");
	const STATE_FUNCTION = Symbol("function");
	const STATE_NAME = Symbol("name");

	function parseCell(input, {globals} = {}) {
	  const cell = CellParser.parse(input);
	  parseReferences(cell, input, globals);
	  parseFeatures(cell);
	  return cell;
	}

	/*
	                       ┌─────┐
	           ┌───────────│START│─function|class
	           │           └─────┘             │
	viewof|mutable|async      │                ▼
	           │              │           ┌────────┐     ┌─┐
	           ▼              │           │FUNCTION│◀───▶│*│
	      ┌────────┐          │           └────────┘     └─┘
	      │MODIFIER│          │                │
	      └────────┘        name             name
	           │              │                │
	           └──name─┐      │                ▼
	                   ▼      │         ┌─────────────┐
	              ┌────────┐  │         │FUNCTION_NAME│
	              │  NAME  │◀─┘         └─────────────┘
	              └────────┘
	                   │
	                   =
	                   ▼
	              ┌────────┐
	              │   EQ   │
	              └────────┘
	*/

	function peekId(input) {
	  let state = STATE_START;
	  let name;
	  try {
	    for (const token of Parser.tokenizer(input, {ecmaVersion: 11})) {
	      switch (state) {
	        case STATE_START:
	        case STATE_MODIFIER: {
	          if (token.type === types.name) {
	            if (
	              state === STATE_START &&
	              (token.value === "viewof" ||
	                token.value === "mutable" ||
	                token.value === "async")
	            ) {
	              state = STATE_MODIFIER;
	              continue;
	            }
	            state = STATE_NAME;
	            name = token;
	            continue;
	          }
	          if (token.type === types._function || token.type === types._class) {
	            state = STATE_FUNCTION;
	            continue;
	          }
	          break;
	        }
	        case STATE_NAME: {
	          if (token.type === types.eq) return name.value;
	          break;
	        }
	        case STATE_FUNCTION: {
	          if (token.type === types.star) continue;
	          if (token.type === types.name && token.end < input.length)
	            return token.value;
	          break;
	        }
	      }
	      return;
	    }
	  } catch (ignore) {
	    return;
	  }
	}

	class CellParser extends Parser {
	  constructor(options, ...args) {
	    super(Object.assign({ecmaVersion: 12}, options), ...args);
	  }
	  enterScope(flags) {
	    if (flags & SCOPE_FUNCTION$1) ++this.O_function;
	    return super.enterScope(flags);
	  }
	  exitScope() {
	    if (this.currentScope().flags & SCOPE_FUNCTION$1) --this.O_function;
	    return super.exitScope();
	  }
	  parseForIn(node, init) {
	    if (this.O_function === 1 && node.await) this.O_async = true;
	    return super.parseForIn(node, init);
	  }
	  parseAwait() {
	    if (this.O_function === 1) this.O_async = true;
	    return super.parseAwait();
	  }
	  parseYield(noIn) {
	    if (this.O_function === 1) this.O_generator = true;
	    return super.parseYield(noIn);
	  }
	  parseImport(node) {
	    this.next();
	    node.specifiers = this.parseImportSpecifiers();
	    if (this.type === types._with) {
	      this.next();
	      node.injections = this.parseImportSpecifiers();
	    }
	    this.expectContextual("from");
	    node.source = this.type === types.string ? this.parseExprAtom() : this.unexpected();
	    return this.finishNode(node, "ImportDeclaration");
	  }
	  parseImportSpecifiers() {
	    const nodes = [];
	    const identifiers = new Set;
	    let first = true;
	    this.expect(types.braceL);
	    while (!this.eat(types.braceR)) {
	      if (first) {
	        first = false;
	      } else {
	        this.expect(types.comma);
	        if (this.afterTrailingComma(types.braceR)) break;
	      }
	      const node = this.startNode();
	      node.view = this.eatContextual("viewof");
	      node.mutable = node.view ? false : this.eatContextual("mutable");
	      node.imported = this.parseIdent();
	      this.checkUnreserved(node.imported);
	      this.checkLocal(node.imported);
	      if (this.eatContextual("as")) {
	        node.local = this.parseIdent();
	        this.checkUnreserved(node.local);
	        this.checkLocal(node.local);
	      } else {
	        node.local = node.imported;
	      }
	      this.checkLVal(node.local, "let");
	      if (identifiers.has(node.local.name)) {
	        this.raise(node.local.start, `Identifier '${node.local.name}' has already been declared`);
	      }
	      identifiers.add(node.local.name);
	      nodes.push(this.finishNode(node, "ImportSpecifier"));
	    }
	    return nodes;
	  }
	  parseExprAtom(refDestructuringErrors) {
	    return (
	      this.parseMaybeKeywordExpression("viewof", "ViewExpression") ||
	      this.parseMaybeKeywordExpression("mutable", "MutableExpression") ||
	      super.parseExprAtom(refDestructuringErrors)
	    );
	  }
	  parseCell(node, eof) {
	    const lookahead = new CellParser({}, this.input, this.start);
	    let token = lookahead.getToken();
	    let body = null;
	    let id = null;

	    this.O_function = 0;
	    this.O_async = false;
	    this.O_generator = false;
	    this.strict = true;
	    this.enterScope(SCOPE_FUNCTION$1 | SCOPE_ASYNC$1 | SCOPE_GENERATOR$1);

	    // An import?
	    if (token.type === types._import && lookahead.getToken().type !== types.parenL) {
	      body = this.parseImport(this.startNode());
	    }

	    // A non-empty cell?
	    else if (token.type !== types.eof && token.type !== types.semi) {
	      // A named cell?
	      if (token.type === types.name) {
	        if (token.value === "viewof" || token.value === "mutable") {
	          token = lookahead.getToken();
	          if (token.type !== types.name) {
	            lookahead.unexpected();
	          }
	        }
	        token = lookahead.getToken();
	        if (token.type === types.eq) {
	          id =
	            this.parseMaybeKeywordExpression("viewof", "ViewExpression") ||
	            this.parseMaybeKeywordExpression("mutable", "MutableExpression") ||
	            this.parseIdent();
	          token = lookahead.getToken();
	          this.expect(types.eq);
	        }
	      }

	      // A block?
	      if (token.type === types.braceL) {
	        body = this.parseBlock();
	      }

	      // An expression?
	      // Possibly a function or class declaration?
	      else {
	        body = this.parseExpression();
	        if (
	          id === null &&
	          (body.type === "FunctionExpression" ||
	            body.type === "ClassExpression")
	        ) {
	          id = body.id;
	        }
	      }
	    }

	    this.semicolon();
	    if (eof) this.expect(types.eof); // TODO

	    if (id) this.checkLocal(id);
	    node.id = id;
	    node.async = this.O_async;
	    node.generator = this.O_generator;
	    node.body = body;
	    this.exitScope();
	    return this.finishNode(node, "Cell");
	  }
	  parseTopLevel(node) {
	    return this.parseCell(node, true);
	  }
	  toAssignable(node, isBinding, refDestructuringErrors) {
	    return node.type === "MutableExpression"
	      ? node
	      : super.toAssignable(node, isBinding, refDestructuringErrors);
	  }
	  checkLocal(id) {
	    const node = id.id || id;
	    if (defaultGlobals.has(node.name) || node.name === "arguments") {
	      this.raise(node.start, `Identifier '${node.name}' is reserved`);
	    }
	  }
	  checkUnreserved(node) {
	    if (node.name === "viewof" || node.name === "mutable") {
	      this.raise(node.start, `Unexpected keyword '${node.name}'`);
	    }
	    return super.checkUnreserved(node);
	  }
	  checkLVal(expr, bindingType, checkClashes) {
	    return super.checkLVal(
	      expr.type === "MutableExpression" ? expr.id : expr,
	      bindingType,
	      checkClashes
	    );
	  }
	  unexpected(pos) {
	    this.raise(
	      pos != null ? pos : this.start,
	      this.type === types.eof ? "Unexpected end of input" : "Unexpected token"
	    );
	  }
	  parseMaybeKeywordExpression(keyword, type) {
	    if (this.isContextual(keyword)) {
	      const node = this.startNode();
	      this.next();
	      node.id = this.parseIdent();
	      return this.finishNode(node, type);
	    }
	  }
	}

	function parseModule(input, {globals} = {}) {
	  const program = ModuleParser.parse(input);
	  for (const cell of program.cells) {
	    parseReferences(cell, input, globals);
	    parseFeatures(cell, input);
	  }
	  return program;
	}

	class ModuleParser extends CellParser {
	  parseTopLevel(node) {
	    if (!node.cells) node.cells = [];
	    while (this.type !== types.eof) {
	      const cell = this.parseCell(this.startNode());
	      cell.input = this.input;
	      node.cells.push(cell);
	    }
	    this.next();
	    return this.finishNode(node, "Program");
	  }
	}

	// Find references.
	// Check for illegal references to arguments.
	// Check for illegal assignments to global references.
	function parseReferences(cell, input, globals = defaultGlobals) {
	  if (cell.body && cell.body.type !== "ImportDeclaration") {
	    try {
	      cell.references = findReferences(cell, globals);
	    } catch (error) {
	      if (error.node) {
	        const loc = getLineInfo(input, error.node.start);
	        error.message += ` (${loc.line}:${loc.column})`;
	        error.pos = error.node.start;
	        error.loc = loc;
	        delete error.node;
	      }
	      throw error;
	    }
	  }
	  return cell;
	}

	// Find features: file attachments, secrets, database clients.
	// Check for illegal references to arguments.
	// Check for illegal assignments to global references.
	function parseFeatures(cell, input) {
	  if (cell.body && cell.body.type !== "ImportDeclaration") {
	    try {
	      cell.fileAttachments = findFeatures(cell, "FileAttachment");
	      cell.databaseClients = findFeatures(cell, "DatabaseClient");
	      cell.secrets = findFeatures(cell, "Secret");
	    } catch (error) {
	      if (error.node) {
	        const loc = getLineInfo(input, error.node.start);
	        error.message += ` (${loc.line}:${loc.column})`;
	        error.pos = error.node.start;
	        error.loc = loc;
	        delete error.node;
	      }
	      throw error;
	    }
	  } else {
	    cell.fileAttachments = new Map();
	    cell.databaseClients = new Map();
	    cell.secrets = new Map();
	  }
	  return cell;
	}var index=/*#__PURE__*/Object.freeze({__proto__:null,parseCell: parseCell,peekId: peekId,CellParser: CellParser,parseModule: parseModule,ModuleParser: ModuleParser,walk: walk});/**
	 *  FINISH REPLACING THE SIMPLE WALKER WITH A FULL WALKER THAT DOES SUBSTITUTION ALL AT ONCE.
	 * 
	 */

	const extractPath = path => {
	  let source = path;
	  let m;

	  // "https://api.observablehq.com/@jashkenas/inputs.js?v=3" => strip off ".js"
	  if ((m = /\.js(\?|$)/i.exec(source))) source = source.slice(0, m.index);

	  // "74f872c4fde62e35" => "d/..."
	  if ((m = /^[0-9a-f]{16}$/i.test(source))) source = `d/${source}`;

	  // link of notebook
	  if ((m = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source)))
	    source = source.slice(m[0].length);
	  return source;
	};

	function setupImportCell(cell) {
	  const specifiers = [];

	  if (cell.body.specifiers)
	    for (const specifier of cell.body.specifiers) {
	      if (specifier.view) {
	        specifiers.push({
	          name: "viewof " + specifier.imported.name,
	          alias: "viewof " + specifier.local.name
	        });
	      } else if (specifier.mutable) {
	        specifiers.push({
	          name: "mutable " + specifier.imported.name,
	          alias: "mutable " + specifier.local.name
	        });
	      }
	      specifiers.push({
	        name: specifier.imported.name,
	        alias: specifier.local.name
	      });
	    }
	  // If injections is undefined, do not derive!
	  const hasInjections = cell.body.injections !== undefined;
	  const injections = [];
	  if (hasInjections)
	    for (const injection of cell.body.injections) {
	      // This currently behaves like notebooks on observablehq.com
	      // Commenting out the if & else if blocks result in behavior like Example 3 here: https://observablehq.com/d/7ccad009e4d89969
	      if (injection.view) {
	        injections.push({
	          name: "viewof " + injection.imported.name,
	          alias: "viewof " + injection.local.name
	        });
	      } else if (injection.mutable) {
	        injections.push({
	          name: "mutable " + injection.imported.name,
	          alias: "mutable " + injection.local.name
	        });
	      }
	      injections.push({
	        name: injection.imported.name,
	        alias: injection.local.name
	      });
	    }
	  const importString = `import {${specifiers
	    .map(specifier => `${specifier.name} as ${specifier.alias}`)
	    .join(", ")}} ${
	    hasInjections
	      ? `with {${injections
	          .map(injection => `${injection.name} as ${injection.alias}`)
	          .join(", ")}} `
	      : ``
	  }from "${cell.body.source.value}"`;

	  return { specifiers, hasInjections, injections, importString };
	}

	function setupRegularCell(cell) {
	  let name = null;
	  if (cell.id && cell.id.name) name = cell.id.name;
	  else if (cell.id && cell.id.id && cell.id.id.name) name = cell.id.id.name;
	  let bodyText = cell.input.substring(cell.body.start, cell.body.end);
	  let expressionMap = {};
	  let references = [];
	  const cellReferences = Array.from(new Set((cell.references || []).map(ref => {
	    if (ref.type === "ViewExpression") {
	      if (expressionMap[ref.id.name] === undefined) {
	        expressionMap[ref.id.name] = ref.id.name;
	        references.push(ref.id.name);
	      }
	      return "viewof " + ref.id.name;
	    } else if (ref.type === "MutableExpression") {
	      if (expressionMap[ref.id.name] === undefined) {
	        expressionMap[ref.id.name] = ref.id.name;
	        references.push(ref.id.name);
	      }
	      return "mutable " + ref.id.name;
	    } else {
	      references.push(ref.name);
	      return ref.name;
	    }
	  })));
	  const uniq = (lst) => {
	    const result = [];
	    const s = new Set();
	    for (const v of lst) {
	      if (s.has(v)) continue;
	      s.add(v);
	      result.push(v);
	    }
	    return result;
	  };
	  const patches = [];
	  let latestPatch = { newStr: "", span: [cell.body.start, cell.body.start] };
	  full(cell.body, node => {
	    if (node.type === "ViewExpression" || node.type === "MutableExpression") {
	      // cover previous ground?
	      if (node.start !== latestPatch.span[1]) {
	        patches.push({ newStr: cell.input.substring(latestPatch.span[1], node.start)});
	      }
	      const suffix = node.type === "MutableExpression" ? ".value" : "";
	      const newStr = `${expressionMap[node.id.name]}${suffix}`;
	      const patch = {
	        newStr,
	        span: [node.start, node.end]
	      };
	      latestPatch = patch;
	      patches.push(patch);
	    }
	  }, walk);
	  patches.push({newStr: cell.input.substring(latestPatch.span[1], cell.body.end), span: [latestPatch.span[1], cell.body.end]});
	  bodyText = patches.map(x => x.newStr).join("");

	  return {
	    cellName: name,
	    references: uniq(references),
	    bodyText,
	    cellReferences: uniq(cellReferences)
	  };
	}function names(cell) {
	  if (cell.body && cell.body.specifiers)
	    return cell.body.specifiers.map(
	      d => `${d.view ? "viewof " : d.mutable ? "mutable " : ""}${d.local.name}`
	    );

	  if (cell.id && cell.id.type && cell.id) {
	    if (cell.id.type === "ViewExpression") return [`viewof ${cell.id.id.name}`];
	    if (cell.id.type === "MutableExpression")
	      return [`mutable ${cell.id.id.name}`];
	    if (cell.id.name) return [cell.id.name];
	  }

	  return [];
	}

	function references(cell) {
	  if (cell.references)
	    return cell.references.map(d => {
	      if (d.name) return d.name;
	      if (d.type === "ViewExpression") return `viewof ${d.id.name}`;
	      if (d.type === "MutableExpression") return `mutable ${d.id.name}`;
	      return null;
	    });

	  if (cell.body && cell.body.injections)
	    return cell.body.injections.map(
	      d =>
	        `${d.view ? "viewof " : d.mutable ? "mutable " : ""}${d.imported.name}`
	    );

	  return [];
	}

	function getCellRefs(module) {
	  const cells = [];
	  for (const cell of module.cells) {
	    const ns = names(cell);
	    const refs = references(cell);
	    if (!ns || !ns.length) continue;
	    for (const name of ns) {
	      cells.push([name, refs]);
	      if (name.startsWith("viewof "))
	        cells.push([name.substring("viewof ".length), [name]]);
	    }
	  }
	  return new Map(cells);
	}

	function treeShakeModule(module, targets) {
	  const cellRefs = getCellRefs(module);

	  const embed = new Set();
	  const todo = targets.slice();
	  while (todo.length) {
	    const d = todo.pop();
	    embed.add(d);
	    // happens when 1) d is an stdlib cell, 2) d doesnt have a defintion,
	    // or 3) d is in the window/global object. Let's be forgiving
	    // and let it happen
	    if (!cellRefs.has(d)) continue;
	    const refs = cellRefs.get(d);
	    for (const ref of refs) if (!embed.has(ref)) todo.push(ref);
	  }
	  return {
	    cells: module.cells.filter(
	      cell => names(cell).filter(name => embed.has(name)).length
	    )
	  };
	}function ESMImports(moduleObject, resolveImportPath) {
	  const importMap = new Map();
	  let importSrc = "";
	  let j = 0;

	  for (const { body } of moduleObject.cells) {
	    if (body.type !== "ImportDeclaration" || importMap.has(body.source.value))
	      continue;

	    const defineName = `define${++j}`;
	    // TODO get cell specififiers here and pass in as 2nd param to resolveImportPath
	    // need to use same logic as tree-shake name()s
	    const specifiers = body.specifiers.map(d => {
	      const prefix = d.view ? "viewof " : d.mutable ? "mutable " : "";
	      return `${prefix}${d.imported.name}`;
	    });
	    const fromPath = resolveImportPath(body.source.value, specifiers);
	    importMap.set(body.source.value, { defineName, fromPath });
	    importSrc += `import ${defineName} from "${fromPath}";\n`;
	  }

	  if (importSrc.length) importSrc += "\n";
	  return { importSrc, importMap };
	}

	// by default, file attachments get resolved like:
	//   [ ["a", "https://example.com/files/a"] ]
	// but sometimes, you'll want to write JS code when resolving
	// instead of being limiting by strings. The third param
	// enables that, allowing for resolving like:
	//   [ ["a", new URL("./files/a", import.meta.url)] ]
	function ESMAttachments(
	  moduleObject,
	  resolveFileAttachments,
	  UNSAFE_allowJavascriptFileAttachments = false
	) {
	  let mapValue;
	  if (UNSAFE_allowJavascriptFileAttachments) {
	    const attachmentMapEntries = [];
	    for (const cell of moduleObject.cells) {
	      if (cell.fileAttachments.size === 0) continue;
	      for (const file of cell.fileAttachments.keys())
	        attachmentMapEntries.push([file, resolveFileAttachments(file)]);
	    }
	    if (attachmentMapEntries.length)
	      mapValue = `[${attachmentMapEntries
	        .map(([key, value]) => `[${JSON.stringify(key)}, ${value}]`)
	        .join(",")}]`;
	  } else {
	    const attachmentMapEntries = [];
	    // loop over cells with fileAttachments
	    for (const cell of moduleObject.cells) {
	      if (cell.fileAttachments.size === 0) continue;
	      // add filenames and resolved URLs to array
	      for (const file of cell.fileAttachments.keys())
	        attachmentMapEntries.push([file, resolveFileAttachments(file)]);
	    }
	    if (attachmentMapEntries.length)
	      mapValue = JSON.stringify(attachmentMapEntries);
	  }

	  if (!mapValue) return "";
	  return `  const fileAttachments = new Map(${mapValue});
	  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));`;
	}

	function ESMVariables(moduleObject, importMap, params) {
	  const {
	    defineImportMarkdown,
	    observeViewofValues,
	    observeMutableValues
	  } = params;

	  let childJ = 0;
	  return moduleObject.cells
	    .map(cell => {
	      let src = "";

	      if (cell.body.type === "ImportDeclaration") {
	        const {
	          specifiers,
	          hasInjections,
	          injections,
	          importString
	        } = setupImportCell(cell);

	        if (defineImportMarkdown)
	          src +=
	            `  main.variable(observer()).define(
	    null,
	    ["md"],
	    md => md\`~~~javascript
	${importString}
	~~~\`
	  );` + "\n";

	        // name imported notebook define functions
	        const childName = `child${++childJ}`;
	        src += `  const ${childName} = runtime.module(${
	          importMap.get(cell.body.source.value).defineName
	        })${
	          hasInjections ? `.derive(${JSON.stringify(injections)}, main)` : ""
	        };
	${specifiers
	  .map(
	    specifier =>
	      `  main.import("${specifier.name}", "${specifier.alias}", ${childName});`
	  )
	  .join("\n")}`;
	      } else {
	        const {
	          cellName,
	          references,
	          bodyText,
	          cellReferences
	        } = setupRegularCell(cell);

	        const cellNameString = cellName ? `"${cellName}"` : "";
	        const referenceString = references.join(",");
	        let code = "";
	        if (cell.body.type !== "BlockStatement")
	          code = `{return(
	${bodyText}
	)}`;
	        else code = "\n" + bodyText + "\n";
	        const cellReferencesString = cellReferences.length
	          ? JSON.stringify(cellReferences) + ", "
	          : "";
	        let cellFunction = "";
	        if (cell.generator && cell.async)
	          cellFunction = `async function*(${referenceString})${code}`;
	        else if (cell.async)
	          cellFunction = `async function(${referenceString})${code}`;
	        else if (cell.generator)
	          cellFunction = `function*(${referenceString})${code}`;
	        else cellFunction = `function(${referenceString})${code}`;

	        if (cell.id && cell.id.type === "ViewExpression") {
	          const reference = `"viewof ${cellName}"`;
	          src += `  main.variable(observer(${reference})).define(${reference}, ${cellReferencesString}${cellFunction});
	  main.variable(${
	    observeViewofValues ? `observer("${cellName}")` : `null`
	  }).define("${cellName}", ["Generators", ${reference}], (G, _) => G.input(_));`;
	        } else if (cell.id && cell.id.type === "MutableExpression") {
	          const initialName = `"initial ${cellName}"`;
	          const mutableName = `"mutable ${cellName}"`;
	          src += `  main.define(${initialName}, ${cellReferencesString}${cellFunction});
	  main.variable(observer(${mutableName})).define(${mutableName}, ["Mutable", ${initialName}], (M, _) => new M(_));
	  main.variable(${
	    observeMutableValues ? `observer("${cellName}")` : `null`
	  }).define("${cellName}", [${mutableName}], _ => _.generator);`;
	        } else {
	          src += `  main.variable(observer(${cellNameString})).define(${
	            cellName ? cellNameString + ", " : ""
	          }${cellReferencesString}${cellFunction});`;
	        }
	      }
	      return src;
	    })
	    .join("\n");
	}
	function createESModule(moduleObject, params = {}) {
	  const {
	    resolveImportPath,
	    resolveFileAttachments,
	    defineImportMarkdown,
	    observeViewofValues,
	    observeMutableValues,
	    UNSAFE_allowJavascriptFileAttachments
	  } = params;
	  const { importSrc, importMap } = ESMImports(moduleObject, resolveImportPath);
	  return `${importSrc}export default function define(runtime, observer) {
	  const main = runtime.module();
	${ESMAttachments(
	  moduleObject,
	  resolveFileAttachments,
	  UNSAFE_allowJavascriptFileAttachments
	)}
	${ESMVariables(moduleObject, importMap, {
	  defineImportMarkdown,
	  observeViewofValues,
	  observeMutableValues
	}) || ""}
	  return main;
	}`;
	}

	function defaultResolveImportPath(path) {
	  const source = extractPath(path);
	  return `https://api.observablehq.com/${source}.js?v=3`;
	}

	function defaultResolveFileAttachments(name) {
	  return name;
	}
	class Compiler {
	  constructor(params = {}) {
	    const {
	      resolveFileAttachments = defaultResolveFileAttachments,
	      resolveImportPath = defaultResolveImportPath,
	      defineImportMarkdown = true,
	      observeViewofValues = true,
	      observeMutableValues = true,
	      UNSAFE_allowJavascriptFileAttachments = false
	    } = params;
	    this.resolveFileAttachments = resolveFileAttachments;
	    this.resolveImportPath = resolveImportPath;
	    this.defineImportMarkdown = defineImportMarkdown;
	    this.observeViewofValues = observeViewofValues;
	    this.observeMutableValues = observeMutableValues;
	    this.UNSAFE_allowJavascriptFileAttachments = UNSAFE_allowJavascriptFileAttachments;
	  }
	  module(input, params = {}) {
	    let m1 = typeof input === "string" ? parseModule(input) : input;

	    if (params.treeShake) m1 = treeShakeModule(m1, params.treeShake);

	    return createESModule(m1, {
	      resolveImportPath: this.resolveImportPath,
	      resolveFileAttachments: this.resolveFileAttachments,
	      defineImportMarkdown: this.defineImportMarkdown,
	      observeViewofValues: this.observeViewofValues,
	      observeMutableValues: this.observeMutableValues,
	      UNSAFE_allowJavascriptFileAttachments: this
	        .UNSAFE_allowJavascriptFileAttachments
	    });
	  }
	  notebook(obj) {
	    const cells = obj.nodes.map(({ value }) => {
	      const cell = parseCell(value);
	      cell.input = value;
	      return cell;
	    });
	    return createESModule(
	      { cells },
	      {
	        resolveImportPath: this.resolveImportPath,
	        resolveFileAttachments: this.resolveFileAttachments,
	        defineImportMarkdown: this.defineImportMarkdown,
	        observeViewofValues: this.observeViewofValues,
	        observeMutableValues: this.observeMutableValues
	      }
	    );
	  }
	}const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
	const GeneratorFunction = Object.getPrototypeOf(function*() {}).constructor;
	const AsyncGeneratorFunction = Object.getPrototypeOf(async function*() {})
	  .constructor;

	function createRegularCellDefinition(cell) {
	  const { cellName, references, bodyText, cellReferences } = setupRegularCell(
	    cell
	  );

	  let code;
	  if (cell.body.type !== "BlockStatement") {
	    if (cell.async)
	      code = `return (async function(){ return (${bodyText});})()`;
	    else code = `return (function(){ return (${bodyText});})()`;
	  } else code = bodyText;

	  let f;
	  if (cell.generator && cell.async)
	    f = new AsyncGeneratorFunction(...references, code);
	  else if (cell.async) f = new AsyncFunction(...references, code);
	  else if (cell.generator) f = new GeneratorFunction(...references, code);
	  else f = new Function(...references, code);
	  return {
	    cellName,
	    cellFunction: f,
	    cellReferences
	  };
	}

	function defaultResolveImportPath$1(path) {
	  const source = extractPath(path);
	  return import(`https://api.observablehq.com/${source}.js?v=3`).then(
	    m => m.default
	  );
	}

	function defaultResolveFileAttachments$1(name) {
	  return name;
	}

	class Interpreter {
	  constructor(params = {}) {
	    const {
	      module = null,
	      observer = null,
	      resolveImportPath = defaultResolveImportPath$1,
	      resolveFileAttachments = defaultResolveFileAttachments$1,
	      defineImportMarkdown = true,
	      observeViewofValues = true,
	      observeMutableValues = true
	    } = params;

	    // can't be this.module bc of async module().
	    // so make defaultObserver follow same convention.
	    this.defaultModule = module;
	    this.defaultObserver = observer;

	    this.resolveImportPath = resolveImportPath;
	    this.resolveFileAttachments = resolveFileAttachments;
	    this.defineImportMarkdown = defineImportMarkdown;
	    this.observeViewofValues = observeViewofValues;
	    this.observeMutableValues = observeMutableValues;
	  }

	  async module(input, module, observer) {
	    module = module || this.defaultModule;
	    observer = observer || this.defaultObserver;

	    if (!module) throw Error("No module provided.");
	    if (!observer) throw Error("No observer provided.");

	    const parsedModule = parseModule(input);
	    const cellPromises = [];
	    for (const cell of parsedModule.cells) {
	      cell.input = input;
	      cellPromises.push(this.cell(cell, module, observer));
	    }
	    return Promise.all(cellPromises);
	  }

	  async cell(input, module, observer) {
	    module = module || this.defaultModule;
	    observer = observer || this.defaultObserver;

	    if (!module) throw Error("No module provided.");
	    if (!observer) throw Error("No observer provided.");

	    let cell;
	    if (typeof input === "string") {
	      cell = parseCell(input);
	      cell.input = input;
	    } else {
	      cell = input;
	    }

	    if (cell.body.type === "ImportDeclaration") {
	      const path = cell.body.source.value;
	      const specs = cell.body.specifiers.map(d => {
	        const prefix = d.view ? "viewof " : d.mutable ? "mutable " : "";
	        return `${prefix}${d.imported.name}`;
	      });
	      const fromModule = await this.resolveImportPath(path, specs);
	      let mdVariable, vars;

	      const {
	        specifiers,
	        hasInjections,
	        injections,
	        importString
	      } = setupImportCell(cell);

	      const other = module._runtime.module(fromModule);

	      if (this.defineImportMarkdown)
	        mdVariable = module.variable(observer()).define(
	          null,
	          ["md"],
	          md => md`~~~javascript
	  ${importString}
	  ~~~`
	        );
	      if (hasInjections) {
	        const child = other.derive(injections, module);
	        vars = specifiers.map(({ name, alias }) =>
	          module.import(name, alias, child)
	        );
	      } else {
	        vars = specifiers.map(({ name, alias }) =>
	          module.import(name, alias, other)
	        );
	      }
	      return mdVariable ? [mdVariable, ...vars] : vars;
	    } else {
	      const {
	        cellName,
	        cellFunction,
	        cellReferences
	      } = createRegularCellDefinition(cell);
	      if (cell.id && cell.id.type === "ViewExpression") {
	        const reference = `viewof ${cellName}`;
	        return [
	          module
	            .variable(observer(reference))
	            .define(reference, cellReferences, cellFunction.bind(this)),
	          module
	            .variable(this.observeViewofValues ? observer(cellName) : null)
	            .define(cellName, ["Generators", reference], (G, _) => G.input(_))
	        ];
	      } else if (cell.id && cell.id.type === "MutableExpression") {
	        const initialName = `initial ${cellName}`;
	        const mutableName = `mutable ${cellName}`;
	        return [
	          module
	            .variable(null)
	            .define(initialName, cellReferences, cellFunction),
	          module
	            .variable(observer(mutableName))
	            .define(mutableName, ["Mutable", initialName], (M, _) => new M(_)),
	          module
	            .variable(this.observeMutableValues ? observer(cellName) : null)
	            .define(cellName, [mutableName], _ => _.generator)
	        ];
	      } else {
	        return [
	          module
	            .variable(observer(cellName))
	            .define(cellName, cellReferences, cellFunction.bind(this))
	        ];
	      }
	    }
	  }
	}exports.Compiler=Compiler;exports.Interpreter=Interpreter;exports.parser=index;exports.treeShakeModule=treeShakeModule;Object.defineProperty(exports,'__esModule',{value:true});})));
} (dist, dist.exports));

// This file was generated. Do not modify manually!
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 370, 1, 154, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 161, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 19306, 9, 87, 9, 39, 4, 60, 6, 26, 9, 1014, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4706, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 262, 6, 10, 9, 357, 0, 62, 13, 1495, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];

// This file was generated. Do not modify manually!
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 68, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 349, 41, 7, 1, 79, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 85, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 190, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1070, 4050, 582, 8634, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 689, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 43, 8, 8936, 3, 2, 6, 2, 1, 2, 290, 46, 2, 18, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 482, 44, 11, 6, 17, 0, 322, 29, 19, 43, 1269, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4152, 8, 221, 3, 5761, 15, 7472, 3104, 541, 1507, 4938];

// This file was generated. Do not modify manually!
var nonASCIIidentifierChars = "\u200c\u200d\xb7\u0300-\u036f\u0387\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u07fd\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u0898-\u089f\u08ca-\u08e1\u08e3-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u09fe\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0afa-\u0aff\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b55-\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c00-\u0c04\u0c3c\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c81-\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d00-\u0d03\u0d3b\u0d3c\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d81-\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0de6-\u0def\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1369-\u1371\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u180f-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19d0-\u19da\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1ab0-\u1abd\u1abf-\u1ace\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf4\u1cf7-\u1cf9\u1dc0-\u1dff\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69e\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua82c\ua880\ua881\ua8b4-\ua8c5\ua8d0-\ua8d9\ua8e0-\ua8f1\ua8ff-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\ua9e5\ua9f0-\ua9f9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b-\uaa7d\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe2f\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f";

// This file was generated. Do not modify manually!
var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u05d0-\u05ea\u05ef-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u0860-\u086a\u0870-\u0887\u0889-\u088e\u08a0-\u08c9\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u09fc\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0af9\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c5d\u0c60\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cdd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d04-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5\u0ea7-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u1711\u171f-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1878\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4c\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1c90-\u1cba\u1cbd-\u1cbf\u1ce9-\u1cec\u1cee-\u1cf3\u1cf5\u1cf6\u1cfa\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309b-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u31a0-\u31bf\u31f0-\u31ff\u3400-\u4dbf\u4e00-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua7ca\ua7d0\ua7d1\ua7d3\ua7d5-\ua7d9\ua7f2-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua8fe\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab69\uab70-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc";

// These are a run-length and offset encoded representation of the

// Reserved word lists for various dialects of the language

var reservedWords = {
  3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
  5: "class enum extends super const export import",
  6: "enum",
  strict: "implements interface let package private protected public static yield",
  strictBind: "eval arguments"
};

// And the keywords

var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";

var keywords$1 = {
  5: ecma5AndLessKeywords,
  "5module": ecma5AndLessKeywords + " export import",
  6: ecma5AndLessKeywords + " const class extends export import super"
};

var keywordRelationalOperator = /^in(stanceof)?$/;

// ## Character categories

var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

// This has a complexity linear to the value of the code. The
// assumption is that looking up astral identifier characters is
// rare.
function isInAstralSet(code, set) {
  var pos = 0x10000;
  for (var i = 0; i < set.length; i += 2) {
    pos += set[i];
    if (pos > code) { return false }
    pos += set[i + 1];
    if (pos >= code) { return true }
  }
}

// Test whether a given character code starts an identifier.

function isIdentifierStart(code, astral) {
  if (code < 65) { return code === 36 }
  if (code < 91) { return true }
  if (code < 97) { return code === 95 }
  if (code < 123) { return true }
  if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code)) }
  if (astral === false) { return false }
  return isInAstralSet(code, astralIdentifierStartCodes)
}

// Test whether a given character is part of an identifier.

function isIdentifierChar(code, astral) {
  if (code < 48) { return code === 36 }
  if (code < 58) { return true }
  if (code < 65) { return false }
  if (code < 91) { return true }
  if (code < 97) { return code === 95 }
  if (code < 123) { return true }
  if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code)) }
  if (astral === false) { return false }
  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes)
}

// ## Token types

// The assignment of fine-grained, information-carrying type objects
// allows the tokenizer to store the information it has about a
// token in a way that is very cheap for the parser to look up.

// All token type variables start with an underscore, to make them
// easy to recognize.

// The `beforeExpr` property is used to disambiguate between regular
// expressions and divisions. It is set on all token types that can
// be followed by an expression (thus, a slash after them would be a
// regular expression).
//
// The `startsExpr` property is used to check if the token ends a
// `yield` expression. It is set on all token types that either can
// directly start an expression (like a quotation mark) or can
// continue an expression (like the body of a string).
//
// `isLoop` marks a keyword as starting a loop, which is important
// to know when parsing a label, in order to allow or disallow
// continue jumps to that label.

var TokenType = function TokenType(label, conf) {
  if ( conf === void 0 ) conf = {};

  this.label = label;
  this.keyword = conf.keyword;
  this.beforeExpr = !!conf.beforeExpr;
  this.startsExpr = !!conf.startsExpr;
  this.isLoop = !!conf.isLoop;
  this.isAssign = !!conf.isAssign;
  this.prefix = !!conf.prefix;
  this.postfix = !!conf.postfix;
  this.binop = conf.binop || null;
  this.updateContext = null;
};

function binop(name, prec) {
  return new TokenType(name, {beforeExpr: true, binop: prec})
}
var beforeExpr = {beforeExpr: true}, startsExpr = {startsExpr: true};

// Map keyword names to token types.

var keywords = {};

// Succinct definitions of keyword token types
function kw(name, options) {
  if ( options === void 0 ) options = {};

  options.keyword = name;
  return keywords[name] = new TokenType(name, options)
}

var types$1 = {
  num: new TokenType("num", startsExpr),
  regexp: new TokenType("regexp", startsExpr),
  string: new TokenType("string", startsExpr),
  name: new TokenType("name", startsExpr),
  privateId: new TokenType("privateId", startsExpr),
  eof: new TokenType("eof"),

  // Punctuation token types.
  bracketL: new TokenType("[", {beforeExpr: true, startsExpr: true}),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{", {beforeExpr: true, startsExpr: true}),
  braceR: new TokenType("}"),
  parenL: new TokenType("(", {beforeExpr: true, startsExpr: true}),
  parenR: new TokenType(")"),
  comma: new TokenType(",", beforeExpr),
  semi: new TokenType(";", beforeExpr),
  colon: new TokenType(":", beforeExpr),
  dot: new TokenType("."),
  question: new TokenType("?", beforeExpr),
  questionDot: new TokenType("?."),
  arrow: new TokenType("=>", beforeExpr),
  template: new TokenType("template"),
  invalidTemplate: new TokenType("invalidTemplate"),
  ellipsis: new TokenType("...", beforeExpr),
  backQuote: new TokenType("`", startsExpr),
  dollarBraceL: new TokenType("${", {beforeExpr: true, startsExpr: true}),

  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator.
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.

  eq: new TokenType("=", {beforeExpr: true, isAssign: true}),
  assign: new TokenType("_=", {beforeExpr: true, isAssign: true}),
  incDec: new TokenType("++/--", {prefix: true, postfix: true, startsExpr: true}),
  prefix: new TokenType("!/~", {beforeExpr: true, prefix: true, startsExpr: true}),
  logicalOR: binop("||", 1),
  logicalAND: binop("&&", 2),
  bitwiseOR: binop("|", 3),
  bitwiseXOR: binop("^", 4),
  bitwiseAND: binop("&", 5),
  equality: binop("==/!=/===/!==", 6),
  relational: binop("</>/<=/>=", 7),
  bitShift: binop("<</>>/>>>", 8),
  plusMin: new TokenType("+/-", {beforeExpr: true, binop: 9, prefix: true, startsExpr: true}),
  modulo: binop("%", 10),
  star: binop("*", 10),
  slash: binop("/", 10),
  starstar: new TokenType("**", {beforeExpr: true}),
  coalesce: binop("??", 1),

  // Keyword token types.
  _break: kw("break"),
  _case: kw("case", beforeExpr),
  _catch: kw("catch"),
  _continue: kw("continue"),
  _debugger: kw("debugger"),
  _default: kw("default", beforeExpr),
  _do: kw("do", {isLoop: true, beforeExpr: true}),
  _else: kw("else", beforeExpr),
  _finally: kw("finally"),
  _for: kw("for", {isLoop: true}),
  _function: kw("function", startsExpr),
  _if: kw("if"),
  _return: kw("return", beforeExpr),
  _switch: kw("switch"),
  _throw: kw("throw", beforeExpr),
  _try: kw("try"),
  _var: kw("var"),
  _const: kw("const"),
  _while: kw("while", {isLoop: true}),
  _with: kw("with"),
  _new: kw("new", {beforeExpr: true, startsExpr: true}),
  _this: kw("this", startsExpr),
  _super: kw("super", startsExpr),
  _class: kw("class", startsExpr),
  _extends: kw("extends", beforeExpr),
  _export: kw("export"),
  _import: kw("import", startsExpr),
  _null: kw("null", startsExpr),
  _true: kw("true", startsExpr),
  _false: kw("false", startsExpr),
  _in: kw("in", {beforeExpr: true, binop: 7}),
  _instanceof: kw("instanceof", {beforeExpr: true, binop: 7}),
  _typeof: kw("typeof", {beforeExpr: true, prefix: true, startsExpr: true}),
  _void: kw("void", {beforeExpr: true, prefix: true, startsExpr: true}),
  _delete: kw("delete", {beforeExpr: true, prefix: true, startsExpr: true})
};

// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.

var lineBreak = /\r\n?|\n|\u2028|\u2029/;
var lineBreakG = new RegExp(lineBreak.source, "g");

function isNewLine(code) {
  return code === 10 || code === 13 || code === 0x2028 || code === 0x2029
}

function nextLineBreak(code, from, end) {
  if ( end === void 0 ) end = code.length;

  for (var i = from; i < end; i++) {
    var next = code.charCodeAt(i);
    if (isNewLine(next))
      { return i < end - 1 && next === 13 && code.charCodeAt(i + 1) === 10 ? i + 2 : i + 1 }
  }
  return -1
}

var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;

var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;

var ref = Object.prototype;
var hasOwnProperty = ref.hasOwnProperty;
var toString = ref.toString;

var hasOwn = Object.hasOwn || (function (obj, propName) { return (
  hasOwnProperty.call(obj, propName)
); });

var isArray = Array.isArray || (function (obj) { return (
  toString.call(obj) === "[object Array]"
); });

function wordsRegexp(words) {
  return new RegExp("^(?:" + words.replace(/ /g, "|") + ")$")
}

function codePointToString(code) {
  // UTF-16 Decoding
  if (code <= 0xFFFF) { return String.fromCharCode(code) }
  code -= 0x10000;
  return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00)
}

var loneSurrogate = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/;

// These are used when `options.locations` is on, for the
// `startLoc` and `endLoc` properties.

var Position = function Position(line, col) {
  this.line = line;
  this.column = col;
};

Position.prototype.offset = function offset (n) {
  return new Position(this.line, this.column + n)
};

var SourceLocation = function SourceLocation(p, start, end) {
  this.start = start;
  this.end = end;
  if (p.sourceFile !== null) { this.source = p.sourceFile; }
};

// The `getLineInfo` function is mostly useful when the
// `locations` option is off (for performance reasons) and you
// want to find the line/column position for a given character
// offset. `input` should be the code string that the offset refers
// into.

function getLineInfo(input, offset) {
  for (var line = 1, cur = 0;;) {
    var nextBreak = nextLineBreak(input, cur, offset);
    if (nextBreak < 0) { return new Position(line, offset - cur) }
    ++line;
    cur = nextBreak;
  }
}

// A second argument must be given to configure the parser process.
// These options are recognized (only `ecmaVersion` is required):

var defaultOptions = {
  // `ecmaVersion` indicates the ECMAScript version to parse. Must be
  // either 3, 5, 6 (or 2015), 7 (2016), 8 (2017), 9 (2018), 10
  // (2019), 11 (2020), 12 (2021), 13 (2022), 14 (2023), or `"latest"`
  // (the latest version the library supports). This influences
  // support for strict mode, the set of reserved words, and support
  // for new syntax features.
  ecmaVersion: null,
  // `sourceType` indicates the mode the code should be parsed in.
  // Can be either `"script"` or `"module"`. This influences global
  // strict mode and parsing of `import` and `export` declarations.
  sourceType: "script",
  // `onInsertedSemicolon` can be a callback that will be called
  // when a semicolon is automatically inserted. It will be passed
  // the position of the comma as an offset, and if `locations` is
  // enabled, it is given the location as a `{line, column}` object
  // as second argument.
  onInsertedSemicolon: null,
  // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
  // trailing commas.
  onTrailingComma: null,
  // By default, reserved words are only enforced if ecmaVersion >= 5.
  // Set `allowReserved` to a boolean value to explicitly turn this on
  // an off. When this option has the value "never", reserved words
  // and keywords can also not be used as property names.
  allowReserved: null,
  // When enabled, a return at the top level is not considered an
  // error.
  allowReturnOutsideFunction: false,
  // When enabled, import/export statements are not constrained to
  // appearing at the top of the program, and an import.meta expression
  // in a script isn't considered an error.
  allowImportExportEverywhere: false,
  // By default, await identifiers are allowed to appear at the top-level scope only if ecmaVersion >= 2022.
  // When enabled, await identifiers are allowed to appear at the top-level scope,
  // but they are still not allowed in non-async functions.
  allowAwaitOutsideFunction: null,
  // When enabled, super identifiers are not constrained to
  // appearing in methods and do not raise an error when they appear elsewhere.
  allowSuperOutsideMethod: null,
  // When enabled, hashbang directive in the beginning of file is
  // allowed and treated as a line comment. Enabled by default when
  // `ecmaVersion` >= 2023.
  allowHashBang: false,
  // When `locations` is on, `loc` properties holding objects with
  // `start` and `end` properties in `{line, column}` form (with
  // line being 1-based and column 0-based) will be attached to the
  // nodes.
  locations: false,
  // A function can be passed as `onToken` option, which will
  // cause Acorn to call that function with object in the same
  // format as tokens returned from `tokenizer().getToken()`. Note
  // that you are not allowed to call the parser from the
  // callback—that will corrupt its internal state.
  onToken: null,
  // A function can be passed as `onComment` option, which will
  // cause Acorn to call that function with `(block, text, start,
  // end)` parameters whenever a comment is skipped. `block` is a
  // boolean indicating whether this is a block (`/* */`) comment,
  // `text` is the content of the comment, and `start` and `end` are
  // character offsets that denote the start and end of the comment.
  // When the `locations` option is on, two more parameters are
  // passed, the full `{line, column}` locations of the start and
  // end of the comments. Note that you are not allowed to call the
  // parser from the callback—that will corrupt its internal state.
  onComment: null,
  // Nodes have their start and end characters offsets recorded in
  // `start` and `end` properties (directly on the node, rather than
  // the `loc` object, which holds line/column data. To also add a
  // [semi-standardized][range] `range` property holding a `[start,
  // end]` array with the same numbers, set the `ranges` option to
  // `true`.
  //
  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
  ranges: false,
  // It is possible to parse multiple files into a single AST by
  // passing the tree produced by parsing the first file as
  // `program` option in subsequent parses. This will add the
  // toplevel forms of the parsed file to the `Program` (top) node
  // of an existing parse tree.
  program: null,
  // When `locations` is on, you can pass this to record the source
  // file in every node's `loc` object.
  sourceFile: null,
  // This value, if given, is stored in every node, whether
  // `locations` is on or off.
  directSourceFile: null,
  // When enabled, parenthesized expressions are represented by
  // (non-standard) ParenthesizedExpression nodes
  preserveParens: false
};

// Interpret and default an options object

var warnedAboutEcmaVersion = false;

function getOptions(opts) {
  var options = {};

  for (var opt in defaultOptions)
    { options[opt] = opts && hasOwn(opts, opt) ? opts[opt] : defaultOptions[opt]; }

  if (options.ecmaVersion === "latest") {
    options.ecmaVersion = 1e8;
  } else if (options.ecmaVersion == null) {
    if (!warnedAboutEcmaVersion && typeof console === "object" && console.warn) {
      warnedAboutEcmaVersion = true;
      console.warn("Since Acorn 8.0.0, options.ecmaVersion is required.\nDefaulting to 2020, but this will stop working in the future.");
    }
    options.ecmaVersion = 11;
  } else if (options.ecmaVersion >= 2015) {
    options.ecmaVersion -= 2009;
  }

  if (options.allowReserved == null)
    { options.allowReserved = options.ecmaVersion < 5; }

  if (opts.allowHashBang == null)
    { options.allowHashBang = options.ecmaVersion >= 14; }

  if (isArray(options.onToken)) {
    var tokens = options.onToken;
    options.onToken = function (token) { return tokens.push(token); };
  }
  if (isArray(options.onComment))
    { options.onComment = pushComment(options, options.onComment); }

  return options
}

function pushComment(options, array) {
  return function(block, text, start, end, startLoc, endLoc) {
    var comment = {
      type: block ? "Block" : "Line",
      value: text,
      start: start,
      end: end
    };
    if (options.locations)
      { comment.loc = new SourceLocation(this, startLoc, endLoc); }
    if (options.ranges)
      { comment.range = [start, end]; }
    array.push(comment);
  }
}

// Each scope gets a bitset that may contain these flags
var
    SCOPE_TOP = 1,
    SCOPE_FUNCTION$1 = 2,
    SCOPE_ASYNC$1 = 4,
    SCOPE_GENERATOR$1 = 8,
    SCOPE_ARROW = 16,
    SCOPE_SIMPLE_CATCH = 32,
    SCOPE_SUPER = 64,
    SCOPE_DIRECT_SUPER = 128,
    SCOPE_CLASS_STATIC_BLOCK = 256,
    SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION$1 | SCOPE_CLASS_STATIC_BLOCK;

function functionFlags(async, generator) {
  return SCOPE_FUNCTION$1 | (async ? SCOPE_ASYNC$1 : 0) | (generator ? SCOPE_GENERATOR$1 : 0)
}

// Used in checkLVal* and declareName to determine the type of a binding
var
    BIND_NONE = 0, // Not a binding
    BIND_VAR = 1, // Var-style binding
    BIND_LEXICAL = 2, // Let- or const-style binding
    BIND_FUNCTION = 3, // Function declaration
    BIND_SIMPLE_CATCH = 4, // Simple (identifier pattern) catch binding
    BIND_OUTSIDE = 5; // Special case for function names as bound inside the function

var Parser = function Parser(options, input, startPos) {
  this.options = options = getOptions(options);
  this.sourceFile = options.sourceFile;
  this.keywords = wordsRegexp(keywords$1[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
  var reserved = "";
  if (options.allowReserved !== true) {
    reserved = reservedWords[options.ecmaVersion >= 6 ? 6 : options.ecmaVersion === 5 ? 5 : 3];
    if (options.sourceType === "module") { reserved += " await"; }
  }
  this.reservedWords = wordsRegexp(reserved);
  var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
  this.reservedWordsStrict = wordsRegexp(reservedStrict);
  this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
  this.input = String(input);

  // Used to signal to callers of `readWord1` whether the word
  // contained any escape sequences. This is needed because words with
  // escape sequences must not be interpreted as keywords.
  this.containsEsc = false;

  // Set up token state

  // The current position of the tokenizer in the input.
  if (startPos) {
    this.pos = startPos;
    this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
  } else {
    this.pos = this.lineStart = 0;
    this.curLine = 1;
  }

  // Properties of the current token:
  // Its type
  this.type = types$1.eof;
  // For tokens that include more information than their type, the value
  this.value = null;
  // Its start and end offset
  this.start = this.end = this.pos;
  // And, if locations are used, the {line, column} object
  // corresponding to those offsets
  this.startLoc = this.endLoc = this.curPosition();

  // Position information for the previous token
  this.lastTokEndLoc = this.lastTokStartLoc = null;
  this.lastTokStart = this.lastTokEnd = this.pos;

  // The context stack is used to superficially track syntactic
  // context to predict whether a regular expression is allowed in a
  // given position.
  this.context = this.initialContext();
  this.exprAllowed = true;

  // Figure out if it's a module code.
  this.inModule = options.sourceType === "module";
  this.strict = this.inModule || this.strictDirective(this.pos);

  // Used to signify the start of a potential arrow function
  this.potentialArrowAt = -1;
  this.potentialArrowInForAwait = false;

  // Positions to delayed-check that yield/await does not exist in default parameters.
  this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
  // Labels in scope.
  this.labels = [];
  // Thus-far undefined exports.
  this.undefinedExports = Object.create(null);

  // If enabled, skip leading hashbang line.
  if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!")
    { this.skipLineComment(2); }

  // Scope tracking for duplicate variable names (see scope.js)
  this.scopeStack = [];
  this.enterScope(SCOPE_TOP);

  // For RegExp validation
  this.regexpState = null;

  // The stack of private names.
  // Each element has two properties: 'declared' and 'used'.
  // When it exited from the outermost class definition, all used private names must be declared.
  this.privateNameStack = [];
};

var prototypeAccessors = { inFunction: { configurable: true },inGenerator: { configurable: true },inAsync: { configurable: true },canAwait: { configurable: true },allowSuper: { configurable: true },allowDirectSuper: { configurable: true },treatFunctionsAsVar: { configurable: true },allowNewDotTarget: { configurable: true },inClassStaticBlock: { configurable: true } };

Parser.prototype.parse = function parse () {
  var node = this.options.program || this.startNode();
  this.nextToken();
  return this.parseTopLevel(node)
};

prototypeAccessors.inFunction.get = function () { return (this.currentVarScope().flags & SCOPE_FUNCTION$1) > 0 };

prototypeAccessors.inGenerator.get = function () { return (this.currentVarScope().flags & SCOPE_GENERATOR$1) > 0 && !this.currentVarScope().inClassFieldInit };

prototypeAccessors.inAsync.get = function () { return (this.currentVarScope().flags & SCOPE_ASYNC$1) > 0 && !this.currentVarScope().inClassFieldInit };

prototypeAccessors.canAwait.get = function () {
  for (var i = this.scopeStack.length - 1; i >= 0; i--) {
    var scope = this.scopeStack[i];
    if (scope.inClassFieldInit || scope.flags & SCOPE_CLASS_STATIC_BLOCK) { return false }
    if (scope.flags & SCOPE_FUNCTION$1) { return (scope.flags & SCOPE_ASYNC$1) > 0 }
  }
  return (this.inModule && this.options.ecmaVersion >= 13) || this.options.allowAwaitOutsideFunction
};

prototypeAccessors.allowSuper.get = function () {
  var ref = this.currentThisScope();
    var flags = ref.flags;
    var inClassFieldInit = ref.inClassFieldInit;
  return (flags & SCOPE_SUPER) > 0 || inClassFieldInit || this.options.allowSuperOutsideMethod
};

prototypeAccessors.allowDirectSuper.get = function () { return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0 };

prototypeAccessors.treatFunctionsAsVar.get = function () { return this.treatFunctionsAsVarInScope(this.currentScope()) };

prototypeAccessors.allowNewDotTarget.get = function () {
  var ref = this.currentThisScope();
    var flags = ref.flags;
    var inClassFieldInit = ref.inClassFieldInit;
  return (flags & (SCOPE_FUNCTION$1 | SCOPE_CLASS_STATIC_BLOCK)) > 0 || inClassFieldInit
};

prototypeAccessors.inClassStaticBlock.get = function () {
  return (this.currentVarScope().flags & SCOPE_CLASS_STATIC_BLOCK) > 0
};

Parser.extend = function extend () {
    var plugins = [], len = arguments.length;
    while ( len-- ) plugins[ len ] = arguments[ len ];

  var cls = this;
  for (var i = 0; i < plugins.length; i++) { cls = plugins[i](cls); }
  return cls
};

Parser.parse = function parse (input, options) {
  return new this(options, input).parse()
};

Parser.parseExpressionAt = function parseExpressionAt (input, pos, options) {
  var parser = new this(options, input, pos);
  parser.nextToken();
  return parser.parseExpression()
};

Parser.tokenizer = function tokenizer (input, options) {
  return new this(options, input)
};

Object.defineProperties( Parser.prototype, prototypeAccessors );

var pp$9 = Parser.prototype;

// ## Parser utilities

var literal = /^(?:'((?:\\.|[^'\\])*?)'|"((?:\\.|[^"\\])*?)")/;
pp$9.strictDirective = function(start) {
  if (this.options.ecmaVersion < 5) { return false }
  for (;;) {
    // Try to find string literal.
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    var match = literal.exec(this.input.slice(start));
    if (!match) { return false }
    if ((match[1] || match[2]) === "use strict") {
      skipWhiteSpace.lastIndex = start + match[0].length;
      var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
      var next = this.input.charAt(end);
      return next === ";" || next === "}" ||
        (lineBreak.test(spaceAfter[0]) &&
         !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "="))
    }
    start += match[0].length;

    // Skip semicolon, if any.
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    if (this.input[start] === ";")
      { start++; }
  }
};

// Predicate that tests whether the next token is of the given
// type, and if yes, consumes it as a side effect.

pp$9.eat = function(type) {
  if (this.type === type) {
    this.next();
    return true
  } else {
    return false
  }
};

// Tests whether parsed token is a contextual keyword.

pp$9.isContextual = function(name) {
  return this.type === types$1.name && this.value === name && !this.containsEsc
};

// Consumes contextual keyword if possible.

pp$9.eatContextual = function(name) {
  if (!this.isContextual(name)) { return false }
  this.next();
  return true
};

// Asserts that following token is given contextual keyword.

pp$9.expectContextual = function(name) {
  if (!this.eatContextual(name)) { this.unexpected(); }
};

// Test whether a semicolon can be inserted at the current position.

pp$9.canInsertSemicolon = function() {
  return this.type === types$1.eof ||
    this.type === types$1.braceR ||
    lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
};

pp$9.insertSemicolon = function() {
  if (this.canInsertSemicolon()) {
    if (this.options.onInsertedSemicolon)
      { this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc); }
    return true
  }
};

// Consume a semicolon, or, failing that, see if we are allowed to
// pretend that there is a semicolon at this position.

pp$9.semicolon = function() {
  if (!this.eat(types$1.semi) && !this.insertSemicolon()) { this.unexpected(); }
};

pp$9.afterTrailingComma = function(tokType, notNext) {
  if (this.type === tokType) {
    if (this.options.onTrailingComma)
      { this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc); }
    if (!notNext)
      { this.next(); }
    return true
  }
};

// Expect a token of a given type. If found, consume it, otherwise,
// raise an unexpected token error.

pp$9.expect = function(type) {
  this.eat(type) || this.unexpected();
};

// Raise an unexpected token error.

pp$9.unexpected = function(pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token");
};

var DestructuringErrors = function DestructuringErrors() {
  this.shorthandAssign =
  this.trailingComma =
  this.parenthesizedAssign =
  this.parenthesizedBind =
  this.doubleProto =
    -1;
};

pp$9.checkPatternErrors = function(refDestructuringErrors, isAssign) {
  if (!refDestructuringErrors) { return }
  if (refDestructuringErrors.trailingComma > -1)
    { this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element"); }
  var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
  if (parens > -1) { this.raiseRecoverable(parens, isAssign ? "Assigning to rvalue" : "Parenthesized pattern"); }
};

pp$9.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
  if (!refDestructuringErrors) { return false }
  var shorthandAssign = refDestructuringErrors.shorthandAssign;
  var doubleProto = refDestructuringErrors.doubleProto;
  if (!andThrow) { return shorthandAssign >= 0 || doubleProto >= 0 }
  if (shorthandAssign >= 0)
    { this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns"); }
  if (doubleProto >= 0)
    { this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property"); }
};

pp$9.checkYieldAwaitInDefaultParams = function() {
  if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos))
    { this.raise(this.yieldPos, "Yield expression cannot be a default value"); }
  if (this.awaitPos)
    { this.raise(this.awaitPos, "Await expression cannot be a default value"); }
};

pp$9.isSimpleAssignTarget = function(expr) {
  if (expr.type === "ParenthesizedExpression")
    { return this.isSimpleAssignTarget(expr.expression) }
  return expr.type === "Identifier" || expr.type === "MemberExpression"
};

var pp$8 = Parser.prototype;

// ### Statement parsing

// Parse a program. Initializes the parser, reads any number of
// statements, and wraps them in a Program node.  Optionally takes a
// `program` argument.  If present, the statements will be appended
// to its body instead of creating a new node.

pp$8.parseTopLevel = function(node) {
  var exports = Object.create(null);
  if (!node.body) { node.body = []; }
  while (this.type !== types$1.eof) {
    var stmt = this.parseStatement(null, true, exports);
    node.body.push(stmt);
  }
  if (this.inModule)
    { for (var i = 0, list = Object.keys(this.undefinedExports); i < list.length; i += 1)
      {
        var name = list[i];

        this.raiseRecoverable(this.undefinedExports[name].start, ("Export '" + name + "' is not defined"));
      } }
  this.adaptDirectivePrologue(node.body);
  this.next();
  node.sourceType = this.options.sourceType;
  return this.finishNode(node, "Program")
};

var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

pp$8.isLet = function(context) {
  if (this.options.ecmaVersion < 6 || !this.isContextual("let")) { return false }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
  // For ambiguous cases, determine if a LexicalDeclaration (or only a
  // Statement) is allowed here. If context is not empty then only a Statement
  // is allowed. However, `let [` is an explicit negative lookahead for
  // ExpressionStatement, so special-case it first.
  if (nextCh === 91 || nextCh === 92 || nextCh > 0xd7ff && nextCh < 0xdc00) { return true } // '[', '/', astral
  if (context) { return false }

  if (nextCh === 123) { return true } // '{'
  if (isIdentifierStart(nextCh, true)) {
    var pos = next + 1;
    while (isIdentifierChar(nextCh = this.input.charCodeAt(pos), true)) { ++pos; }
    if (nextCh === 92 || nextCh > 0xd7ff && nextCh < 0xdc00) { return true }
    var ident = this.input.slice(next, pos);
    if (!keywordRelationalOperator.test(ident)) { return true }
  }
  return false
};

// check 'async [no LineTerminator here] function'
// - 'async /*foo*/ function' is OK.
// - 'async /*\n*/ function' is invalid.
pp$8.isAsyncFunction = function() {
  if (this.options.ecmaVersion < 8 || !this.isContextual("async"))
    { return false }

  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, after;
  return !lineBreak.test(this.input.slice(this.pos, next)) &&
    this.input.slice(next, next + 8) === "function" &&
    (next + 8 === this.input.length ||
     !(isIdentifierChar(after = this.input.charCodeAt(next + 8)) || after > 0xd7ff && after < 0xdc00))
};

// Parse a single statement.
//
// If expecting a statement and finding a slash operator, parse a
// regular expression literal. This is to handle cases like
// `if (foo) /blah/.exec(foo)`, where looking at the previous token
// does not help.

pp$8.parseStatement = function(context, topLevel, exports) {
  var starttype = this.type, node = this.startNode(), kind;

  if (this.isLet(context)) {
    starttype = types$1._var;
    kind = "let";
  }

  // Most types of statements are recognized by the keyword they
  // start with. Many are trivial to parse, some require a bit of
  // complexity.

  switch (starttype) {
  case types$1._break: case types$1._continue: return this.parseBreakContinueStatement(node, starttype.keyword)
  case types$1._debugger: return this.parseDebuggerStatement(node)
  case types$1._do: return this.parseDoStatement(node)
  case types$1._for: return this.parseForStatement(node)
  case types$1._function:
    // Function as sole body of either an if statement or a labeled statement
    // works, but not when it is part of a labeled statement that is the sole
    // body of an if statement.
    if ((context && (this.strict || context !== "if" && context !== "label")) && this.options.ecmaVersion >= 6) { this.unexpected(); }
    return this.parseFunctionStatement(node, false, !context)
  case types$1._class:
    if (context) { this.unexpected(); }
    return this.parseClass(node, true)
  case types$1._if: return this.parseIfStatement(node)
  case types$1._return: return this.parseReturnStatement(node)
  case types$1._switch: return this.parseSwitchStatement(node)
  case types$1._throw: return this.parseThrowStatement(node)
  case types$1._try: return this.parseTryStatement(node)
  case types$1._const: case types$1._var:
    kind = kind || this.value;
    if (context && kind !== "var") { this.unexpected(); }
    return this.parseVarStatement(node, kind)
  case types$1._while: return this.parseWhileStatement(node)
  case types$1._with: return this.parseWithStatement(node)
  case types$1.braceL: return this.parseBlock(true, node)
  case types$1.semi: return this.parseEmptyStatement(node)
  case types$1._export:
  case types$1._import:
    if (this.options.ecmaVersion > 10 && starttype === types$1._import) {
      skipWhiteSpace.lastIndex = this.pos;
      var skip = skipWhiteSpace.exec(this.input);
      var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
      if (nextCh === 40 || nextCh === 46) // '(' or '.'
        { return this.parseExpressionStatement(node, this.parseExpression()) }
    }

    if (!this.options.allowImportExportEverywhere) {
      if (!topLevel)
        { this.raise(this.start, "'import' and 'export' may only appear at the top level"); }
      if (!this.inModule)
        { this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'"); }
    }
    return starttype === types$1._import ? this.parseImport(node) : this.parseExport(node, exports)

    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
  default:
    if (this.isAsyncFunction()) {
      if (context) { this.unexpected(); }
      this.next();
      return this.parseFunctionStatement(node, true, !context)
    }

    var maybeName = this.value, expr = this.parseExpression();
    if (starttype === types$1.name && expr.type === "Identifier" && this.eat(types$1.colon))
      { return this.parseLabeledStatement(node, maybeName, expr, context) }
    else { return this.parseExpressionStatement(node, expr) }
  }
};

pp$8.parseBreakContinueStatement = function(node, keyword) {
  var isBreak = keyword === "break";
  this.next();
  if (this.eat(types$1.semi) || this.insertSemicolon()) { node.label = null; }
  else if (this.type !== types$1.name) { this.unexpected(); }
  else {
    node.label = this.parseIdent();
    this.semicolon();
  }

  // Verify that there is an actual destination to break or
  // continue to.
  var i = 0;
  for (; i < this.labels.length; ++i) {
    var lab = this.labels[i];
    if (node.label == null || lab.name === node.label.name) {
      if (lab.kind != null && (isBreak || lab.kind === "loop")) { break }
      if (node.label && isBreak) { break }
    }
  }
  if (i === this.labels.length) { this.raise(node.start, "Unsyntactic " + keyword); }
  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement")
};

pp$8.parseDebuggerStatement = function(node) {
  this.next();
  this.semicolon();
  return this.finishNode(node, "DebuggerStatement")
};

pp$8.parseDoStatement = function(node) {
  this.next();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("do");
  this.labels.pop();
  this.expect(types$1._while);
  node.test = this.parseParenExpression();
  if (this.options.ecmaVersion >= 6)
    { this.eat(types$1.semi); }
  else
    { this.semicolon(); }
  return this.finishNode(node, "DoWhileStatement")
};

// Disambiguating between a `for` and a `for`/`in` or `for`/`of`
// loop is non-trivial. Basically, we have to parse the init `var`
// statement or expression, disallowing the `in` operator (see
// the second parameter to `parseExpression`), and then check
// whether the next token is `in` or `of`. When there is no init
// part (semicolon immediately after the opening parenthesis), it
// is a regular `for` loop.

pp$8.parseForStatement = function(node) {
  this.next();
  var awaitAt = (this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual("await")) ? this.lastTokStart : -1;
  this.labels.push(loopLabel);
  this.enterScope(0);
  this.expect(types$1.parenL);
  if (this.type === types$1.semi) {
    if (awaitAt > -1) { this.unexpected(awaitAt); }
    return this.parseFor(node, null)
  }
  var isLet = this.isLet();
  if (this.type === types$1._var || this.type === types$1._const || isLet) {
    var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
    this.next();
    this.parseVar(init$1, true, kind);
    this.finishNode(init$1, "VariableDeclaration");
    if ((this.type === types$1._in || (this.options.ecmaVersion >= 6 && this.isContextual("of"))) && init$1.declarations.length === 1) {
      if (this.options.ecmaVersion >= 9) {
        if (this.type === types$1._in) {
          if (awaitAt > -1) { this.unexpected(awaitAt); }
        } else { node.await = awaitAt > -1; }
      }
      return this.parseForIn(node, init$1)
    }
    if (awaitAt > -1) { this.unexpected(awaitAt); }
    return this.parseFor(node, init$1)
  }
  var startsWithLet = this.isContextual("let"), isForOf = false;
  var refDestructuringErrors = new DestructuringErrors;
  var init = this.parseExpression(awaitAt > -1 ? "await" : true, refDestructuringErrors);
  if (this.type === types$1._in || (isForOf = this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
    if (this.options.ecmaVersion >= 9) {
      if (this.type === types$1._in) {
        if (awaitAt > -1) { this.unexpected(awaitAt); }
      } else { node.await = awaitAt > -1; }
    }
    if (startsWithLet && isForOf) { this.raise(init.start, "The left-hand side of a for-of loop may not start with 'let'."); }
    this.toAssignable(init, false, refDestructuringErrors);
    this.checkLValPattern(init);
    return this.parseForIn(node, init)
  } else {
    this.checkExpressionErrors(refDestructuringErrors, true);
  }
  if (awaitAt > -1) { this.unexpected(awaitAt); }
  return this.parseFor(node, init)
};

pp$8.parseFunctionStatement = function(node, isAsync, declarationPosition) {
  this.next();
  return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync)
};

pp$8.parseIfStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  // allow function declarations in branches, but only in non-strict mode
  node.consequent = this.parseStatement("if");
  node.alternate = this.eat(types$1._else) ? this.parseStatement("if") : null;
  return this.finishNode(node, "IfStatement")
};

pp$8.parseReturnStatement = function(node) {
  if (!this.inFunction && !this.options.allowReturnOutsideFunction)
    { this.raise(this.start, "'return' outside of function"); }
  this.next();

  // In `return` (and `break`/`continue`), the keywords with
  // optional arguments, we eagerly look for a semicolon or the
  // possibility to insert one.

  if (this.eat(types$1.semi) || this.insertSemicolon()) { node.argument = null; }
  else { node.argument = this.parseExpression(); this.semicolon(); }
  return this.finishNode(node, "ReturnStatement")
};

pp$8.parseSwitchStatement = function(node) {
  this.next();
  node.discriminant = this.parseParenExpression();
  node.cases = [];
  this.expect(types$1.braceL);
  this.labels.push(switchLabel);
  this.enterScope(0);

  // Statements under must be grouped (by label) in SwitchCase
  // nodes. `cur` is used to keep the node that we are currently
  // adding statements to.

  var cur;
  for (var sawDefault = false; this.type !== types$1.braceR;) {
    if (this.type === types$1._case || this.type === types$1._default) {
      var isCase = this.type === types$1._case;
      if (cur) { this.finishNode(cur, "SwitchCase"); }
      node.cases.push(cur = this.startNode());
      cur.consequent = [];
      this.next();
      if (isCase) {
        cur.test = this.parseExpression();
      } else {
        if (sawDefault) { this.raiseRecoverable(this.lastTokStart, "Multiple default clauses"); }
        sawDefault = true;
        cur.test = null;
      }
      this.expect(types$1.colon);
    } else {
      if (!cur) { this.unexpected(); }
      cur.consequent.push(this.parseStatement(null));
    }
  }
  this.exitScope();
  if (cur) { this.finishNode(cur, "SwitchCase"); }
  this.next(); // Closing brace
  this.labels.pop();
  return this.finishNode(node, "SwitchStatement")
};

pp$8.parseThrowStatement = function(node) {
  this.next();
  if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))
    { this.raise(this.lastTokEnd, "Illegal newline after throw"); }
  node.argument = this.parseExpression();
  this.semicolon();
  return this.finishNode(node, "ThrowStatement")
};

// Reused empty array added for node fields that are always empty.

var empty$1 = [];

pp$8.parseTryStatement = function(node) {
  this.next();
  node.block = this.parseBlock();
  node.handler = null;
  if (this.type === types$1._catch) {
    var clause = this.startNode();
    this.next();
    if (this.eat(types$1.parenL)) {
      clause.param = this.parseBindingAtom();
      var simple = clause.param.type === "Identifier";
      this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);
      this.checkLValPattern(clause.param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
      this.expect(types$1.parenR);
    } else {
      if (this.options.ecmaVersion < 10) { this.unexpected(); }
      clause.param = null;
      this.enterScope(0);
    }
    clause.body = this.parseBlock(false);
    this.exitScope();
    node.handler = this.finishNode(clause, "CatchClause");
  }
  node.finalizer = this.eat(types$1._finally) ? this.parseBlock() : null;
  if (!node.handler && !node.finalizer)
    { this.raise(node.start, "Missing catch or finally clause"); }
  return this.finishNode(node, "TryStatement")
};

pp$8.parseVarStatement = function(node, kind) {
  this.next();
  this.parseVar(node, false, kind);
  this.semicolon();
  return this.finishNode(node, "VariableDeclaration")
};

pp$8.parseWhileStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("while");
  this.labels.pop();
  return this.finishNode(node, "WhileStatement")
};

pp$8.parseWithStatement = function(node) {
  if (this.strict) { this.raise(this.start, "'with' in strict mode"); }
  this.next();
  node.object = this.parseParenExpression();
  node.body = this.parseStatement("with");
  return this.finishNode(node, "WithStatement")
};

pp$8.parseEmptyStatement = function(node) {
  this.next();
  return this.finishNode(node, "EmptyStatement")
};

pp$8.parseLabeledStatement = function(node, maybeName, expr, context) {
  for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1)
    {
    var label = list[i$1];

    if (label.name === maybeName)
      { this.raise(expr.start, "Label '" + maybeName + "' is already declared");
  } }
  var kind = this.type.isLoop ? "loop" : this.type === types$1._switch ? "switch" : null;
  for (var i = this.labels.length - 1; i >= 0; i--) {
    var label$1 = this.labels[i];
    if (label$1.statementStart === node.start) {
      // Update information about previous labels on this node
      label$1.statementStart = this.start;
      label$1.kind = kind;
    } else { break }
  }
  this.labels.push({name: maybeName, kind: kind, statementStart: this.start});
  node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
  this.labels.pop();
  node.label = expr;
  return this.finishNode(node, "LabeledStatement")
};

pp$8.parseExpressionStatement = function(node, expr) {
  node.expression = expr;
  this.semicolon();
  return this.finishNode(node, "ExpressionStatement")
};

// Parse a semicolon-enclosed block of statements, handling `"use
// strict"` declarations when `allowStrict` is true (used for
// function bodies).

pp$8.parseBlock = function(createNewLexicalScope, node, exitStrict) {
  if ( createNewLexicalScope === void 0 ) createNewLexicalScope = true;
  if ( node === void 0 ) node = this.startNode();

  node.body = [];
  this.expect(types$1.braceL);
  if (createNewLexicalScope) { this.enterScope(0); }
  while (this.type !== types$1.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  if (exitStrict) { this.strict = false; }
  this.next();
  if (createNewLexicalScope) { this.exitScope(); }
  return this.finishNode(node, "BlockStatement")
};

// Parse a regular `for` loop. The disambiguation code in
// `parseStatement` will already have parsed the init statement or
// expression.

pp$8.parseFor = function(node, init) {
  node.init = init;
  this.expect(types$1.semi);
  node.test = this.type === types$1.semi ? null : this.parseExpression();
  this.expect(types$1.semi);
  node.update = this.type === types$1.parenR ? null : this.parseExpression();
  this.expect(types$1.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, "ForStatement")
};

// Parse a `for`/`in` and `for`/`of` loop, which are almost
// same from parser's perspective.

pp$8.parseForIn = function(node, init) {
  var isForIn = this.type === types$1._in;
  this.next();

  if (
    init.type === "VariableDeclaration" &&
    init.declarations[0].init != null &&
    (
      !isForIn ||
      this.options.ecmaVersion < 8 ||
      this.strict ||
      init.kind !== "var" ||
      init.declarations[0].id.type !== "Identifier"
    )
  ) {
    this.raise(
      init.start,
      ((isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer")
    );
  }
  node.left = init;
  node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
  this.expect(types$1.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement")
};

// Parse a list of variable declarations.

pp$8.parseVar = function(node, isFor, kind) {
  node.declarations = [];
  node.kind = kind;
  for (;;) {
    var decl = this.startNode();
    this.parseVarId(decl, kind);
    if (this.eat(types$1.eq)) {
      decl.init = this.parseMaybeAssign(isFor);
    } else if (kind === "const" && !(this.type === types$1._in || (this.options.ecmaVersion >= 6 && this.isContextual("of")))) {
      this.unexpected();
    } else if (decl.id.type !== "Identifier" && !(isFor && (this.type === types$1._in || this.isContextual("of")))) {
      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
    } else {
      decl.init = null;
    }
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
    if (!this.eat(types$1.comma)) { break }
  }
  return node
};

pp$8.parseVarId = function(decl, kind) {
  decl.id = this.parseBindingAtom();
  this.checkLValPattern(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
};

var FUNC_STATEMENT = 1, FUNC_HANGING_STATEMENT = 2, FUNC_NULLABLE_ID = 4;

// Parse a function declaration or literal (depending on the
// `statement & FUNC_STATEMENT`).

// Remove `allowExpressionBody` for 7.0.0, as it is only called with false
pp$8.parseFunction = function(node, statement, allowExpressionBody, isAsync, forInit) {
  this.initFunction(node);
  if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
    if (this.type === types$1.star && (statement & FUNC_HANGING_STATEMENT))
      { this.unexpected(); }
    node.generator = this.eat(types$1.star);
  }
  if (this.options.ecmaVersion >= 8)
    { node.async = !!isAsync; }

  if (statement & FUNC_STATEMENT) {
    node.id = (statement & FUNC_NULLABLE_ID) && this.type !== types$1.name ? null : this.parseIdent();
    if (node.id && !(statement & FUNC_HANGING_STATEMENT))
      // If it is a regular function declaration in sloppy mode, then it is
      // subject to Annex B semantics (BIND_FUNCTION). Otherwise, the binding
      // mode depends on properties of the current scope (see
      // treatFunctionsAsVar).
      { this.checkLValSimple(node.id, (this.strict || node.generator || node.async) ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION); }
  }

  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(node.async, node.generator));

  if (!(statement & FUNC_STATEMENT))
    { node.id = this.type === types$1.name ? this.parseIdent() : null; }

  this.parseFunctionParams(node);
  this.parseFunctionBody(node, allowExpressionBody, false, forInit);

  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, (statement & FUNC_STATEMENT) ? "FunctionDeclaration" : "FunctionExpression")
};

pp$8.parseFunctionParams = function(node) {
  this.expect(types$1.parenL);
  node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
};

// Parse a class declaration or literal (depending on the
// `isStatement` parameter).

pp$8.parseClass = function(node, isStatement) {
  this.next();

  // ecma-262 14.6 Class Definitions
  // A class definition is always strict mode code.
  var oldStrict = this.strict;
  this.strict = true;

  this.parseClassId(node, isStatement);
  this.parseClassSuper(node);
  var privateNameMap = this.enterClassBody();
  var classBody = this.startNode();
  var hadConstructor = false;
  classBody.body = [];
  this.expect(types$1.braceL);
  while (this.type !== types$1.braceR) {
    var element = this.parseClassElement(node.superClass !== null);
    if (element) {
      classBody.body.push(element);
      if (element.type === "MethodDefinition" && element.kind === "constructor") {
        if (hadConstructor) { this.raise(element.start, "Duplicate constructor in the same class"); }
        hadConstructor = true;
      } else if (element.key && element.key.type === "PrivateIdentifier" && isPrivateNameConflicted(privateNameMap, element)) {
        this.raiseRecoverable(element.key.start, ("Identifier '#" + (element.key.name) + "' has already been declared"));
      }
    }
  }
  this.strict = oldStrict;
  this.next();
  node.body = this.finishNode(classBody, "ClassBody");
  this.exitClassBody();
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression")
};

pp$8.parseClassElement = function(constructorAllowsSuper) {
  if (this.eat(types$1.semi)) { return null }

  var ecmaVersion = this.options.ecmaVersion;
  var node = this.startNode();
  var keyName = "";
  var isGenerator = false;
  var isAsync = false;
  var kind = "method";
  var isStatic = false;

  if (this.eatContextual("static")) {
    // Parse static init block
    if (ecmaVersion >= 13 && this.eat(types$1.braceL)) {
      this.parseClassStaticBlock(node);
      return node
    }
    if (this.isClassElementNameStart() || this.type === types$1.star) {
      isStatic = true;
    } else {
      keyName = "static";
    }
  }
  node.static = isStatic;
  if (!keyName && ecmaVersion >= 8 && this.eatContextual("async")) {
    if ((this.isClassElementNameStart() || this.type === types$1.star) && !this.canInsertSemicolon()) {
      isAsync = true;
    } else {
      keyName = "async";
    }
  }
  if (!keyName && (ecmaVersion >= 9 || !isAsync) && this.eat(types$1.star)) {
    isGenerator = true;
  }
  if (!keyName && !isAsync && !isGenerator) {
    var lastValue = this.value;
    if (this.eatContextual("get") || this.eatContextual("set")) {
      if (this.isClassElementNameStart()) {
        kind = lastValue;
      } else {
        keyName = lastValue;
      }
    }
  }

  // Parse element name
  if (keyName) {
    // 'async', 'get', 'set', or 'static' were not a keyword contextually.
    // The last token is any of those. Make it the element name.
    node.computed = false;
    node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
    node.key.name = keyName;
    this.finishNode(node.key, "Identifier");
  } else {
    this.parseClassElementName(node);
  }

  // Parse element value
  if (ecmaVersion < 13 || this.type === types$1.parenL || kind !== "method" || isGenerator || isAsync) {
    var isConstructor = !node.static && checkKeyName(node, "constructor");
    var allowsDirectSuper = isConstructor && constructorAllowsSuper;
    // Couldn't move this check into the 'parseClassMethod' method for backward compatibility.
    if (isConstructor && kind !== "method") { this.raise(node.key.start, "Constructor can't have get/set modifier"); }
    node.kind = isConstructor ? "constructor" : kind;
    this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);
  } else {
    this.parseClassField(node);
  }

  return node
};

pp$8.isClassElementNameStart = function() {
  return (
    this.type === types$1.name ||
    this.type === types$1.privateId ||
    this.type === types$1.num ||
    this.type === types$1.string ||
    this.type === types$1.bracketL ||
    this.type.keyword
  )
};

pp$8.parseClassElementName = function(element) {
  if (this.type === types$1.privateId) {
    if (this.value === "constructor") {
      this.raise(this.start, "Classes can't have an element named '#constructor'");
    }
    element.computed = false;
    element.key = this.parsePrivateIdent();
  } else {
    this.parsePropertyName(element);
  }
};

pp$8.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
  // Check key and flags
  var key = method.key;
  if (method.kind === "constructor") {
    if (isGenerator) { this.raise(key.start, "Constructor can't be a generator"); }
    if (isAsync) { this.raise(key.start, "Constructor can't be an async method"); }
  } else if (method.static && checkKeyName(method, "prototype")) {
    this.raise(key.start, "Classes may not have a static property named prototype");
  }

  // Parse value
  var value = method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);

  // Check value
  if (method.kind === "get" && value.params.length !== 0)
    { this.raiseRecoverable(value.start, "getter should have no params"); }
  if (method.kind === "set" && value.params.length !== 1)
    { this.raiseRecoverable(value.start, "setter should have exactly one param"); }
  if (method.kind === "set" && value.params[0].type === "RestElement")
    { this.raiseRecoverable(value.params[0].start, "Setter cannot use rest params"); }

  return this.finishNode(method, "MethodDefinition")
};

pp$8.parseClassField = function(field) {
  if (checkKeyName(field, "constructor")) {
    this.raise(field.key.start, "Classes can't have a field named 'constructor'");
  } else if (field.static && checkKeyName(field, "prototype")) {
    this.raise(field.key.start, "Classes can't have a static field named 'prototype'");
  }

  if (this.eat(types$1.eq)) {
    // To raise SyntaxError if 'arguments' exists in the initializer.
    var scope = this.currentThisScope();
    var inClassFieldInit = scope.inClassFieldInit;
    scope.inClassFieldInit = true;
    field.value = this.parseMaybeAssign();
    scope.inClassFieldInit = inClassFieldInit;
  } else {
    field.value = null;
  }
  this.semicolon();

  return this.finishNode(field, "PropertyDefinition")
};

pp$8.parseClassStaticBlock = function(node) {
  node.body = [];

  var oldLabels = this.labels;
  this.labels = [];
  this.enterScope(SCOPE_CLASS_STATIC_BLOCK | SCOPE_SUPER);
  while (this.type !== types$1.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  this.next();
  this.exitScope();
  this.labels = oldLabels;

  return this.finishNode(node, "StaticBlock")
};

pp$8.parseClassId = function(node, isStatement) {
  if (this.type === types$1.name) {
    node.id = this.parseIdent();
    if (isStatement)
      { this.checkLValSimple(node.id, BIND_LEXICAL, false); }
  } else {
    if (isStatement === true)
      { this.unexpected(); }
    node.id = null;
  }
};

pp$8.parseClassSuper = function(node) {
  node.superClass = this.eat(types$1._extends) ? this.parseExprSubscripts(false) : null;
};

pp$8.enterClassBody = function() {
  var element = {declared: Object.create(null), used: []};
  this.privateNameStack.push(element);
  return element.declared
};

pp$8.exitClassBody = function() {
  var ref = this.privateNameStack.pop();
  var declared = ref.declared;
  var used = ref.used;
  var len = this.privateNameStack.length;
  var parent = len === 0 ? null : this.privateNameStack[len - 1];
  for (var i = 0; i < used.length; ++i) {
    var id = used[i];
    if (!hasOwn(declared, id.name)) {
      if (parent) {
        parent.used.push(id);
      } else {
        this.raiseRecoverable(id.start, ("Private field '#" + (id.name) + "' must be declared in an enclosing class"));
      }
    }
  }
};

function isPrivateNameConflicted(privateNameMap, element) {
  var name = element.key.name;
  var curr = privateNameMap[name];

  var next = "true";
  if (element.type === "MethodDefinition" && (element.kind === "get" || element.kind === "set")) {
    next = (element.static ? "s" : "i") + element.kind;
  }

  // `class { get #a(){}; static set #a(_){} }` is also conflict.
  if (
    curr === "iget" && next === "iset" ||
    curr === "iset" && next === "iget" ||
    curr === "sget" && next === "sset" ||
    curr === "sset" && next === "sget"
  ) {
    privateNameMap[name] = "true";
    return false
  } else if (!curr) {
    privateNameMap[name] = next;
    return false
  } else {
    return true
  }
}

function checkKeyName(node, name) {
  var computed = node.computed;
  var key = node.key;
  return !computed && (
    key.type === "Identifier" && key.name === name ||
    key.type === "Literal" && key.value === name
  )
}

// Parses module export declaration.

pp$8.parseExport = function(node, exports) {
  this.next();
  // export * from '...'
  if (this.eat(types$1.star)) {
    if (this.options.ecmaVersion >= 11) {
      if (this.eatContextual("as")) {
        node.exported = this.parseModuleExportName();
        this.checkExport(exports, node.exported, this.lastTokStart);
      } else {
        node.exported = null;
      }
    }
    this.expectContextual("from");
    if (this.type !== types$1.string) { this.unexpected(); }
    node.source = this.parseExprAtom();
    this.semicolon();
    return this.finishNode(node, "ExportAllDeclaration")
  }
  if (this.eat(types$1._default)) { // export default ...
    this.checkExport(exports, "default", this.lastTokStart);
    var isAsync;
    if (this.type === types$1._function || (isAsync = this.isAsyncFunction())) {
      var fNode = this.startNode();
      this.next();
      if (isAsync) { this.next(); }
      node.declaration = this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
    } else if (this.type === types$1._class) {
      var cNode = this.startNode();
      node.declaration = this.parseClass(cNode, "nullableID");
    } else {
      node.declaration = this.parseMaybeAssign();
      this.semicolon();
    }
    return this.finishNode(node, "ExportDefaultDeclaration")
  }
  // export var|const|let|function|class ...
  if (this.shouldParseExportStatement()) {
    node.declaration = this.parseStatement(null);
    if (node.declaration.type === "VariableDeclaration")
      { this.checkVariableExport(exports, node.declaration.declarations); }
    else
      { this.checkExport(exports, node.declaration.id, node.declaration.id.start); }
    node.specifiers = [];
    node.source = null;
  } else { // export { x, y as z } [from '...']
    node.declaration = null;
    node.specifiers = this.parseExportSpecifiers(exports);
    if (this.eatContextual("from")) {
      if (this.type !== types$1.string) { this.unexpected(); }
      node.source = this.parseExprAtom();
    } else {
      for (var i = 0, list = node.specifiers; i < list.length; i += 1) {
        // check for keywords used as local names
        var spec = list[i];

        this.checkUnreserved(spec.local);
        // check if export is defined
        this.checkLocalExport(spec.local);

        if (spec.local.type === "Literal") {
          this.raise(spec.local.start, "A string literal cannot be used as an exported binding without `from`.");
        }
      }

      node.source = null;
    }
    this.semicolon();
  }
  return this.finishNode(node, "ExportNamedDeclaration")
};

pp$8.checkExport = function(exports, name, pos) {
  if (!exports) { return }
  if (typeof name !== "string")
    { name = name.type === "Identifier" ? name.name : name.value; }
  if (hasOwn(exports, name))
    { this.raiseRecoverable(pos, "Duplicate export '" + name + "'"); }
  exports[name] = true;
};

pp$8.checkPatternExport = function(exports, pat) {
  var type = pat.type;
  if (type === "Identifier")
    { this.checkExport(exports, pat, pat.start); }
  else if (type === "ObjectPattern")
    { for (var i = 0, list = pat.properties; i < list.length; i += 1)
      {
        var prop = list[i];

        this.checkPatternExport(exports, prop);
      } }
  else if (type === "ArrayPattern")
    { for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
      var elt = list$1[i$1];

        if (elt) { this.checkPatternExport(exports, elt); }
    } }
  else if (type === "Property")
    { this.checkPatternExport(exports, pat.value); }
  else if (type === "AssignmentPattern")
    { this.checkPatternExport(exports, pat.left); }
  else if (type === "RestElement")
    { this.checkPatternExport(exports, pat.argument); }
  else if (type === "ParenthesizedExpression")
    { this.checkPatternExport(exports, pat.expression); }
};

pp$8.checkVariableExport = function(exports, decls) {
  if (!exports) { return }
  for (var i = 0, list = decls; i < list.length; i += 1)
    {
    var decl = list[i];

    this.checkPatternExport(exports, decl.id);
  }
};

pp$8.shouldParseExportStatement = function() {
  return this.type.keyword === "var" ||
    this.type.keyword === "const" ||
    this.type.keyword === "class" ||
    this.type.keyword === "function" ||
    this.isLet() ||
    this.isAsyncFunction()
};

// Parses a comma-separated list of module exports.

pp$8.parseExportSpecifiers = function(exports) {
  var nodes = [], first = true;
  // export { x, y as z } [from '...']
  this.expect(types$1.braceL);
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) { break }
    } else { first = false; }

    var node = this.startNode();
    node.local = this.parseModuleExportName();
    node.exported = this.eatContextual("as") ? this.parseModuleExportName() : node.local;
    this.checkExport(
      exports,
      node.exported,
      node.exported.start
    );
    nodes.push(this.finishNode(node, "ExportSpecifier"));
  }
  return nodes
};

// Parses import declaration.

pp$8.parseImport = function(node) {
  this.next();
  // import '...'
  if (this.type === types$1.string) {
    node.specifiers = empty$1;
    node.source = this.parseExprAtom();
  } else {
    node.specifiers = this.parseImportSpecifiers();
    this.expectContextual("from");
    node.source = this.type === types$1.string ? this.parseExprAtom() : this.unexpected();
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration")
};

// Parses a comma-separated list of module imports.

pp$8.parseImportSpecifiers = function() {
  var nodes = [], first = true;
  if (this.type === types$1.name) {
    // import defaultObj, { x, y as z } from '...'
    var node = this.startNode();
    node.local = this.parseIdent();
    this.checkLValSimple(node.local, BIND_LEXICAL);
    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
    if (!this.eat(types$1.comma)) { return nodes }
  }
  if (this.type === types$1.star) {
    var node$1 = this.startNode();
    this.next();
    this.expectContextual("as");
    node$1.local = this.parseIdent();
    this.checkLValSimple(node$1.local, BIND_LEXICAL);
    nodes.push(this.finishNode(node$1, "ImportNamespaceSpecifier"));
    return nodes
  }
  this.expect(types$1.braceL);
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) { break }
    } else { first = false; }

    var node$2 = this.startNode();
    node$2.imported = this.parseModuleExportName();
    if (this.eatContextual("as")) {
      node$2.local = this.parseIdent();
    } else {
      this.checkUnreserved(node$2.imported);
      node$2.local = node$2.imported;
    }
    this.checkLValSimple(node$2.local, BIND_LEXICAL);
    nodes.push(this.finishNode(node$2, "ImportSpecifier"));
  }
  return nodes
};

pp$8.parseModuleExportName = function() {
  if (this.options.ecmaVersion >= 13 && this.type === types$1.string) {
    var stringLiteral = this.parseLiteral(this.value);
    if (loneSurrogate.test(stringLiteral.value)) {
      this.raise(stringLiteral.start, "An export name cannot include a lone surrogate.");
    }
    return stringLiteral
  }
  return this.parseIdent(true)
};

// Set `ExpressionStatement#directive` property for directive prologues.
pp$8.adaptDirectivePrologue = function(statements) {
  for (var i = 0; i < statements.length && this.isDirectiveCandidate(statements[i]); ++i) {
    statements[i].directive = statements[i].expression.raw.slice(1, -1);
  }
};
pp$8.isDirectiveCandidate = function(statement) {
  return (
    this.options.ecmaVersion >= 5 &&
    statement.type === "ExpressionStatement" &&
    statement.expression.type === "Literal" &&
    typeof statement.expression.value === "string" &&
    // Reject parenthesized strings.
    (this.input[statement.start] === "\"" || this.input[statement.start] === "'")
  )
};

var pp$7 = Parser.prototype;

// Convert existing expression atom to assignable pattern
// if possible.

pp$7.toAssignable = function(node, isBinding, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 6 && node) {
    switch (node.type) {
    case "Identifier":
      if (this.inAsync && node.name === "await")
        { this.raise(node.start, "Cannot use 'await' as identifier inside an async function"); }
      break

    case "ObjectPattern":
    case "ArrayPattern":
    case "AssignmentPattern":
    case "RestElement":
      break

    case "ObjectExpression":
      node.type = "ObjectPattern";
      if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
      for (var i = 0, list = node.properties; i < list.length; i += 1) {
        var prop = list[i];

      this.toAssignable(prop, isBinding);
        // Early error:
        //   AssignmentRestProperty[Yield, Await] :
        //     `...` DestructuringAssignmentTarget[Yield, Await]
        //
        //   It is a Syntax Error if |DestructuringAssignmentTarget| is an |ArrayLiteral| or an |ObjectLiteral|.
        if (
          prop.type === "RestElement" &&
          (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")
        ) {
          this.raise(prop.argument.start, "Unexpected token");
        }
      }
      break

    case "Property":
      // AssignmentProperty has type === "Property"
      if (node.kind !== "init") { this.raise(node.key.start, "Object pattern can't contain getter or setter"); }
      this.toAssignable(node.value, isBinding);
      break

    case "ArrayExpression":
      node.type = "ArrayPattern";
      if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
      this.toAssignableList(node.elements, isBinding);
      break

    case "SpreadElement":
      node.type = "RestElement";
      this.toAssignable(node.argument, isBinding);
      if (node.argument.type === "AssignmentPattern")
        { this.raise(node.argument.start, "Rest elements cannot have a default value"); }
      break

    case "AssignmentExpression":
      if (node.operator !== "=") { this.raise(node.left.end, "Only '=' operator can be used for specifying default value."); }
      node.type = "AssignmentPattern";
      delete node.operator;
      this.toAssignable(node.left, isBinding);
      break

    case "ParenthesizedExpression":
      this.toAssignable(node.expression, isBinding, refDestructuringErrors);
      break

    case "ChainExpression":
      this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
      break

    case "MemberExpression":
      if (!isBinding) { break }

    default:
      this.raise(node.start, "Assigning to rvalue");
    }
  } else if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
  return node
};

// Convert list of expression atoms to binding list.

pp$7.toAssignableList = function(exprList, isBinding) {
  var end = exprList.length;
  for (var i = 0; i < end; i++) {
    var elt = exprList[i];
    if (elt) { this.toAssignable(elt, isBinding); }
  }
  if (end) {
    var last = exprList[end - 1];
    if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier")
      { this.unexpected(last.argument.start); }
  }
  return exprList
};

// Parses spread element.

pp$7.parseSpread = function(refDestructuringErrors) {
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
  return this.finishNode(node, "SpreadElement")
};

pp$7.parseRestBinding = function() {
  var node = this.startNode();
  this.next();

  // RestElement inside of a function parameter must be an identifier
  if (this.options.ecmaVersion === 6 && this.type !== types$1.name)
    { this.unexpected(); }

  node.argument = this.parseBindingAtom();

  return this.finishNode(node, "RestElement")
};

// Parses lvalue (assignable) atom.

pp$7.parseBindingAtom = function() {
  if (this.options.ecmaVersion >= 6) {
    switch (this.type) {
    case types$1.bracketL:
      var node = this.startNode();
      this.next();
      node.elements = this.parseBindingList(types$1.bracketR, true, true);
      return this.finishNode(node, "ArrayPattern")

    case types$1.braceL:
      return this.parseObj(true)
    }
  }
  return this.parseIdent()
};

pp$7.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
  var elts = [], first = true;
  while (!this.eat(close)) {
    if (first) { first = false; }
    else { this.expect(types$1.comma); }
    if (allowEmpty && this.type === types$1.comma) {
      elts.push(null);
    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
      break
    } else if (this.type === types$1.ellipsis) {
      var rest = this.parseRestBinding();
      this.parseBindingListItem(rest);
      elts.push(rest);
      if (this.type === types$1.comma) { this.raise(this.start, "Comma is not permitted after the rest element"); }
      this.expect(close);
      break
    } else {
      var elem = this.parseMaybeDefault(this.start, this.startLoc);
      this.parseBindingListItem(elem);
      elts.push(elem);
    }
  }
  return elts
};

pp$7.parseBindingListItem = function(param) {
  return param
};

// Parses assignment pattern around given atom if possible.

pp$7.parseMaybeDefault = function(startPos, startLoc, left) {
  left = left || this.parseBindingAtom();
  if (this.options.ecmaVersion < 6 || !this.eat(types$1.eq)) { return left }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.right = this.parseMaybeAssign();
  return this.finishNode(node, "AssignmentPattern")
};

// The following three functions all verify that a node is an lvalue —
// something that can be bound, or assigned to. In order to do so, they perform
// a variety of checks:
//
// - Check that none of the bound/assigned-to identifiers are reserved words.
// - Record name declarations for bindings in the appropriate scope.
// - Check duplicate argument names, if checkClashes is set.
//
// If a complex binding pattern is encountered (e.g., object and array
// destructuring), the entire pattern is recursively checked.
//
// There are three versions of checkLVal*() appropriate for different
// circumstances:
//
// - checkLValSimple() shall be used if the syntactic construct supports
//   nothing other than identifiers and member expressions. Parenthesized
//   expressions are also correctly handled. This is generally appropriate for
//   constructs for which the spec says
//
//   > It is a Syntax Error if AssignmentTargetType of [the production] is not
//   > simple.
//
//   It is also appropriate for checking if an identifier is valid and not
//   defined elsewhere, like import declarations or function/class identifiers.
//
//   Examples where this is used include:
//     a += …;
//     import a from '…';
//   where a is the node to be checked.
//
// - checkLValPattern() shall be used if the syntactic construct supports
//   anything checkLValSimple() supports, as well as object and array
//   destructuring patterns. This is generally appropriate for constructs for
//   which the spec says
//
//   > It is a Syntax Error if [the production] is neither an ObjectLiteral nor
//   > an ArrayLiteral and AssignmentTargetType of [the production] is not
//   > simple.
//
//   Examples where this is used include:
//     (a = …);
//     const a = …;
//     try { … } catch (a) { … }
//   where a is the node to be checked.
//
// - checkLValInnerPattern() shall be used if the syntactic construct supports
//   anything checkLValPattern() supports, as well as default assignment
//   patterns, rest elements, and other constructs that may appear within an
//   object or array destructuring pattern.
//
//   As a special case, function parameters also use checkLValInnerPattern(),
//   as they also support defaults and rest constructs.
//
// These functions deliberately support both assignment and binding constructs,
// as the logic for both is exceedingly similar. If the node is the target of
// an assignment, then bindingType should be set to BIND_NONE. Otherwise, it
// should be set to the appropriate BIND_* constant, like BIND_VAR or
// BIND_LEXICAL.
//
// If the function is called with a non-BIND_NONE bindingType, then
// additionally a checkClashes object may be specified to allow checking for
// duplicate argument names. checkClashes is ignored if the provided construct
// is an assignment (i.e., bindingType is BIND_NONE).

pp$7.checkLValSimple = function(expr, bindingType, checkClashes) {
  if ( bindingType === void 0 ) bindingType = BIND_NONE;

  var isBind = bindingType !== BIND_NONE;

  switch (expr.type) {
  case "Identifier":
    if (this.strict && this.reservedWordsStrictBind.test(expr.name))
      { this.raiseRecoverable(expr.start, (isBind ? "Binding " : "Assigning to ") + expr.name + " in strict mode"); }
    if (isBind) {
      if (bindingType === BIND_LEXICAL && expr.name === "let")
        { this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name"); }
      if (checkClashes) {
        if (hasOwn(checkClashes, expr.name))
          { this.raiseRecoverable(expr.start, "Argument name clash"); }
        checkClashes[expr.name] = true;
      }
      if (bindingType !== BIND_OUTSIDE) { this.declareName(expr.name, bindingType, expr.start); }
    }
    break

  case "ChainExpression":
    this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
    break

  case "MemberExpression":
    if (isBind) { this.raiseRecoverable(expr.start, "Binding member expression"); }
    break

  case "ParenthesizedExpression":
    if (isBind) { this.raiseRecoverable(expr.start, "Binding parenthesized expression"); }
    return this.checkLValSimple(expr.expression, bindingType, checkClashes)

  default:
    this.raise(expr.start, (isBind ? "Binding" : "Assigning to") + " rvalue");
  }
};

pp$7.checkLValPattern = function(expr, bindingType, checkClashes) {
  if ( bindingType === void 0 ) bindingType = BIND_NONE;

  switch (expr.type) {
  case "ObjectPattern":
    for (var i = 0, list = expr.properties; i < list.length; i += 1) {
      var prop = list[i];

    this.checkLValInnerPattern(prop, bindingType, checkClashes);
    }
    break

  case "ArrayPattern":
    for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
      var elem = list$1[i$1];

    if (elem) { this.checkLValInnerPattern(elem, bindingType, checkClashes); }
    }
    break

  default:
    this.checkLValSimple(expr, bindingType, checkClashes);
  }
};

pp$7.checkLValInnerPattern = function(expr, bindingType, checkClashes) {
  if ( bindingType === void 0 ) bindingType = BIND_NONE;

  switch (expr.type) {
  case "Property":
    // AssignmentProperty has type === "Property"
    this.checkLValInnerPattern(expr.value, bindingType, checkClashes);
    break

  case "AssignmentPattern":
    this.checkLValPattern(expr.left, bindingType, checkClashes);
    break

  case "RestElement":
    this.checkLValPattern(expr.argument, bindingType, checkClashes);
    break

  default:
    this.checkLValPattern(expr, bindingType, checkClashes);
  }
};

// The algorithm used to determine whether a regexp can appear at a

var TokContext = function TokContext(token, isExpr, preserveSpace, override, generator) {
  this.token = token;
  this.isExpr = !!isExpr;
  this.preserveSpace = !!preserveSpace;
  this.override = override;
  this.generator = !!generator;
};

var types = {
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  b_tmpl: new TokContext("${", false),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  q_tmpl: new TokContext("`", true, true, function (p) { return p.tryReadTemplateToken(); }),
  f_stat: new TokContext("function", false),
  f_expr: new TokContext("function", true),
  f_expr_gen: new TokContext("function", true, false, null, true),
  f_gen: new TokContext("function", false, false, null, true)
};

var pp$6 = Parser.prototype;

pp$6.initialContext = function() {
  return [types.b_stat]
};

pp$6.curContext = function() {
  return this.context[this.context.length - 1]
};

pp$6.braceIsBlock = function(prevType) {
  var parent = this.curContext();
  if (parent === types.f_expr || parent === types.f_stat)
    { return true }
  if (prevType === types$1.colon && (parent === types.b_stat || parent === types.b_expr))
    { return !parent.isExpr }

  // The check for `tt.name && exprAllowed` detects whether we are
  // after a `yield` or `of` construct. See the `updateContext` for
  // `tt.name`.
  if (prevType === types$1._return || prevType === types$1.name && this.exprAllowed)
    { return lineBreak.test(this.input.slice(this.lastTokEnd, this.start)) }
  if (prevType === types$1._else || prevType === types$1.semi || prevType === types$1.eof || prevType === types$1.parenR || prevType === types$1.arrow)
    { return true }
  if (prevType === types$1.braceL)
    { return parent === types.b_stat }
  if (prevType === types$1._var || prevType === types$1._const || prevType === types$1.name)
    { return false }
  return !this.exprAllowed
};

pp$6.inGeneratorContext = function() {
  for (var i = this.context.length - 1; i >= 1; i--) {
    var context = this.context[i];
    if (context.token === "function")
      { return context.generator }
  }
  return false
};

pp$6.updateContext = function(prevType) {
  var update, type = this.type;
  if (type.keyword && prevType === types$1.dot)
    { this.exprAllowed = false; }
  else if (update = type.updateContext)
    { update.call(this, prevType); }
  else
    { this.exprAllowed = type.beforeExpr; }
};

// Used to handle egde cases when token context could not be inferred correctly during tokenization phase

pp$6.overrideContext = function(tokenCtx) {
  if (this.curContext() !== tokenCtx) {
    this.context[this.context.length - 1] = tokenCtx;
  }
};

// Token-specific context update code

types$1.parenR.updateContext = types$1.braceR.updateContext = function() {
  if (this.context.length === 1) {
    this.exprAllowed = true;
    return
  }
  var out = this.context.pop();
  if (out === types.b_stat && this.curContext().token === "function") {
    out = this.context.pop();
  }
  this.exprAllowed = !out.isExpr;
};

types$1.braceL.updateContext = function(prevType) {
  this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
  this.exprAllowed = true;
};

types$1.dollarBraceL.updateContext = function() {
  this.context.push(types.b_tmpl);
  this.exprAllowed = true;
};

types$1.parenL.updateContext = function(prevType) {
  var statementParens = prevType === types$1._if || prevType === types$1._for || prevType === types$1._with || prevType === types$1._while;
  this.context.push(statementParens ? types.p_stat : types.p_expr);
  this.exprAllowed = true;
};

types$1.incDec.updateContext = function() {
  // tokExprAllowed stays unchanged
};

types$1._function.updateContext = types$1._class.updateContext = function(prevType) {
  if (prevType.beforeExpr && prevType !== types$1._else &&
      !(prevType === types$1.semi && this.curContext() !== types.p_stat) &&
      !(prevType === types$1._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) &&
      !((prevType === types$1.colon || prevType === types$1.braceL) && this.curContext() === types.b_stat))
    { this.context.push(types.f_expr); }
  else
    { this.context.push(types.f_stat); }
  this.exprAllowed = false;
};

types$1.backQuote.updateContext = function() {
  if (this.curContext() === types.q_tmpl)
    { this.context.pop(); }
  else
    { this.context.push(types.q_tmpl); }
  this.exprAllowed = false;
};

types$1.star.updateContext = function(prevType) {
  if (prevType === types$1._function) {
    var index = this.context.length - 1;
    if (this.context[index] === types.f_expr)
      { this.context[index] = types.f_expr_gen; }
    else
      { this.context[index] = types.f_gen; }
  }
  this.exprAllowed = true;
};

types$1.name.updateContext = function(prevType) {
  var allowed = false;
  if (this.options.ecmaVersion >= 6 && prevType !== types$1.dot) {
    if (this.value === "of" && !this.exprAllowed ||
        this.value === "yield" && this.inGeneratorContext())
      { allowed = true; }
  }
  this.exprAllowed = allowed;
};

// A recursive descent parser operates by defining functions for all

var pp$5 = Parser.prototype;

// Check if property name clashes with already added.
// Object/class getters and setters are not allowed to clash —
// either with each other or with an init property — and in
// strict mode, init properties are also not allowed to be repeated.

pp$5.checkPropClash = function(prop, propHash, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement")
    { return }
  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand))
    { return }
  var key = prop.key;
  var name;
  switch (key.type) {
  case "Identifier": name = key.name; break
  case "Literal": name = String(key.value); break
  default: return
  }
  var kind = prop.kind;
  if (this.options.ecmaVersion >= 6) {
    if (name === "__proto__" && kind === "init") {
      if (propHash.proto) {
        if (refDestructuringErrors) {
          if (refDestructuringErrors.doubleProto < 0) {
            refDestructuringErrors.doubleProto = key.start;
          }
        } else {
          this.raiseRecoverable(key.start, "Redefinition of __proto__ property");
        }
      }
      propHash.proto = true;
    }
    return
  }
  name = "$" + name;
  var other = propHash[name];
  if (other) {
    var redefinition;
    if (kind === "init") {
      redefinition = this.strict && other.init || other.get || other.set;
    } else {
      redefinition = other.init || other[kind];
    }
    if (redefinition)
      { this.raiseRecoverable(key.start, "Redefinition of property"); }
  } else {
    other = propHash[name] = {
      init: false,
      get: false,
      set: false
    };
  }
  other[kind] = true;
};

// ### Expression parsing

// These nest, from the most general expression type at the top to
// 'atomic', nondivisible expression types at the bottom. Most of
// the functions will simply let the function(s) below them parse,
// and, *if* the syntactic construct they handle is present, wrap
// the AST node that the inner parser gave them in another node.

// Parse a full expression. The optional arguments are used to
// forbid the `in` operator (in for loops initalization expressions)
// and provide reference for storing '=' operator inside shorthand
// property assignment in contexts where both object expression
// and object pattern might appear (so it's possible to raise
// delayed syntax error at correct position).

pp$5.parseExpression = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseMaybeAssign(forInit, refDestructuringErrors);
  if (this.type === types$1.comma) {
    var node = this.startNodeAt(startPos, startLoc);
    node.expressions = [expr];
    while (this.eat(types$1.comma)) { node.expressions.push(this.parseMaybeAssign(forInit, refDestructuringErrors)); }
    return this.finishNode(node, "SequenceExpression")
  }
  return expr
};

// Parse an assignment expression. This includes applications of
// operators like `+=`.

pp$5.parseMaybeAssign = function(forInit, refDestructuringErrors, afterLeftParse) {
  if (this.isContextual("yield")) {
    if (this.inGenerator) { return this.parseYield(forInit) }
    // The tokenizer will assume an expression is allowed after
    // `yield`, but this isn't that kind of yield
    else { this.exprAllowed = false; }
  }

  var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldDoubleProto = -1;
  if (refDestructuringErrors) {
    oldParenAssign = refDestructuringErrors.parenthesizedAssign;
    oldTrailingComma = refDestructuringErrors.trailingComma;
    oldDoubleProto = refDestructuringErrors.doubleProto;
    refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
  } else {
    refDestructuringErrors = new DestructuringErrors;
    ownDestructuringErrors = true;
  }

  var startPos = this.start, startLoc = this.startLoc;
  if (this.type === types$1.parenL || this.type === types$1.name) {
    this.potentialArrowAt = this.start;
    this.potentialArrowInForAwait = forInit === "await";
  }
  var left = this.parseMaybeConditional(forInit, refDestructuringErrors);
  if (afterLeftParse) { left = afterLeftParse.call(this, left, startPos, startLoc); }
  if (this.type.isAssign) {
    var node = this.startNodeAt(startPos, startLoc);
    node.operator = this.value;
    if (this.type === types$1.eq)
      { left = this.toAssignable(left, false, refDestructuringErrors); }
    if (!ownDestructuringErrors) {
      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
    }
    if (refDestructuringErrors.shorthandAssign >= left.start)
      { refDestructuringErrors.shorthandAssign = -1; } // reset because shorthand default was used correctly
    if (this.type === types$1.eq)
      { this.checkLValPattern(left); }
    else
      { this.checkLValSimple(left); }
    node.left = left;
    this.next();
    node.right = this.parseMaybeAssign(forInit);
    if (oldDoubleProto > -1) { refDestructuringErrors.doubleProto = oldDoubleProto; }
    return this.finishNode(node, "AssignmentExpression")
  } else {
    if (ownDestructuringErrors) { this.checkExpressionErrors(refDestructuringErrors, true); }
  }
  if (oldParenAssign > -1) { refDestructuringErrors.parenthesizedAssign = oldParenAssign; }
  if (oldTrailingComma > -1) { refDestructuringErrors.trailingComma = oldTrailingComma; }
  return left
};

// Parse a ternary conditional (`?:`) operator.

pp$5.parseMaybeConditional = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprOps(forInit, refDestructuringErrors);
  if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
  if (this.eat(types$1.question)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    this.expect(types$1.colon);
    node.alternate = this.parseMaybeAssign(forInit);
    return this.finishNode(node, "ConditionalExpression")
  }
  return expr
};

// Start the precedence parser.

pp$5.parseExprOps = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseMaybeUnary(refDestructuringErrors, false, false, forInit);
  if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
  return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, forInit)
};

// Parse binary operators with the operator precedence parsing
// algorithm. `left` is the left-hand side of the operator.
// `minPrec` provides context that allows the function to stop and
// defer further parser to one of its callers when it encounters an
// operator that has a lower precedence than the set it is parsing.

pp$5.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, forInit) {
  var prec = this.type.binop;
  if (prec != null && (!forInit || this.type !== types$1._in)) {
    if (prec > minPrec) {
      var logical = this.type === types$1.logicalOR || this.type === types$1.logicalAND;
      var coalesce = this.type === types$1.coalesce;
      if (coalesce) {
        // Handle the precedence of `tt.coalesce` as equal to the range of logical expressions.
        // In other words, `node.right` shouldn't contain logical expressions in order to check the mixed error.
        prec = types$1.logicalAND.binop;
      }
      var op = this.value;
      this.next();
      var startPos = this.start, startLoc = this.startLoc;
      var right = this.parseExprOp(this.parseMaybeUnary(null, false, false, forInit), startPos, startLoc, prec, forInit);
      var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);
      if ((logical && this.type === types$1.coalesce) || (coalesce && (this.type === types$1.logicalOR || this.type === types$1.logicalAND))) {
        this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
      }
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit)
    }
  }
  return left
};

pp$5.buildBinary = function(startPos, startLoc, left, right, op, logical) {
  if (right.type === "PrivateIdentifier") { this.raise(right.start, "Private identifier can only be left side of binary expression"); }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.operator = op;
  node.right = right;
  return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression")
};

// Parse unary operators, both prefix and postfix.

pp$5.parseMaybeUnary = function(refDestructuringErrors, sawUnary, incDec, forInit) {
  var startPos = this.start, startLoc = this.startLoc, expr;
  if (this.isContextual("await") && this.canAwait) {
    expr = this.parseAwait(forInit);
    sawUnary = true;
  } else if (this.type.prefix) {
    var node = this.startNode(), update = this.type === types$1.incDec;
    node.operator = this.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary(null, true, update, forInit);
    this.checkExpressionErrors(refDestructuringErrors, true);
    if (update) { this.checkLValSimple(node.argument); }
    else if (this.strict && node.operator === "delete" &&
             node.argument.type === "Identifier")
      { this.raiseRecoverable(node.start, "Deleting local variable in strict mode"); }
    else if (node.operator === "delete" && isPrivateFieldAccess(node.argument))
      { this.raiseRecoverable(node.start, "Private fields can not be deleted"); }
    else { sawUnary = true; }
    expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  } else if (!sawUnary && this.type === types$1.privateId) {
    if (forInit || this.privateNameStack.length === 0) { this.unexpected(); }
    expr = this.parsePrivateIdent();
    // only could be private fields in 'in', such as #x in obj
    if (this.type !== types$1._in) { this.unexpected(); }
  } else {
    expr = this.parseExprSubscripts(refDestructuringErrors, forInit);
    if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
    while (this.type.postfix && !this.canInsertSemicolon()) {
      var node$1 = this.startNodeAt(startPos, startLoc);
      node$1.operator = this.value;
      node$1.prefix = false;
      node$1.argument = expr;
      this.checkLValSimple(expr);
      this.next();
      expr = this.finishNode(node$1, "UpdateExpression");
    }
  }

  if (!incDec && this.eat(types$1.starstar)) {
    if (sawUnary)
      { this.unexpected(this.lastTokStart); }
    else
      { return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false, false, forInit), "**", false) }
  } else {
    return expr
  }
};

function isPrivateFieldAccess(node) {
  return (
    node.type === "MemberExpression" && node.property.type === "PrivateIdentifier" ||
    node.type === "ChainExpression" && isPrivateFieldAccess(node.expression)
  )
}

// Parse call, dot, and `[]`-subscript expressions.

pp$5.parseExprSubscripts = function(refDestructuringErrors, forInit) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprAtom(refDestructuringErrors, forInit);
  if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")")
    { return expr }
  var result = this.parseSubscripts(expr, startPos, startLoc, false, forInit);
  if (refDestructuringErrors && result.type === "MemberExpression") {
    if (refDestructuringErrors.parenthesizedAssign >= result.start) { refDestructuringErrors.parenthesizedAssign = -1; }
    if (refDestructuringErrors.parenthesizedBind >= result.start) { refDestructuringErrors.parenthesizedBind = -1; }
    if (refDestructuringErrors.trailingComma >= result.start) { refDestructuringErrors.trailingComma = -1; }
  }
  return result
};

pp$5.parseSubscripts = function(base, startPos, startLoc, noCalls, forInit) {
  var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" &&
      this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 &&
      this.potentialArrowAt === base.start;
  var optionalChained = false;

  while (true) {
    var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit);

    if (element.optional) { optionalChained = true; }
    if (element === base || element.type === "ArrowFunctionExpression") {
      if (optionalChained) {
        var chainNode = this.startNodeAt(startPos, startLoc);
        chainNode.expression = element;
        element = this.finishNode(chainNode, "ChainExpression");
      }
      return element
    }

    base = element;
  }
};

pp$5.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
  var optionalSupported = this.options.ecmaVersion >= 11;
  var optional = optionalSupported && this.eat(types$1.questionDot);
  if (noCalls && optional) { this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions"); }

  var computed = this.eat(types$1.bracketL);
  if (computed || (optional && this.type !== types$1.parenL && this.type !== types$1.backQuote) || this.eat(types$1.dot)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.object = base;
    if (computed) {
      node.property = this.parseExpression();
      this.expect(types$1.bracketR);
    } else if (this.type === types$1.privateId && base.type !== "Super") {
      node.property = this.parsePrivateIdent();
    } else {
      node.property = this.parseIdent(this.options.allowReserved !== "never");
    }
    node.computed = !!computed;
    if (optionalSupported) {
      node.optional = optional;
    }
    base = this.finishNode(node, "MemberExpression");
  } else if (!noCalls && this.eat(types$1.parenL)) {
    var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    var exprList = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
    if (maybeAsyncArrow && !optional && !this.canInsertSemicolon() && this.eat(types$1.arrow)) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      if (this.awaitIdentPos > 0)
        { this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function"); }
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      this.awaitIdentPos = oldAwaitIdentPos;
      return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true, forInit)
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
    var node$1 = this.startNodeAt(startPos, startLoc);
    node$1.callee = base;
    node$1.arguments = exprList;
    if (optionalSupported) {
      node$1.optional = optional;
    }
    base = this.finishNode(node$1, "CallExpression");
  } else if (this.type === types$1.backQuote) {
    if (optional || optionalChained) {
      this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
    }
    var node$2 = this.startNodeAt(startPos, startLoc);
    node$2.tag = base;
    node$2.quasi = this.parseTemplate({isTagged: true});
    base = this.finishNode(node$2, "TaggedTemplateExpression");
  }
  return base
};

// Parse an atomic expression — either a single token that is an
// expression, an expression started by a keyword like `function` or
// `new`, or an expression wrapped in punctuation like `()`, `[]`,
// or `{}`.

pp$5.parseExprAtom = function(refDestructuringErrors, forInit) {
  // If a division operator appears in an expression position, the
  // tokenizer got confused, and we force it to read a regexp instead.
  if (this.type === types$1.slash) { this.readRegexp(); }

  var node, canBeArrow = this.potentialArrowAt === this.start;
  switch (this.type) {
  case types$1._super:
    if (!this.allowSuper)
      { this.raise(this.start, "'super' keyword outside a method"); }
    node = this.startNode();
    this.next();
    if (this.type === types$1.parenL && !this.allowDirectSuper)
      { this.raise(node.start, "super() call outside constructor of a subclass"); }
    // The `super` keyword can appear at below:
    // SuperProperty:
    //     super [ Expression ]
    //     super . IdentifierName
    // SuperCall:
    //     super ( Arguments )
    if (this.type !== types$1.dot && this.type !== types$1.bracketL && this.type !== types$1.parenL)
      { this.unexpected(); }
    return this.finishNode(node, "Super")

  case types$1._this:
    node = this.startNode();
    this.next();
    return this.finishNode(node, "ThisExpression")

  case types$1.name:
    var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
    var id = this.parseIdent(false);
    if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(types$1._function)) {
      this.overrideContext(types.f_expr);
      return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true, forInit)
    }
    if (canBeArrow && !this.canInsertSemicolon()) {
      if (this.eat(types$1.arrow))
        { return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false, forInit) }
      if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === types$1.name && !containsEsc &&
          (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
        id = this.parseIdent(false);
        if (this.canInsertSemicolon() || !this.eat(types$1.arrow))
          { this.unexpected(); }
        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true, forInit)
      }
    }
    return id

  case types$1.regexp:
    var value = this.value;
    node = this.parseLiteral(value.value);
    node.regex = {pattern: value.pattern, flags: value.flags};
    return node

  case types$1.num: case types$1.string:
    return this.parseLiteral(this.value)

  case types$1._null: case types$1._true: case types$1._false:
    node = this.startNode();
    node.value = this.type === types$1._null ? null : this.type === types$1._true;
    node.raw = this.type.keyword;
    this.next();
    return this.finishNode(node, "Literal")

  case types$1.parenL:
    var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow, forInit);
    if (refDestructuringErrors) {
      if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr))
        { refDestructuringErrors.parenthesizedAssign = start; }
      if (refDestructuringErrors.parenthesizedBind < 0)
        { refDestructuringErrors.parenthesizedBind = start; }
    }
    return expr

  case types$1.bracketL:
    node = this.startNode();
    this.next();
    node.elements = this.parseExprList(types$1.bracketR, true, true, refDestructuringErrors);
    return this.finishNode(node, "ArrayExpression")

  case types$1.braceL:
    this.overrideContext(types.b_expr);
    return this.parseObj(false, refDestructuringErrors)

  case types$1._function:
    node = this.startNode();
    this.next();
    return this.parseFunction(node, 0)

  case types$1._class:
    return this.parseClass(this.startNode(), false)

  case types$1._new:
    return this.parseNew()

  case types$1.backQuote:
    return this.parseTemplate()

  case types$1._import:
    if (this.options.ecmaVersion >= 11) {
      return this.parseExprImport()
    } else {
      return this.unexpected()
    }

  default:
    this.unexpected();
  }
};

pp$5.parseExprImport = function() {
  var node = this.startNode();

  // Consume `import` as an identifier for `import.meta`.
  // Because `this.parseIdent(true)` doesn't check escape sequences, it needs the check of `this.containsEsc`.
  if (this.containsEsc) { this.raiseRecoverable(this.start, "Escape sequence in keyword import"); }
  var meta = this.parseIdent(true);

  switch (this.type) {
  case types$1.parenL:
    return this.parseDynamicImport(node)
  case types$1.dot:
    node.meta = meta;
    return this.parseImportMeta(node)
  default:
    this.unexpected();
  }
};

pp$5.parseDynamicImport = function(node) {
  this.next(); // skip `(`

  // Parse node.source.
  node.source = this.parseMaybeAssign();

  // Verify ending.
  if (!this.eat(types$1.parenR)) {
    var errorPos = this.start;
    if (this.eat(types$1.comma) && this.eat(types$1.parenR)) {
      this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
    } else {
      this.unexpected(errorPos);
    }
  }

  return this.finishNode(node, "ImportExpression")
};

pp$5.parseImportMeta = function(node) {
  this.next(); // skip `.`

  var containsEsc = this.containsEsc;
  node.property = this.parseIdent(true);

  if (node.property.name !== "meta")
    { this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'"); }
  if (containsEsc)
    { this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters"); }
  if (this.options.sourceType !== "module" && !this.options.allowImportExportEverywhere)
    { this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module"); }

  return this.finishNode(node, "MetaProperty")
};

pp$5.parseLiteral = function(value) {
  var node = this.startNode();
  node.value = value;
  node.raw = this.input.slice(this.start, this.end);
  if (node.raw.charCodeAt(node.raw.length - 1) === 110) { node.bigint = node.raw.slice(0, -1).replace(/_/g, ""); }
  this.next();
  return this.finishNode(node, "Literal")
};

pp$5.parseParenExpression = function() {
  this.expect(types$1.parenL);
  var val = this.parseExpression();
  this.expect(types$1.parenR);
  return val
};

pp$5.parseParenAndDistinguishExpression = function(canBeArrow, forInit) {
  var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
  if (this.options.ecmaVersion >= 6) {
    this.next();

    var innerStartPos = this.start, innerStartLoc = this.startLoc;
    var exprList = [], first = true, lastIsComma = false;
    var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
    this.yieldPos = 0;
    this.awaitPos = 0;
    // Do not save awaitIdentPos to allow checking awaits nested in parameters
    while (this.type !== types$1.parenR) {
      first ? first = false : this.expect(types$1.comma);
      if (allowTrailingComma && this.afterTrailingComma(types$1.parenR, true)) {
        lastIsComma = true;
        break
      } else if (this.type === types$1.ellipsis) {
        spreadStart = this.start;
        exprList.push(this.parseParenItem(this.parseRestBinding()));
        if (this.type === types$1.comma) { this.raise(this.start, "Comma is not permitted after the rest element"); }
        break
      } else {
        exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
      }
    }
    var innerEndPos = this.lastTokEnd, innerEndLoc = this.lastTokEndLoc;
    this.expect(types$1.parenR);

    if (canBeArrow && !this.canInsertSemicolon() && this.eat(types$1.arrow)) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      return this.parseParenArrowList(startPos, startLoc, exprList, forInit)
    }

    if (!exprList.length || lastIsComma) { this.unexpected(this.lastTokStart); }
    if (spreadStart) { this.unexpected(spreadStart); }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }
  } else {
    val = this.parseParenExpression();
  }

  if (this.options.preserveParens) {
    var par = this.startNodeAt(startPos, startLoc);
    par.expression = val;
    return this.finishNode(par, "ParenthesizedExpression")
  } else {
    return val
  }
};

pp$5.parseParenItem = function(item) {
  return item
};

pp$5.parseParenArrowList = function(startPos, startLoc, exprList, forInit) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, false, forInit)
};

// New's precedence is slightly tricky. It must allow its argument to
// be a `[]` or dot subscript expression, but not a call — at least,
// not without wrapping it in parentheses. Thus, it uses the noCalls
// argument to parseSubscripts to prevent it from consuming the
// argument list.

var empty = [];

pp$5.parseNew = function() {
  if (this.containsEsc) { this.raiseRecoverable(this.start, "Escape sequence in keyword new"); }
  var node = this.startNode();
  var meta = this.parseIdent(true);
  if (this.options.ecmaVersion >= 6 && this.eat(types$1.dot)) {
    node.meta = meta;
    var containsEsc = this.containsEsc;
    node.property = this.parseIdent(true);
    if (node.property.name !== "target")
      { this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'"); }
    if (containsEsc)
      { this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters"); }
    if (!this.allowNewDotTarget)
      { this.raiseRecoverable(node.start, "'new.target' can only be used in functions and class static block"); }
    return this.finishNode(node, "MetaProperty")
  }
  var startPos = this.start, startLoc = this.startLoc, isImport = this.type === types$1._import;
  node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true, false);
  if (isImport && node.callee.type === "ImportExpression") {
    this.raise(startPos, "Cannot use new with import()");
  }
  if (this.eat(types$1.parenL)) { node.arguments = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false); }
  else { node.arguments = empty; }
  return this.finishNode(node, "NewExpression")
};

// Parse template expression.

pp$5.parseTemplateElement = function(ref) {
  var isTagged = ref.isTagged;

  var elem = this.startNode();
  if (this.type === types$1.invalidTemplate) {
    if (!isTagged) {
      this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
    }
    elem.value = {
      raw: this.value,
      cooked: null
    };
  } else {
    elem.value = {
      raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
      cooked: this.value
    };
  }
  this.next();
  elem.tail = this.type === types$1.backQuote;
  return this.finishNode(elem, "TemplateElement")
};

pp$5.parseTemplate = function(ref) {
  if ( ref === void 0 ) ref = {};
  var isTagged = ref.isTagged; if ( isTagged === void 0 ) isTagged = false;

  var node = this.startNode();
  this.next();
  node.expressions = [];
  var curElt = this.parseTemplateElement({isTagged: isTagged});
  node.quasis = [curElt];
  while (!curElt.tail) {
    if (this.type === types$1.eof) { this.raise(this.pos, "Unterminated template literal"); }
    this.expect(types$1.dollarBraceL);
    node.expressions.push(this.parseExpression());
    this.expect(types$1.braceR);
    node.quasis.push(curElt = this.parseTemplateElement({isTagged: isTagged}));
  }
  this.next();
  return this.finishNode(node, "TemplateLiteral")
};

pp$5.isAsyncProp = function(prop) {
  return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" &&
    (this.type === types$1.name || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword || (this.options.ecmaVersion >= 9 && this.type === types$1.star)) &&
    !lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
};

// Parse an object literal or binding pattern.

pp$5.parseObj = function(isPattern, refDestructuringErrors) {
  var node = this.startNode(), first = true, propHash = {};
  node.properties = [];
  this.next();
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types$1.braceR)) { break }
    } else { first = false; }

    var prop = this.parseProperty(isPattern, refDestructuringErrors);
    if (!isPattern) { this.checkPropClash(prop, propHash, refDestructuringErrors); }
    node.properties.push(prop);
  }
  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression")
};

pp$5.parseProperty = function(isPattern, refDestructuringErrors) {
  var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
  if (this.options.ecmaVersion >= 9 && this.eat(types$1.ellipsis)) {
    if (isPattern) {
      prop.argument = this.parseIdent(false);
      if (this.type === types$1.comma) {
        this.raise(this.start, "Comma is not permitted after the rest element");
      }
      return this.finishNode(prop, "RestElement")
    }
    // Parse argument.
    prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    // To disallow trailing comma via `this.toAssignable()`.
    if (this.type === types$1.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
      refDestructuringErrors.trailingComma = this.start;
    }
    // Finish
    return this.finishNode(prop, "SpreadElement")
  }
  if (this.options.ecmaVersion >= 6) {
    prop.method = false;
    prop.shorthand = false;
    if (isPattern || refDestructuringErrors) {
      startPos = this.start;
      startLoc = this.startLoc;
    }
    if (!isPattern)
      { isGenerator = this.eat(types$1.star); }
  }
  var containsEsc = this.containsEsc;
  this.parsePropertyName(prop);
  if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
    isAsync = true;
    isGenerator = this.options.ecmaVersion >= 9 && this.eat(types$1.star);
    this.parsePropertyName(prop, refDestructuringErrors);
  } else {
    isAsync = false;
  }
  this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
  return this.finishNode(prop, "Property")
};

pp$5.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
  if ((isGenerator || isAsync) && this.type === types$1.colon)
    { this.unexpected(); }

  if (this.eat(types$1.colon)) {
    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
    prop.kind = "init";
  } else if (this.options.ecmaVersion >= 6 && this.type === types$1.parenL) {
    if (isPattern) { this.unexpected(); }
    prop.kind = "init";
    prop.method = true;
    prop.value = this.parseMethod(isGenerator, isAsync);
  } else if (!isPattern && !containsEsc &&
             this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" &&
             (prop.key.name === "get" || prop.key.name === "set") &&
             (this.type !== types$1.comma && this.type !== types$1.braceR && this.type !== types$1.eq)) {
    if (isGenerator || isAsync) { this.unexpected(); }
    prop.kind = prop.key.name;
    this.parsePropertyName(prop);
    prop.value = this.parseMethod(false);
    var paramCount = prop.kind === "get" ? 0 : 1;
    if (prop.value.params.length !== paramCount) {
      var start = prop.value.start;
      if (prop.kind === "get")
        { this.raiseRecoverable(start, "getter should have no params"); }
      else
        { this.raiseRecoverable(start, "setter should have exactly one param"); }
    } else {
      if (prop.kind === "set" && prop.value.params[0].type === "RestElement")
        { this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params"); }
    }
  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
    if (isGenerator || isAsync) { this.unexpected(); }
    this.checkUnreserved(prop.key);
    if (prop.key.name === "await" && !this.awaitIdentPos)
      { this.awaitIdentPos = startPos; }
    prop.kind = "init";
    if (isPattern) {
      prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
    } else if (this.type === types$1.eq && refDestructuringErrors) {
      if (refDestructuringErrors.shorthandAssign < 0)
        { refDestructuringErrors.shorthandAssign = this.start; }
      prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
    } else {
      prop.value = this.copyNode(prop.key);
    }
    prop.shorthand = true;
  } else { this.unexpected(); }
};

pp$5.parsePropertyName = function(prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(types$1.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(types$1.bracketR);
      return prop.key
    } else {
      prop.computed = false;
    }
  }
  return prop.key = this.type === types$1.num || this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never")
};

// Initialize empty function node.

pp$5.initFunction = function(node) {
  node.id = null;
  if (this.options.ecmaVersion >= 6) { node.generator = node.expression = false; }
  if (this.options.ecmaVersion >= 8) { node.async = false; }
};

// Parse object or class method.

pp$5.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
  var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;

  this.initFunction(node);
  if (this.options.ecmaVersion >= 6)
    { node.generator = isGenerator; }
  if (this.options.ecmaVersion >= 8)
    { node.async = !!isAsync; }

  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));

  this.expect(types$1.parenL);
  node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
  this.parseFunctionBody(node, false, true, false);

  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "FunctionExpression")
};

// Parse arrow function expression with given parameters.

pp$5.parseArrowExpression = function(node, params, isAsync, forInit) {
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;

  this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
  this.initFunction(node);
  if (this.options.ecmaVersion >= 8) { node.async = !!isAsync; }

  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;

  node.params = this.toAssignableList(params, true);
  this.parseFunctionBody(node, true, false, forInit);

  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "ArrowFunctionExpression")
};

// Parse function body and check parameters.

pp$5.parseFunctionBody = function(node, isArrowFunction, isMethod, forInit) {
  var isExpression = isArrowFunction && this.type !== types$1.braceL;
  var oldStrict = this.strict, useStrict = false;

  if (isExpression) {
    node.body = this.parseMaybeAssign(forInit);
    node.expression = true;
    this.checkParams(node, false);
  } else {
    var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
    if (!oldStrict || nonSimple) {
      useStrict = this.strictDirective(this.end);
      // If this is a strict mode function, verify that argument names
      // are not repeated, and it does not try to bind the words `eval`
      // or `arguments`.
      if (useStrict && nonSimple)
        { this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list"); }
    }
    // Start a new scope with regard to labels and the `inFunction`
    // flag (restore them to their old value afterwards).
    var oldLabels = this.labels;
    this.labels = [];
    if (useStrict) { this.strict = true; }

    // Add the params to varDeclaredNames to ensure that an error is thrown
    // if a let/const declaration in the function clashes with one of the params.
    this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
    // Ensure the function name isn't a forbidden identifier in strict mode, e.g. 'eval'
    if (this.strict && node.id) { this.checkLValSimple(node.id, BIND_OUTSIDE); }
    node.body = this.parseBlock(false, undefined, useStrict && !oldStrict);
    node.expression = false;
    this.adaptDirectivePrologue(node.body.body);
    this.labels = oldLabels;
  }
  this.exitScope();
};

pp$5.isSimpleParamList = function(params) {
  for (var i = 0, list = params; i < list.length; i += 1)
    {
    var param = list[i];

    if (param.type !== "Identifier") { return false
  } }
  return true
};

// Checks function params for various disallowed patterns such as using "eval"
// or "arguments" and duplicate parameters.

pp$5.checkParams = function(node, allowDuplicates) {
  var nameHash = Object.create(null);
  for (var i = 0, list = node.params; i < list.length; i += 1)
    {
    var param = list[i];

    this.checkLValInnerPattern(param, BIND_VAR, allowDuplicates ? null : nameHash);
  }
};

// Parses a comma-separated list of expressions, and returns them as
// an array. `close` is the token type that ends the list, and
// `allowEmpty` can be turned on to allow subsequent commas with
// nothing in between them to be parsed as `null` (which is needed
// for array literals).

pp$5.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
  var elts = [], first = true;
  while (!this.eat(close)) {
    if (!first) {
      this.expect(types$1.comma);
      if (allowTrailingComma && this.afterTrailingComma(close)) { break }
    } else { first = false; }

    var elt = (void 0);
    if (allowEmpty && this.type === types$1.comma)
      { elt = null; }
    else if (this.type === types$1.ellipsis) {
      elt = this.parseSpread(refDestructuringErrors);
      if (refDestructuringErrors && this.type === types$1.comma && refDestructuringErrors.trailingComma < 0)
        { refDestructuringErrors.trailingComma = this.start; }
    } else {
      elt = this.parseMaybeAssign(false, refDestructuringErrors);
    }
    elts.push(elt);
  }
  return elts
};

pp$5.checkUnreserved = function(ref) {
  var start = ref.start;
  var end = ref.end;
  var name = ref.name;

  if (this.inGenerator && name === "yield")
    { this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator"); }
  if (this.inAsync && name === "await")
    { this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function"); }
  if (this.currentThisScope().inClassFieldInit && name === "arguments")
    { this.raiseRecoverable(start, "Cannot use 'arguments' in class field initializer"); }
  if (this.inClassStaticBlock && (name === "arguments" || name === "await"))
    { this.raise(start, ("Cannot use " + name + " in class static initialization block")); }
  if (this.keywords.test(name))
    { this.raise(start, ("Unexpected keyword '" + name + "'")); }
  if (this.options.ecmaVersion < 6 &&
    this.input.slice(start, end).indexOf("\\") !== -1) { return }
  var re = this.strict ? this.reservedWordsStrict : this.reservedWords;
  if (re.test(name)) {
    if (!this.inAsync && name === "await")
      { this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function"); }
    this.raiseRecoverable(start, ("The keyword '" + name + "' is reserved"));
  }
};

// Parse the next token as an identifier. If `liberal` is true (used
// when parsing properties), it will also convert keywords into
// identifiers.

pp$5.parseIdent = function(liberal, isBinding) {
  var node = this.startNode();
  if (this.type === types$1.name) {
    node.name = this.value;
  } else if (this.type.keyword) {
    node.name = this.type.keyword;

    // To fix https://github.com/acornjs/acorn/issues/575
    // `class` and `function` keywords push new context into this.context.
    // But there is no chance to pop the context if the keyword is consumed as an identifier such as a property name.
    // If the previous token is a dot, this does not apply because the context-managing code already ignored the keyword
    if ((node.name === "class" || node.name === "function") &&
        (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
      this.context.pop();
    }
  } else {
    this.unexpected();
  }
  this.next(!!liberal);
  this.finishNode(node, "Identifier");
  if (!liberal) {
    this.checkUnreserved(node);
    if (node.name === "await" && !this.awaitIdentPos)
      { this.awaitIdentPos = node.start; }
  }
  return node
};

pp$5.parsePrivateIdent = function() {
  var node = this.startNode();
  if (this.type === types$1.privateId) {
    node.name = this.value;
  } else {
    this.unexpected();
  }
  this.next();
  this.finishNode(node, "PrivateIdentifier");

  // For validating existence
  if (this.privateNameStack.length === 0) {
    this.raise(node.start, ("Private field '#" + (node.name) + "' must be declared in an enclosing class"));
  } else {
    this.privateNameStack[this.privateNameStack.length - 1].used.push(node);
  }

  return node
};

// Parses yield expression inside generator.

pp$5.parseYield = function(forInit) {
  if (!this.yieldPos) { this.yieldPos = this.start; }

  var node = this.startNode();
  this.next();
  if (this.type === types$1.semi || this.canInsertSemicolon() || (this.type !== types$1.star && !this.type.startsExpr)) {
    node.delegate = false;
    node.argument = null;
  } else {
    node.delegate = this.eat(types$1.star);
    node.argument = this.parseMaybeAssign(forInit);
  }
  return this.finishNode(node, "YieldExpression")
};

pp$5.parseAwait = function(forInit) {
  if (!this.awaitPos) { this.awaitPos = this.start; }

  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeUnary(null, true, false, forInit);
  return this.finishNode(node, "AwaitExpression")
};

var pp$4 = Parser.prototype;

// This function is used to raise exceptions on parse errors. It
// takes an offset integer (into the current `input`) to indicate
// the location of the error, attaches the position to the end
// of the error message, and then raises a `SyntaxError` with that
// message.

pp$4.raise = function(pos, message) {
  var loc = getLineInfo(this.input, pos);
  message += " (" + loc.line + ":" + loc.column + ")";
  var err = new SyntaxError(message);
  err.pos = pos; err.loc = loc; err.raisedAt = this.pos;
  throw err
};

pp$4.raiseRecoverable = pp$4.raise;

pp$4.curPosition = function() {
  if (this.options.locations) {
    return new Position(this.curLine, this.pos - this.lineStart)
  }
};

var pp$3 = Parser.prototype;

var Scope = function Scope(flags) {
  this.flags = flags;
  // A list of var-declared names in the current lexical scope
  this.var = [];
  // A list of lexically-declared names in the current lexical scope
  this.lexical = [];
  // A list of lexically-declared FunctionDeclaration names in the current lexical scope
  this.functions = [];
  // A switch to disallow the identifier reference 'arguments'
  this.inClassFieldInit = false;
};

// The functions in this module keep track of declared variables in the current scope in order to detect duplicate variable names.

pp$3.enterScope = function(flags) {
  this.scopeStack.push(new Scope(flags));
};

pp$3.exitScope = function() {
  this.scopeStack.pop();
};

// The spec says:
// > At the top level of a function, or script, function declarations are
// > treated like var declarations rather than like lexical declarations.
pp$3.treatFunctionsAsVarInScope = function(scope) {
  return (scope.flags & SCOPE_FUNCTION$1) || !this.inModule && (scope.flags & SCOPE_TOP)
};

pp$3.declareName = function(name, bindingType, pos) {
  var redeclared = false;
  if (bindingType === BIND_LEXICAL) {
    var scope = this.currentScope();
    redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
    scope.lexical.push(name);
    if (this.inModule && (scope.flags & SCOPE_TOP))
      { delete this.undefinedExports[name]; }
  } else if (bindingType === BIND_SIMPLE_CATCH) {
    var scope$1 = this.currentScope();
    scope$1.lexical.push(name);
  } else if (bindingType === BIND_FUNCTION) {
    var scope$2 = this.currentScope();
    if (this.treatFunctionsAsVar)
      { redeclared = scope$2.lexical.indexOf(name) > -1; }
    else
      { redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1; }
    scope$2.functions.push(name);
  } else {
    for (var i = this.scopeStack.length - 1; i >= 0; --i) {
      var scope$3 = this.scopeStack[i];
      if (scope$3.lexical.indexOf(name) > -1 && !((scope$3.flags & SCOPE_SIMPLE_CATCH) && scope$3.lexical[0] === name) ||
          !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
        redeclared = true;
        break
      }
      scope$3.var.push(name);
      if (this.inModule && (scope$3.flags & SCOPE_TOP))
        { delete this.undefinedExports[name]; }
      if (scope$3.flags & SCOPE_VAR) { break }
    }
  }
  if (redeclared) { this.raiseRecoverable(pos, ("Identifier '" + name + "' has already been declared")); }
};

pp$3.checkLocalExport = function(id) {
  // scope.functions must be empty as Module code is always strict.
  if (this.scopeStack[0].lexical.indexOf(id.name) === -1 &&
      this.scopeStack[0].var.indexOf(id.name) === -1) {
    this.undefinedExports[id.name] = id;
  }
};

pp$3.currentScope = function() {
  return this.scopeStack[this.scopeStack.length - 1]
};

pp$3.currentVarScope = function() {
  for (var i = this.scopeStack.length - 1;; i--) {
    var scope = this.scopeStack[i];
    if (scope.flags & SCOPE_VAR) { return scope }
  }
};

// Could be useful for `this`, `new.target`, `super()`, `super.property`, and `super[property]`.
pp$3.currentThisScope = function() {
  for (var i = this.scopeStack.length - 1;; i--) {
    var scope = this.scopeStack[i];
    if (scope.flags & SCOPE_VAR && !(scope.flags & SCOPE_ARROW)) { return scope }
  }
};

var Node$1 = function Node(parser, pos, loc) {
  this.type = "";
  this.start = pos;
  this.end = 0;
  if (parser.options.locations)
    { this.loc = new SourceLocation(parser, loc); }
  if (parser.options.directSourceFile)
    { this.sourceFile = parser.options.directSourceFile; }
  if (parser.options.ranges)
    { this.range = [pos, 0]; }
};

// Start an AST node, attaching a start offset.

var pp$2 = Parser.prototype;

pp$2.startNode = function() {
  return new Node$1(this, this.start, this.startLoc)
};

pp$2.startNodeAt = function(pos, loc) {
  return new Node$1(this, pos, loc)
};

// Finish an AST node, adding `type` and `end` properties.

function finishNodeAt(node, type, pos, loc) {
  node.type = type;
  node.end = pos;
  if (this.options.locations)
    { node.loc.end = loc; }
  if (this.options.ranges)
    { node.range[1] = pos; }
  return node
}

pp$2.finishNode = function(node, type) {
  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc)
};

// Finish node at given position

pp$2.finishNodeAt = function(node, type, pos, loc) {
  return finishNodeAt.call(this, node, type, pos, loc)
};

pp$2.copyNode = function(node) {
  var newNode = new Node$1(this, node.start, this.startLoc);
  for (var prop in node) { newNode[prop] = node[prop]; }
  return newNode
};

// This file contains Unicode properties extracted from the ECMAScript
// specification. The lists are extracted like so:
// $$('#table-binary-unicode-properties > figure > table > tbody > tr > td:nth-child(1) code').map(el => el.innerText)

// #table-binary-unicode-properties
var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
var ecma11BinaryProperties = ecma10BinaryProperties;
var ecma12BinaryProperties = ecma11BinaryProperties + " EBase EComp EMod EPres ExtPict";
var ecma13BinaryProperties = ecma12BinaryProperties;
var unicodeBinaryProperties = {
  9: ecma9BinaryProperties,
  10: ecma10BinaryProperties,
  11: ecma11BinaryProperties,
  12: ecma12BinaryProperties,
  13: ecma13BinaryProperties
};

// #table-unicode-general-category-values
var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";

// #table-unicode-script-values
var ecma9ScriptValues = "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
var ecma12ScriptValues = ecma11ScriptValues + " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi";
var ecma13ScriptValues = ecma12ScriptValues + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith";
var unicodeScriptValues = {
  9: ecma9ScriptValues,
  10: ecma10ScriptValues,
  11: ecma11ScriptValues,
  12: ecma12ScriptValues,
  13: ecma13ScriptValues
};

var data = {};
function buildUnicodeData(ecmaVersion) {
  var d = data[ecmaVersion] = {
    binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion] + " " + unicodeGeneralCategoryValues),
    nonBinary: {
      General_Category: wordsRegexp(unicodeGeneralCategoryValues),
      Script: wordsRegexp(unicodeScriptValues[ecmaVersion])
    }
  };
  d.nonBinary.Script_Extensions = d.nonBinary.Script;

  d.nonBinary.gc = d.nonBinary.General_Category;
  d.nonBinary.sc = d.nonBinary.Script;
  d.nonBinary.scx = d.nonBinary.Script_Extensions;
}

for (var i = 0, list = [9, 10, 11, 12, 13]; i < list.length; i += 1) {
  var ecmaVersion = list[i];

  buildUnicodeData(ecmaVersion);
}

var pp$1 = Parser.prototype;

var RegExpValidationState = function RegExpValidationState(parser) {
  this.parser = parser;
  this.validFlags = "gim" + (parser.options.ecmaVersion >= 6 ? "uy" : "") + (parser.options.ecmaVersion >= 9 ? "s" : "") + (parser.options.ecmaVersion >= 13 ? "d" : "");
  this.unicodeProperties = data[parser.options.ecmaVersion >= 13 ? 13 : parser.options.ecmaVersion];
  this.source = "";
  this.flags = "";
  this.start = 0;
  this.switchU = false;
  this.switchN = false;
  this.pos = 0;
  this.lastIntValue = 0;
  this.lastStringValue = "";
  this.lastAssertionIsQuantifiable = false;
  this.numCapturingParens = 0;
  this.maxBackReference = 0;
  this.groupNames = [];
  this.backReferenceNames = [];
};

RegExpValidationState.prototype.reset = function reset (start, pattern, flags) {
  var unicode = flags.indexOf("u") !== -1;
  this.start = start | 0;
  this.source = pattern + "";
  this.flags = flags;
  this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
  this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
};

RegExpValidationState.prototype.raise = function raise (message) {
  this.parser.raiseRecoverable(this.start, ("Invalid regular expression: /" + (this.source) + "/: " + message));
};

// If u flag is given, this returns the code point at the index (it combines a surrogate pair).
// Otherwise, this returns the code unit of the index (can be a part of a surrogate pair).
RegExpValidationState.prototype.at = function at (i, forceU) {
    if ( forceU === void 0 ) forceU = false;

  var s = this.source;
  var l = s.length;
  if (i >= l) {
    return -1
  }
  var c = s.charCodeAt(i);
  if (!(forceU || this.switchU) || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l) {
    return c
  }
  var next = s.charCodeAt(i + 1);
  return next >= 0xDC00 && next <= 0xDFFF ? (c << 10) + next - 0x35FDC00 : c
};

RegExpValidationState.prototype.nextIndex = function nextIndex (i, forceU) {
    if ( forceU === void 0 ) forceU = false;

  var s = this.source;
  var l = s.length;
  if (i >= l) {
    return l
  }
  var c = s.charCodeAt(i), next;
  if (!(forceU || this.switchU) || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l ||
      (next = s.charCodeAt(i + 1)) < 0xDC00 || next > 0xDFFF) {
    return i + 1
  }
  return i + 2
};

RegExpValidationState.prototype.current = function current (forceU) {
    if ( forceU === void 0 ) forceU = false;

  return this.at(this.pos, forceU)
};

RegExpValidationState.prototype.lookahead = function lookahead (forceU) {
    if ( forceU === void 0 ) forceU = false;

  return this.at(this.nextIndex(this.pos, forceU), forceU)
};

RegExpValidationState.prototype.advance = function advance (forceU) {
    if ( forceU === void 0 ) forceU = false;

  this.pos = this.nextIndex(this.pos, forceU);
};

RegExpValidationState.prototype.eat = function eat (ch, forceU) {
    if ( forceU === void 0 ) forceU = false;

  if (this.current(forceU) === ch) {
    this.advance(forceU);
    return true
  }
  return false
};

/**
 * Validate the flags part of a given RegExpLiteral.
 *
 * @param {RegExpValidationState} state The state to validate RegExp.
 * @returns {void}
 */
pp$1.validateRegExpFlags = function(state) {
  var validFlags = state.validFlags;
  var flags = state.flags;

  for (var i = 0; i < flags.length; i++) {
    var flag = flags.charAt(i);
    if (validFlags.indexOf(flag) === -1) {
      this.raise(state.start, "Invalid regular expression flag");
    }
    if (flags.indexOf(flag, i + 1) > -1) {
      this.raise(state.start, "Duplicate regular expression flag");
    }
  }
};

/**
 * Validate the pattern part of a given RegExpLiteral.
 *
 * @param {RegExpValidationState} state The state to validate RegExp.
 * @returns {void}
 */
pp$1.validateRegExpPattern = function(state) {
  this.regexp_pattern(state);

  // The goal symbol for the parse is |Pattern[~U, ~N]|. If the result of
  // parsing contains a |GroupName|, reparse with the goal symbol
  // |Pattern[~U, +N]| and use this result instead. Throw a *SyntaxError*
  // exception if _P_ did not conform to the grammar, if any elements of _P_
  // were not matched by the parse, or if any Early Error conditions exist.
  if (!state.switchN && this.options.ecmaVersion >= 9 && state.groupNames.length > 0) {
    state.switchN = true;
    this.regexp_pattern(state);
  }
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-Pattern
pp$1.regexp_pattern = function(state) {
  state.pos = 0;
  state.lastIntValue = 0;
  state.lastStringValue = "";
  state.lastAssertionIsQuantifiable = false;
  state.numCapturingParens = 0;
  state.maxBackReference = 0;
  state.groupNames.length = 0;
  state.backReferenceNames.length = 0;

  this.regexp_disjunction(state);

  if (state.pos !== state.source.length) {
    // Make the same messages as V8.
    if (state.eat(0x29 /* ) */)) {
      state.raise("Unmatched ')'");
    }
    if (state.eat(0x5D /* ] */) || state.eat(0x7D /* } */)) {
      state.raise("Lone quantifier brackets");
    }
  }
  if (state.maxBackReference > state.numCapturingParens) {
    state.raise("Invalid escape");
  }
  for (var i = 0, list = state.backReferenceNames; i < list.length; i += 1) {
    var name = list[i];

    if (state.groupNames.indexOf(name) === -1) {
      state.raise("Invalid named capture referenced");
    }
  }
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-Disjunction
pp$1.regexp_disjunction = function(state) {
  this.regexp_alternative(state);
  while (state.eat(0x7C /* | */)) {
    this.regexp_alternative(state);
  }

  // Make the same message as V8.
  if (this.regexp_eatQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  if (state.eat(0x7B /* { */)) {
    state.raise("Lone quantifier brackets");
  }
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-Alternative
pp$1.regexp_alternative = function(state) {
  while (state.pos < state.source.length && this.regexp_eatTerm(state))
    { }
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Term
pp$1.regexp_eatTerm = function(state) {
  if (this.regexp_eatAssertion(state)) {
    // Handle `QuantifiableAssertion Quantifier` alternative.
    // `state.lastAssertionIsQuantifiable` is true if the last eaten Assertion
    // is a QuantifiableAssertion.
    if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
      // Make the same message as V8.
      if (state.switchU) {
        state.raise("Invalid quantifier");
      }
    }
    return true
  }

  if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
    this.regexp_eatQuantifier(state);
    return true
  }

  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Assertion
pp$1.regexp_eatAssertion = function(state) {
  var start = state.pos;
  state.lastAssertionIsQuantifiable = false;

  // ^, $
  if (state.eat(0x5E /* ^ */) || state.eat(0x24 /* $ */)) {
    return true
  }

  // \b \B
  if (state.eat(0x5C /* \ */)) {
    if (state.eat(0x42 /* B */) || state.eat(0x62 /* b */)) {
      return true
    }
    state.pos = start;
  }

  // Lookahead / Lookbehind
  if (state.eat(0x28 /* ( */) && state.eat(0x3F /* ? */)) {
    var lookbehind = false;
    if (this.options.ecmaVersion >= 9) {
      lookbehind = state.eat(0x3C /* < */);
    }
    if (state.eat(0x3D /* = */) || state.eat(0x21 /* ! */)) {
      this.regexp_disjunction(state);
      if (!state.eat(0x29 /* ) */)) {
        state.raise("Unterminated group");
      }
      state.lastAssertionIsQuantifiable = !lookbehind;
      return true
    }
  }

  state.pos = start;
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-Quantifier
pp$1.regexp_eatQuantifier = function(state, noError) {
  if ( noError === void 0 ) noError = false;

  if (this.regexp_eatQuantifierPrefix(state, noError)) {
    state.eat(0x3F /* ? */);
    return true
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-QuantifierPrefix
pp$1.regexp_eatQuantifierPrefix = function(state, noError) {
  return (
    state.eat(0x2A /* * */) ||
    state.eat(0x2B /* + */) ||
    state.eat(0x3F /* ? */) ||
    this.regexp_eatBracedQuantifier(state, noError)
  )
};
pp$1.regexp_eatBracedQuantifier = function(state, noError) {
  var start = state.pos;
  if (state.eat(0x7B /* { */)) {
    var min = 0, max = -1;
    if (this.regexp_eatDecimalDigits(state)) {
      min = state.lastIntValue;
      if (state.eat(0x2C /* , */) && this.regexp_eatDecimalDigits(state)) {
        max = state.lastIntValue;
      }
      if (state.eat(0x7D /* } */)) {
        // SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-term
        if (max !== -1 && max < min && !noError) {
          state.raise("numbers out of order in {} quantifier");
        }
        return true
      }
    }
    if (state.switchU && !noError) {
      state.raise("Incomplete quantifier");
    }
    state.pos = start;
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-Atom
pp$1.regexp_eatAtom = function(state) {
  return (
    this.regexp_eatPatternCharacters(state) ||
    state.eat(0x2E /* . */) ||
    this.regexp_eatReverseSolidusAtomEscape(state) ||
    this.regexp_eatCharacterClass(state) ||
    this.regexp_eatUncapturingGroup(state) ||
    this.regexp_eatCapturingGroup(state)
  )
};
pp$1.regexp_eatReverseSolidusAtomEscape = function(state) {
  var start = state.pos;
  if (state.eat(0x5C /* \ */)) {
    if (this.regexp_eatAtomEscape(state)) {
      return true
    }
    state.pos = start;
  }
  return false
};
pp$1.regexp_eatUncapturingGroup = function(state) {
  var start = state.pos;
  if (state.eat(0x28 /* ( */)) {
    if (state.eat(0x3F /* ? */) && state.eat(0x3A /* : */)) {
      this.regexp_disjunction(state);
      if (state.eat(0x29 /* ) */)) {
        return true
      }
      state.raise("Unterminated group");
    }
    state.pos = start;
  }
  return false
};
pp$1.regexp_eatCapturingGroup = function(state) {
  if (state.eat(0x28 /* ( */)) {
    if (this.options.ecmaVersion >= 9) {
      this.regexp_groupSpecifier(state);
    } else if (state.current() === 0x3F /* ? */) {
      state.raise("Invalid group");
    }
    this.regexp_disjunction(state);
    if (state.eat(0x29 /* ) */)) {
      state.numCapturingParens += 1;
      return true
    }
    state.raise("Unterminated group");
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedAtom
pp$1.regexp_eatExtendedAtom = function(state) {
  return (
    state.eat(0x2E /* . */) ||
    this.regexp_eatReverseSolidusAtomEscape(state) ||
    this.regexp_eatCharacterClass(state) ||
    this.regexp_eatUncapturingGroup(state) ||
    this.regexp_eatCapturingGroup(state) ||
    this.regexp_eatInvalidBracedQuantifier(state) ||
    this.regexp_eatExtendedPatternCharacter(state)
  )
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-InvalidBracedQuantifier
pp$1.regexp_eatInvalidBracedQuantifier = function(state) {
  if (this.regexp_eatBracedQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-SyntaxCharacter
pp$1.regexp_eatSyntaxCharacter = function(state) {
  var ch = state.current();
  if (isSyntaxCharacter(ch)) {
    state.lastIntValue = ch;
    state.advance();
    return true
  }
  return false
};
function isSyntaxCharacter(ch) {
  return (
    ch === 0x24 /* $ */ ||
    ch >= 0x28 /* ( */ && ch <= 0x2B /* + */ ||
    ch === 0x2E /* . */ ||
    ch === 0x3F /* ? */ ||
    ch >= 0x5B /* [ */ && ch <= 0x5E /* ^ */ ||
    ch >= 0x7B /* { */ && ch <= 0x7D /* } */
  )
}

// https://www.ecma-international.org/ecma-262/8.0/#prod-PatternCharacter
// But eat eager.
pp$1.regexp_eatPatternCharacters = function(state) {
  var start = state.pos;
  var ch = 0;
  while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {
    state.advance();
  }
  return state.pos !== start
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedPatternCharacter
pp$1.regexp_eatExtendedPatternCharacter = function(state) {
  var ch = state.current();
  if (
    ch !== -1 &&
    ch !== 0x24 /* $ */ &&
    !(ch >= 0x28 /* ( */ && ch <= 0x2B /* + */) &&
    ch !== 0x2E /* . */ &&
    ch !== 0x3F /* ? */ &&
    ch !== 0x5B /* [ */ &&
    ch !== 0x5E /* ^ */ &&
    ch !== 0x7C /* | */
  ) {
    state.advance();
    return true
  }
  return false
};

// GroupSpecifier ::
//   [empty]
//   `?` GroupName
pp$1.regexp_groupSpecifier = function(state) {
  if (state.eat(0x3F /* ? */)) {
    if (this.regexp_eatGroupName(state)) {
      if (state.groupNames.indexOf(state.lastStringValue) !== -1) {
        state.raise("Duplicate capture group name");
      }
      state.groupNames.push(state.lastStringValue);
      return
    }
    state.raise("Invalid group");
  }
};

// GroupName ::
//   `<` RegExpIdentifierName `>`
// Note: this updates `state.lastStringValue` property with the eaten name.
pp$1.regexp_eatGroupName = function(state) {
  state.lastStringValue = "";
  if (state.eat(0x3C /* < */)) {
    if (this.regexp_eatRegExpIdentifierName(state) && state.eat(0x3E /* > */)) {
      return true
    }
    state.raise("Invalid capture group name");
  }
  return false
};

// RegExpIdentifierName ::
//   RegExpIdentifierStart
//   RegExpIdentifierName RegExpIdentifierPart
// Note: this updates `state.lastStringValue` property with the eaten name.
pp$1.regexp_eatRegExpIdentifierName = function(state) {
  state.lastStringValue = "";
  if (this.regexp_eatRegExpIdentifierStart(state)) {
    state.lastStringValue += codePointToString(state.lastIntValue);
    while (this.regexp_eatRegExpIdentifierPart(state)) {
      state.lastStringValue += codePointToString(state.lastIntValue);
    }
    return true
  }
  return false
};

// RegExpIdentifierStart ::
//   UnicodeIDStart
//   `$`
//   `_`
//   `\` RegExpUnicodeEscapeSequence[+U]
pp$1.regexp_eatRegExpIdentifierStart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch = state.current(forceU);
  state.advance(forceU);

  if (ch === 0x5C /* \ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch = state.lastIntValue;
  }
  if (isRegExpIdentifierStart(ch)) {
    state.lastIntValue = ch;
    return true
  }

  state.pos = start;
  return false
};
function isRegExpIdentifierStart(ch) {
  return isIdentifierStart(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */
}

// RegExpIdentifierPart ::
//   UnicodeIDContinue
//   `$`
//   `_`
//   `\` RegExpUnicodeEscapeSequence[+U]
//   <ZWNJ>
//   <ZWJ>
pp$1.regexp_eatRegExpIdentifierPart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch = state.current(forceU);
  state.advance(forceU);

  if (ch === 0x5C /* \ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch = state.lastIntValue;
  }
  if (isRegExpIdentifierPart(ch)) {
    state.lastIntValue = ch;
    return true
  }

  state.pos = start;
  return false
};
function isRegExpIdentifierPart(ch) {
  return isIdentifierChar(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */ || ch === 0x200C /* <ZWNJ> */ || ch === 0x200D /* <ZWJ> */
}

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-AtomEscape
pp$1.regexp_eatAtomEscape = function(state) {
  if (
    this.regexp_eatBackReference(state) ||
    this.regexp_eatCharacterClassEscape(state) ||
    this.regexp_eatCharacterEscape(state) ||
    (state.switchN && this.regexp_eatKGroupName(state))
  ) {
    return true
  }
  if (state.switchU) {
    // Make the same message as V8.
    if (state.current() === 0x63 /* c */) {
      state.raise("Invalid unicode escape");
    }
    state.raise("Invalid escape");
  }
  return false
};
pp$1.regexp_eatBackReference = function(state) {
  var start = state.pos;
  if (this.regexp_eatDecimalEscape(state)) {
    var n = state.lastIntValue;
    if (state.switchU) {
      // For SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-atomescape
      if (n > state.maxBackReference) {
        state.maxBackReference = n;
      }
      return true
    }
    if (n <= state.numCapturingParens) {
      return true
    }
    state.pos = start;
  }
  return false
};
pp$1.regexp_eatKGroupName = function(state) {
  if (state.eat(0x6B /* k */)) {
    if (this.regexp_eatGroupName(state)) {
      state.backReferenceNames.push(state.lastStringValue);
      return true
    }
    state.raise("Invalid named reference");
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-CharacterEscape
pp$1.regexp_eatCharacterEscape = function(state) {
  return (
    this.regexp_eatControlEscape(state) ||
    this.regexp_eatCControlLetter(state) ||
    this.regexp_eatZero(state) ||
    this.regexp_eatHexEscapeSequence(state) ||
    this.regexp_eatRegExpUnicodeEscapeSequence(state, false) ||
    (!state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state)) ||
    this.regexp_eatIdentityEscape(state)
  )
};
pp$1.regexp_eatCControlLetter = function(state) {
  var start = state.pos;
  if (state.eat(0x63 /* c */)) {
    if (this.regexp_eatControlLetter(state)) {
      return true
    }
    state.pos = start;
  }
  return false
};
pp$1.regexp_eatZero = function(state) {
  if (state.current() === 0x30 /* 0 */ && !isDecimalDigit(state.lookahead())) {
    state.lastIntValue = 0;
    state.advance();
    return true
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-ControlEscape
pp$1.regexp_eatControlEscape = function(state) {
  var ch = state.current();
  if (ch === 0x74 /* t */) {
    state.lastIntValue = 0x09; /* \t */
    state.advance();
    return true
  }
  if (ch === 0x6E /* n */) {
    state.lastIntValue = 0x0A; /* \n */
    state.advance();
    return true
  }
  if (ch === 0x76 /* v */) {
    state.lastIntValue = 0x0B; /* \v */
    state.advance();
    return true
  }
  if (ch === 0x66 /* f */) {
    state.lastIntValue = 0x0C; /* \f */
    state.advance();
    return true
  }
  if (ch === 0x72 /* r */) {
    state.lastIntValue = 0x0D; /* \r */
    state.advance();
    return true
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-ControlLetter
pp$1.regexp_eatControlLetter = function(state) {
  var ch = state.current();
  if (isControlLetter(ch)) {
    state.lastIntValue = ch % 0x20;
    state.advance();
    return true
  }
  return false
};
function isControlLetter(ch) {
  return (
    (ch >= 0x41 /* A */ && ch <= 0x5A /* Z */) ||
    (ch >= 0x61 /* a */ && ch <= 0x7A /* z */)
  )
}

// https://www.ecma-international.org/ecma-262/8.0/#prod-RegExpUnicodeEscapeSequence
pp$1.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
  if ( forceU === void 0 ) forceU = false;

  var start = state.pos;
  var switchU = forceU || state.switchU;

  if (state.eat(0x75 /* u */)) {
    if (this.regexp_eatFixedHexDigits(state, 4)) {
      var lead = state.lastIntValue;
      if (switchU && lead >= 0xD800 && lead <= 0xDBFF) {
        var leadSurrogateEnd = state.pos;
        if (state.eat(0x5C /* \ */) && state.eat(0x75 /* u */) && this.regexp_eatFixedHexDigits(state, 4)) {
          var trail = state.lastIntValue;
          if (trail >= 0xDC00 && trail <= 0xDFFF) {
            state.lastIntValue = (lead - 0xD800) * 0x400 + (trail - 0xDC00) + 0x10000;
            return true
          }
        }
        state.pos = leadSurrogateEnd;
        state.lastIntValue = lead;
      }
      return true
    }
    if (
      switchU &&
      state.eat(0x7B /* { */) &&
      this.regexp_eatHexDigits(state) &&
      state.eat(0x7D /* } */) &&
      isValidUnicode(state.lastIntValue)
    ) {
      return true
    }
    if (switchU) {
      state.raise("Invalid unicode escape");
    }
    state.pos = start;
  }

  return false
};
function isValidUnicode(ch) {
  return ch >= 0 && ch <= 0x10FFFF
}

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-IdentityEscape
pp$1.regexp_eatIdentityEscape = function(state) {
  if (state.switchU) {
    if (this.regexp_eatSyntaxCharacter(state)) {
      return true
    }
    if (state.eat(0x2F /* / */)) {
      state.lastIntValue = 0x2F; /* / */
      return true
    }
    return false
  }

  var ch = state.current();
  if (ch !== 0x63 /* c */ && (!state.switchN || ch !== 0x6B /* k */)) {
    state.lastIntValue = ch;
    state.advance();
    return true
  }

  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalEscape
pp$1.regexp_eatDecimalEscape = function(state) {
  state.lastIntValue = 0;
  var ch = state.current();
  if (ch >= 0x31 /* 1 */ && ch <= 0x39 /* 9 */) {
    do {
      state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);
      state.advance();
    } while ((ch = state.current()) >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */)
    return true
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClassEscape
pp$1.regexp_eatCharacterClassEscape = function(state) {
  var ch = state.current();

  if (isCharacterClassEscape(ch)) {
    state.lastIntValue = -1;
    state.advance();
    return true
  }

  if (
    state.switchU &&
    this.options.ecmaVersion >= 9 &&
    (ch === 0x50 /* P */ || ch === 0x70 /* p */)
  ) {
    state.lastIntValue = -1;
    state.advance();
    if (
      state.eat(0x7B /* { */) &&
      this.regexp_eatUnicodePropertyValueExpression(state) &&
      state.eat(0x7D /* } */)
    ) {
      return true
    }
    state.raise("Invalid property name");
  }

  return false
};
function isCharacterClassEscape(ch) {
  return (
    ch === 0x64 /* d */ ||
    ch === 0x44 /* D */ ||
    ch === 0x73 /* s */ ||
    ch === 0x53 /* S */ ||
    ch === 0x77 /* w */ ||
    ch === 0x57 /* W */
  )
}

// UnicodePropertyValueExpression ::
//   UnicodePropertyName `=` UnicodePropertyValue
//   LoneUnicodePropertyNameOrValue
pp$1.regexp_eatUnicodePropertyValueExpression = function(state) {
  var start = state.pos;

  // UnicodePropertyName `=` UnicodePropertyValue
  if (this.regexp_eatUnicodePropertyName(state) && state.eat(0x3D /* = */)) {
    var name = state.lastStringValue;
    if (this.regexp_eatUnicodePropertyValue(state)) {
      var value = state.lastStringValue;
      this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
      return true
    }
  }
  state.pos = start;

  // LoneUnicodePropertyNameOrValue
  if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
    var nameOrValue = state.lastStringValue;
    this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
    return true
  }
  return false
};
pp$1.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
  if (!hasOwn(state.unicodeProperties.nonBinary, name))
    { state.raise("Invalid property name"); }
  if (!state.unicodeProperties.nonBinary[name].test(value))
    { state.raise("Invalid property value"); }
};
pp$1.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
  if (!state.unicodeProperties.binary.test(nameOrValue))
    { state.raise("Invalid property name"); }
};

// UnicodePropertyName ::
//   UnicodePropertyNameCharacters
pp$1.regexp_eatUnicodePropertyName = function(state) {
  var ch = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyNameCharacter(ch = state.current())) {
    state.lastStringValue += codePointToString(ch);
    state.advance();
  }
  return state.lastStringValue !== ""
};
function isUnicodePropertyNameCharacter(ch) {
  return isControlLetter(ch) || ch === 0x5F /* _ */
}

// UnicodePropertyValue ::
//   UnicodePropertyValueCharacters
pp$1.regexp_eatUnicodePropertyValue = function(state) {
  var ch = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyValueCharacter(ch = state.current())) {
    state.lastStringValue += codePointToString(ch);
    state.advance();
  }
  return state.lastStringValue !== ""
};
function isUnicodePropertyValueCharacter(ch) {
  return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch)
}

// LoneUnicodePropertyNameOrValue ::
//   UnicodePropertyValueCharacters
pp$1.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
  return this.regexp_eatUnicodePropertyValue(state)
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClass
pp$1.regexp_eatCharacterClass = function(state) {
  if (state.eat(0x5B /* [ */)) {
    state.eat(0x5E /* ^ */);
    this.regexp_classRanges(state);
    if (state.eat(0x5D /* ] */)) {
      return true
    }
    // Unreachable since it threw "unterminated regular expression" error before.
    state.raise("Unterminated character class");
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassRanges
// https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRanges
// https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRangesNoDash
pp$1.regexp_classRanges = function(state) {
  while (this.regexp_eatClassAtom(state)) {
    var left = state.lastIntValue;
    if (state.eat(0x2D /* - */) && this.regexp_eatClassAtom(state)) {
      var right = state.lastIntValue;
      if (state.switchU && (left === -1 || right === -1)) {
        state.raise("Invalid character class");
      }
      if (left !== -1 && right !== -1 && left > right) {
        state.raise("Range out of order in character class");
      }
    }
  }
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtom
// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtomNoDash
pp$1.regexp_eatClassAtom = function(state) {
  var start = state.pos;

  if (state.eat(0x5C /* \ */)) {
    if (this.regexp_eatClassEscape(state)) {
      return true
    }
    if (state.switchU) {
      // Make the same message as V8.
      var ch$1 = state.current();
      if (ch$1 === 0x63 /* c */ || isOctalDigit(ch$1)) {
        state.raise("Invalid class escape");
      }
      state.raise("Invalid escape");
    }
    state.pos = start;
  }

  var ch = state.current();
  if (ch !== 0x5D /* ] */) {
    state.lastIntValue = ch;
    state.advance();
    return true
  }

  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassEscape
pp$1.regexp_eatClassEscape = function(state) {
  var start = state.pos;

  if (state.eat(0x62 /* b */)) {
    state.lastIntValue = 0x08; /* <BS> */
    return true
  }

  if (state.switchU && state.eat(0x2D /* - */)) {
    state.lastIntValue = 0x2D; /* - */
    return true
  }

  if (!state.switchU && state.eat(0x63 /* c */)) {
    if (this.regexp_eatClassControlLetter(state)) {
      return true
    }
    state.pos = start;
  }

  return (
    this.regexp_eatCharacterClassEscape(state) ||
    this.regexp_eatCharacterEscape(state)
  )
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassControlLetter
pp$1.regexp_eatClassControlLetter = function(state) {
  var ch = state.current();
  if (isDecimalDigit(ch) || ch === 0x5F /* _ */) {
    state.lastIntValue = ch % 0x20;
    state.advance();
    return true
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence
pp$1.regexp_eatHexEscapeSequence = function(state) {
  var start = state.pos;
  if (state.eat(0x78 /* x */)) {
    if (this.regexp_eatFixedHexDigits(state, 2)) {
      return true
    }
    if (state.switchU) {
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalDigits
pp$1.regexp_eatDecimalDigits = function(state) {
  var start = state.pos;
  var ch = 0;
  state.lastIntValue = 0;
  while (isDecimalDigit(ch = state.current())) {
    state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);
    state.advance();
  }
  return state.pos !== start
};
function isDecimalDigit(ch) {
  return ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */
}

// https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigits
pp$1.regexp_eatHexDigits = function(state) {
  var start = state.pos;
  var ch = 0;
  state.lastIntValue = 0;
  while (isHexDigit(ch = state.current())) {
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    state.advance();
  }
  return state.pos !== start
};
function isHexDigit(ch) {
  return (
    (ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */) ||
    (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) ||
    (ch >= 0x61 /* a */ && ch <= 0x66 /* f */)
  )
}
function hexToInt(ch) {
  if (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) {
    return 10 + (ch - 0x41 /* A */)
  }
  if (ch >= 0x61 /* a */ && ch <= 0x66 /* f */) {
    return 10 + (ch - 0x61 /* a */)
  }
  return ch - 0x30 /* 0 */
}

// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-LegacyOctalEscapeSequence
// Allows only 0-377(octal) i.e. 0-255(decimal).
pp$1.regexp_eatLegacyOctalEscapeSequence = function(state) {
  if (this.regexp_eatOctalDigit(state)) {
    var n1 = state.lastIntValue;
    if (this.regexp_eatOctalDigit(state)) {
      var n2 = state.lastIntValue;
      if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
        state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
      } else {
        state.lastIntValue = n1 * 8 + n2;
      }
    } else {
      state.lastIntValue = n1;
    }
    return true
  }
  return false
};

// https://www.ecma-international.org/ecma-262/8.0/#prod-OctalDigit
pp$1.regexp_eatOctalDigit = function(state) {
  var ch = state.current();
  if (isOctalDigit(ch)) {
    state.lastIntValue = ch - 0x30; /* 0 */
    state.advance();
    return true
  }
  state.lastIntValue = 0;
  return false
};
function isOctalDigit(ch) {
  return ch >= 0x30 /* 0 */ && ch <= 0x37 /* 7 */
}

// https://www.ecma-international.org/ecma-262/8.0/#prod-Hex4Digits
// https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigit
// And HexDigit HexDigit in https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence
pp$1.regexp_eatFixedHexDigits = function(state, length) {
  var start = state.pos;
  state.lastIntValue = 0;
  for (var i = 0; i < length; ++i) {
    var ch = state.current();
    if (!isHexDigit(ch)) {
      state.pos = start;
      return false
    }
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    state.advance();
  }
  return true
};

// Object type used to represent tokens. Note that normally, tokens
// simply exist as properties on the parser object. This is only
// used for the onToken callback and the external tokenizer.

var Token = function Token(p) {
  this.type = p.type;
  this.value = p.value;
  this.start = p.start;
  this.end = p.end;
  if (p.options.locations)
    { this.loc = new SourceLocation(p, p.startLoc, p.endLoc); }
  if (p.options.ranges)
    { this.range = [p.start, p.end]; }
};

// ## Tokenizer

var pp = Parser.prototype;

// Move to the next token

pp.next = function(ignoreEscapeSequenceInKeyword) {
  if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc)
    { this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword); }
  if (this.options.onToken)
    { this.options.onToken(new Token(this)); }

  this.lastTokEnd = this.end;
  this.lastTokStart = this.start;
  this.lastTokEndLoc = this.endLoc;
  this.lastTokStartLoc = this.startLoc;
  this.nextToken();
};

pp.getToken = function() {
  this.next();
  return new Token(this)
};

// If we're in an ES6 environment, make parsers iterable
if (typeof Symbol !== "undefined")
  { pp[Symbol.iterator] = function() {
    var this$1$1 = this;

    return {
      next: function () {
        var token = this$1$1.getToken();
        return {
          done: token.type === types$1.eof,
          value: token
        }
      }
    }
  }; }

// Toggle strict mode. Re-reads the next number or string to please
// pedantic tests (`"use strict"; 010;` should fail).

// Read a single token, updating the parser object's token-related
// properties.

pp.nextToken = function() {
  var curContext = this.curContext();
  if (!curContext || !curContext.preserveSpace) { this.skipSpace(); }

  this.start = this.pos;
  if (this.options.locations) { this.startLoc = this.curPosition(); }
  if (this.pos >= this.input.length) { return this.finishToken(types$1.eof) }

  if (curContext.override) { return curContext.override(this) }
  else { this.readToken(this.fullCharCodeAtPos()); }
};

pp.readToken = function(code) {
  // Identifier or keyword. '\uXXXX' sequences are allowed in
  // identifiers, so '\' also dispatches to that.
  if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */)
    { return this.readWord() }

  return this.getTokenFromCode(code)
};

pp.fullCharCodeAtPos = function() {
  var code = this.input.charCodeAt(this.pos);
  if (code <= 0xd7ff || code >= 0xdc00) { return code }
  var next = this.input.charCodeAt(this.pos + 1);
  return next <= 0xdbff || next >= 0xe000 ? code : (code << 10) + next - 0x35fdc00
};

pp.skipBlockComment = function() {
  var startLoc = this.options.onComment && this.curPosition();
  var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
  if (end === -1) { this.raise(this.pos - 2, "Unterminated comment"); }
  this.pos = end + 2;
  if (this.options.locations) {
    for (var nextBreak = (void 0), pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1;) {
      ++this.curLine;
      pos = this.lineStart = nextBreak;
    }
  }
  if (this.options.onComment)
    { this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos,
                           startLoc, this.curPosition()); }
};

pp.skipLineComment = function(startSkip) {
  var start = this.pos;
  var startLoc = this.options.onComment && this.curPosition();
  var ch = this.input.charCodeAt(this.pos += startSkip);
  while (this.pos < this.input.length && !isNewLine(ch)) {
    ch = this.input.charCodeAt(++this.pos);
  }
  if (this.options.onComment)
    { this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos,
                           startLoc, this.curPosition()); }
};

// Called at the start of the parse and after every token. Skips
// whitespace and comments, and.

pp.skipSpace = function() {
  loop: while (this.pos < this.input.length) {
    var ch = this.input.charCodeAt(this.pos);
    switch (ch) {
    case 32: case 160: // ' '
      ++this.pos;
      break
    case 13:
      if (this.input.charCodeAt(this.pos + 1) === 10) {
        ++this.pos;
      }
    case 10: case 8232: case 8233:
      ++this.pos;
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
      break
    case 47: // '/'
      switch (this.input.charCodeAt(this.pos + 1)) {
      case 42: // '*'
        this.skipBlockComment();
        break
      case 47:
        this.skipLineComment(2);
        break
      default:
        break loop
      }
      break
    default:
      if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
        ++this.pos;
      } else {
        break loop
      }
    }
  }
};

// Called at the end of every token. Sets `end`, `val`, and
// maintains `context` and `exprAllowed`, and skips the space after
// the token, so that the next one's `start` will point at the
// right position.

pp.finishToken = function(type, val) {
  this.end = this.pos;
  if (this.options.locations) { this.endLoc = this.curPosition(); }
  var prevType = this.type;
  this.type = type;
  this.value = val;

  this.updateContext(prevType);
};

// ### Token reading

// This is the function that is called to fetch the next token. It
// is somewhat obscure, because it works in character codes rather
// than characters, and because operator parsing has been inlined
// into it.
//
// All in the name of speed.
//
pp.readToken_dot = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next >= 48 && next <= 57) { return this.readNumber(true) }
  var next2 = this.input.charCodeAt(this.pos + 2);
  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) { // 46 = dot '.'
    this.pos += 3;
    return this.finishToken(types$1.ellipsis)
  } else {
    ++this.pos;
    return this.finishToken(types$1.dot)
  }
};

pp.readToken_slash = function() { // '/'
  var next = this.input.charCodeAt(this.pos + 1);
  if (this.exprAllowed) { ++this.pos; return this.readRegexp() }
  if (next === 61) { return this.finishOp(types$1.assign, 2) }
  return this.finishOp(types$1.slash, 1)
};

pp.readToken_mult_modulo_exp = function(code) { // '%*'
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  var tokentype = code === 42 ? types$1.star : types$1.modulo;

  // exponentiation operator ** and **=
  if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
    ++size;
    tokentype = types$1.starstar;
    next = this.input.charCodeAt(this.pos + 2);
  }

  if (next === 61) { return this.finishOp(types$1.assign, size + 1) }
  return this.finishOp(tokentype, size)
};

pp.readToken_pipe_amp = function(code) { // '|&'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (this.options.ecmaVersion >= 12) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 === 61) { return this.finishOp(types$1.assign, 3) }
    }
    return this.finishOp(code === 124 ? types$1.logicalOR : types$1.logicalAND, 2)
  }
  if (next === 61) { return this.finishOp(types$1.assign, 2) }
  return this.finishOp(code === 124 ? types$1.bitwiseOR : types$1.bitwiseAND, 1)
};

pp.readToken_caret = function() { // '^'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) { return this.finishOp(types$1.assign, 2) }
  return this.finishOp(types$1.bitwiseXOR, 1)
};

pp.readToken_plus_min = function(code) { // '+-'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 &&
        (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
      // A `-->` line comment
      this.skipLineComment(3);
      this.skipSpace();
      return this.nextToken()
    }
    return this.finishOp(types$1.incDec, 2)
  }
  if (next === 61) { return this.finishOp(types$1.assign, 2) }
  return this.finishOp(types$1.plusMin, 1)
};

pp.readToken_lt_gt = function(code) { // '<>'
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  if (next === code) {
    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
    if (this.input.charCodeAt(this.pos + size) === 61) { return this.finishOp(types$1.assign, size + 1) }
    return this.finishOp(types$1.bitShift, size)
  }
  if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 &&
      this.input.charCodeAt(this.pos + 3) === 45) {
    // `<!--`, an XML-style comment that should be interpreted as a line comment
    this.skipLineComment(4);
    this.skipSpace();
    return this.nextToken()
  }
  if (next === 61) { size = 2; }
  return this.finishOp(types$1.relational, size)
};

pp.readToken_eq_excl = function(code) { // '=!'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) { return this.finishOp(types$1.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2) }
  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) { // '=>'
    this.pos += 2;
    return this.finishToken(types$1.arrow)
  }
  return this.finishOp(code === 61 ? types$1.eq : types$1.prefix, 1)
};

pp.readToken_question = function() { // '?'
  var ecmaVersion = this.options.ecmaVersion;
  if (ecmaVersion >= 11) {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 46) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 < 48 || next2 > 57) { return this.finishOp(types$1.questionDot, 2) }
    }
    if (next === 63) {
      if (ecmaVersion >= 12) {
        var next2$1 = this.input.charCodeAt(this.pos + 2);
        if (next2$1 === 61) { return this.finishOp(types$1.assign, 3) }
      }
      return this.finishOp(types$1.coalesce, 2)
    }
  }
  return this.finishOp(types$1.question, 1)
};

pp.readToken_numberSign = function() { // '#'
  var ecmaVersion = this.options.ecmaVersion;
  var code = 35; // '#'
  if (ecmaVersion >= 13) {
    ++this.pos;
    code = this.fullCharCodeAtPos();
    if (isIdentifierStart(code, true) || code === 92 /* '\' */) {
      return this.finishToken(types$1.privateId, this.readWord1())
    }
  }

  this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
};

pp.getTokenFromCode = function(code) {
  switch (code) {
  // The interpretation of a dot depends on whether it is followed
  // by a digit or another two dots.
  case 46: // '.'
    return this.readToken_dot()

  // Punctuation tokens.
  case 40: ++this.pos; return this.finishToken(types$1.parenL)
  case 41: ++this.pos; return this.finishToken(types$1.parenR)
  case 59: ++this.pos; return this.finishToken(types$1.semi)
  case 44: ++this.pos; return this.finishToken(types$1.comma)
  case 91: ++this.pos; return this.finishToken(types$1.bracketL)
  case 93: ++this.pos; return this.finishToken(types$1.bracketR)
  case 123: ++this.pos; return this.finishToken(types$1.braceL)
  case 125: ++this.pos; return this.finishToken(types$1.braceR)
  case 58: ++this.pos; return this.finishToken(types$1.colon)

  case 96: // '`'
    if (this.options.ecmaVersion < 6) { break }
    ++this.pos;
    return this.finishToken(types$1.backQuote)

  case 48: // '0'
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 120 || next === 88) { return this.readRadixNumber(16) } // '0x', '0X' - hex number
    if (this.options.ecmaVersion >= 6) {
      if (next === 111 || next === 79) { return this.readRadixNumber(8) } // '0o', '0O' - octal number
      if (next === 98 || next === 66) { return this.readRadixNumber(2) } // '0b', '0B' - binary number
    }

  // Anything else beginning with a digit is an integer, octal
  // number, or float.
  case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
    return this.readNumber(false)

  // Quotes produce strings.
  case 34: case 39: // '"', "'"
    return this.readString(code)

  // Operators are parsed inline in tiny state machines. '=' (61) is
  // often referred to. `finishOp` simply skips the amount of
  // characters it is given as second argument, and returns a token
  // of the type given by its first argument.
  case 47: // '/'
    return this.readToken_slash()

  case 37: case 42: // '%*'
    return this.readToken_mult_modulo_exp(code)

  case 124: case 38: // '|&'
    return this.readToken_pipe_amp(code)

  case 94: // '^'
    return this.readToken_caret()

  case 43: case 45: // '+-'
    return this.readToken_plus_min(code)

  case 60: case 62: // '<>'
    return this.readToken_lt_gt(code)

  case 61: case 33: // '=!'
    return this.readToken_eq_excl(code)

  case 63: // '?'
    return this.readToken_question()

  case 126: // '~'
    return this.finishOp(types$1.prefix, 1)

  case 35: // '#'
    return this.readToken_numberSign()
  }

  this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
};

pp.finishOp = function(type, size) {
  var str = this.input.slice(this.pos, this.pos + size);
  this.pos += size;
  return this.finishToken(type, str)
};

pp.readRegexp = function() {
  var escaped, inClass, start = this.pos;
  for (;;) {
    if (this.pos >= this.input.length) { this.raise(start, "Unterminated regular expression"); }
    var ch = this.input.charAt(this.pos);
    if (lineBreak.test(ch)) { this.raise(start, "Unterminated regular expression"); }
    if (!escaped) {
      if (ch === "[") { inClass = true; }
      else if (ch === "]" && inClass) { inClass = false; }
      else if (ch === "/" && !inClass) { break }
      escaped = ch === "\\";
    } else { escaped = false; }
    ++this.pos;
  }
  var pattern = this.input.slice(start, this.pos);
  ++this.pos;
  var flagsStart = this.pos;
  var flags = this.readWord1();
  if (this.containsEsc) { this.unexpected(flagsStart); }

  // Validate pattern
  var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
  state.reset(start, pattern, flags);
  this.validateRegExpFlags(state);
  this.validateRegExpPattern(state);

  // Create Literal#value property value.
  var value = null;
  try {
    value = new RegExp(pattern, flags);
  } catch (e) {
    // ESTree requires null if it failed to instantiate RegExp object.
    // https://github.com/estree/estree/blob/a27003adf4fd7bfad44de9cef372a2eacd527b1c/es5.md#regexpliteral
  }

  return this.finishToken(types$1.regexp, {pattern: pattern, flags: flags, value: value})
};

// Read an integer in the given radix. Return null if zero digits
// were read, the integer value otherwise. When `len` is given, this
// will return `null` unless the integer has exactly `len` digits.

pp.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
  // `len` is used for character escape sequences. In that case, disallow separators.
  var allowSeparators = this.options.ecmaVersion >= 12 && len === undefined;

  // `maybeLegacyOctalNumericLiteral` is true if it doesn't have prefix (0x,0o,0b)
  // and isn't fraction part nor exponent part. In that case, if the first digit
  // is zero then disallow separators.
  var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;

  var start = this.pos, total = 0, lastCode = 0;
  for (var i = 0, e = len == null ? Infinity : len; i < e; ++i, ++this.pos) {
    var code = this.input.charCodeAt(this.pos), val = (void 0);

    if (allowSeparators && code === 95) {
      if (isLegacyOctalNumericLiteral) { this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals"); }
      if (lastCode === 95) { this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore"); }
      if (i === 0) { this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits"); }
      lastCode = code;
      continue
    }

    if (code >= 97) { val = code - 97 + 10; } // a
    else if (code >= 65) { val = code - 65 + 10; } // A
    else if (code >= 48 && code <= 57) { val = code - 48; } // 0-9
    else { val = Infinity; }
    if (val >= radix) { break }
    lastCode = code;
    total = total * radix + val;
  }

  if (allowSeparators && lastCode === 95) { this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits"); }
  if (this.pos === start || len != null && this.pos - start !== len) { return null }

  return total
};

function stringToNumber(str, isLegacyOctalNumericLiteral) {
  if (isLegacyOctalNumericLiteral) {
    return parseInt(str, 8)
  }

  // `parseFloat(value)` stops parsing at the first numeric separator then returns a wrong value.
  return parseFloat(str.replace(/_/g, ""))
}

function stringToBigInt(str) {
  if (typeof BigInt !== "function") {
    return null
  }

  // `BigInt(value)` throws syntax error if the string contains numeric separators.
  return BigInt(str.replace(/_/g, ""))
}

pp.readRadixNumber = function(radix) {
  var start = this.pos;
  this.pos += 2; // 0x
  var val = this.readInt(radix);
  if (val == null) { this.raise(this.start + 2, "Expected number in radix " + radix); }
  if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
    val = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
  } else if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }
  return this.finishToken(types$1.num, val)
};

// Read an integer, octal integer, or floating-point number.

pp.readNumber = function(startsWithDot) {
  var start = this.pos;
  if (!startsWithDot && this.readInt(10, undefined, true) === null) { this.raise(start, "Invalid number"); }
  var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
  if (octal && this.strict) { this.raise(start, "Invalid number"); }
  var next = this.input.charCodeAt(this.pos);
  if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
    var val$1 = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
    if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }
    return this.finishToken(types$1.num, val$1)
  }
  if (octal && /[89]/.test(this.input.slice(start, this.pos))) { octal = false; }
  if (next === 46 && !octal) { // '.'
    ++this.pos;
    this.readInt(10);
    next = this.input.charCodeAt(this.pos);
  }
  if ((next === 69 || next === 101) && !octal) { // 'eE'
    next = this.input.charCodeAt(++this.pos);
    if (next === 43 || next === 45) { ++this.pos; } // '+-'
    if (this.readInt(10) === null) { this.raise(start, "Invalid number"); }
  }
  if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }

  var val = stringToNumber(this.input.slice(start, this.pos), octal);
  return this.finishToken(types$1.num, val)
};

// Read a string value, interpreting backslash-escapes.

pp.readCodePoint = function() {
  var ch = this.input.charCodeAt(this.pos), code;

  if (ch === 123) { // '{'
    if (this.options.ecmaVersion < 6) { this.unexpected(); }
    var codePos = ++this.pos;
    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
    ++this.pos;
    if (code > 0x10FFFF) { this.invalidStringToken(codePos, "Code point out of bounds"); }
  } else {
    code = this.readHexChar(4);
  }
  return code
};

pp.readString = function(quote) {
  var out = "", chunkStart = ++this.pos;
  for (;;) {
    if (this.pos >= this.input.length) { this.raise(this.start, "Unterminated string constant"); }
    var ch = this.input.charCodeAt(this.pos);
    if (ch === quote) { break }
    if (ch === 92) { // '\'
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar(false);
      chunkStart = this.pos;
    } else if (ch === 0x2028 || ch === 0x2029) {
      if (this.options.ecmaVersion < 10) { this.raise(this.start, "Unterminated string constant"); }
      ++this.pos;
      if (this.options.locations) {
        this.curLine++;
        this.lineStart = this.pos;
      }
    } else {
      if (isNewLine(ch)) { this.raise(this.start, "Unterminated string constant"); }
      ++this.pos;
    }
  }
  out += this.input.slice(chunkStart, this.pos++);
  return this.finishToken(types$1.string, out)
};

// Reads template string tokens.

var INVALID_TEMPLATE_ESCAPE_ERROR = {};

pp.tryReadTemplateToken = function() {
  this.inTemplateElement = true;
  try {
    this.readTmplToken();
  } catch (err) {
    if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {
      this.readInvalidTemplateToken();
    } else {
      throw err
    }
  }

  this.inTemplateElement = false;
};

pp.invalidStringToken = function(position, message) {
  if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
    throw INVALID_TEMPLATE_ESCAPE_ERROR
  } else {
    this.raise(position, message);
  }
};

pp.readTmplToken = function() {
  var out = "", chunkStart = this.pos;
  for (;;) {
    if (this.pos >= this.input.length) { this.raise(this.start, "Unterminated template"); }
    var ch = this.input.charCodeAt(this.pos);
    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) { // '`', '${'
      if (this.pos === this.start && (this.type === types$1.template || this.type === types$1.invalidTemplate)) {
        if (ch === 36) {
          this.pos += 2;
          return this.finishToken(types$1.dollarBraceL)
        } else {
          ++this.pos;
          return this.finishToken(types$1.backQuote)
        }
      }
      out += this.input.slice(chunkStart, this.pos);
      return this.finishToken(types$1.template, out)
    }
    if (ch === 92) { // '\'
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar(true);
      chunkStart = this.pos;
    } else if (isNewLine(ch)) {
      out += this.input.slice(chunkStart, this.pos);
      ++this.pos;
      switch (ch) {
      case 13:
        if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; }
      case 10:
        out += "\n";
        break
      default:
        out += String.fromCharCode(ch);
        break
      }
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
      chunkStart = this.pos;
    } else {
      ++this.pos;
    }
  }
};

// Reads a template token to search for the end, without validating any escape sequences
pp.readInvalidTemplateToken = function() {
  for (; this.pos < this.input.length; this.pos++) {
    switch (this.input[this.pos]) {
    case "\\":
      ++this.pos;
      break

    case "$":
      if (this.input[this.pos + 1] !== "{") {
        break
      }

    // falls through
    case "`":
      return this.finishToken(types$1.invalidTemplate, this.input.slice(this.start, this.pos))

    // no default
    }
  }
  this.raise(this.start, "Unterminated template");
};

// Used to read escaped characters

pp.readEscapedChar = function(inTemplate) {
  var ch = this.input.charCodeAt(++this.pos);
  ++this.pos;
  switch (ch) {
  case 110: return "\n" // 'n' -> '\n'
  case 114: return "\r" // 'r' -> '\r'
  case 120: return String.fromCharCode(this.readHexChar(2)) // 'x'
  case 117: return codePointToString(this.readCodePoint()) // 'u'
  case 116: return "\t" // 't' -> '\t'
  case 98: return "\b" // 'b' -> '\b'
  case 118: return "\u000b" // 'v' -> '\u000b'
  case 102: return "\f" // 'f' -> '\f'
  case 13: if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; } // '\r\n'
  case 10: // ' \n'
    if (this.options.locations) { this.lineStart = this.pos; ++this.curLine; }
    return ""
  case 56:
  case 57:
    if (this.strict) {
      this.invalidStringToken(
        this.pos - 1,
        "Invalid escape sequence"
      );
    }
    if (inTemplate) {
      var codePos = this.pos - 1;

      this.invalidStringToken(
        codePos,
        "Invalid escape sequence in template string"
      );

      return null
    }
  default:
    if (ch >= 48 && ch <= 55) {
      var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
      var octal = parseInt(octalStr, 8);
      if (octal > 255) {
        octalStr = octalStr.slice(0, -1);
        octal = parseInt(octalStr, 8);
      }
      this.pos += octalStr.length - 1;
      ch = this.input.charCodeAt(this.pos);
      if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
        this.invalidStringToken(
          this.pos - 1 - octalStr.length,
          inTemplate
            ? "Octal literal in template string"
            : "Octal literal in strict mode"
        );
      }
      return String.fromCharCode(octal)
    }
    if (isNewLine(ch)) {
      // Unicode new line characters after \ get removed from output in both
      // template literals and strings
      return ""
    }
    return String.fromCharCode(ch)
  }
};

// Used to read character escape sequences ('\x', '\u', '\U').

pp.readHexChar = function(len) {
  var codePos = this.pos;
  var n = this.readInt(16, len);
  if (n === null) { this.invalidStringToken(codePos, "Bad character escape sequence"); }
  return n
};

// Read an identifier, and return it as a string. Sets `this.containsEsc`
// to whether the word contained a '\u' escape.
//
// Incrementally adds only escaped chars, adding other chunks as-is
// as a micro-optimization.

pp.readWord1 = function() {
  this.containsEsc = false;
  var word = "", first = true, chunkStart = this.pos;
  var astral = this.options.ecmaVersion >= 6;
  while (this.pos < this.input.length) {
    var ch = this.fullCharCodeAtPos();
    if (isIdentifierChar(ch, astral)) {
      this.pos += ch <= 0xffff ? 1 : 2;
    } else if (ch === 92) { // "\"
      this.containsEsc = true;
      word += this.input.slice(chunkStart, this.pos);
      var escStart = this.pos;
      if (this.input.charCodeAt(++this.pos) !== 117) // "u"
        { this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX"); }
      ++this.pos;
      var esc = this.readCodePoint();
      if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral))
        { this.invalidStringToken(escStart, "Invalid Unicode escape"); }
      word += codePointToString(esc);
      chunkStart = this.pos;
    } else {
      break
    }
    first = false;
  }
  return word + this.input.slice(chunkStart, this.pos)
};

// Read an identifier or keyword token. Will check for reserved
// words when necessary.

pp.readWord = function() {
  var word = this.readWord1();
  var type = types$1.name;
  if (this.keywords.test(word)) {
    type = keywords[word];
  }
  return this.finishToken(type, word)
};

// Acorn is a tiny, fast JavaScript parser written in JavaScript.

var version = "8.8.0";

Parser.acorn = {
  Parser: Parser,
  version: version,
  defaultOptions: defaultOptions,
  Position: Position,
  SourceLocation: SourceLocation,
  getLineInfo: getLineInfo,
  Node: Node$1,
  TokenType: TokenType,
  tokTypes: types$1,
  keywordTypes: keywords,
  TokContext: TokContext,
  tokContexts: types,
  isIdentifierChar: isIdentifierChar,
  isIdentifierStart: isIdentifierStart,
  Token: Token,
  isNewLine: isNewLine,
  lineBreak: lineBreak,
  lineBreakG: lineBreakG,
  nonASCIIwhitespace: nonASCIIwhitespace
};

var defaultGlobals = new Set([
  "Array",
  "ArrayBuffer",
  "atob",
  "AudioContext",
  "Blob",
  "Boolean",
  "BigInt",
  "btoa",
  "clearInterval",
  "clearTimeout",
  "console",
  "crypto",
  "CustomEvent",
  "DataView",
  "Date",
  "decodeURI",
  "decodeURIComponent",
  "devicePixelRatio",
  "document",
  "encodeURI",
  "encodeURIComponent",
  "Error",
  "escape",
  "eval",
  "fetch",
  "File",
  "FileList",
  "FileReader",
  "Float32Array",
  "Float64Array",
  "Function",
  "Headers",
  "Image",
  "ImageData",
  "Infinity",
  "Int16Array",
  "Int32Array",
  "Int8Array",
  "Intl",
  "isFinite",
  "isNaN",
  "JSON",
  "Map",
  "Math",
  "NaN",
  "Number",
  "navigator",
  "Object",
  "parseFloat",
  "parseInt",
  "performance",
  "Path2D",
  "Promise",
  "Proxy",
  "RangeError",
  "ReferenceError",
  "Reflect",
  "RegExp",
  "cancelAnimationFrame",
  "requestAnimationFrame",
  "Set",
  "setInterval",
  "setTimeout",
  "String",
  "Symbol",
  "SyntaxError",
  "TextDecoder",
  "TextEncoder",
  "this",
  "TypeError",
  "Uint16Array",
  "Uint32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "undefined",
  "unescape",
  "URIError",
  "URL",
  "WeakMap",
  "WeakSet",
  "WebSocket",
  "Worker",
  "window"
]);

// AST walker module for Mozilla Parser API compatible trees

// A simple walk is one where you simply specify callbacks to be
// called on specific nodes. The last two arguments are optional. A
// simple use would be
//
//     walk.simple(myTree, {
//         Expression: function(node) { ... }
//     });
//
// to do something with all expressions. All Parser API node types
// can be used to identify node types, as well as Expression and
// Statement, which denote categories of nodes.
//
// The base argument can be used to pass a custom (recursive)
// walker, and state can be used to give this walked an initial
// state.

function simple(node, visitors, baseVisitor, state, override) {
  if (!baseVisitor) { baseVisitor = base
  ; }(function c(node, st, override) {
    var type = override || node.type, found = visitors[type];
    baseVisitor[type](node, st, c);
    if (found) { found(node, st); }
  })(node, state, override);
}

// An ancestor walk keeps an array of ancestor nodes (including the
// current node) and passes them to the callback as third parameter
// (and also as state parameter when no other state is present).
function ancestor(node, visitors, baseVisitor, state, override) {
  var ancestors = [];
  if (!baseVisitor) { baseVisitor = base
  ; }(function c(node, st, override) {
    var type = override || node.type, found = visitors[type];
    var isNew = node !== ancestors[ancestors.length - 1];
    if (isNew) { ancestors.push(node); }
    baseVisitor[type](node, st, c);
    if (found) { found(node, st || ancestors, ancestors); }
    if (isNew) { ancestors.pop(); }
  })(node, state, override);
}

// Used to create a custom walker. Will fill in all missing node
// type properties with the defaults.
function make(funcs, baseVisitor) {
  var visitor = Object.create(baseVisitor || base);
  for (var type in funcs) { visitor[type] = funcs[type]; }
  return visitor
}

function skipThrough(node, st, c) { c(node, st); }
function ignore(_node, _st, _c) {}

// Node walkers.

var base = {};

base.Program = base.BlockStatement = base.StaticBlock = function (node, st, c) {
  for (var i = 0, list = node.body; i < list.length; i += 1)
    {
    var stmt = list[i];

    c(stmt, st, "Statement");
  }
};
base.Statement = skipThrough;
base.EmptyStatement = ignore;
base.ExpressionStatement = base.ParenthesizedExpression = base.ChainExpression =
  function (node, st, c) { return c(node.expression, st, "Expression"); };
base.IfStatement = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.consequent, st, "Statement");
  if (node.alternate) { c(node.alternate, st, "Statement"); }
};
base.LabeledStatement = function (node, st, c) { return c(node.body, st, "Statement"); };
base.BreakStatement = base.ContinueStatement = ignore;
base.WithStatement = function (node, st, c) {
  c(node.object, st, "Expression");
  c(node.body, st, "Statement");
};
base.SwitchStatement = function (node, st, c) {
  c(node.discriminant, st, "Expression");
  for (var i$1 = 0, list$1 = node.cases; i$1 < list$1.length; i$1 += 1) {
    var cs = list$1[i$1];

    if (cs.test) { c(cs.test, st, "Expression"); }
    for (var i = 0, list = cs.consequent; i < list.length; i += 1)
      {
      var cons = list[i];

      c(cons, st, "Statement");
    }
  }
};
base.SwitchCase = function (node, st, c) {
  if (node.test) { c(node.test, st, "Expression"); }
  for (var i = 0, list = node.consequent; i < list.length; i += 1)
    {
    var cons = list[i];

    c(cons, st, "Statement");
  }
};
base.ReturnStatement = base.YieldExpression = base.AwaitExpression = function (node, st, c) {
  if (node.argument) { c(node.argument, st, "Expression"); }
};
base.ThrowStatement = base.SpreadElement =
  function (node, st, c) { return c(node.argument, st, "Expression"); };
base.TryStatement = function (node, st, c) {
  c(node.block, st, "Statement");
  if (node.handler) { c(node.handler, st); }
  if (node.finalizer) { c(node.finalizer, st, "Statement"); }
};
base.CatchClause = function (node, st, c) {
  if (node.param) { c(node.param, st, "Pattern"); }
  c(node.body, st, "Statement");
};
base.WhileStatement = base.DoWhileStatement = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.body, st, "Statement");
};
base.ForStatement = function (node, st, c) {
  if (node.init) { c(node.init, st, "ForInit"); }
  if (node.test) { c(node.test, st, "Expression"); }
  if (node.update) { c(node.update, st, "Expression"); }
  c(node.body, st, "Statement");
};
base.ForInStatement = base.ForOfStatement = function (node, st, c) {
  c(node.left, st, "ForInit");
  c(node.right, st, "Expression");
  c(node.body, st, "Statement");
};
base.ForInit = function (node, st, c) {
  if (node.type === "VariableDeclaration") { c(node, st); }
  else { c(node, st, "Expression"); }
};
base.DebuggerStatement = ignore;

base.FunctionDeclaration = function (node, st, c) { return c(node, st, "Function"); };
base.VariableDeclaration = function (node, st, c) {
  for (var i = 0, list = node.declarations; i < list.length; i += 1)
    {
    var decl = list[i];

    c(decl, st);
  }
};
base.VariableDeclarator = function (node, st, c) {
  c(node.id, st, "Pattern");
  if (node.init) { c(node.init, st, "Expression"); }
};

base.Function = function (node, st, c) {
  if (node.id) { c(node.id, st, "Pattern"); }
  for (var i = 0, list = node.params; i < list.length; i += 1)
    {
    var param = list[i];

    c(param, st, "Pattern");
  }
  c(node.body, st, node.expression ? "Expression" : "Statement");
};

base.Pattern = function (node, st, c) {
  if (node.type === "Identifier")
    { c(node, st, "VariablePattern"); }
  else if (node.type === "MemberExpression")
    { c(node, st, "MemberPattern"); }
  else
    { c(node, st); }
};
base.VariablePattern = ignore;
base.MemberPattern = skipThrough;
base.RestElement = function (node, st, c) { return c(node.argument, st, "Pattern"); };
base.ArrayPattern = function (node, st, c) {
  for (var i = 0, list = node.elements; i < list.length; i += 1) {
    var elt = list[i];

    if (elt) { c(elt, st, "Pattern"); }
  }
};
base.ObjectPattern = function (node, st, c) {
  for (var i = 0, list = node.properties; i < list.length; i += 1) {
    var prop = list[i];

    if (prop.type === "Property") {
      if (prop.computed) { c(prop.key, st, "Expression"); }
      c(prop.value, st, "Pattern");
    } else if (prop.type === "RestElement") {
      c(prop.argument, st, "Pattern");
    }
  }
};

base.Expression = skipThrough;
base.ThisExpression = base.Super = base.MetaProperty = ignore;
base.ArrayExpression = function (node, st, c) {
  for (var i = 0, list = node.elements; i < list.length; i += 1) {
    var elt = list[i];

    if (elt) { c(elt, st, "Expression"); }
  }
};
base.ObjectExpression = function (node, st, c) {
  for (var i = 0, list = node.properties; i < list.length; i += 1)
    {
    var prop = list[i];

    c(prop, st);
  }
};
base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
base.SequenceExpression = function (node, st, c) {
  for (var i = 0, list = node.expressions; i < list.length; i += 1)
    {
    var expr = list[i];

    c(expr, st, "Expression");
  }
};
base.TemplateLiteral = function (node, st, c) {
  for (var i = 0, list = node.quasis; i < list.length; i += 1)
    {
    var quasi = list[i];

    c(quasi, st);
  }

  for (var i$1 = 0, list$1 = node.expressions; i$1 < list$1.length; i$1 += 1)
    {
    var expr = list$1[i$1];

    c(expr, st, "Expression");
  }
};
base.TemplateElement = ignore;
base.UnaryExpression = base.UpdateExpression = function (node, st, c) {
  c(node.argument, st, "Expression");
};
base.BinaryExpression = base.LogicalExpression = function (node, st, c) {
  c(node.left, st, "Expression");
  c(node.right, st, "Expression");
};
base.AssignmentExpression = base.AssignmentPattern = function (node, st, c) {
  c(node.left, st, "Pattern");
  c(node.right, st, "Expression");
};
base.ConditionalExpression = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.consequent, st, "Expression");
  c(node.alternate, st, "Expression");
};
base.NewExpression = base.CallExpression = function (node, st, c) {
  c(node.callee, st, "Expression");
  if (node.arguments)
    { for (var i = 0, list = node.arguments; i < list.length; i += 1)
      {
        var arg = list[i];

        c(arg, st, "Expression");
      } }
};
base.MemberExpression = function (node, st, c) {
  c(node.object, st, "Expression");
  if (node.computed) { c(node.property, st, "Expression"); }
};
base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function (node, st, c) {
  if (node.declaration)
    { c(node.declaration, st, node.type === "ExportNamedDeclaration" || node.declaration.id ? "Statement" : "Expression"); }
  if (node.source) { c(node.source, st, "Expression"); }
};
base.ExportAllDeclaration = function (node, st, c) {
  if (node.exported)
    { c(node.exported, st); }
  c(node.source, st, "Expression");
};
base.ImportDeclaration = function (node, st, c) {
  for (var i = 0, list = node.specifiers; i < list.length; i += 1)
    {
    var spec = list[i];

    c(spec, st);
  }
  c(node.source, st, "Expression");
};
base.ImportExpression = function (node, st, c) {
  c(node.source, st, "Expression");
};
base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.PrivateIdentifier = base.Literal = ignore;

base.TaggedTemplateExpression = function (node, st, c) {
  c(node.tag, st, "Expression");
  c(node.quasi, st, "Expression");
};
base.ClassDeclaration = base.ClassExpression = function (node, st, c) { return c(node, st, "Class"); };
base.Class = function (node, st, c) {
  if (node.id) { c(node.id, st, "Pattern"); }
  if (node.superClass) { c(node.superClass, st, "Expression"); }
  c(node.body, st);
};
base.ClassBody = function (node, st, c) {
  for (var i = 0, list = node.body; i < list.length; i += 1)
    {
    var elt = list[i];

    c(elt, st);
  }
};
base.MethodDefinition = base.PropertyDefinition = base.Property = function (node, st, c) {
  if (node.computed) { c(node.key, st, "Expression"); }
  if (node.value) { c(node.value, st, "Expression"); }
};

var walk = make({
  Import() {},
  ViewExpression(node, st, c) {
    c(node.id, st, "Identifier");
  },
  MutableExpression(node, st, c) {
    c(node.id, st, "Identifier");
  }
});

// Based on https://github.com/ForbesLindesay/acorn-globals

function isScope(node) {
  return node.type === "FunctionExpression"
      || node.type === "FunctionDeclaration"
      || node.type === "ArrowFunctionExpression"
      || node.type === "Program";
}

function isBlockScope(node) {
  return node.type === "BlockStatement"
      || node.type === "ForInStatement"
      || node.type === "ForOfStatement"
      || node.type === "ForStatement"
      || isScope(node);
}

function declaresArguments(node) {
  return node.type === "FunctionExpression"
      || node.type === "FunctionDeclaration";
}

function findReferences(cell, globals) {
  const ast = {type: "Program", body: [cell.body]};
  const locals = new Map;
  const globalSet = new Set(globals);
  const references = [];

  function hasLocal(node, name) {
    const l = locals.get(node);
    return l ? l.has(name) : false;
  }

  function declareLocal(node, id) {
    const l = locals.get(node);
    if (l) l.add(id.name);
    else locals.set(node, new Set([id.name]));
  }

  function declareClass(node) {
    if (node.id) declareLocal(node, node.id);
  }

  function declareFunction(node) {
    node.params.forEach(param => declarePattern(param, node));
    if (node.id) declareLocal(node, node.id);
  }

  function declareCatchClause(node) {
    if (node.param) declarePattern(node.param, node);
  }

  function declarePattern(node, parent) {
    switch (node.type) {
      case "Identifier":
        declareLocal(parent, node);
        break;
      case "ObjectPattern":
        node.properties.forEach(node => declarePattern(node, parent));
        break;
      case "ArrayPattern":
        node.elements.forEach(node => node && declarePattern(node, parent));
        break;
      case "Property":
        declarePattern(node.value, parent);
        break;
      case "RestElement":
        declarePattern(node.argument, parent);
        break;
      case "AssignmentPattern":
        declarePattern(node.left, parent);
        break;
      default:
        throw new Error("Unrecognized pattern type: " + node.type);
    }
  }

  function declareModuleSpecifier(node) {
    declareLocal(ast, node.local);
  }

  ancestor(
    ast,
    {
      VariableDeclaration: (node, parents) => {
        let parent = null;
        for (let i = parents.length - 1; i >= 0 && parent === null; --i) {
          if (node.kind === "var" ? isScope(parents[i]) : isBlockScope(parents[i])) {
            parent = parents[i];
          }
        }
        node.declarations.forEach(declaration => declarePattern(declaration.id, parent));
      },
      FunctionDeclaration: (node, parents) => {
        let parent = null;
        for (let i = parents.length - 2; i >= 0 && parent === null; --i) {
          if (isScope(parents[i])) {
            parent = parents[i];
          }
        }
        declareLocal(parent, node.id);
        declareFunction(node);
      },
      Function: declareFunction,
      ClassDeclaration: (node, parents) => {
        let parent = null;
        for (let i = parents.length - 2; i >= 0 && parent === null; i--) {
          if (isScope(parents[i])) {
            parent = parents[i];
          }
        }
        declareLocal(parent, node.id);
      },
      Class: declareClass,
      CatchClause: declareCatchClause,
      ImportDefaultSpecifier: declareModuleSpecifier,
      ImportSpecifier: declareModuleSpecifier,
      ImportNamespaceSpecifier: declareModuleSpecifier
    },
    walk
  );

  function identifier(node, parents) {
    let name = node.name;
    if (name === "undefined") return;
    for (let i = parents.length - 2; i >= 0; --i) {
      if (name === "arguments") {
        if (declaresArguments(parents[i])) {
          return;
        }
      }
      if (hasLocal(parents[i], name)) {
        return;
      }
      if (parents[i].type === "ViewExpression") {
        node = parents[i];
        name = `viewof ${node.id.name}`;
      }
      if (parents[i].type === "MutableExpression") {
        node = parents[i];
        name = `mutable ${node.id.name}`;
      }
    }
    if (!globalSet.has(name)) {
      if (name === "arguments") {
        throw Object.assign(new SyntaxError(`arguments is not allowed`), {node});
      }
      references.push(node);
    }
  }

  ancestor(
    ast,
    {
      VariablePattern: identifier,
      Identifier: identifier
    },
    walk
  );

  function checkConst(node, parents) {
    if (!node) return;
    switch (node.type) {
      case "Identifier":
      case "VariablePattern": {
        for (const parent of parents) {
          if (hasLocal(parent, node.name)) {
            return;
          }
        }
        if (parents[parents.length - 2].type === "MutableExpression") {
          return;
        }
        throw Object.assign(new SyntaxError(`Assignment to constant variable ${node.name}`), {node});
      }
      case "ArrayPattern": {
        for (const element of node.elements) {
          checkConst(element, parents);
        }
        return;
      }
      case "ObjectPattern": {
        for (const property of node.properties) {
          checkConst(property, parents);
        }
        return;
      }
      case "Property": {
        checkConst(node.value, parents);
        return;
      }
      case "RestElement": {
        checkConst(node.argument, parents);
        return;
      }
    }
  }

  function checkConstArgument(node, parents) {
    checkConst(node.argument, parents);
  }

  function checkConstLeft(node, parents) {
    checkConst(node.left, parents);
  }

  ancestor(
    ast,
    {
      AssignmentExpression: checkConstLeft,
      AssignmentPattern: checkConstLeft,
      UpdateExpression: checkConstArgument,
      ForOfStatement: checkConstLeft,
      ForInStatement: checkConstLeft
    },
    walk
  );

  return references;
}

function findFeatures(cell, featureName) {
  const ast = {type: "Program", body: [cell.body]};
  const features = new Map();
  const {references} = cell;

  simple(
    ast,
    {
      CallExpression: node => {
        const {callee, arguments: args} = node;

        // Ignore function calls that are not references to the feature.
        if (
          callee.type !== "Identifier" ||
          callee.name !== featureName ||
          references.indexOf(callee) < 0
        ) return;

        // Forbid dynamic calls.
        if (
          args.length !== 1 ||
          !((args[0].type === "Literal" && /^['"]/.test(args[0].raw)) ||
            (args[0].type === "TemplateLiteral" && args[0].expressions.length === 0))
        ) {
          throw Object.assign(new SyntaxError(`${featureName} requires a single literal string argument`), {node});
        }

        const [arg] = args;
        const name = arg.type === "Literal" ? arg.value : arg.quasis[0].value.cooked;
        const location = {start: arg.start, end: arg.end};
        if (features.has(name)) features.get(name).push(location);
        else features.set(name, [location]);
      }
    },
    walk
  );

  return features;
}

const SCOPE_FUNCTION = 2;
const SCOPE_ASYNC = 4;
const SCOPE_GENERATOR = 8;

class CellParser extends Parser {
  constructor(options, ...args) {
    super(Object.assign({ecmaVersion: 13}, options), ...args);
  }
  enterScope(flags) {
    if (flags & SCOPE_FUNCTION) ++this.O_function;
    return super.enterScope(flags);
  }
  exitScope() {
    if (this.currentScope().flags & SCOPE_FUNCTION) --this.O_function;
    return super.exitScope();
  }
  parseForIn(node, init) {
    if (this.O_function === 1 && node.await) this.O_async = true;
    return super.parseForIn(node, init);
  }
  parseAwait() {
    if (this.O_function === 1) this.O_async = true;
    return super.parseAwait();
  }
  parseYield(noIn) {
    if (this.O_function === 1) this.O_generator = true;
    return super.parseYield(noIn);
  }
  parseImport(node) {
    this.next();
    node.specifiers = this.parseImportSpecifiers();
    if (this.type === types$1._with) {
      this.next();
      node.injections = this.parseImportSpecifiers();
    }
    this.expectContextual("from");
    node.source = this.type === types$1.string ? this.parseExprAtom() : this.unexpected();
    return this.finishNode(node, "ImportDeclaration");
  }
  parseImportSpecifiers() {
    const nodes = [];
    const identifiers = new Set;
    let first = true;
    this.expect(types$1.braceL);
    while (!this.eat(types$1.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(types$1.comma);
        if (this.afterTrailingComma(types$1.braceR)) break;
      }
      const node = this.startNode();
      node.view = this.eatContextual("viewof");
      node.mutable = node.view ? false : this.eatContextual("mutable");
      node.imported = this.parseIdent();
      this.checkUnreserved(node.imported);
      this.checkLocal(node.imported);
      if (this.eatContextual("as")) {
        node.local = this.parseIdent();
        this.checkUnreserved(node.local);
        this.checkLocal(node.local);
      } else {
        node.local = node.imported;
      }
      this.checkLValSimple(node.local, "let");
      if (identifiers.has(node.local.name)) {
        this.raise(node.local.start, `Identifier '${node.local.name}' has already been declared`);
      }
      identifiers.add(node.local.name);
      nodes.push(this.finishNode(node, "ImportSpecifier"));
    }
    return nodes;
  }
  parseExprAtom(refDestructuringErrors) {
    return (
      this.parseMaybeKeywordExpression("viewof", "ViewExpression") ||
      this.parseMaybeKeywordExpression("mutable", "MutableExpression") ||
      super.parseExprAtom(refDestructuringErrors)
    );
  }
  startCell() {
    this.O_function = 0;
    this.O_async = false;
    this.O_generator = false;
    this.strict = true;
    this.enterScope(SCOPE_FUNCTION | SCOPE_ASYNC | SCOPE_GENERATOR);
  }
  finishCell(node, body, id) {
    if (id) this.checkLocal(id);
    node.id = id;
    node.body = body;
    node.async = this.O_async;
    node.generator = this.O_generator;
    this.exitScope();
    return this.finishNode(node, "Cell");
  }
  parseCell(node, eof) {
    const lookahead = new CellParser({}, this.input, this.start);
    let token = lookahead.getToken();
    let body = null;
    let id = null;

    this.startCell();

    // An import?
    if (token.type === types$1._import && lookahead.getToken().type !== types$1.parenL) {
      body = this.parseImport(this.startNode());
    }

    // A non-empty cell?
    else if (token.type !== types$1.eof && token.type !== types$1.semi) {
      // A named cell?
      if (token.type === types$1.name) {
        if (token.value === "viewof" || token.value === "mutable") {
          token = lookahead.getToken();
          if (token.type !== types$1.name) {
            lookahead.unexpected();
          }
        }
        token = lookahead.getToken();
        if (token.type === types$1.eq) {
          id =
            this.parseMaybeKeywordExpression("viewof", "ViewExpression") ||
            this.parseMaybeKeywordExpression("mutable", "MutableExpression") ||
            this.parseIdent();
          token = lookahead.getToken();
          this.expect(types$1.eq);
        }
      }

      // A block?
      if (token.type === types$1.braceL) {
        body = this.parseBlock();
      }

      // An expression?
      // Possibly a function or class declaration?
      else {
        body = this.parseExpression();
        if (
          id === null &&
          (body.type === "FunctionExpression" ||
            body.type === "ClassExpression")
        ) {
          id = body.id;
        }
      }
    }

    this.semicolon();
    if (eof) this.expect(types$1.eof); // TODO

    return this.finishCell(node, body, id);
  }
  parseTopLevel(node) {
    return this.parseCell(node, true);
  }
  toAssignable(node, isBinding, refDestructuringErrors) {
    return node.type === "MutableExpression"
      ? node
      : super.toAssignable(node, isBinding, refDestructuringErrors);
  }
  checkLocal(id) {
    const node = id.id || id;
    if (defaultGlobals.has(node.name) || node.name === "arguments") {
      this.raise(node.start, `Identifier '${node.name}' is reserved`);
    }
  }
  checkUnreserved(node) {
    if (node.name === "viewof" || node.name === "mutable") {
      this.raise(node.start, `Unexpected keyword '${node.name}'`);
    }
    return super.checkUnreserved(node);
  }
  checkLValSimple(expr, bindingType, checkClashes) {
    return super.checkLValSimple(
      expr.type === "MutableExpression" ? expr.id : expr,
      bindingType,
      checkClashes
    );
  }
  unexpected(pos) {
    this.raise(
      pos != null ? pos : this.start,
      this.type === types$1.eof ? "Unexpected end of input" : "Unexpected token"
    );
  }
  parseMaybeKeywordExpression(keyword, type) {
    if (this.isContextual(keyword)) {
      const node = this.startNode();
      this.next();
      node.id = this.parseIdent();
      return this.finishNode(node, type);
    }
  }
}

// Based on acorn’s q_tmpl. We will use this to initialize the
// parser context so our `readTemplateToken` override is called.
// `readTemplateToken` is based on acorn's `readTmplToken` which
// is used inside template literals. Our version allows backQuotes.
new TokContext(
  "`", // token
  true, // isExpr
  true, // preserveSpace
  parser => readTemplateToken.call(parser) // override
);

// This is our custom override for parsing a template that allows backticks.
// Based on acorn's readInvalidTemplateToken.
function readTemplateToken() {
  out: for (; this.pos < this.input.length; this.pos++) {
    switch (this.input.charCodeAt(this.pos)) {
      case 92: { // slash
        if (this.pos < this.input.length - 1) ++this.pos; // not a terminal slash
        break;
      }
      case 36: { // dollar
        if (this.input.charCodeAt(this.pos + 1) === 123) { // dollar curly
          if (this.pos === this.start && this.type === types$1.invalidTemplate) {
            this.pos += 2;
            return this.finishToken(types$1.dollarBraceL);
          }
          break out;
        }
        break;
      }
    }
  }
  return this.finishToken(types$1.invalidTemplate, this.input.slice(this.start, this.pos));
}

// Find references.
// Check for illegal references to arguments.
// Check for illegal assignments to global references.
function parseReferences(cell, input, globals = defaultGlobals) {
  if (!cell.body) {
    cell.references = [];
  } else if (cell.body.type === "ImportDeclaration") {
    cell.references = cell.body.injections
      ? cell.body.injections.map(i => i.imported)
      : [];
  } else {
    try {
      cell.references = findReferences(cell, globals);
    } catch (error) {
      if (error.node) {
        const loc = getLineInfo(input, error.node.start);
        error.message += ` (${loc.line}:${loc.column})`;
        error.pos = error.node.start;
        error.loc = loc;
        delete error.node;
      }
      throw error;
    }
  }
  return cell;
}

// Find features: file attachments, secrets, database clients.
// Check for illegal references to arguments.
// Check for illegal assignments to global references.
function parseFeatures(cell, input) {
  if (cell.body && cell.body.type !== "ImportDeclaration") {
    try {
      cell.fileAttachments = findFeatures(cell, "FileAttachment");
      cell.databaseClients = findFeatures(cell, "DatabaseClient");
      cell.secrets = findFeatures(cell, "Secret");
    } catch (error) {
      if (error.node) {
        const loc = getLineInfo(input, error.node.start);
        error.message += ` (${loc.line}:${loc.column})`;
        error.pos = error.node.start;
        error.loc = loc;
        delete error.node;
      }
      throw error;
    }
  } else {
    cell.fileAttachments = new Map();
    cell.databaseClients = new Map();
    cell.secrets = new Map();
  }
  return cell;
}

/* Fork changes begin here */

function parseModule(input, {globals} = {}) {
  const program = ModuleParser.parse(input);
  for (const cell of program.cells) {
    parseReferences(cell, input, globals);
    parseFeatures(cell, input);
  }
  return program;
}

class ModuleParser extends CellParser {
  parseTopLevel(node) {
    if (!node.cells) node.cells = [];
    while (this.type !== types$1.eof) {
      const cell = this.parseCell(this.startNode());
      cell.input = this.input;
      node.cells.push(cell);
    }
    this.next();
    return this.finishNode(node, "Program");
  }
}

/* Fork changes end here */

/*global Shiny, $, DOMParser, MutationObserver, URL
*
* ojs-connector.js
*
* Copyright (C) 2022 RStudio, PBC
*
*/

//////////////////////////////////////////////////////////////////////////////

class EmptyInspector {
  pending() {
  }
  fulfilled(_value, _name) {
  }
  rejected(_error, _name) {
    // TODO we should probably communicate this upstream somehow.
  }
}

// here we need to convert from an ES6 module to an observable module
// in, well, a best-effort kind of way.
function es6ImportAsObservableModule(modulePromise, specs) {
  const promiseMap = {};
  const resolveMap = {};
  specs.forEach(spec => {
    promiseMap[spec] = new Promise((resolve, reject) => { resolveMap[spec] = { resolve, reject }; });
  });
  modulePromise.then(m => {
    specs.forEach(spec => {
      resolveMap[spec].resolve(m[spec]);
    });
  }).catch(error => {
    specs.forEach(spec => {
      resolveMap[spec].reject(error);
    });
  });
  return function (runtime, observer) {
    const main = runtime.module();

    specs.forEach(key => {
      main.variable(observer(key)).define(key, [], () => promiseMap[key]);
    });
/* 
    Object.keys(m).forEach((key) => {
      const v = m[key];

      main.variable(observer(key)).define(key, [], () => promiseMap[key]v);
    });
 */
    return main;
  };
}


// this is essentially the import resolution code from observable's
// runtime. we change it to add a license check for permissive
// open-source licenses before resolving the import
async function defaultResolveImportPath(path) {
  const extractPath = (path) => {
    let source = path;
    let m;
    if ((m = /\.js(\?|$)/i.exec(source))) {
      source = source.slice(0, m.index);
    }
    if ((m = /^[0-9a-f]{16}$/i.test(source))) {
      source = `d/${source}`;
    }
    if ((m = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source))) {
      source = source.slice(m[0].length);
    }
    return source;
  };
  const source = extractPath(path);
  const moduleURL = `https://api.observablehq.com/${source}.js?v=3`;

  /* TODO This should be the implementation we use, once/if observable
  starts reporting notebook license on their metadata.

  const metadata = await fetch(metadataURL, { mode: 'no-cors' });
  const nbJson = metadata.json();
  if (["isc", "mit", "bsd-3-clause", "apache-2.0"].indexOf(nbJson.license) === -1) {
    throw new Error(`Notebook doesn't have a permissive open-source license`);
  } */

  const m = await import(moduleURL);
  return m.default;
}

/*
  importPathResolver encodes the rules for ojsconnector to resolve
  import statements. 

  This code doesn't depend have any dependencies on quarto, but some
  of the decisions here are influence by the needs of the quarto
  system.

  We use the same name from observable's runtime so the intended
  functionality is clear.  However, note that their name is slightly
  misleading. importPathResolver not only resolves import paths but
  performs module imports as well. This is useful for us because it
  allows us to extend the meaning of ojs's import statement, but it
  makes the name confusing.

  Here are the rules for our version of the import statement.

  The function returned by importPathResolver expects a "module specifier", and
  produces a module as defined by observable's runtime.

  ## Local vs remote vs observable imports

  A module specifier is a string, interpreted differently depending on
  the following properties:

  - it starts with "." or "/", in which case we call it a "local module"

  - it is a well-defined absolute URL which does _not_ match the regexp:
    /^https:\/\/(api\.|beta\.|)observablehq\.com\//i
    in which case we call it a "remote import"

  - otherwise, it is an "observable import"

  If the string is an observable import, it behaves exactly like the import
  statement inside observable notebooks (we actually defer to their function
  call.) Otherwise, the import statement first retrieves the text content
  of the resource referenced by the path, and then interprets it.

  ## where resources come from

  When operating in non-self-contained mode, local and remote import
  paths are then interpreted as relative URLs (RFC 1808) with base URL
  window.location (specifically as "relative path" and "absolute path"
  relative URLs).

  In self-contained mode, these paths are interpreted as paths in the
  quarto project, either as root-relative or relative paths. The
  contents of these files are converted to data URLs and stored in a
  local resolution map.

  ## how are contents interpreted

  The contents of the resource are then interpreted differently
  depending on the file type of the requested resource.

  For non-self-contained imports, the file type is determined by the
  extension of the URL pathname. If the extension is "js", we take the
  specifier to mean an ES module; If the extension is "ojs", we take
  the specifier to mean an "ojs" module (a collection of observable
  statements packaged into a module, suitable for reuse). If the 
  extension is "ts" or "tsx", then this is an import that was actually transpiled 
  into js during quarto render, and we change the extension to .js and
  resolve that. Finally, if the extension is "qmd", we take the specifier
  to mean an "implicit ojs module", equivalent to extracting all
  the ojs statements from the .qmd file and producing an OJS module.

  For self-contained imports, the file type is determined by the MIME
  type of the data URL. "application/javascript" is interpreted to
  mean an ES module, and "application/ojs-javascript" is interpreted
  to mean an "ojs" module. (.qmd imports will have been
  translated to ojs modules by the compilation step.)

  The resources are finally retrieved, compiled into modules
  compatible with the observable runtime, and returned as
  the result of the import statement.

*/

function importPathResolver(paths, localResolverMap) {
  // NB: only resolve the field values in paths when calling rootPath
  // and relativePath. If we prematurely optimize this by moving the
  // const declarations outside, then we will capture the
  // uninitialized values.

  // fetch() and import() have different relative path semantics, so
  // we need different paths for each use case

  function importRootPath(path) {
    const { runtimeToRoot } = paths;
    if (!runtimeToRoot) {
      return path;
    } else {
      return `${runtimeToRoot}/${path}`;
    }
  }

  function importRelativePath(path) {
    const { runtimeToDoc } = paths;
    if (!runtimeToDoc) {
      return path;
    } else {
      return `${runtimeToDoc}/${path}`;
    }
  }

  // a fetch path of a root-relative path is resolved wrt to
  // the document root
  function fetchRootPath(path) {
    const { docToRoot } = paths;
    if (!docToRoot) {
      return path;
    } else {
      return `${docToRoot}/${path}`;
    }
  }

  // a fetch path of a relative path is resolved the naive way
  function fetchRelativePath(path) {
    return path;
  }

  return async (path, specs) => {
    const isLocalModule = path.startsWith("/") || path.startsWith(".");
    const isImportFromObservableWebsite = path.match(
      /^https:\/\/(api\.|beta\.|)observablehq\.com\//i,
    );

    if (!isLocalModule || isImportFromObservableWebsite) {
      return defaultResolveImportPath(path);
    }

    let importPath, fetchPath;
    let moduleType;
    if (window._ojs.selfContained) {
      if (path.endsWith(".ts")) {
        path = path.replace(/\.ts$/, ".js");
      } else if (path.endsWith(".tsx")) {
        path = path.replace(/\.tsx$/, ".js");
      }
      const resolved = localResolverMap.get(path);
      if (resolved === undefined) {
        throw new Error(`missing local file ${path} in self-contained mode`);
      }
      // self-contained resolves to data URLs, so they behave the same.
      importPath = resolved;
      fetchPath = resolved;

      // we have a data URL here.
      const mimeType = resolved.match(/data:(.*);base64/)[1];
      switch (mimeType) {
        case "application/javascript":
          moduleType = "js";
          break;
        case "application/ojs-javascript":
          moduleType = "ojs";
          break;
        default:
          throw new Error(`unrecognized MIME type ${mimeType}`);
      }
    } else {
      // we have a relative URL here
      const resourceURL = new URL(path, window.location);
      moduleType = resourceURL.pathname.match(/\.(ojs|js|ts|tsx|qmd)$/)[1];

      // resolve path according to quarto path resolution rules.
      if (path.startsWith("/")) {
        importPath = importRootPath(path);
        fetchPath = fetchRootPath(path);
      } else {
        importPath = importRelativePath(path);
        fetchPath = fetchRelativePath(path);
      }
    }

    if (moduleType === "ts" || moduleType === "tsx") {
      try {
        const modulePromise = import(window._ojs.selfContained ? 
          importPath : 
          importPath.replace(/\.ts$/, ".js").replace(/\.tsx$/, ".js"));
        return es6ImportAsObservableModule(modulePromise, specs);
      } catch (e) {
        // record the error on the browser console to make debugging
        // slightly more convenient.
        console.error(e);
        throw e;
      }
    } else if (moduleType === "js") {
      try {
        const modulePromise = import(importPath);
        return es6ImportAsObservableModule(modulePromise, specs);
      } catch (e) {
        // record the error on the browser console to make debugging
        // slightly more convenient.
        console.error(e);
        throw e;
      }
    } else if (moduleType === "ojs") {
      return importOjsFromURL(fetchPath);
    } else if (moduleType === "qmd") {
      const htmlPath = `${fetchPath.slice(0, -4)}.html`;
      const response = await fetch(htmlPath);
      const text = await response.text();
      return createOjsModuleFromHTMLSrc(text);
    } else {
      throw new Error(`internal error, unrecognized module type ${moduleType}`);
    }
  };
}

function createOjsModuleFromHTMLSrc(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const staticDefns = [];
  for (const el of doc.querySelectorAll('script[type="ojs-define"]')) {
    staticDefns.push(el.text);
  }
  const ojsSource = [];
  for (
    const content of doc.querySelectorAll('script[type="ojs-module-contents"]')
  ) {
    for (const cell of JSON.parse(content.text).contents) {
      ojsSource.push(cell.source);
    }
  }
  return createOjsModuleFromSrc(ojsSource.join("\n"), staticDefns);
}

function createOjsModuleFromSrc(src, staticDefns = []) {
  return (runtime, _observer) => {
    const newModule = runtime.module();
    const interpreter = window._ojs.ojsConnector.interpreter;
    interpreter.module(
      src,
      newModule,
      (_name) => new EmptyInspector(),
    );
    for (const defn of staticDefns) {
      for (const { name, value } of JSON.parse(defn).contents) {
        window._ojs.ojsConnector.define(name, newModule)(value);
      }
    }
    return newModule;
  };
}

/*
  * Given a URL, fetches the text content and creates a new observable module
  * exporting all of the names as variables
  */
async function importOjsFromURL(path) {
  const r = await fetch(path);
  const src = await r.text();
  return createOjsModuleFromSrc(src);
}

class OJSConnector {
  constructor({ paths, inspectorClass, library, allowPendingGlobals = false }) {
    this.library = library || new Library();

    // this map contains a mapping from resource names to data URLs
    // that governs fileAttachment and import() resolutions in the
    // case of self-contained files.
    this.localResolverMap = new Map();
    // Keeps track of variables that have been requested by ojs code, but do
    // not exist (not in the module, not in the library, not on window).
    // The keys are variable names, the values are {promise, resolve, reject}.
    // This is intended to allow for a (hopefully brief) phase during startup
    // in which, if an ojs code chunk references a variable that is not defined,
    // instead of treating it as an "x is not defined" error we instead
    // take a wait-and-see approach, in case the variable dynamically becomes
    // defined later. When the phase ends, killPendingGlobals() must be called
    // so any variables that are still missing do cause "x is not defined"
    // errors.
    this.pendingGlobals = {};
    // When true, the mechanism described in the `this.pendingGlobals` comment
    // is used. When false, the result of accessing undefined variables is just
    // "x is not defined". This should be considered private, only settable via
    // constructor or `killPendingGlobals`.
    this.allowPendingGlobals = allowPendingGlobals;
    // NB it looks like Runtime makes a local copy of the library object,
    // such that mutating library after this is initializaed doesn't actually
    // work.
    this.runtime = new Runtime(this.library, (name) => this.global(name));
    this.mainModule = this.runtime.module();
    this.interpreter = new dist.exports.Interpreter({
      module: this.mainModule,
      resolveImportPath: importPathResolver(paths, this.localResolverMap),
    });
    this.inspectorClass = inspectorClass || Inspector;

    // state to handle flash of unevaluated js because of async module imports
    this.mainModuleHasImports = false;
    this.mainModuleOutstandingImportCount = 0;
    this.chunkPromises = [];
  }

  // Customizes the Runtime's behavior when an undefined variable is accessed.
  // This is needed for cases where the ojs graph is not all present at the
  // time of initialization; in particular, the case where a dependent cell
  // starts executing before one or more of its dependencies have been defined.
  // Without this customization, the user would see a flash of errors while the
  // graph is constructed; with this customization, the dependents stay blank
  // while they wait.
  global(name) {
    if (typeof window[name] !== "undefined") {
      return window[name];
    }
    if (!this.allowPendingGlobals) {
      return undefined;
    }

    // deno-lint-ignore no-prototype-builtins
    if (!this.pendingGlobals.hasOwnProperty(name)) {
      // This is a pending global we haven't seen before. Stash a new promise,
      // along with its resolve/reject callbacks, in an object and remember it
      // for later.
      const info = {};
      info.promise = new Promise((resolve, reject) => {
        info.resolve = resolve;
        info.reject = reject;
      });
      this.pendingGlobals[name] = info;
    }
    return this.pendingGlobals[name].promise;
  }

  // Signals the end of the "pending globals" phase. Any promises we've handed
  // out from the global() method now are rejected. (We never resolve these
  // promises to values; if these variables made an appearance, it would've
  // been as variables on modules.)
  killPendingGlobals() {
    this.allowPendingGlobals = false;
    for (const [name, { reject }] of Object.entries(this.pendingGlobals)) {
      reject(new RuntimeError(`${name} is not defined`));
    }
  }

  setLocalResolver(map) {
    for (const [key, value] of Object.entries(map)) {
      this.localResolverMap.set(key, value);
    }
  }

  define(name, module = undefined) {
    if (!module) {
      module = this.mainModule;
    }
    let change;
    const obs = this.library.Generators.observe((change_) => {
      change = change_;
      // TODO do something about destruction
    });
    module.variable().define(name, obs);
    return change;
  }

  watch(name, k, module = undefined) {
    if (!module) {
      module = this.mainModule;
    }
    module.variable({
      fulfilled: (x) => k(x, name),
    }).define([name], (val) => val);
  }

  async value(val, module = undefined) {
    if (!module) {
      module = this.mainModule;
    }
    const result = await module.value(val);
    return result;
  }

  finishInterpreting() {
    return Promise.all(this.chunkPromises);
  }
  
  interpretWithRunner(src, runner) {
    try {
      const parse = parseModule(src);
      const chunkPromise = Promise.all(parse.cells.map(runner));
      this.chunkPromises.push(chunkPromise);
      return chunkPromise;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  waitOnImports(cell, promise) {
    if (cell.body.type !== "ImportDeclaration") {
      return promise;
    } else {
      this.mainModuleHasImports = true;
      this.mainModuleOutstandingImportCount++;
      return promise.then((result) => {
        this.mainModuleOutstandingImportCount--;
        if (this.mainModuleOutstandingImportCount === 0) {
          this.clearImportModuleWait();
        }
        return result;
      });
    }
  }

  interpretQuiet(src) {
    const runCell = (cell) => {
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(
        cellSrc,
        undefined,
        (_name) => new EmptyInspector(),
      );
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }
}

/*!
 * escape-html
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * Copyright(c) 2022 RStudio, PBC
 * 
 * MIT Licensed
 *
 * Minimal changes to make ES6
 * 
 */

var matchHtmlRegExp = /["'&<>]/;

/**
 * Escape special characters in the given string of text.
 *
 * @param  {string} string The string to escape for inserting into HTML
 * @return {string}
 * @public
 */

function escapeHtml (string) {
  var str = '' + string;
  var match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str
  }

  var escape;
  var html = '';
  var index = 0;
  var lastIndex = 0;

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;';
        break
      case 38: // &
        escape = '&amp;';
        break
      case 39: // '
        escape = '&#39;';
        break
      case 60: // <
        escape = '&lt;';
        break
      case 62: // >
        escape = '&gt;';
        break
      default:
        continue
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index
    ? html + str.substring(lastIndex, index)
    : html
}

function createHtmlElement(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    el.setAttribute(key, val);
  }
  while (children.length) {
    const child = children.shift();
    if (Array.isArray(child)) {
      children.unshift(...child);
    } else if (child instanceof HTMLElement) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(escapeHtml(child)));
    }
  }
  return el;
}

function createNamespacedElement(ns, tag, attrs, ...children) {
  const el = document.createElementNS(ns.namespace, tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    el.setAttribute(key, val);
  }
  while (children.length) {
    const child = children.shift();
    if (Array.isArray(child)) {
      children.unshift(...child);
    } else if (child instanceof HTMLElement || child instanceof ns.class) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(escapeHtml(child)));
    }
  }
  return el;
}

const resolver = {
  a: "svg",
  animate: "svg",
  animateMotion: "svg",
  animateTransform: "svg",
  circle: "svg",
  clipPath: "svg",
  defs: "svg",
  desc: "svg",
  discard: "svg",
  ellipse: "svg",
  feBlend: "svg",
  feColorMatrix: "svg",
  feComponentTransfer: "svg",
  feComposite: "svg",
  feConvolveMatrix: "svg",
  feDiffuseLighting: "svg",
  feDisplacementMap: "svg",
  feDistantLight: "svg",
  feDropShadow: "svg",
  feFlood: "svg",
  feFuncA: "svg",
  feFuncB: "svg",
  feFuncG: "svg",
  feFuncR: "svg",
  feGaussianBlur: "svg",
  feImage: "svg",
  feMerge: "svg",
  feMergeNode: "svg",
  feMorphology: "svg",
  feOffset: "svg",
  fePointLight: "svg",
  feSpecularLighting: "svg",
  feSpotLight: "svg",
  feTile: "svg",
  feTurbulence: "svg",
  filter: "svg",
  foreignObject: "svg",
  g: "svg",
  image: "svg",
  line: "svg",
  linearGradient: "svg",
  marker: "svg",
  mask: "svg",
  metadata: "svg",
  mpath: "svg",
  path: "svg",
  pattern: "svg",
  polygon: "svg",
  polyline: "svg",
  radialGradient: "svg",
  rect: "svg",
  script: "svg",
  set: "svg",
  stop: "svg",
  style: "svg",
  svg: "svg",
  switch: "svg",
  symbol: "svg",
  text: "svg",
  textPath: "svg",
  title: "svg",
  tspan: "svg",
  use: "svg",
  view: "svg",  
};

const nss = {
  "svg": { namespace: "http://www.w3.org/2000/svg", class: SVGElement }
};

function resolveCreator(tag) {
  const nsKey = resolver[tag];
  if (nsKey === undefined) {
    return createHtmlElement;
  }
  const namespace = nss[nsKey];

  return function(tag, attrs, ...children) {
    return createNamespacedElement(namespace, tag, attrs, ...children);
  }
}

function createQuartoJsxShim()
{
  return {
    createElement(tag, attrs, ...children) {
      if (typeof tag === "function") {
        return tag({...attrs, children });
      }

      return resolveCreator(tag)(tag, attrs, ...children);
    }
  };
}

/*global Shiny, $, DOMParser, MutationObserver, URL
 *
 * quarto-ojs.js
 *
 * Copyright (C) 2021 RStudio, PBC
 *
 */

//////////////////////////////////////////////////////////////////////////////
// Quarto-specific code starts here.

// For RStudio IDE integration
/** creates a click handler to point the IDE to a given line and column */
const makeDevhostErrorClickHandler = (line, column) => {
  return function () {
    if (!window.quartoDevhost) {
      return false;
    }
    window.quartoDevhost.openInputFile(line, column, true);
    return false;
  };
};

// we cannot depend on Object.fromEntries because the IDE
// doesn't support it. We minimally polyfill it
if (Object.fromEntries === undefined) {
  Object.fromEntries = function (obj) {
    const result = {};
    for (const [key, value] of obj) {
      result[key] = value;
    }
    return result;
  };
}

/** create a callout block with the given opts, currently to be used
    to signal a runtime error in the observable runtime.
*/
function calloutBlock(opts) {
  const { type, heading, message, onclick } = opts;

  const outerBlock = document.createElement("div");
  outerBlock.classList.add(
    `callout-${type}`,
    "callout",
    "callout-style-default",
    "callout-captioned"
  );
  const header = document.createElement("div");
  header.classList.add("callout-header", "d-flex", "align-content-center");
  const iconContainer = document.createElement("div");
  iconContainer.classList.add("callout-icon-container");
  const icon = document.createElement("i");
  icon.classList.add("callout-icon");
  iconContainer.appendChild(icon);
  header.appendChild(iconContainer);

  const headingDiv = document.createElement("div");
  headingDiv.classList.add("callout-caption-container", "flex-fill");
  // we assume heading is either a string or a span
  if (typeof heading === "string") {
    headingDiv.innerText = heading;
  } else {
    headingDiv.appendChild(heading);
  }
  header.appendChild(headingDiv);
  outerBlock.appendChild(header);

  const container = document.createElement("div");
  container.classList.add("callout-body-container", "callout-body");
  if (typeof message === "string") {
    const p = document.createElement("p");
    p.innerText = message;
    container.appendChild(p);
  } else {
    container.append(message);
  }
  outerBlock.appendChild(container);

  if (onclick) {
    outerBlock.onclick = onclick;
    outerBlock.style.cursor = "pointer";
  }

  return outerBlock;
}

const kQuartoModuleWaitClass = "ojs-in-a-box-waiting-for-module-import";

class QuartoOJSConnector extends OJSConnector {
  constructor(opts) {
    super(opts);
  }

  ////////////////////////////////////////////////////////////////////////////
  // handle import module waits

  clearImportModuleWait() {
    const array = Array.from(
      document.querySelectorAll(`.${kQuartoModuleWaitClass}`)
    );
    for (const node of array) {
      node.classList.remove(kQuartoModuleWaitClass);
    }
  }

  finishInterpreting() {
    return super.finishInterpreting().then(() => {
      if (this.mainModuleHasImports) {
        this.clearImportModuleWait();
      }
    });
  }

  ////////////////////////////////////////////////////////////////////////////
  // Error tracking/reporting

  locatePreDiv(cellDiv, ojsDiv) {
    // locate the correct pre div with the pandocDecorator
    // of all potential divs, we need to find the one that most
    // immediately precedes `ojsDiv` in the DOM.
    let preDiv;
    for (const candidate of cellDiv.querySelectorAll("pre.sourceCode")) {
      if (
        candidate.compareDocumentPosition(ojsDiv) &
        ojsDiv.DOCUMENT_POSITION_FOLLOWING
      ) {
        preDiv = candidate;
      } else {
        break;
      }
    }
    return preDiv;
  }

  findCellOutputDisplay(ojsDiv) {
    while (ojsDiv && !ojsDiv.classList.contains("cell-output-display")) {
      ojsDiv = ojsDiv.parentElement;
    }
    if (!ojsDiv) {
      return null;
    }
    return ojsDiv;
  }

  setPreDivClasses(preDiv, hasErrors) {
    if (!hasErrors) {
      preDiv.classList.remove("numberSource");
      if (preDiv._hidden === true) {
        const parent = preDiv.parentElement;
        parent.classList.add("hidden");
        // when code-tools is active (that is, when pre is inside a details tag), we also need to hide the details tag.
        if (parent.parentElement.tagName === "DETAILS") {
          parent.parentElement.classList.add("hidden");
        }
      }
    } else {
      preDiv.classList.add("numberSource");
      const parent = preDiv.parentElement;
      if (parent.classList.contains("hidden")) {
        preDiv._hidden = true; // signal that we used to be hidden so that when errors go away, we're hidden again.
        parent.classList.remove("hidden");

        // when code-tools is active (that is, when pre is inside a details tag), we also need to unhide the details tag.
        if (parent.parentElement.tagName === "DETAILS") {
          parent.parentElement.classList.remove("hidden");
          // open the code-tools by default when error happens.
          parent.parentElement.setAttribute("open", "open");
        }
      }
    }
  }

  clearErrorPinpoints(cellDiv, ojsDiv) {
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    if (preDiv === undefined) {
      return;
    }
    this.setPreDivClasses(preDiv, false);
    let startingOffset = 0;
    if (preDiv.parentElement.dataset.sourceOffset) {
      startingOffset = -Number(preDiv.parentElement.dataset.sourceOffset);
    }
    for (const entryPoint of preDiv._decorator.spanSelection(
      startingOffset,
      Infinity
    )) {
      const { node } = entryPoint;
      node.classList.remove("quarto-ojs-error-pinpoint");
      node.onclick = null;
    }
  }

  decorateOjsDivWithErrorPinpoint(ojsDiv, start, end, line, column) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    // if ojs element is inline, there's no div.
    if (!cellOutputDisplay) {
      return;
    }
    if (cellOutputDisplay._errorSpans === undefined) {
      cellOutputDisplay._errorSpans = [];
    }
    cellOutputDisplay._errorSpans.push({
      start,
      end,
      line,
      column,
    });
  }

  decorateSource(cellDiv, ojsDiv) {
    if (!cellDiv) {
      // no div in inline spans
      return;
    }
    this.clearErrorPinpoints(cellDiv, ojsDiv);
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    // sometimes the source code is not echoed.
    // FIXME: should ojs source always be "hidden" so we can show it
    // in case of runtime errors?
    if (preDiv === undefined) {
      return;
    }
    // now find all ojsDivs that contain errors that need to be decorated
    // on preDiv
    let parent = preDiv.parentElement;
    if (parent.parentElement.tagName === "DETAILS") {
      // we're in a code-tools setting, need to go one further up
      parent = parent.parentElement;
    }
    let div = parent.nextElementSibling;
    let foundErrors = false;
    while (div !== null && div.classList.contains("cell-output-display")) {
      for (const errorSpan of div._errorSpans || []) {
        for (const entryPoint of preDiv._decorator.spanSelection(
          errorSpan.start,
          errorSpan.end
        )) {
          const { node } = entryPoint;
          node.classList.add("quarto-ojs-error-pinpoint");
          node.onclick = makeDevhostErrorClickHandler(
            errorSpan.line,
            errorSpan.column
          );
        }
        foundErrors = true;
      }
      div = div.nextElementSibling;
    }
    this.setPreDivClasses(preDiv, foundErrors);
  }

  clearError(ojsDiv) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    // if ojs element is inline, there's no div.
    if (cellOutputDisplay)
      cellOutputDisplay._errorSpans = [];
  }

  signalError(cellDiv, ojsDiv, ojsAst) {
    const buildCallout = (ojsDiv) => {
      let onclick;
      const inspectChild = ojsDiv.querySelector(".observablehq--inspect");
      let [heading, message] = inspectChild.textContent.split(": ");
      if (heading === "RuntimeError") {
        heading = "OJS Runtime Error";
        if (message.match(/^(.+) is not defined$/)) {
          const [varName, ...rest] = message.split(" ");
          const p = document.createElement("p");
          const tt = document.createElement("tt");
          tt.innerText = varName;
          p.appendChild(tt);
          p.appendChild(document.createTextNode(" " + rest.join(" ")));
          message = p;

          const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
          // preDiv might not be exist in case source isn't echoed to HTML
          if (preDiv !== undefined) {
            // force line numbers to show
            preDiv.classList.add("numberSource");
            const missingRef = ojsAst.references.find(
              (n) => n.name === varName
            );
            // TODO when missingRef === undefined, it likely means an unresolved
            // import reference. For now we will leave things as is, but
            // this needs better handling.
            if (missingRef !== undefined) {
              const { line, column } = preDiv._decorator.offsetToLineColumn(
                missingRef.start
              );
              const headingSpan = document.createElement("span");
              const headingTextEl = document.createTextNode(
                `${heading} (line ${line}, column ${column}) `
              );
              headingSpan.appendChild(headingTextEl);
              if (window.quartoDevhost) {
                const clicker = document.createElement("a");
                clicker.href = "#"; // this forces the right CSS to apply
                clicker.innerText = "(source)";
                onclick = makeDevhostErrorClickHandler(line, column);
                headingSpan.appendChild(clicker);
              }
              heading = headingSpan;
              this.decorateOjsDivWithErrorPinpoint(
                ojsDiv,
                missingRef.start,
                missingRef.end,
                line,
                column
              );
            }
          }
        } else if (
          message.match(/^(.+) could not be resolved$/) ||
          message.match(/^(.+) is defined more than once$/)
        ) {
          const [varName, ...rest] = message.split(" ");
          const p = document.createElement("p");
          const tt = document.createElement("tt");
          tt.innerText = varName;
          p.appendChild(tt);
          p.appendChild(document.createTextNode(" " + rest.join(" ")));
          message = p;
        } else {
          const p = document.createElement("p");
          p.appendChild(document.createTextNode(message));
          message = p;
        }
      } else {
        heading = "OJS Error";
        const p = document.createElement("p");
        p.appendChild(document.createTextNode(inspectChild.textContent));
        message = p;
      }
      const callout = calloutBlock({
        type: "important",
        heading,
        message,
        onclick,
      });
      ojsDiv.appendChild(callout);
    };

    buildCallout(ojsDiv);
  }

  interpret(src, elementGetter, elementCreator) {
    // deno-lint-ignore no-this-alias
    const that = this;
    const observer = (targetElement, ojsAst) => {
      return (name) => {
        const element =
          typeof elementCreator === "function"
            ? elementCreator()
            : elementCreator;
        targetElement.appendChild(element);

        // TODO the unofficial interpreter always calls viewexpression observers
        // twice, one with the name, and the next with 'viewof $name'.
        // we check for 'viewof ' here and hide the element we're creating.
        // this behavior appears inconsistent with OHQ's interpreter, so we
        // shouldn't be surprised to see this fail in the future.
        if (
          ojsAst.id &&
          ojsAst.id.type === "ViewExpression" &&
          !name.startsWith("viewof ")
        ) {
          element.classList.add("quarto-ojs-hide");
        }

        // handle output:all hiding
        //
        // if every output from a cell is is not displayed, then we
        // must also not display the cell output display element
        // itself.

        // collect the cell element as well as the cell output display
        // element
        let cellDiv = targetElement;
        let cellOutputDisplay;
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
          if (cellDiv && cellDiv.classList.contains("cell-output-display")) {
            cellOutputDisplay = cellDiv;
          }
        }
        const forceShowDeclarations = !(
          cellDiv && cellDiv.dataset.output !== "all"
        );

        const config = { childList: true };
        const callback = function (mutationsList) {
          // we may fail to find a cell in inline settings; but
          // inline cells won't have inspectors, so in that case
          // we never hide
          for (const mutation of mutationsList) {
            const ojsDiv = mutation.target;

            if (!forceShowDeclarations) {
              const childNodes = Array.from(mutation.target.childNodes);
              for (const n of childNodes) {
                // hide the inner inspect outputs that aren't errors or
                // declarations
                if (
                  n.classList.contains("observablehq--inspect") &&
                  !n.parentNode.classList.contains("observablehq--error") &&
                  n.parentNode.parentNode.dataset.nodetype !== "expression"
                ) {
                  n.classList.add("quarto-ojs-hide");
                }
                // show the inspect outputs that aren't errors and are
                // expressions (they might have been hidden in the past,
                // since errors can clear)
                if (
                  n.classList.contains("observablehq--inspect") &&
                  !n.parentNode.classList.contains("observablehq--error") &&
                  n.parentNode.parentNode.dataset.nodetype === "expression"
                ) {
                  n.classList.remove("quarto-ojs-hide");
                }
              }
            }

            // if the ojsDiv shows an error, display a callout block instead of it.
            if (ojsDiv.classList.contains("observablehq--error")) {
              // we don't use quarto-ojs-hide here because that would confuse
              // the code which depends on that class for its logic.
              ojsDiv.querySelector(".observablehq--inspect").style.display =
                "none";

              if (ojsDiv.querySelectorAll(".callout-important").length === 0) {
                that.signalError(cellDiv, ojsDiv, ojsAst);
              }
            } else {
              that.clearError(ojsDiv);
              if (
                ojsDiv.parentNode.dataset.nodetype !== "expression" &&
                !forceShowDeclarations &&
                Array.from(ojsDiv.childNodes).every((n) =>
                  n.classList.contains("observablehq--inspect")
                )
              ) {
                // if every child is an inspect output, hide the ojsDiv
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }

            that.decorateSource(cellDiv, ojsDiv);

            // hide import statements even if output === "all"
            for (const added of mutation.addedNodes) {
              if (
                added.tagName === "FORM" &&
                Array.from(added.classList).some(
                  (x) => x.endsWith("table") && x.startsWith("oi-")
                )
              ) {
                added.classList.add("quarto-ojs-table-fixup");
              }

              const addedButtons = added.querySelectorAll("button");
              for (const button of Array.from(addedButtons)) {
                button.classList.add("btn");
                button.classList.add("btn-quarto");
              }
              //// Hide imports that aren't javascript code
              //
              // We search here for code.javascript and node span.hljs-... because
              // at this point in the DOM, observable's runtime hasn't called
              // HLJS yet. if you inspect the DOM yourself, you're likely to see
              // HLJS, so this comment is here to prevent future confusion.
              const result = added.querySelectorAll("code.javascript");
              if (result.length !== 1) {
                continue;
              }
              if (result[0].textContent.trim().startsWith("import")) {
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }
          }

          // cellOutputDisplay doesn't exist in inline spans, so we must check it explicitly
          if (cellOutputDisplay) {
            const children = Array.from(
              cellOutputDisplay.querySelectorAll("div.observablehq")
            );
            // after all mutations are handled, we check the full cell for hiding
            if (
              children.every((n) => {
                return n.classList.contains("quarto-ojs-hide");
              })
            ) {
              cellOutputDisplay.classList.add("quarto-ojs-hide");
            } else {
              cellOutputDisplay.classList.remove("quarto-ojs-hide");
            }
          }
        };
        new MutationObserver(callback).observe(element, config);
        // 'element' is the outer div given to observable's runtime to insert their output
        // every quarto cell will have either one or two such divs.
        // The parent of these divs should always be a div corresponding to an ojs "cell"
        // (with ids "ojs-cell-*")

        element.classList.add(kQuartoModuleWaitClass);

        return new this.inspectorClass(element, ojsAst);
      };
    };
    const runCell = (cell) => {
      const targetElement =
        typeof elementGetter === "function" ? elementGetter() : elementGetter;
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(
        cellSrc,
        undefined,
        observer(targetElement, cell)
      );
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }
}

//////////////////////////////////////////////////////////////////////////////
// previously quarto-observable-shiny.js

function createRuntime() {
  const quartoOjsGlobal = window._ojs;
  const isShiny = window.Shiny !== undefined;

  // Are we shiny?
  if (isShiny) {
    quartoOjsGlobal.hasShiny = true;
    initOjsShinyRuntime();

    const span = document.createElement("span");
    window._ojs.shinyElementRoot = span;
    document.body.appendChild(span);
  }

  // we use the trick described here to extend observable runtime's standard library
  // https://talk.observablehq.com/t/embedded-width/1063

  // stdlib from our fork, which uses the safe d3-require
  const lib = new Library();
  if (isShiny) {
    extendObservableStdlib(lib);
  }

  function transpose(df) {
    const keys = Object.keys(df);
    return df[keys[0]]
      .map((v, i) =>
        Object.fromEntries(keys.map((key) => {
          const v = df[key][i];
          const result = v === null ? undefined : v;
          return [key, result];
        })))
      .filter((v) => !Object.values(v).every((e) => e === undefined));
  }
  lib.transpose = () => transpose;

  const mainEl = document.querySelector("main");
  function width() {
    return lib.Generators.observe(function (change) {
      var width = change(mainEl.clientWidth);
      function resized() {
        var w = mainEl.clientWidth;
        if (w !== width) change((width = w));
      }
      window.addEventListener("resize", resized);
      return function () {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.width = width;

  // hack for "echo: fenced": remove all "//| echo: fenced" lines the hard way, but keep
  // the right line numbers around.
  Array.from(document.querySelectorAll("span.co"))
    .filter((n) => n.textContent === "//| echo: fenced")
    .forEach((n) => {
      const lineSpan = n.parentElement;
      const lineBreak = lineSpan.nextSibling;
      if (lineBreak) {
        const nextLineSpan = lineBreak.nextSibling;
        if (nextLineSpan) {
          const lineNumber = Number(nextLineSpan.id.split("-")[1]);
          nextLineSpan.style = `counter-reset: source-line ${lineNumber - 1}`;
        }
      }

      // update the source offset variable with the new right amount
      const sourceDiv = lineSpan.parentElement.parentElement.parentElement;
      const oldOffset = Number(sourceDiv.dataset.sourceOffset);
      sourceDiv.dataset.sourceOffset = oldOffset - "//| echo: fenced\n".length;

      lineSpan.remove();
      lineBreak.remove();
    });

  // select all elements to track:
  //   panel elements with ids, and divs with ids and .ojs-track-layout

  const layoutDivs = [...Array.from(
    document.querySelectorAll("div.quarto-layout-panel div[id]")
  ),
  ...Array.from(
    document.querySelectorAll('div.ojs-track-layout[id]')
  )];
  
  function layoutWidth() {
    return lib.Generators.observe(function (change) {
      const ourWidths = Object.fromEntries(
        layoutDivs.map((div) => [div.id, div.clientWidth])
      );
      change(ourWidths);
      function resized() {
        let changed = false;
        for (const div of layoutDivs) {
          const w = div.clientWidth;
          if (w !== ourWidths[div.id]) {
            ourWidths[div.id] = w;
            changed = true;
          }
        }
        if (changed) {
          change(ourWidths);
        }
      }
      window.addEventListener("resize", resized);
      return function () {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.layoutWidth = layoutWidth;
  let localResolver = {};

  function fileAttachmentPathResolver(n) {
    if (localResolver[n]) {
      return localResolver[n];
    }

    if (n.startsWith("/")) {
      // docToRoot can be empty, in which case naive concatenation creates
      // an absolute path.
      if (quartoOjsGlobal.paths.docToRoot === "") {
        return `.${n}`;
      } else {
        return `${quartoOjsGlobal.paths.docToRoot}${n}`;
      }
    } else {
      return n;
    }
  }
  lib.FileAttachment = () => FileAttachments(fileAttachmentPathResolver);

  const ojsConnector = new QuartoOJSConnector({
    paths: quartoOjsGlobal.paths,
    inspectorClass: isShiny ? ShinyInspector : QuartoInspector,
    library: lib,
    allowPendingGlobals: isShiny,
  });
  quartoOjsGlobal.ojsConnector = ojsConnector;
  if (isShiny) {
    // When isShiny, OJSConnector is constructed with allowPendingGlobals:true.
    // Our guess is that most shiny-to-ojs exports will have been defined
    // by the time the server function finishes executing (i.e. session init
    // completion); so we call `killPendingGlobals()` to show errors for
    // variables that are still undefined.
    $(document).one("shiny:idle", () => {
      // "shiny:idle" is not late enough; it is raised before the resulting
      // outputs are received from the server.
      $(document).one("shiny:message", () => {
        // "shiny:message" is not late enough; it is raised after the message
        // is received, but before it is processed (i.e. variables are still
        // not actually defined).
        setTimeout(() => {
          ojsConnector.killPendingGlobals();
        }, 0);
      });
    });
  }

  const subfigIdMap = new Map();
  function getSubfigId(elementId) {
    if (!subfigIdMap.has(elementId)) {
      subfigIdMap.set(elementId, 0);
    }
    let nextIx = subfigIdMap.get(elementId);
    nextIx++;
    subfigIdMap.set(elementId, nextIx);
    return `${elementId}-${nextIx}`;
  }

  const sourceNodes = document.querySelectorAll(
    "pre.sourceCode code.sourceCode"
  );
  const decorators = Array.from(sourceNodes).map((n) => {
    n = n.parentElement;
    const decorator = new PandocCodeDecorator(n);
    n._decorator = decorator;
    return decorator;
  });
  // handle build-time syntax error
  decorators.forEach((n) => {
    if (n._node.parentElement.dataset.syntaxErrorPosition === undefined) {
      return;
    }
    const offset = Number(n._node.parentElement.dataset.syntaxErrorPosition);
    n.decorateSpan(offset, offset + 1, ["quarto-ojs-error-pinpoint"]);
  });

  const result = {
    setLocalResolver(obj) {
      localResolver = obj;
      ojsConnector.setLocalResolver(obj);
    },
    finishInterpreting() {
      return ojsConnector.finishInterpreting();
    },

    // return the latest value of the named reactive variable in the main module
    async value(name) {
      await this.finishInterpreting();
      const result = await ojsConnector.value(name);
      return result;
    },

    // fixme clarify what's the expected behavior of the 'error' option
    // when evaluation is at client-time
    interpretLenient(src, targetElementId, inline) {
      return result.interpret(src, targetElementId, inline).catch(() => {});
    },
    interpret(src, targetElementId, inline) {
      // we capture the result here so that the error handler doesn't
      // grab a new id accidentally.
      let targetElement;
      const getElement = () => {
        targetElement = document.getElementById(targetElementId);
        let subFigId;
        if (!targetElement) {
          // this is a subfigure
          subFigId = getSubfigId(targetElementId);
          targetElement = document.getElementById(subFigId);
          if (!targetElement) {
            // console.error("Ran out of subfigures for element", targetElementId);
            // console.error("This will fail.");
            throw new Error("Ran out of quarto subfigures.");
          }
        }
        return targetElement;
      };

      const makeElement = () => {
        return document.createElement(inline ? "span" : "div");
      };

      return ojsConnector.interpret(src, getElement, makeElement).catch((e) => {
        // to the best of our knowledge, we only get here
        // on import statement failures. So we report those
        // in a callout

        let cellDiv = targetElement;
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
        }

        const ojsDiv = targetElement.querySelector(".observablehq");
        if (!ojsDiv) {
          // we failed to find an observablehq div inside the targetElement.
          // This is an internal error and we have no way to report it
          // except throwing the original exception.
          throw e;
        }
        // because this is in an exception handler, we might need
        // to clear some of the garbage that other pieces of code
        // won't have the chance to
        //
        for (const div of ojsDiv.querySelectorAll(".callout")) {
          div.remove();
        }

        const messagePre = document.createElement("pre");
        messagePre.innerText = e.stack;

        const callout = calloutBlock({
          type: "important",
          heading: `${e.name}: ${e.message}`,
          message: messagePre,
        });
        ojsDiv.appendChild(callout);
        ojsConnector.clearError(ojsDiv);
        ojsConnector.clearErrorPinpoints(cellDiv, ojsDiv);

        return e;
      });
    },
    interpretQuiet(src) {
      return ojsConnector.interpretQuiet(src);
    },
    interpretFromScriptTags() {
      // source definitions
      for (const el of document.querySelectorAll(
        "script[type='ojs-module-contents']"
      )) {
        for (const call of JSON.parse(el.text).contents) {
          switch (call.methodName) {
            case "interpret":
              this.interpret(call.source, call.cellName, call.inline);
              break;
            case "interpretLenient":
              this.interpretLenient(call.source, call.cellName, call.inline);
              break;
            case "interpretQuiet":
              this.interpretQuiet(call.source);
              break;
            default:
              throw new Error(
                `Don't know how to call method ${call.methodName}`
              );
          }
        }
      }

      // static data definitions
      for (const el of document.querySelectorAll("script[type='ojs-define']")) {
        for (const { name, value } of JSON.parse(el.text).contents) {
          ojsConnector.define(name)(value);
        }
      }
    },
  };

  return result;
}


function initializeRuntime()
{
  // TODO "obs" or "ojs"? Inconsistent naming.
  window._ojs = {
    ojsConnector: undefined,

    paths: {}, // placeholder for per-quarto-file paths
    // necessary for module resolution

    hasShiny: false, // true if we have the quarto-ojs-shiny runtime

    shinyElementRoot: undefined, // root element for the communication with shiny
    // via DOM
  };
  window._ojs.runtime = createRuntime();
  window._ojs.jsx = createQuartoJsxShim();
}

initializeRuntime();
// export default init;
