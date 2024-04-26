import boolbase_1 from "/-/boolbase@v1.0.0-VOm51i7l8eNaWy5whtPS/dist=es2019,mode=imports/optimized/boolbase.js";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
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
var parse_1 = createCommonjsModule(function(module, exports) {
  Object.defineProperty(exports, "__esModule", {value: true});
  exports.parse = void 0;
  var whitespace = new Set([9, 10, 12, 13, 32]);
  var ZERO = "0".charCodeAt(0);
  var NINE = "9".charCodeAt(0);
  function parse2(formula) {
    formula = formula.trim().toLowerCase();
    if (formula === "even") {
      return [2, 0];
    } else if (formula === "odd") {
      return [2, 1];
    }
    var idx = 0;
    var a = 0;
    var sign = readSign();
    var number = readNumber();
    if (idx < formula.length && formula.charAt(idx) === "n") {
      idx++;
      a = sign * (number !== null && number !== void 0 ? number : 1);
      skipWhitespace();
      if (idx < formula.length) {
        sign = readSign();
        skipWhitespace();
        number = readNumber();
      } else {
        sign = number = 0;
      }
    }
    if (number === null || idx < formula.length) {
      throw new Error("n-th rule couldn't be parsed ('" + formula + "')");
    }
    return [a, sign * number];
    function readSign() {
      if (formula.charAt(idx) === "-") {
        idx++;
        return -1;
      }
      if (formula.charAt(idx) === "+") {
        idx++;
      }
      return 1;
    }
    function readNumber() {
      var start = idx;
      var value = 0;
      while (idx < formula.length && formula.charCodeAt(idx) >= ZERO && formula.charCodeAt(idx) <= NINE) {
        value = value * 10 + (formula.charCodeAt(idx) - ZERO);
        idx++;
      }
      return idx === start ? null : value;
    }
    function skipWhitespace() {
      while (idx < formula.length && whitespace.has(formula.charCodeAt(idx))) {
        idx++;
      }
    }
  }
  exports.parse = parse2;
});
var compile_1 = createCommonjsModule(function(module, exports) {
  Object.defineProperty(exports, "__esModule", {value: true});
  exports.compile = void 0;
  function compile2(parsed) {
    var a = parsed[0];
    var b = parsed[1] - 1;
    if (b < 0 && a <= 0)
      return boolbase_1.falseFunc;
    if (a === -1)
      return function(index) {
        return index <= b;
      };
    if (a === 0)
      return function(index) {
        return index === b;
      };
    if (a === 1)
      return b < 0 ? boolbase_1.trueFunc : function(index) {
        return index >= b;
      };
    var absA = Math.abs(a);
    var bMod = (b % absA + absA) % absA;
    return a > 1 ? function(index) {
      return index >= b && index % absA === bMod;
    } : function(index) {
      return index <= b && index % absA === bMod;
    };
  }
  exports.compile = compile2;
});
var lib = createCommonjsModule(function(module, exports) {
  Object.defineProperty(exports, "__esModule", {value: true});
  exports.compile = exports.parse = void 0;
  Object.defineProperty(exports, "parse", {enumerable: true, get: function() {
    return parse_1.parse;
  }});
  Object.defineProperty(exports, "compile", {enumerable: true, get: function() {
    return compile_1.compile;
  }});
  function nthCheck(formula) {
    return (0, compile_1.compile)((0, parse_1.parse)(formula));
  }
  exports.default = nthCheck;
});
var __pika_web_default_export_for_treeshaking__ = /* @__PURE__ */ getDefaultExportFromCjs(lib);
var compile = lib.compile;
export default __pika_web_default_export_for_treeshaking__;
var parse = lib.parse;
export {lib as __moduleExports, compile, parse};
