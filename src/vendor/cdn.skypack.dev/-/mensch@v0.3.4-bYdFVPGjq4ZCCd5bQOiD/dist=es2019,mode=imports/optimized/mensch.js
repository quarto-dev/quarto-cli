function createCommonjsModule(fn, basedir, module) {
  return module = {
    path: basedir,
    exports: {},
    require: function(path, base) {
      return commonjsRequire(path, base === void 0 || base === null ? module.path : base);
    }
  }, fn(module, module.exports), module.exports;
}
function commonjsRequire() {
  throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
function defaultSetTimout() {
  throw new Error("setTimeout has not been defined");
}
function defaultClearTimeout() {
  throw new Error("clearTimeout has not been defined");
}
var cachedSetTimeout = defaultSetTimout;
var cachedClearTimeout = defaultClearTimeout;
var globalContext;
if (typeof window !== "undefined") {
  globalContext = window;
} else if (typeof self !== "undefined") {
  globalContext = self;
} else {
  globalContext = {};
}
if (typeof globalContext.setTimeout === "function") {
  cachedSetTimeout = setTimeout;
}
if (typeof globalContext.clearTimeout === "function") {
  cachedClearTimeout = clearTimeout;
}
function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    return setTimeout(fun, 0);
  }
  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }
  try {
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e2) {
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}
function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    return clearTimeout(marker);
  }
  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }
  try {
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      return cachedClearTimeout.call(null, marker);
    } catch (e2) {
      return cachedClearTimeout.call(this, marker);
    }
  }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;
function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return;
  }
  draining = false;
  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }
  if (queue.length) {
    drainQueue();
  }
}
function drainQueue() {
  if (draining) {
    return;
  }
  var timeout = runTimeout(cleanUpNextTick);
  draining = true;
  var len = queue.length;
  while (len) {
    currentQueue = queue;
    queue = [];
    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run();
      }
    }
    queueIndex = -1;
    len = queue.length;
  }
  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}
function nextTick(fun) {
  var args = new Array(arguments.length - 1);
  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }
  queue.push(new Item(fun, args));
  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
}
function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}
Item.prototype.run = function() {
  this.fun.apply(null, this.array);
};
var title = "browser";
var platform = "browser";
var browser = true;
var argv = [];
var version = "";
var versions = {};
var release = {};
var config = {};
function noop() {
}
var on = noop;
var addListener = noop;
var once = noop;
var off = noop;
var removeListener = noop;
var removeAllListeners = noop;
var emit = noop;
function binding(name) {
  throw new Error("process.binding is not supported");
}
function cwd() {
  return "/";
}
function chdir(dir) {
  throw new Error("process.chdir is not supported");
}
function umask() {
  return 0;
}
var performance = globalContext.performance || {};
var performanceNow = performance.now || performance.mozNow || performance.msNow || performance.oNow || performance.webkitNow || function() {
  return new Date().getTime();
};
function hrtime(previousTimestamp) {
  var clocktime = performanceNow.call(performance) * 1e-3;
  var seconds = Math.floor(clocktime);
  var nanoseconds = Math.floor(clocktime % 1 * 1e9);
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds < 0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [seconds, nanoseconds];
}
var startTime = new Date();
function uptime() {
  var currentTime = new Date();
  var dif = currentTime - startTime;
  return dif / 1e3;
}
var process = {
  nextTick,
  title,
  browser,
  env: {NODE_ENV: "production"},
  argv,
  version,
  versions,
  on,
  addListener,
  once,
  off,
  removeListener,
  removeAllListeners,
  emit,
  binding,
  cwd,
  chdir,
  umask,
  hrtime,
  platform,
  release,
  config,
  uptime
};
var debug_1 = createCommonjsModule(function(module, exports) {
  exports = module.exports = debug;
  function debug(label) {
    return _debug.bind(null, label);
  }
  function _debug(label) {
    var args = [].slice.call(arguments, 1);
    args.unshift("[" + label + "]");
    process.stderr.write(args.join(" ") + "\n");
  }
});
var lexer = createCommonjsModule(function(module, exports) {
  var debug = debug_1("lex");
  exports = module.exports = lex2;
  function lex2(css) {
    var buffer = "";
    var ch;
    var column = 0;
    var cursor = -1;
    var depth = 0;
    var line = 1;
    var state = "before-selector";
    var stack = [state];
    var token = {};
    var tokens = [];
    var atRules = [
      "media",
      "keyframes",
      {name: "-webkit-keyframes", type: "keyframes", prefix: "-webkit-"},
      {name: "-moz-keyframes", type: "keyframes", prefix: "-moz-"},
      {name: "-ms-keyframes", type: "keyframes", prefix: "-ms-"},
      {name: "-o-keyframes", type: "keyframes", prefix: "-o-"},
      "font-face",
      {name: "import", state: "before-at-value"},
      {name: "charset", state: "before-at-value"},
      "supports",
      "viewport",
      {name: "namespace", state: "before-at-value"},
      "document",
      {name: "-moz-document", type: "document", prefix: "-moz-"},
      "page"
    ];
    function getCh() {
      skip();
      return css[cursor];
    }
    function getState(index) {
      return index ? stack[stack.length - 1 - index] : state;
    }
    function isNextString(str) {
      var start = cursor + 1;
      return str === css.slice(start, start + str.length);
    }
    function find(str) {
      var pos2 = css.slice(cursor).indexOf(str);
      return pos2 > 0 ? pos2 : false;
    }
    function isNextChar(ch2) {
      return ch2 === peek(1);
    }
    function peek(offset) {
      return css[cursor + (offset || 1)];
    }
    function popState() {
      var removed = stack.pop();
      state = stack[stack.length - 1];
      return removed;
    }
    function pushState(newState) {
      state = newState;
      stack.push(state);
      return stack.length;
    }
    function replaceState(newState) {
      var previousState = state;
      stack[stack.length - 1] = state = newState;
      return previousState;
    }
    function skip(n) {
      if ((n || 1) == 1) {
        if (css[cursor] == "\n") {
          line++;
          column = 1;
        } else {
          column++;
        }
        cursor++;
      } else {
        var skipStr = css.slice(cursor, cursor + n).split("\n");
        if (skipStr.length > 1) {
          line += skipStr.length - 1;
          column = 1;
        }
        column += skipStr[skipStr.length - 1].length;
        cursor = cursor + n;
      }
    }
    function addToken() {
      token.end = {
        line,
        col: column
      };
      tokens.push(token);
      buffer = "";
      token = {};
    }
    function initializeToken(type) {
      token = {
        type,
        start: {
          line,
          col: column
        }
      };
    }
    while (ch = getCh()) {
      switch (ch) {
        case " ":
          switch (getState()) {
            case "selector":
            case "value":
            case "value-paren":
            case "at-group":
            case "at-value":
            case "comment":
            case "double-string":
            case "single-string":
              buffer += ch;
              break;
          }
          break;
        case "\n":
        case "	":
        case "\r":
        case "\f":
          switch (getState()) {
            case "value":
            case "value-paren":
            case "at-group":
            case "comment":
            case "single-string":
            case "double-string":
            case "selector":
              buffer += ch;
              break;
            case "at-value":
              if (ch === "\n") {
                token.value = buffer.trim();
                addToken();
                popState();
              }
              break;
          }
          break;
        case ":":
          switch (getState()) {
            case "name":
              token.name = buffer.trim();
              buffer = "";
              replaceState("before-value");
              break;
            case "before-selector":
              buffer += ch;
              initializeToken("selector");
              pushState("selector");
              break;
            case "before-value":
              replaceState("value");
              buffer += ch;
              break;
            default:
              buffer += ch;
              break;
          }
          break;
        case ";":
          switch (getState()) {
            case "name":
            case "before-value":
            case "value":
              if (buffer.trim().length > 0) {
                token.value = buffer.trim(), addToken();
              }
              replaceState("before-name");
              break;
            case "value-paren":
              buffer += ch;
              break;
            case "at-value":
              token.value = buffer.trim();
              addToken();
              popState();
              break;
            case "before-name":
              break;
            default:
              buffer += ch;
              break;
          }
          break;
        case "{":
          switch (getState()) {
            case "selector":
              if (peek(-1) === "\\") {
                buffer += ch;
                break;
              }
              token.text = buffer.trim();
              addToken();
              replaceState("before-name");
              depth = depth + 1;
              break;
            case "at-group":
              token.name = buffer.trim();
              switch (token.type) {
                case "font-face":
                case "viewport":
                case "page":
                  pushState("before-name");
                  break;
                default:
                  pushState("before-selector");
              }
              addToken();
              depth = depth + 1;
              break;
            case "name":
            case "at-rule":
              token.name = buffer.trim();
              addToken();
              pushState("before-name");
              depth = depth + 1;
              break;
            case "comment":
            case "double-string":
            case "single-string":
              buffer += ch;
              break;
            case "before-value":
              replaceState("value");
              buffer += ch;
              break;
          }
          break;
        case "}":
          switch (getState()) {
            case "before-name":
            case "name":
            case "before-value":
            case "value":
              if (buffer) {
                token.value = buffer.trim();
              }
              if (token.name && token.value) {
                addToken();
              }
              initializeToken("end");
              addToken();
              popState();
              if (getState() === "at-group") {
                initializeToken("at-group-end");
                addToken();
                popState();
              }
              if (depth > 0) {
                depth = depth - 1;
              }
              break;
            case "at-group":
            case "before-selector":
            case "selector":
              if (peek(-1) === "\\") {
                buffer += ch;
                break;
              }
              if (depth > 0) {
                if (getState(1) === "at-group") {
                  initializeToken("at-group-end");
                  addToken();
                }
              }
              if (depth > 1) {
                popState();
              }
              if (depth > 0) {
                depth = depth - 1;
              }
              break;
            case "double-string":
            case "single-string":
            case "comment":
              buffer += ch;
              break;
          }
          break;
        case '"':
        case "'":
          switch (getState()) {
            case "double-string":
              if (ch === '"' && peek(-1) !== "\\") {
                popState();
              }
              break;
            case "single-string":
              if (ch === "'" && peek(-1) !== "\\") {
                popState();
              }
              break;
            case "before-at-value":
              replaceState("at-value");
              pushState(ch === '"' ? "double-string" : "single-string");
              break;
            case "before-value":
              replaceState("value");
              pushState(ch === '"' ? "double-string" : "single-string");
              break;
            case "comment":
              break;
            default:
              if (peek(-1) !== "\\") {
                pushState(ch === '"' ? "double-string" : "single-string");
              }
          }
          buffer += ch;
          break;
        case "/":
          switch (getState()) {
            case "comment":
            case "double-string":
            case "single-string":
              buffer += ch;
              break;
            case "before-value":
            case "selector":
            case "name":
            case "value":
              if (isNextChar("*")) {
                var pos = find("*/");
                if (pos) {
                  skip(pos + 1);
                }
              } else {
                if (getState() == "before-value")
                  replaceState("value");
                buffer += ch;
              }
              break;
            default:
              if (isNextChar("*")) {
                initializeToken("comment");
                pushState("comment");
                skip();
              } else {
                buffer += ch;
              }
              break;
          }
          break;
        case "*":
          switch (getState()) {
            case "comment":
              if (isNextChar("/")) {
                token.text = buffer;
                skip();
                addToken();
                popState();
              } else {
                buffer += ch;
              }
              break;
            case "before-selector":
              buffer += ch;
              initializeToken("selector");
              pushState("selector");
              break;
            case "before-value":
              replaceState("value");
              buffer += ch;
              break;
            default:
              buffer += ch;
          }
          break;
        case "@":
          switch (getState()) {
            case "comment":
            case "double-string":
            case "single-string":
              buffer += ch;
              break;
            case "before-value":
              replaceState("value");
              buffer += ch;
              break;
            default:
              var tokenized = false;
              var name;
              var rule;
              for (var j = 0, len = atRules.length; !tokenized && j < len; ++j) {
                rule = atRules[j];
                name = rule.name || rule;
                if (!isNextString(name)) {
                  continue;
                }
                tokenized = true;
                initializeToken(name);
                pushState(rule.state || "at-group");
                skip(name.length);
                if (rule.prefix) {
                  token.prefix = rule.prefix;
                }
                if (rule.type) {
                  token.type = rule.type;
                }
              }
              if (!tokenized) {
                buffer += ch;
              }
              break;
          }
          break;
        case "(":
          switch (getState()) {
            case "value":
              pushState("value-paren");
              break;
            case "before-value":
              replaceState("value");
              break;
          }
          buffer += ch;
          break;
        case ")":
          switch (getState()) {
            case "value-paren":
              popState();
              break;
            case "before-value":
              replaceState("value");
              break;
          }
          buffer += ch;
          break;
        default:
          switch (getState()) {
            case "before-selector":
              initializeToken("selector");
              pushState("selector");
              break;
            case "before-name":
              initializeToken("property");
              replaceState("name");
              break;
            case "before-value":
              replaceState("value");
              break;
            case "before-at-value":
              replaceState("at-value");
              break;
          }
          buffer += ch;
          break;
      }
    }
    return tokens;
  }
});
var parser = createCommonjsModule(function(module, exports) {
  var debug = debug_1("parse");
  exports = module.exports = parse;
  var _comments;
  var _depth;
  var _position;
  var _tokens;
  function parse(css, options) {
    options || (options = {});
    _comments = !!options.comments;
    _position = !!options.position;
    _depth = 0;
    _tokens = Array.isArray(css) ? css.slice() : lexer(css);
    var rule;
    var rules = [];
    var token;
    while (token = next()) {
      rule = parseToken(token);
      rule && rules.push(rule);
    }
    return {
      type: "stylesheet",
      stylesheet: {
        rules
      }
    };
  }
  function astNode(token, override) {
    override || (override = {});
    var key;
    var keys = ["type", "name", "value"];
    var node = {};
    for (var i = 0; i < keys.length; ++i) {
      key = keys[i];
      if (token[key]) {
        node[key] = override[key] || token[key];
      }
    }
    keys = Object.keys(override);
    for (i = 0; i < keys.length; ++i) {
      key = keys[i];
      if (!node[key]) {
        node[key] = override[key];
      }
    }
    if (_position) {
      node.position = {
        start: token.start,
        end: token.end
      };
    }
    return node;
  }
  function next() {
    var token = _tokens.shift();
    return token;
  }
  function parseAtGroup(token) {
    _depth = _depth + 1;
    var overrides = {};
    switch (token.type) {
      case "font-face":
      case "viewport":
        overrides.declarations = parseDeclarations();
        break;
      case "page":
        overrides.prefix = token.prefix;
        overrides.declarations = parseDeclarations();
        break;
      default:
        overrides.prefix = token.prefix;
        overrides.rules = parseRules();
    }
    return astNode(token, overrides);
  }
  function parseAtImport(token) {
    return astNode(token);
  }
  function parseCharset(token) {
    return astNode(token);
  }
  function parseComment(token) {
    return astNode(token, {text: token.text});
  }
  function parseNamespace(token) {
    return astNode(token);
  }
  function parseProperty(token) {
    return astNode(token);
  }
  function parseSelector(token) {
    function trim(str) {
      return str.trim();
    }
    return astNode(token, {
      type: "rule",
      selectors: token.text.split(",").map(trim),
      declarations: parseDeclarations()
    });
  }
  function parseToken(token) {
    switch (token.type) {
      case "property":
        return parseProperty(token);
      case "selector":
        return parseSelector(token);
      case "at-group-end":
        _depth = _depth - 1;
        return;
      case "media":
      case "keyframes":
        return parseAtGroup(token);
      case "comment":
        if (_comments) {
          return parseComment(token);
        }
        break;
      case "charset":
        return parseCharset(token);
      case "import":
        return parseAtImport(token);
      case "namespace":
        return parseNamespace(token);
      case "font-face":
      case "supports":
      case "viewport":
      case "document":
      case "page":
        return parseAtGroup(token);
    }
  }
  function parseTokensWhile(conditionFn) {
    var node;
    var nodes = [];
    var token;
    while ((token = next()) && (conditionFn && conditionFn(token))) {
      node = parseToken(token);
      node && nodes.push(node);
    }
    if (token && token.type !== "end") {
      _tokens.unshift(token);
    }
    return nodes;
  }
  function parseDeclarations() {
    return parseTokensWhile(function(token) {
      return token.type === "property" || token.type === "comment";
    });
  }
  function parseRules() {
    return parseTokensWhile(function() {
      return _depth;
    });
  }
});
var stringify_1 = createCommonjsModule(function(module, exports) {
  var debug = debug_1("stringify");
  var _comments;
  var _compress;
  var _indentation;
  var _level;
  var _n;
  var _s;
  exports = module.exports = stringify;
  function stringify(ast, options) {
    options || (options = {});
    _indentation = options.indentation || "";
    _compress = !!options.compress;
    _comments = !!options.comments;
    _level = 1;
    if (_compress) {
      _n = _s = "";
    } else {
      _n = "\n";
      _s = " ";
    }
    var css = reduce(ast.stylesheet.rules, stringifyNode).join("\n").trim();
    return css;
  }
  function indent(level) {
    if (level) {
      _level += level;
      return;
    }
    if (_compress) {
      return "";
    }
    return Array(_level).join(_indentation || "");
  }
  function stringifyAtRule(node) {
    return "@" + node.type + " " + node.value + ";" + _n;
  }
  function stringifyAtGroup(node) {
    var label = "";
    var prefix = node.prefix || "";
    if (node.name) {
      label = " " + node.name;
    }
    var chomp = node.type !== "page";
    return "@" + prefix + node.type + label + _s + stringifyBlock(node, chomp) + _n;
  }
  function stringifyComment(node) {
    if (!_comments) {
      return "";
    }
    return "/*" + (node.text || "") + "*/" + _n;
  }
  function stringifyRule(node) {
    var label;
    if (node.selectors) {
      label = node.selectors.join("," + _n);
    } else {
      label = "@" + node.type;
      label += node.name ? " " + node.name : "";
    }
    return indent() + label + _s + stringifyBlock(node) + _n;
  }
  function reduce(items, fn) {
    return items.reduce(function(results, item) {
      var result = item.type === "comment" ? stringifyComment(item) : fn(item);
      result && results.push(result);
      return results;
    }, []);
  }
  function stringifyBlock(node, chomp) {
    var children = node.declarations;
    var fn = stringifyDeclaration;
    if (node.rules) {
      children = node.rules;
      fn = stringifyRule;
    }
    children = stringifyChildren(children, fn);
    children && (children = _n + children + (chomp ? "" : _n));
    return "{" + children + indent() + "}";
  }
  function stringifyChildren(children, fn) {
    if (!children) {
      return "";
    }
    indent(1);
    var results = reduce(children, fn);
    indent(-1);
    if (!results.length) {
      return "";
    }
    return results.join(_n);
  }
  function stringifyDeclaration(node) {
    if (node.type === "property") {
      return stringifyProperty(node);
    }
  }
  function stringifyNode(node) {
    switch (node.type) {
      case "rule":
        return stringifyRule(node);
      case "media":
      case "keyframes":
        return stringifyAtGroup(node);
      case "comment":
        return stringifyComment(node);
      case "import":
      case "charset":
      case "namespace":
        return stringifyAtRule(node);
      case "font-face":
      case "supports":
      case "viewport":
      case "document":
      case "page":
        return stringifyAtGroup(node);
    }
  }
  function stringifyProperty(node) {
    var name = node.name ? node.name + ":" + _s : "";
    return indent() + name + node.value + ";";
  }
});
var mensch = {
  lex: lexer,
  parse: parser,
  stringify: stringify_1
};
export default mensch;
var lex = mensch.lex;
export {mensch as __moduleExports, lex};
