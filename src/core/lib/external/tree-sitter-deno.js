// deno-lint-ignore-file
// deno-fmt-ignore-file
//
// tree-sitter-deno.js
//
// A quixotic attempt at a deno version of tree-sitter, based on the
// WASM version and a whole lot of hand-editing.
//
// Note that this module has different exports from how tree-sitter.js works
//
// it exports the Parser class as "TreeSitter", and exports an additional function
// setWasmBinaryFile, which takes an Uint8Array with the WASM contents for tree-sitter.

/*global Deno, WebAssembly, TextDecoder, noExitRuntime, performance, PATH */

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = {};

var wasmBinaryFile;

let wasmInstantiateResolve;
let wasmInstantiatePromise = new Promise((resolve, reject) => { wasmInstantiateResolve = resolve; });

export function setWasmBinaryFile(wbf) {
  wasmBinaryFile = wbf;
}

let init = false;
// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
export let TreeSitter = function() {
  var initPromise;
  class Parser {
    constructor() {
      this.initialize();
    }

    initialize() {
      throw new Error("cannot construct a Parser before calling `init()`");
    }

    static async init(moduleOptions) {
      if (init) return;

      Module = Object.assign({ }, Module, moduleOptions);

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
//
// 2022-01-14: We delete all of the ENVIRONMENT_IS_* and set things up for Deno
        
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_DENO = true;
        
// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';

// Hooks that are implemented differently in different runtime environments.
var read_,
    readBinary,
    setWindowTitle;

var nodeFS;
var nodePath;

if (ENVIRONMENT_IS_DENO) {

read_ = function shell_read(filename, binary) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    return binary ? ret : ret.toString();
  }
  filename = Deno.realPathSync(filename);
  if (binary) {
    return Deno.readFileSync(filename);
  } else {
    return Deno.readTextFileSync(filename);
  }
};

readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

// end include: node_shell_read.js

  quit_ = function(status) {
    Deno.exit(status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };

} else {
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.

var STACK_ALIGN = 16;

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  return Math.ceil(size / factor) * factor;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = Number(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

// include: runtime_functions.js


// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {

  // If the type reflection proposal is available, use the new
  // "WebAssembly.Function" constructor.
  // Otherwise, construct a minimal wasm module importing the JS function and
  // re-exporting it.
  if (typeof WebAssembly.Function === "function") {
    var typeNames = {
      'i': 'i32',
      'j': 'i64',
      'f': 'f32',
      'd': 'f64'
    };
    var type = {
      parameters: [],
      results: sig[0] == 'v' ? [] : [typeNames[sig[0]]]
    };
    for (var i = 1; i < sig.length; ++i) {
      type.parameters.push(typeNames[sig[i]]);
    }
    return new WebAssembly.Function(type, func);
  }

  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  var typeSection = [
    0x01, // id: section,
    0x00, // length: 0 (placeholder)
    0x01, // count: 1
    0x60, // form: func
  ];
  var sigRet = sig.slice(0, 1);
  var sigParam = sig.slice(1);
  var typeCodes = {
    'i': 0x7f, // i32
    'j': 0x7e, // i64
    'f': 0x7d, // f32
    'd': 0x7c, // f64
  };

  // Parameters, length + signatures
  typeSection.push(sigParam.length);
  for (var i = 0; i < sigParam.length; ++i) {
    typeSection.push(typeCodes[sigParam[i]]);
  }

  // Return values, length + signatures
  // With no multi-return in MVP, either 0 (void) or 1 (anything else)
  if (sigRet == 'v') {
    typeSection.push(0x00);
  } else {
    typeSection = typeSection.concat([0x01, typeCodes[sigRet]]);
  }

  // Write the overall length of the type section back into the section header
  // (excepting the 2 bytes for the section id and length)
  typeSection[1] = typeSection.length - 2;

  // Rest of the module is static
  var bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // magic ("\0asm")
    0x01, 0x00, 0x00, 0x00, // version: 1
  ].concat(typeSection, [
    0x02, 0x07, // import section
      // (import "e" "f" (func 0 (type 0)))
      0x01, 0x01, 0x65, 0x01, 0x66, 0x00, 0x00,
    0x07, 0x05, // export section
      // (export "f" (func 0 (type 0)))
      0x01, 0x01, 0x66, 0x00, 0x00,
  ]));

   // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    'e': {
      'f': func
    }
  });
  var wrappedFunc = instance.exports['f'];
  return wrappedFunc;
}

var freeTableIndexes = [];

// Weak map of functions in the table to their indexes, created on first use.
var functionsInTableMap;

function getEmptyTableSlot() {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  try {
    wasmTable.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
  }
  return wasmTable.length - 1;
}

// Add a wasm function to the table.
function addFunctionWasm(func, sig) {
  // Check if the function is already in the table, to ensure each function
  // gets a unique index. First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap();
    for (var i = 0; i < wasmTable.length; i++) {
      var item = wasmTable.get(i);
      // Ignore null values.
      if (item) {
        functionsInTableMap.set(item, i);
      }
    }
  }
  if (functionsInTableMap.has(func)) {
    return functionsInTableMap.get(func);
  }

  // It's not in the table, add it now.

  var ret = getEmptyTableSlot();

  // Set the new value.
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    wasmTable.set(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction: ' + func);
    var wrapped = convertJsFunctionToWasm(func, sig);
    wasmTable.set(ret, wrapped);
  }

  functionsInTableMap.set(func, ret);

  return ret;
}

function removeFunction(index) {
  functionsInTableMap.delete(wasmTable.get(index));
  freeTableIndexes.push(index);
}

// 'sig' parameter is required for the llvm backend but only when func is not
// already a WebAssembly function.
function addFunction(func, sig) {
  assert(typeof func !== 'undefined');

  return addFunctionWasm(func, sig);
}

// end include: runtime_functions.js
// include: runtime_debug.js


// end include: runtime_debug.js
var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var dynamicLibraries = Module['dynamicLibraries'] || [];

var wasmBinary;

if (typeof WebAssembly !== 'object') {
  abort('no native wasm support detected');
}

// include: runtime_safe_heap.js

// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @param {number} ptr
    @param {number} value
    @param {string} type
    @param {number|boolean=} noSafe */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)] = tempI64[0],HEAP32[(((ptr)+(4))>>2)] = tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @param {number} ptr
    @param {string} type
    @param {number|boolean=} noSafe */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

// end include: runtime_safe_heap.js
// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
/** @param {string|null=} returnType
    @param {Array=} argTypes
    @param {Arguments|Array=} args
    @param {Object=} opts */
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);

  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

/** @param {string=} returnType
    @param {Array=} argTypes
    @param {Object=} opts */
function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  };
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((Uint8Array|Array<number>), number)} */
function allocate(slab, allocator) {
  var ret;
  assert(typeof allocator === 'number', 'allocate no longer takes a type argument');
  assert(typeof slab !== 'number', 'allocate no longer takes a number as arg0');

  if (allocator == ALLOC_STACK) {
    ret = stackAlloc(slab.length);
  } else {
    ret = _malloc(slab.length);
  }

  if (slab.subarray || slab.slice) {
    HEAPU8.set(/** @type {!Uint8Array} */(slab), ret);
  } else {
    HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
}

// include: runtime_strings.js


// runtime_strings.js: Strings related runtime functions that are part of both MINIMAL_RUNTIME and regular runtime.

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(heap.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = heap[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = heap[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = heap[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   heap: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 0xC0 | (u >> 6);
      heap[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 0xE0 | (u >> 12);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u >= 0x200000) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x1FFFFF).');
      heap[outIdx++] = 0xF0 | (u >> 18);
      heap[outIdx++] = 0x80 | ((u >> 12) & 63);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}

// end include: runtime_strings.js
// include: runtime_strings_extra.js


// runtime_strings_extra.js: Strings related runtime functions that are available only in regular runtime.

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;

function UTF16ToString(ptr, maxBytesToRead) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  var maxIdx = idx + maxBytesToRead / 2;
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var str = '';

    // If maxBytesToRead is not passed explicitly, it will be undefined, and the for-loop's condition
    // will always evaluate to true. The loop is then terminated on the first null char.
    for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) break;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }

    return str;
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)] = codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr, maxBytesToRead) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(i >= maxBytesToRead / 4)) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0) break;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
  return str;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated
    @param {boolean=} dontAddNull */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)');
  HEAP8.set(array, buffer);
}

/** @param {boolean=} dontAddNull */
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)] = str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)] = 0;
}

// end include: runtime_strings_extra.js
// Memory management

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var TOTAL_STACK = 5242880;
        if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime');

var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 33554432;
if (!Object.getOwnPropertyDescriptor(Module, 'INITIAL_MEMORY')) {
  Object.defineProperty(Module, 'INITIAL_MEMORY', {
    configurable: true,
    get: function() {
      abort('Module.INITIAL_MEMORY has been replaced with plain INITIAL_MEMORY (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)');
    }
  });
}

assert(INITIAL_MEMORY >= TOTAL_STACK, 'INITIAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js


// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)

  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_MEMORY / 65536,
      // In theory we should not need to emit the maximum if we want "unlimited"
      // or 4GB of memory, but VMs error on that atm, see
      // https://github.com/emscripten-core/emscripten/issues/14130
      // And in the pthreads case we definitely need to emit a maximum. So
      // always emit one.
      'maximum': 2147483648 / 65536
    });
  }

if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['INITIAL_MEMORY'].
INITIAL_MEMORY = buffer.byteLength;
assert(INITIAL_MEMORY % 65536 === 0);
updateGlobalBufferAndViews(buffer);

// end include: runtime_init_memory.js

// include: runtime_init_table.js
// In RELOCATABLE mode we create the table in JS.
var wasmTable = new WebAssembly.Table({
  'initial': 21,
  'element': 'anyfunc'
});

// end include: runtime_init_table.js
// include: runtime_stack_check.js


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // The stack grows downwards
  HEAPU32[(max >> 2)+1] = 0x2135467;
  HEAPU32[(max >> 2)+2] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAP32[0] = 0x63736d65; /* 'emsc' */
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  var cookie1 = HEAPU32[(max >> 2)+1];
  var cookie2 = HEAPU32[(max >> 2)+2];
  if (cookie1 != 0x2135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x' + cookie2.toString(16) + ' ' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

// end include: runtime_stack_check.js
// include: runtime_assertions.js


// Endianness check
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian! (Run with -s SUPPORT_BIG_ENDIAN=1 to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;

function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
          
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data
Module["preloadedWasm"] = {}; // maps url to wasm instance exports

/** @param {string|number=} what */
function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what += '';
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  var output = 'abort(' + what + ') at ' + stackTrace();
  what = output;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// {{MEM_INITIALIZER}}

// include: memoryprofiler.js


// end include: memoryprofiler.js
// show errors on likely calls to FS when it was not included
var FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error(); },
  createDataFile: function() { FS.error(); },
  createPreloadedFile: function() { FS.error(); },
  createLazyFile: function() { FS.error(); },
  open: function() { FS.error(); },
  mkdev: function() { FS.error(); },
  registerDevice: function() { FS.error(); },
  analyzePath: function() { FS.error(); },
  loadFilesFromDB: function() { FS.error(); },

  ErrnoError: function ErrnoError() { FS.error(); },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

// include: URIUtils.js


// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  // Prefix of data URIs emitted by SINGLE_FILE and related options.
  return filename.startsWith(dataURIPrefix);
}

// Indicates whether filename is delivered via file protocol (as opposed to http/https)
function isFileURI(filename) {
  return filename.startsWith('file://');
}

// end include: URIUtils.js
function createExportWrapper(name, fixedasm) {
  return function() {
    var displayName = name;
    var asm = fixedasm;
    if (!fixedasm) {
      asm = Module['asm'];
    }
    assert(runtimeInitialized, 'native function `' + displayName + '` called before runtime initialization');
    assert(!runtimeExited, 'native function `' + displayName + '` called after runtime exit (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
    if (!asm[name]) {
      assert(asm[name], 'exported native function `' + displayName + '` not found');
    }
    return asm[name].apply(null, arguments);
  };
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg,
    'GOT.mem': new Proxy(asmLibraryArg, GOTHandler),
    'GOT.func': new Proxy(asmLibraryArg, GOTHandler),
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    var exports = instance.exports;

    exports = relocateExports(exports, 1024);

    Module['asm'] = exports;

    var metadata = getDylinkMetadata(module);
    if (metadata.neededDynlibs) {
      dynamicLibraries = metadata.neededDynlibs.concat(dynamicLibraries);
    }
    mergeLibSymbols(exports, 'main');

    addOnInit(Module['asm']['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
    
    // 2022-01-14: we added this ourselves.
    wasmInstantiateResolve();
  }
  // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    receiveInstance(result['instance'], result['module']);
  }

  // let result = await WebAssembly.instantiate(wasmBinaryFile, info);
  // .... this is causing an exit and (subsequent race condition) deep inside Deno, it seems
  // Let's use the sync api instead.
  
  let wasmModule = new WebAssembly.Module(wasmBinaryFile);
  let wasmInstance = new WebAssembly.Instance(wasmModule, info);
  receiveInstantiationResult({ module: wasmModule, instance: wasmInstance});
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  
};






  var GOT={};
  var GOTHandler={get:function(obj, symName) {
        if (!GOT[symName]) {
          GOT[symName] = new WebAssembly.Global({'value': 'i32', 'mutable': true});
        }
        return GOT[symName];
      }};

  function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
          callback(Module); // Pass the module as the first argument.
          continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            wasmTable.get(func)();
          } else {
            wasmTable.get(func)(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  function getDylinkMetadata(binary) {
      var next = 0;
      function getLEB() {
        var ret = 0;
        var mul = 1;
        while (1) {
          var byte = binary[next++];
          ret += ((byte & 0x7f) * mul);
          mul *= 0x80;
          if (!(byte & 0x80)) break;
        }
        return ret;
      }
  
      if (binary instanceof WebAssembly.Module) {
        var dylinkSection = WebAssembly.Module.customSections(binary, "dylink");
        assert(dylinkSection.length != 0, 'need dylink section');
        binary = new Int8Array(dylinkSection[0]);
      } else {
        var int32View = new Uint32Array(new Uint8Array(binary.subarray(0, 24)).buffer);
        assert(int32View[0] == 0x6d736100, 'need to see wasm magic number'); // \0asm
        // we should see the dylink section right after the magic number and wasm version
        assert(binary[8] === 0, 'need the dylink section to be first');
        next = 9;
        getLEB(); //section size
        assert(binary[next] === 6);                 next++; // size of "dylink" string
        assert(binary[next] === 'd'.charCodeAt(0)); next++;
        assert(binary[next] === 'y'.charCodeAt(0)); next++;
        assert(binary[next] === 'l'.charCodeAt(0)); next++;
        assert(binary[next] === 'i'.charCodeAt(0)); next++;
        assert(binary[next] === 'n'.charCodeAt(0)); next++;
        assert(binary[next] === 'k'.charCodeAt(0)); next++;
      }
  
      var customSection = {};
      customSection.memorySize = getLEB();
      customSection.memoryAlign = getLEB();
      customSection.tableSize = getLEB();
      customSection.tableAlign = getLEB();
      var tableAlign = Math.pow(2, customSection.tableAlign);
      assert(tableAlign === 1, 'invalid tableAlign ' + tableAlign);
      // shared libraries this module needs. We need to load them first, so that
      // current module could resolve its imports. (see tools/shared.py
      // WebAssembly.make_shared_library() for "dylink" section extension format)
      var neededDynlibsCount = getLEB();
      customSection.neededDynlibs = [];
      for (var i = 0; i < neededDynlibsCount; ++i) {
        var nameLen = getLEB();
        var nameUTF8 = binary.subarray(next, next + nameLen);
        next += nameLen;
        var name = UTF8ArrayToString(nameUTF8, 0);
        customSection.neededDynlibs.push(name);
      }
      return customSection;
    }

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }

  var runtimeKeepaliveCounter=0;
  function keepRuntimeAlive() {
      return noExitRuntime || runtimeKeepaliveCounter > 0;
    }

  function asmjsMangle(x) {
      var unmangledSymbols = ['stackAlloc','stackSave','stackRestore'];
      return x.indexOf('dynCall_') == 0 || unmangledSymbols.includes(x) ? x : '_' + x;
    }
  function mergeLibSymbols(exports, libName) {
      // add symbols into global namespace TODO: weak linking etc.
      for (var sym in exports) {
        if (!exports.hasOwnProperty(sym)) {
          continue;
        }
  
        // When RTLD_GLOBAL is enable, the symbols defined by this shared object will be made
        // available for symbol resolution of subsequently loaded shared objects.
        //
        // We should copy the symbols (which include methods and variables) from SIDE_MODULE to MAIN_MODULE.
  
        if (!asmLibraryArg.hasOwnProperty(sym)) {
          asmLibraryArg[sym] = exports[sym];
        }
  
        // Export native export on the Module object.
        // TODO(sbc): Do all users want this?  Should we skip this by default?
        var module_sym = asmjsMangle(sym);
        if (!Module.hasOwnProperty(module_sym)) {
          Module[module_sym] = exports[sym];
        }
      }
    }

  var LDSO={nextHandle:1,loadedLibs:{},loadedLibNames:{}};
  
  function dynCallLegacy(sig, ptr, args) {
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      if (args && args.length) {
        // j (64-bit integer) must be passed in as two numbers [low 32, high 32].
        assert(args.length === sig.substring(1).replace(/j/g, '--').length);
      } else {
        assert(sig.length == 1);
      }
      var f = Module["dynCall_" + sig];
      return args && args.length ? f.apply(null, [ptr].concat(args)) : f.call(null, ptr);
    }
  function dynCall(sig, ptr, args) {
      // Without WASM_BIGINT support we cannot directly call function with i64 as
      // part of thier signature, so we rely the dynCall functions generated by
      // wasm-emscripten-finalize
      if (sig.includes('j')) {
        return dynCallLegacy(sig, ptr, args);
      }
      assert(wasmTable.get(ptr), 'missing table entry in dynCall: ' + ptr);
      return wasmTable.get(ptr).apply(null, args);
    }
  function createInvokeFunction(sig) {
      return function() {
        var sp = stackSave();
        try {
          return dynCall(sig, arguments[0], Array.prototype.slice.call(arguments, 1));
        } catch(e) {
          stackRestore(sp);
          if (e !== e+0 && e !== 'longjmp') throw e;
          _setThrew(1, 0);
        }
      };
    }
  
  var ___heap_base=5251008;
  Module["___heap_base"] = ___heap_base;
  function getMemory(size) {
      // After the runtime is initialized, we must only use sbrk() normally.
      if (runtimeInitialized)
        return _malloc(size);
      var ret = ___heap_base;
      var end = (ret + size + 15) & -16;
      assert(end <= HEAP8.length, 'failure to getMemory - memory growth etc. is not supported there, call malloc/sbrk directly or increase INITIAL_MEMORY');
      ___heap_base = end;
      GOT['__heap_base'].value = end;
      return ret;
    }
  
  function isInternalSym(symName) {
      // TODO: find a way to mark these in the binary or avoid exporting them.
      return [
        '__cpp_exception',
        '__wasm_apply_data_relocs',
        '__dso_handle',
        '__set_stack_limits'
      ].includes(symName)
      ;
    }
  function updateGOT(exports) {
      for (var symName in exports) {
        if (isInternalSym(symName)) {
          continue;
        }
  
        var replace = false;
        var value = exports[symName];
        if (symName.startsWith('orig$')) {
          symName = symName.split('$')[1];
          replace = true;
        }
  
        if (!GOT[symName]) {
          GOT[symName] = new WebAssembly.Global({'value': 'i32', 'mutable': true});
        }
        if (replace || GOT[symName].value == 0) {
          if (typeof value === 'function') {
            GOT[symName].value = addFunctionWasm(value);
          } else if (typeof value === 'number') {
            GOT[symName].value = value;
          } else {
            err("unhandled export type for `" + symName + "`: " + (typeof value));
          }
        }
      }
    }
  function relocateExports(exports, memoryBase) {
      var relocated = {};
  
      for (var e in exports) {
        var value = exports[e];
        if (typeof value === 'object') {
          // a breaking change in the wasm spec, globals are now objects
          // https://github.com/WebAssembly/mutable-global/issues/1
          value = value.value;
        }
        if (typeof value === 'number') {
          value += memoryBase;
        }
        relocated[e] = value;
      }
      updateGOT(relocated);
      return relocated;
    }
  
  function resolveGlobalSymbol(symName, direct) {
      var sym;
      if (direct) {
        // First look for the orig$ symbol which is the symbols without
        // any legalization performed.
        sym = asmLibraryArg['orig$' + symName];
      }
      if (!sym) {
        sym = asmLibraryArg[symName];
      }
  
      // Check for the symbol on the Module object.  This is the only
      // way to dynamically access JS library symbols that were not
      // referenced by the main module (and therefore not part of the
      // initial set of symbols included in asmLibraryArg when it
      // was declared.
      if (!sym) {
        sym = Module[asmjsMangle(symName)];
      }
  
      if (!sym && symName.startsWith('invoke_')) {
        sym = createInvokeFunction(symName.split('_')[1]);
      }
  
      return sym;
    }
  function loadWebAssemblyModule(binary, flags) {
      var metadata = getDylinkMetadata(binary);
      var originalTable = wasmTable;
  
      // loadModule loads the wasm module after all its dependencies have been loaded.
      // can be called both sync/async.
      function loadModule() {
        // alignments are powers of 2
        var memAlign = Math.pow(2, metadata.memoryAlign);
        // finalize alignments and verify them
        memAlign = Math.max(memAlign, STACK_ALIGN); // we at least need stack alignment
        // prepare memory
        var memoryBase = alignMemory(getMemory(metadata.memorySize + memAlign), memAlign); // TODO: add to cleanups
        // TODO: use only __memory_base and __table_base, need to update asm.js backend
        var tableBase = wasmTable.length;
        wasmTable.grow(metadata.tableSize);
        // zero-initialize memory and table
        // The static area consists of explicitly initialized data, followed by zero-initialized data.
        // The latter may need zeroing out if the MAIN_MODULE has already used this memory area before
        // dlopen'ing the SIDE_MODULE.  Since we don't know the size of the explicitly initialized data
        // here, we just zero the whole thing, which is suboptimal, but should at least resolve bugs
        // from uninitialized memory.
          for (var i = memoryBase; i < memoryBase + metadata.memorySize; i++) {
            HEAP8[i] = 0;
          }
        for (var i = tableBase; i < tableBase + metadata.tableSize; i++) {
          wasmTable.set(i, null);
        }
  
        // This is the export map that we ultimately return.  We declare it here
        // so it can be used within resolveSymbol.  We resolve symbols against
        // this local symbol map in the case there they are not present on the
        // global Module object.  We need this fallback because:
        // a) Modules sometime need to import their own symbols
        // b) Symbols from side modules are not always added to the global namespace.
        var moduleExports;
  
        function resolveSymbol(sym) {
          var resolved = resolveGlobalSymbol(sym, false);
          if (!resolved) {
            resolved = moduleExports[sym];
          }
          assert(resolved, 'undefined symbol `' + sym + '`. perhaps a side module was not linked in? if this global was expected to arrive from a system library, try to build the MAIN_MODULE with EMCC_FORCE_STDLIBS=1 in the environment');
          return resolved;
        }
  
        // TODO kill ↓↓↓ (except "symbols local to this module", it will likely be
        // not needed if we require that if A wants symbols from B it has to link
        // to B explicitly: similarly to -Wl,--no-undefined)
        //
        // wasm dynamic libraries are pure wasm, so they cannot assist in
        // their own loading. When side module A wants to import something
        // provided by a side module B that is loaded later, we need to
        // add a layer of indirection, but worse, we can't even tell what
        // to add the indirection for, without inspecting what A's imports
        // are. To do that here, we use a JS proxy (another option would
        // be to inspect the binary directly).
        var proxyHandler = {
          'get': function(stubs, prop) {
            // symbols that should be local to this module
            switch (prop) {
              case '__memory_base':
                return memoryBase;
              case '__table_base':
                return tableBase;
            }
            if (prop in asmLibraryArg) {
              // No stub needed, symbol already exists in symbol table
              return asmLibraryArg[prop];
            }
            // Return a stub function that will resolve the symbol
            // when first called.
            if (!(prop in stubs)) {
              var resolved;
              stubs[prop] = function() {
                if (!resolved) resolved = resolveSymbol(prop, true);
                return resolved.apply(null, arguments);
              };
            }
            return stubs[prop];
          }
        };
        var proxy = new Proxy({}, proxyHandler);
        var info = {
          'GOT.mem': new Proxy({}, GOTHandler),
          'GOT.func': new Proxy({}, GOTHandler),
          'env': proxy,
          wasi_snapshot_preview1: proxy,
        };
  
        function postInstantiation(instance) {
          // the table should be unchanged
          assert(wasmTable === originalTable);
          // add new entries to functionsInTableMap
          for (var i = 0; i < metadata.tableSize; i++) {
            var item = wasmTable.get(tableBase + i);
            // verify that the new table region was filled in
            assert(item !== undefined, 'table entry was not filled in');
            // Ignore null values.
            if (item) {
              functionsInTableMap.set(item, tableBase + i);
            }
          }
          moduleExports = relocateExports(instance.exports, memoryBase);
          if (!flags.allowUndefined) {
            reportUndefinedSymbols();
          }
  
          // initialize the module
            var init = moduleExports['__wasm_call_ctors'];
            // TODO(sbc): Remove this once extra check once the binaryen
            // change propogates: https://github.com/WebAssembly/binaryen/pull/3811
            if (!init) {
              init = moduleExports['__post_instantiate'];
            }
            if (init) {
              if (runtimeInitialized) {
                init();
              } else {
                // we aren't ready to run compiled code yet
                __ATINIT__.push(init);
              }
            }
          return moduleExports;
        }
  
        var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
        var instance = new WebAssembly.Instance(module, info);
        return postInstantiation(instance);
      }
  
      // now load needed libraries and the module itself.
      if (flags.loadAsync) {
        return metadata.neededDynlibs.reduce(function(chain, dynNeeded) {
          return chain.then(function() {
            return loadDynamicLibrary(dynNeeded, flags);
          });
        }, Promise.resolve()).then(function() {
          return loadModule();
        });
      }
  
      metadata.neededDynlibs.forEach(function(dynNeeded) {
        loadDynamicLibrary(dynNeeded, flags);
      });
      return loadModule();
    }
  
  function fetchBinary(url) {
      return fetch(url, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load binary file at '" + url + "'";
        }
        return response['arrayBuffer']();
      }).then(function(buffer) {
        return new Uint8Array(buffer);
      });
    }
  function loadDynamicLibrary(lib, flags) {
      if (lib == '__main__' && !LDSO.loadedLibNames[lib]) {
        LDSO.loadedLibs[-1] = {
          refcount: Infinity,   // = nodelete
          name:     '__main__',
          module:   Module['asm'],
          global:   true
        };
        LDSO.loadedLibNames['__main__'] = -1;
      }
  
      // when loadDynamicLibrary did not have flags, libraries were loaded globally & permanently
      flags = flags || {global: true, nodelete: true};
  
      var handle = LDSO.loadedLibNames[lib];
      var dso;
      if (handle) {
        // the library is being loaded or has been loaded already.
        //
        // however it could be previously loaded only locally and if we get
        // load request with global=true we have to make it globally visible now.
        dso = LDSO.loadedLibs[handle];
        if (flags.global && !dso.global) {
          dso.global = true;
          if (dso.module !== 'loading') {
            // ^^^ if module is 'loading' - symbols merging will be eventually done by the loader.
            mergeLibSymbols(dso.module, lib);
          }
        }
        // same for "nodelete"
        if (flags.nodelete && dso.refcount !== Infinity) {
          dso.refcount = Infinity;
        }
        dso.refcount++;
        return flags.loadAsync ? Promise.resolve(handle) : handle;
      }
  
      // allocate new DSO & handle
      handle = LDSO.nextHandle++;
      dso = {
        refcount: flags.nodelete ? Infinity : 1,
        name:     lib,
        module:   'loading',
        global:   flags.global,
      };
      LDSO.loadedLibNames[lib] = handle;
      LDSO.loadedLibs[handle] = dso;
  
      // libData <- libFile
      function loadLibData(libFile) {
        // for wasm, we can use fetch for async, but for fs mode we can only imitate it
        if (flags.fs) {
          var libData = flags.fs.readFile(libFile, {encoding: 'binary'});
          if (!(libData instanceof Uint8Array)) {
            libData = new Uint8Array(libData);
          }
          return flags.loadAsync ? Promise.resolve(libData) : libData;
        }
  
        if (flags.loadAsync) {
          return fetchBinary(libFile);
        }
        // load the binary synchronously
        return readBinary(libFile);
      }
  
      // libModule <- lib
      function getLibModule() {
        // lookup preloaded cache first
        if (Module['preloadedWasm'] !== undefined &&
            Module['preloadedWasm'][lib] !== undefined) {
          var libModule = Module['preloadedWasm'][lib];
          return flags.loadAsync ? Promise.resolve(libModule) : libModule;
        }
  
        // module not preloaded - load lib data and create new module from it
        if (flags.loadAsync) {
          return loadLibData(lib).then(function(libData) {
            return loadWebAssemblyModule(libData, flags);
          });
        }
  
        return loadWebAssemblyModule(loadLibData(lib), flags);
      }
  
      // module for lib is loaded - update the dso & global namespace
      function moduleLoaded(libModule) {
        if (dso.global) {
          mergeLibSymbols(libModule, lib);
        }
        dso.module = libModule;
      }
  
      if (flags.loadAsync) {
        return getLibModule().then(function(libModule) {
          moduleLoaded(libModule);
          return handle;
        });
      }
  
      moduleLoaded(getLibModule());
      return handle;
    }
  
  function reportUndefinedSymbols() {
      for (var symName in GOT) {
        if (GOT[symName].value == 0) {
          var value = resolveGlobalSymbol(symName, true);
          assert(value, 'undefined symbol `' + symName + '`. perhaps a side module was not linked in? if this global was expected to arrive from a system library, try to build the MAIN_MODULE with EMCC_FORCE_STDLIBS=1 in the environment');
          if (typeof value === 'function') {
            GOT[symName].value = addFunctionWasm(value, value.sig);
          } else if (typeof value === 'number') {
            GOT[symName].value = value;
          } else {
            assert(false, 'bad export type for `' + symName + '`: ' + (typeof value));
          }
        }
      }
    }
  function preloadDylibs() {
      if (!dynamicLibraries.length) {
        reportUndefinedSymbols();
        return;
      }
  
      // if we can load dynamic libraries synchronously, do so, otherwise, preload
      if (!readBinary) {
        // we can't read binary data synchronously, so preload
        addRunDependency('preloadDylibs');
        dynamicLibraries.reduce(function(chain, lib) {
          return chain.then(function() {
            return loadDynamicLibrary(lib, {loadAsync: true, global: true, nodelete: true, allowUndefined: true});
          });
        }, Promise.resolve()).then(function() {
          // we got them all, wonderful
          removeRunDependency('preloadDylibs');
          reportUndefinedSymbols();
        });
        return;
      }
  
      dynamicLibraries.forEach(function(lib) {
        // libraries linked to main never go away
        loadDynamicLibrary(lib, {global: true, nodelete: true, allowUndefined: true});
      });
      reportUndefinedSymbols();
    }



  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }


  var ___stack_pointer=new WebAssembly.Global({'value': 'i32', 'mutable': true}, 5251008);

  function _abort() {
      abort();
    }
  Module["_abort"] = _abort;
  _abort.sig = 'v';

  var _emscripten_get_now = function() { return performance.now(); };
  
  var _emscripten_get_now_is_monotonic=true;;
  
  function setErrNo(value) {
      HEAP32[((___errno_location())>>2)] = value;
      return value;
    }
  function _clock_gettime(clk_id, tp) {
      // int clock_gettime(clockid_t clk_id, struct timespec *tp);
      var now;
      if (clk_id === 0) {
        now = Date.now();
      } else if ((clk_id === 1 || clk_id === 4) && _emscripten_get_now_is_monotonic) {
        now = _emscripten_get_now();
      } else {
        setErrNo(28);
        return -1;
      }
      HEAP32[((tp)>>2)] = (now/1000)|0; // seconds
      HEAP32[(((tp)+(4))>>2)] = ((now % 1000)*1000*1000)|0; // nanoseconds
      return 0;
    }
  _clock_gettime.sig = 'iii';

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

  function emscripten_realloc_buffer(size) {
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow((size - buffer.byteLength + 65535) >>> 16); // .grow() takes a delta compared to the previous size
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1 /*success*/;
      } catch(e) {
        console.error('emscripten_realloc_buffer: Attempted to grow heap from ' + buffer.byteLength  + ' bytes to ' + size + ' bytes, but got error: ' + e);
      }
      // implicit 0 return to save code size (caller will cast "undefined" into 0
      // anyhow)
    }
  function _emscripten_resize_heap(requestedSize) {
      var oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      // With pthreads, races can happen (another thread might increase the size in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
      // Memory resize rules:
      // 1. Always increase heap size to at least the requested size, rounded up to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap geometrically: increase the heap size according to 
      //                                         MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%),
      //                                         At most overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap linearly: increase the heap size by at least MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3. Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4. If we were unable to allocate as much memory, it may be due to over-eager decision to excessively reserve due to (3) above.
      //    Hence if an allocation fails, cut down on the amount of excess growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      // In CAN_ADDRESS_2GB mode, stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate full 4GB Wasm memories, the size will wrap
      // back to 0 bytes in Wasm side for any code that deals with heap sizes, which would require special casing all heap size related code to treat
      // 0 specially.
      var maxHeapSize = 2147483648;
      if (requestedSize > maxHeapSize) {
        err('Cannot enlarge memory, asked to go up to ' + requestedSize + ' bytes, but the limit is ' + maxHeapSize + ' bytes!');
        return false;
      }
  
      // Loop through potential heap size increases. If we attempt a too eager reservation that fails, cut down on the
      // attempted size and reserve a smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
  
          return true;
        }
      }
      err('Failed to grow the heap from ' + oldSize + ' bytes to ' + newSize + ' bytes, not enough memory!');
      return false;
    }

  function _exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      exit(status);
    }
  _exit.sig = 'vi';

  var SYSCALLS={mappings:{},DEFAULT_POLLMASK:5,umask:511,calculateAt:function(dirfd, path, allowEmpty) {
        if (path[0] === '/') {
          return path;
        }
        // relative path
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = FS.getStream(dirfd);
          if (!dirstream) throw new FS.ErrnoError(8);
          dir = dirstream.path;
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);;
          }
          return dir;
        }
        return PATH.join2(dir, path);
      },doStat:function(func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -54;
          }
          throw e;
        }
        HEAP32[((buf)>>2)] = stat.dev;
        HEAP32[(((buf)+(4))>>2)] = 0;
        HEAP32[(((buf)+(8))>>2)] = stat.ino;
        HEAP32[(((buf)+(12))>>2)] = stat.mode;
        HEAP32[(((buf)+(16))>>2)] = stat.nlink;
        HEAP32[(((buf)+(20))>>2)] = stat.uid;
        HEAP32[(((buf)+(24))>>2)] = stat.gid;
        HEAP32[(((buf)+(28))>>2)] = stat.rdev;
        HEAP32[(((buf)+(32))>>2)] = 0;
        (tempI64 = [stat.size>>>0,(tempDouble=stat.size,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((buf)+(40))>>2)] = tempI64[0],HEAP32[(((buf)+(44))>>2)] = tempI64[1]);
        HEAP32[(((buf)+(48))>>2)] = 4096;
        HEAP32[(((buf)+(52))>>2)] = stat.blocks;
        HEAP32[(((buf)+(56))>>2)] = (stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)] = 0;
        HEAP32[(((buf)+(64))>>2)] = (stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)] = 0;
        HEAP32[(((buf)+(72))>>2)] = (stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(76))>>2)] = 0;
        (tempI64 = [stat.ino>>>0,(tempDouble=stat.ino,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((buf)+(80))>>2)] = tempI64[0],HEAP32[(((buf)+(84))>>2)] = tempI64[1]);
        return 0;
      },doMsync:function(addr, stream, len, flags, offset) {
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },doMkdir:function(path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function(path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -28;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function(path, buf, bufsize) {
        if (bufsize <= 0) return -28;
        var ret = FS.readlink(path);
  
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf+len];
        stringToUTF8(ret, buf, bufsize+1);
        // readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
        // stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
        HEAP8[buf+len] = endChar;
  
        return len;
      },doAccess:function(path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -28;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        if (!node) {
          return -44;
        }
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -2;
        }
        return 0;
      },doDup:function(path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function(stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.read(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break; // nothing more to read
        }
        return ret;
      },doWritev:function(stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:undefined,get:function() {
        assert(SYSCALLS.varargs != undefined);
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },getStreamFromFD:function(fd) {
        var stream = FS.getStream(fd);
        if (!stream) throw new FS.ErrnoError(8);
        return stream;
      },get64:function(low, high) {
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      }};
  function _fd_close(fd) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }
  _fd_close.sig = 'ii';

  function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {try {
  
      
      var stream = SYSCALLS.getStreamFromFD(fd);
      var HIGH_OFFSET = 0x100000000; // 2^32
      // use an unsigned operator on low and shift high by 32-bits
      var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
  
      var DOUBLE_LIMIT = 0x20000000000000; // 2^53
      // we also check for equality since DOUBLE_LIMIT + 1 == DOUBLE_LIMIT
      if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
        return -61;
      }
  
      FS.llseek(stream, offset, whence);
      (tempI64 = [stream.position>>>0,(tempDouble=stream.position,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((newOffset)>>2)] = tempI64[0],HEAP32[(((newOffset)+(4))>>2)] = tempI64[1]);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_write(fd, iov, iovcnt, pnum) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = SYSCALLS.doWritev(stream, iov, iovcnt);
      HEAP32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }
  _fd_write.sig = 'iiiii';

  function _setTempRet0(val) {
      setTempRet0(val);
    }
  _setTempRet0.sig = 'vi';

  function _tree_sitter_log_callback(isLexMessage, messageAddress) {
      if (currentLogCallback) {
        const message = UTF8ToString(messageAddress);
        currentLogCallback(message, isLexMessage !== 0);
      }
    }

  function _tree_sitter_parse_callback(
      inputBufferAddress,
      index,
      row,
      column,
      lengthAddress
    ) {
      var INPUT_BUFFER_SIZE = 10 * 1024;
      var string = currentParseCallback(index, {row: row, column: column});
      if (typeof string === 'string') {
        setValue(lengthAddress, string.length, 'i32');
        stringToUTF16(string, inputBufferAddress, INPUT_BUFFER_SIZE);
      } else {
        setValue(lengthAddress, 0, 'i32');
      }
    }


  var ___memory_base=1024;

  var ___table_base=1;

var ASSERTIONS = true;



/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {string} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return undefined;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


var asmLibraryArg = {
  "__heap_base": ___heap_base,
  "__indirect_function_table": wasmTable,
  "__memory_base": ___memory_base,
  "__stack_pointer": ___stack_pointer,
  "__table_base": ___table_base,
  "abort": _abort,
  "clock_gettime": _clock_gettime,
  "emscripten_memcpy_big": _emscripten_memcpy_big,
  "emscripten_resize_heap": _emscripten_resize_heap,
  "exit": _exit,
  "fd_close": _fd_close,
  "fd_seek": _fd_seek,
  "fd_write": _fd_write,
  "memory": wasmMemory,
  "setTempRet0": _setTempRet0,
  "tree_sitter_log_callback": _tree_sitter_log_callback,
  "tree_sitter_parse_callback": _tree_sitter_parse_callback
};

var asm = await createWasm();

/** @type {function(...*):?} */
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = createExportWrapper("__wasm_call_ctors");

/** @type {function(...*):?} */
var _ts_language_symbol_count = Module["_ts_language_symbol_count"] = createExportWrapper("ts_language_symbol_count");

/** @type {function(...*):?} */
var _ts_language_version = Module["_ts_language_version"] = createExportWrapper("ts_language_version");

/** @type {function(...*):?} */
var _ts_language_field_count = Module["_ts_language_field_count"] = createExportWrapper("ts_language_field_count");

/** @type {function(...*):?} */
var _ts_language_symbol_name = Module["_ts_language_symbol_name"] = createExportWrapper("ts_language_symbol_name");

/** @type {function(...*):?} */
var _ts_language_symbol_for_name = Module["_ts_language_symbol_for_name"] = createExportWrapper("ts_language_symbol_for_name");

/** @type {function(...*):?} */
var _ts_language_symbol_type = Module["_ts_language_symbol_type"] = createExportWrapper("ts_language_symbol_type");

/** @type {function(...*):?} */
var _ts_language_field_name_for_id = Module["_ts_language_field_name_for_id"] = createExportWrapper("ts_language_field_name_for_id");

/** @type {function(...*):?} */
var _memcpy = Module["_memcpy"] = createExportWrapper("memcpy");

/** @type {function(...*):?} */
var _free = Module["_free"] = createExportWrapper("free");

/** @type {function(...*):?} */
var _calloc = Module["_calloc"] = createExportWrapper("calloc");

/** @type {function(...*):?} */
var _ts_parser_delete = Module["_ts_parser_delete"] = createExportWrapper("ts_parser_delete");

/** @type {function(...*):?} */
var _ts_parser_set_language = Module["_ts_parser_set_language"] = createExportWrapper("ts_parser_set_language");

/** @type {function(...*):?} */
var _ts_parser_reset = Module["_ts_parser_reset"] = createExportWrapper("ts_parser_reset");

/** @type {function(...*):?} */
var _ts_parser_timeout_micros = Module["_ts_parser_timeout_micros"] = createExportWrapper("ts_parser_timeout_micros");

/** @type {function(...*):?} */
var _ts_parser_set_timeout_micros = Module["_ts_parser_set_timeout_micros"] = createExportWrapper("ts_parser_set_timeout_micros");

/** @type {function(...*):?} */
var _ts_query_new = Module["_ts_query_new"] = createExportWrapper("ts_query_new");

/** @type {function(...*):?} */
var _ts_query_delete = Module["_ts_query_delete"] = createExportWrapper("ts_query_delete");

/** @type {function(...*):?} */
var _malloc = Module["_malloc"] = createExportWrapper("malloc");

/** @type {function(...*):?} */
var _iswspace = Module["_iswspace"] = createExportWrapper("iswspace");

/** @type {function(...*):?} */
var _ts_query_pattern_count = Module["_ts_query_pattern_count"] = createExportWrapper("ts_query_pattern_count");

/** @type {function(...*):?} */
var _ts_query_capture_count = Module["_ts_query_capture_count"] = createExportWrapper("ts_query_capture_count");

/** @type {function(...*):?} */
var _ts_query_string_count = Module["_ts_query_string_count"] = createExportWrapper("ts_query_string_count");

/** @type {function(...*):?} */
var _ts_query_capture_name_for_id = Module["_ts_query_capture_name_for_id"] = createExportWrapper("ts_query_capture_name_for_id");

/** @type {function(...*):?} */
var _ts_query_string_value_for_id = Module["_ts_query_string_value_for_id"] = createExportWrapper("ts_query_string_value_for_id");

/** @type {function(...*):?} */
var _ts_query_predicates_for_pattern = Module["_ts_query_predicates_for_pattern"] = createExportWrapper("ts_query_predicates_for_pattern");

/** @type {function(...*):?} */
var _memmove = Module["_memmove"] = createExportWrapper("memmove");

/** @type {function(...*):?} */
var _memcmp = Module["_memcmp"] = createExportWrapper("memcmp");

/** @type {function(...*):?} */
var _ts_tree_copy = Module["_ts_tree_copy"] = createExportWrapper("ts_tree_copy");

/** @type {function(...*):?} */
var _ts_tree_delete = Module["_ts_tree_delete"] = createExportWrapper("ts_tree_delete");

/** @type {function(...*):?} */
var _iswalnum = Module["_iswalnum"] = createExportWrapper("iswalnum");

/** @type {function(...*):?} */
var _ts_init = Module["_ts_init"] = createExportWrapper("ts_init");

/** @type {function(...*):?} */
var _ts_parser_new_wasm = Module["_ts_parser_new_wasm"] = createExportWrapper("ts_parser_new_wasm");

/** @type {function(...*):?} */
var _ts_parser_enable_logger_wasm = Module["_ts_parser_enable_logger_wasm"] = createExportWrapper("ts_parser_enable_logger_wasm");

/** @type {function(...*):?} */
var _ts_parser_parse_wasm = Module["_ts_parser_parse_wasm"] = createExportWrapper("ts_parser_parse_wasm");

/** @type {function(...*):?} */
var _ts_language_type_is_named_wasm = Module["_ts_language_type_is_named_wasm"] = createExportWrapper("ts_language_type_is_named_wasm");

/** @type {function(...*):?} */
var _ts_language_type_is_visible_wasm = Module["_ts_language_type_is_visible_wasm"] = createExportWrapper("ts_language_type_is_visible_wasm");

/** @type {function(...*):?} */
var _ts_tree_root_node_wasm = Module["_ts_tree_root_node_wasm"] = createExportWrapper("ts_tree_root_node_wasm");

/** @type {function(...*):?} */
var _ts_tree_edit_wasm = Module["_ts_tree_edit_wasm"] = createExportWrapper("ts_tree_edit_wasm");

/** @type {function(...*):?} */
var _ts_tree_get_changed_ranges_wasm = Module["_ts_tree_get_changed_ranges_wasm"] = createExportWrapper("ts_tree_get_changed_ranges_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_new_wasm = Module["_ts_tree_cursor_new_wasm"] = createExportWrapper("ts_tree_cursor_new_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_delete_wasm = Module["_ts_tree_cursor_delete_wasm"] = createExportWrapper("ts_tree_cursor_delete_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_reset_wasm = Module["_ts_tree_cursor_reset_wasm"] = createExportWrapper("ts_tree_cursor_reset_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_goto_first_child_wasm = Module["_ts_tree_cursor_goto_first_child_wasm"] = createExportWrapper("ts_tree_cursor_goto_first_child_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_goto_next_sibling_wasm = Module["_ts_tree_cursor_goto_next_sibling_wasm"] = createExportWrapper("ts_tree_cursor_goto_next_sibling_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_goto_parent_wasm = Module["_ts_tree_cursor_goto_parent_wasm"] = createExportWrapper("ts_tree_cursor_goto_parent_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_current_node_type_id_wasm = Module["_ts_tree_cursor_current_node_type_id_wasm"] = createExportWrapper("ts_tree_cursor_current_node_type_id_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_current_node_is_named_wasm = Module["_ts_tree_cursor_current_node_is_named_wasm"] = createExportWrapper("ts_tree_cursor_current_node_is_named_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_current_node_is_missing_wasm = Module["_ts_tree_cursor_current_node_is_missing_wasm"] = createExportWrapper("ts_tree_cursor_current_node_is_missing_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_current_node_id_wasm = Module["_ts_tree_cursor_current_node_id_wasm"] = createExportWrapper("ts_tree_cursor_current_node_id_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_start_position_wasm = Module["_ts_tree_cursor_start_position_wasm"] = createExportWrapper("ts_tree_cursor_start_position_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_end_position_wasm = Module["_ts_tree_cursor_end_position_wasm"] = createExportWrapper("ts_tree_cursor_end_position_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_start_index_wasm = Module["_ts_tree_cursor_start_index_wasm"] = createExportWrapper("ts_tree_cursor_start_index_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_end_index_wasm = Module["_ts_tree_cursor_end_index_wasm"] = createExportWrapper("ts_tree_cursor_end_index_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_current_field_id_wasm = Module["_ts_tree_cursor_current_field_id_wasm"] = createExportWrapper("ts_tree_cursor_current_field_id_wasm");

/** @type {function(...*):?} */
var _ts_tree_cursor_current_node_wasm = Module["_ts_tree_cursor_current_node_wasm"] = createExportWrapper("ts_tree_cursor_current_node_wasm");

/** @type {function(...*):?} */
var _ts_node_symbol_wasm = Module["_ts_node_symbol_wasm"] = createExportWrapper("ts_node_symbol_wasm");

/** @type {function(...*):?} */
var _ts_node_child_count_wasm = Module["_ts_node_child_count_wasm"] = createExportWrapper("ts_node_child_count_wasm");

/** @type {function(...*):?} */
var _ts_node_named_child_count_wasm = Module["_ts_node_named_child_count_wasm"] = createExportWrapper("ts_node_named_child_count_wasm");

/** @type {function(...*):?} */
var _ts_node_child_wasm = Module["_ts_node_child_wasm"] = createExportWrapper("ts_node_child_wasm");

/** @type {function(...*):?} */
var _ts_node_named_child_wasm = Module["_ts_node_named_child_wasm"] = createExportWrapper("ts_node_named_child_wasm");

/** @type {function(...*):?} */
var _ts_node_child_by_field_id_wasm = Module["_ts_node_child_by_field_id_wasm"] = createExportWrapper("ts_node_child_by_field_id_wasm");

/** @type {function(...*):?} */
var _ts_node_next_sibling_wasm = Module["_ts_node_next_sibling_wasm"] = createExportWrapper("ts_node_next_sibling_wasm");

/** @type {function(...*):?} */
var _ts_node_prev_sibling_wasm = Module["_ts_node_prev_sibling_wasm"] = createExportWrapper("ts_node_prev_sibling_wasm");

/** @type {function(...*):?} */
var _ts_node_next_named_sibling_wasm = Module["_ts_node_next_named_sibling_wasm"] = createExportWrapper("ts_node_next_named_sibling_wasm");

/** @type {function(...*):?} */
var _ts_node_prev_named_sibling_wasm = Module["_ts_node_prev_named_sibling_wasm"] = createExportWrapper("ts_node_prev_named_sibling_wasm");

/** @type {function(...*):?} */
var _ts_node_parent_wasm = Module["_ts_node_parent_wasm"] = createExportWrapper("ts_node_parent_wasm");

/** @type {function(...*):?} */
var _ts_node_descendant_for_index_wasm = Module["_ts_node_descendant_for_index_wasm"] = createExportWrapper("ts_node_descendant_for_index_wasm");

/** @type {function(...*):?} */
var _ts_node_named_descendant_for_index_wasm = Module["_ts_node_named_descendant_for_index_wasm"] = createExportWrapper("ts_node_named_descendant_for_index_wasm");

/** @type {function(...*):?} */
var _ts_node_descendant_for_position_wasm = Module["_ts_node_descendant_for_position_wasm"] = createExportWrapper("ts_node_descendant_for_position_wasm");

/** @type {function(...*):?} */
var _ts_node_named_descendant_for_position_wasm = Module["_ts_node_named_descendant_for_position_wasm"] = createExportWrapper("ts_node_named_descendant_for_position_wasm");

/** @type {function(...*):?} */
var _ts_node_start_point_wasm = Module["_ts_node_start_point_wasm"] = createExportWrapper("ts_node_start_point_wasm");

/** @type {function(...*):?} */
var _ts_node_end_point_wasm = Module["_ts_node_end_point_wasm"] = createExportWrapper("ts_node_end_point_wasm");

/** @type {function(...*):?} */
var _ts_node_start_index_wasm = Module["_ts_node_start_index_wasm"] = createExportWrapper("ts_node_start_index_wasm");

/** @type {function(...*):?} */
var _ts_node_end_index_wasm = Module["_ts_node_end_index_wasm"] = createExportWrapper("ts_node_end_index_wasm");

/** @type {function(...*):?} */
var _ts_node_to_string_wasm = Module["_ts_node_to_string_wasm"] = createExportWrapper("ts_node_to_string_wasm");

/** @type {function(...*):?} */
var _ts_node_children_wasm = Module["_ts_node_children_wasm"] = createExportWrapper("ts_node_children_wasm");

/** @type {function(...*):?} */
var _ts_node_named_children_wasm = Module["_ts_node_named_children_wasm"] = createExportWrapper("ts_node_named_children_wasm");

/** @type {function(...*):?} */
var _ts_node_descendants_of_type_wasm = Module["_ts_node_descendants_of_type_wasm"] = createExportWrapper("ts_node_descendants_of_type_wasm");

/** @type {function(...*):?} */
var _ts_node_is_named_wasm = Module["_ts_node_is_named_wasm"] = createExportWrapper("ts_node_is_named_wasm");

/** @type {function(...*):?} */
var _ts_node_has_changes_wasm = Module["_ts_node_has_changes_wasm"] = createExportWrapper("ts_node_has_changes_wasm");

/** @type {function(...*):?} */
var _ts_node_has_error_wasm = Module["_ts_node_has_error_wasm"] = createExportWrapper("ts_node_has_error_wasm");

/** @type {function(...*):?} */
var _ts_node_is_missing_wasm = Module["_ts_node_is_missing_wasm"] = createExportWrapper("ts_node_is_missing_wasm");

/** @type {function(...*):?} */
var _ts_query_matches_wasm = Module["_ts_query_matches_wasm"] = createExportWrapper("ts_query_matches_wasm");

/** @type {function(...*):?} */
var _ts_query_captures_wasm = Module["_ts_query_captures_wasm"] = createExportWrapper("ts_query_captures_wasm");

/** @type {function(...*):?} */
var ___errno_location = Module["___errno_location"] = createExportWrapper("__errno_location");

/** @type {function(...*):?} */
var _iswalpha = Module["_iswalpha"] = createExportWrapper("iswalpha");

/** @type {function(...*):?} */
var _towupper = Module["_towupper"] = createExportWrapper("towupper");

/** @type {function(...*):?} */
var _iswlower = Module["_iswlower"] = createExportWrapper("iswlower");

/** @type {function(...*):?} */
var _iswdigit = Module["_iswdigit"] = createExportWrapper("iswdigit");

/** @type {function(...*):?} */
var _memchr = Module["_memchr"] = createExportWrapper("memchr");

/** @type {function(...*):?} */
var _strlen = Module["_strlen"] = createExportWrapper("strlen");

/** @type {function(...*):?} */
var stackSave = Module["stackSave"] = createExportWrapper("stackSave");

/** @type {function(...*):?} */
var stackRestore = Module["stackRestore"] = createExportWrapper("stackRestore");

/** @type {function(...*):?} */
var stackAlloc = Module["stackAlloc"] = createExportWrapper("stackAlloc");

/** @type {function(...*):?} */
var _emscripten_stack_set_limits = Module["_emscripten_stack_set_limits"] = function() {
  return (_emscripten_stack_set_limits = Module["_emscripten_stack_set_limits"] = Module["asm"]["emscripten_stack_set_limits"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = function() {
  return (_emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = Module["asm"]["emscripten_stack_get_free"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = function() {
  return (_emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = Module["asm"]["emscripten_stack_get_end"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _setThrew = Module["_setThrew"] = createExportWrapper("setThrew");

/** @type {function(...*):?} */
var __Znwm = Module["__Znwm"] = createExportWrapper("_Znwm");

/** @type {function(...*):?} */
var __ZdlPv = Module["__ZdlPv"] = createExportWrapper("_ZdlPv");

/** @type {function(...*):?} */
var __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv = Module["__ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv"] = createExportWrapper("_ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv");

/** @type {function(...*):?} */
var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev"] = createExportWrapper("_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev");

/** @type {function(...*):?} */
var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm"] = createExportWrapper("_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm");

/** @type {function(...*):?} */
var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcm = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcm"] = createExportWrapper("_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcm");

/** @type {function(...*):?} */
var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm"] = createExportWrapper("_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm");

/** @type {function(...*):?} */
var __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4copyEPcmm = Module["__ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4copyEPcmm"] = createExportWrapper("_ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4copyEPcmm");

/** @type {function(...*):?} */
var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc"] = createExportWrapper("_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc");

/** @type {function(...*):?} */
var __ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev = Module["__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev"] = createExportWrapper("_ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev");

/** @type {function(...*):?} */
var __ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw = Module["__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw"] = createExportWrapper("_ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw");

/** @type {function(...*):?} */
var dynCall_jiji = Module["dynCall_jiji"] = createExportWrapper("dynCall_jiji");

/** @type {function(...*):?} */
var _orig$ts_parser_timeout_micros = Module["_orig$ts_parser_timeout_micros"] = createExportWrapper("orig$ts_parser_timeout_micros");

/** @type {function(...*):?} */
var _orig$ts_parser_set_timeout_micros = Module["_orig$ts_parser_set_timeout_micros"] = createExportWrapper("orig$ts_parser_set_timeout_micros");

var _stderr = Module['_stderr'] = 7088;
var _TRANSFER_BUFFER = Module['_TRANSFER_BUFFER'] = 7472;
var ___THREW__ = Module['___THREW__'] = 8116;
var ___threwValue = Module['___threwValue'] = 8120;
var ___cxa_new_handler = Module['___cxa_new_handler'] = 8112;
var ___data_end = Module['___data_end'] = 8124;



// === Auto-generated postamble setup entry stuff ===

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "ccall")) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "cwrap")) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getValue")) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
Module["allocate"] = allocate;
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"); };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"); };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"); };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"); };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"); };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"); };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"); };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"); };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "addFunction")) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "removeFunction")) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "callMain")) Module["callMain"] = function() { abort("'callMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "abort")) Module["abort"] = function() { abort("'abort' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stringToNewUTF8")) Module["stringToNewUTF8"] = function() { abort("'stringToNewUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "setFileTime")) Module["setFileTime"] = function() { abort("'setFileTime' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "emscripten_realloc_buffer")) Module["emscripten_realloc_buffer"] = function() { abort("'emscripten_realloc_buffer' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_CODES")) Module["ERRNO_CODES"] = function() { abort("'ERRNO_CODES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_MESSAGES")) Module["ERRNO_MESSAGES"] = function() { abort("'ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "setErrNo")) Module["setErrNo"] = function() { abort("'setErrNo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton4")) Module["inetPton4"] = function() { abort("'inetPton4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop4")) Module["inetNtop4"] = function() { abort("'inetNtop4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton6")) Module["inetPton6"] = function() { abort("'inetPton6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop6")) Module["inetNtop6"] = function() { abort("'inetNtop6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "readSockaddr")) Module["readSockaddr"] = function() { abort("'readSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeSockaddr")) Module["writeSockaddr"] = function() { abort("'writeSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "DNS")) Module["DNS"] = function() { abort("'DNS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getHostByName")) Module["getHostByName"] = function() { abort("'getHostByName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "GAI_ERRNO_MESSAGES")) Module["GAI_ERRNO_MESSAGES"] = function() { abort("'GAI_ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "Protocols")) Module["Protocols"] = function() { abort("'Protocols' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "Sockets")) Module["Sockets"] = function() { abort("'Sockets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getRandomDevice")) Module["getRandomDevice"] = function() { abort("'getRandomDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "traverseStack")) Module["traverseStack"] = function() { abort("'traverseStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "UNWIND_CACHE")) Module["UNWIND_CACHE"] = function() { abort("'UNWIND_CACHE' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "withBuiltinMalloc")) Module["withBuiltinMalloc"] = function() { abort("'withBuiltinMalloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgsArray")) Module["readAsmConstArgsArray"] = function() { abort("'readAsmConstArgsArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgs")) Module["readAsmConstArgs"] = function() { abort("'readAsmConstArgs' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "mainThreadEM_ASM")) Module["mainThreadEM_ASM"] = function() { abort("'mainThreadEM_ASM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_q")) Module["jstoi_q"] = function() { abort("'jstoi_q' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_s")) Module["jstoi_s"] = function() { abort("'jstoi_s' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getExecutableName")) Module["getExecutableName"] = function() { abort("'getExecutableName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "listenOnce")) Module["listenOnce"] = function() { abort("'listenOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "autoResumeAudioContext")) Module["autoResumeAudioContext"] = function() { abort("'autoResumeAudioContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "dynCallLegacy")) Module["dynCallLegacy"] = function() { abort("'dynCallLegacy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getDynCaller")) Module["getDynCaller"] = function() { abort("'getDynCaller' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "callRuntimeCallbacks")) Module["callRuntimeCallbacks"] = function() { abort("'callRuntimeCallbacks' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepaliveCounter")) Module["runtimeKeepaliveCounter"] = function() { abort("'runtimeKeepaliveCounter' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "keepRuntimeAlive")) Module["keepRuntimeAlive"] = function() { abort("'keepRuntimeAlive' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePush")) Module["runtimeKeepalivePush"] = function() { abort("'runtimeKeepalivePush' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePop")) Module["runtimeKeepalivePop"] = function() { abort("'runtimeKeepalivePop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "callUserCallback")) Module["callUserCallback"] = function() { abort("'callUserCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "maybeExit")) Module["maybeExit"] = function() { abort("'maybeExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "asmjsMangle")) Module["asmjsMangle"] = function() { abort("'asmjsMangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "reallyNegative")) Module["reallyNegative"] = function() { abort("'reallyNegative' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "unSign")) Module["unSign"] = function() { abort("'unSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "reSign")) Module["reSign"] = function() { abort("'reSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "formatString")) Module["formatString"] = function() { abort("'formatString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "PATH")) Module["PATH"] = function() { abort("'PATH' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "PATH_FS")) Module["PATH_FS"] = function() { abort("'PATH_FS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "SYSCALLS")) Module["SYSCALLS"] = function() { abort("'SYSCALLS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMmap2")) Module["syscallMmap2"] = function() { abort("'syscallMmap2' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMunmap")) Module["syscallMunmap"] = function() { abort("'syscallMunmap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketFromFD")) Module["getSocketFromFD"] = function() { abort("'getSocketFromFD' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketAddress")) Module["getSocketAddress"] = function() { abort("'getSocketAddress' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "JSEvents")) Module["JSEvents"] = function() { abort("'JSEvents' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerKeyEventCallback")) Module["registerKeyEventCallback"] = function() { abort("'registerKeyEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "specialHTMLTargets")) Module["specialHTMLTargets"] = function() { abort("'specialHTMLTargets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "maybeCStringToJsString")) Module["maybeCStringToJsString"] = function() { abort("'maybeCStringToJsString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "findEventTarget")) Module["findEventTarget"] = function() { abort("'findEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "findCanvasEventTarget")) Module["findCanvasEventTarget"] = function() { abort("'findCanvasEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getBoundingClientRect")) Module["getBoundingClientRect"] = function() { abort("'getBoundingClientRect' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillMouseEventData")) Module["fillMouseEventData"] = function() { abort("'fillMouseEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerMouseEventCallback")) Module["registerMouseEventCallback"] = function() { abort("'registerMouseEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerWheelEventCallback")) Module["registerWheelEventCallback"] = function() { abort("'registerWheelEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerUiEventCallback")) Module["registerUiEventCallback"] = function() { abort("'registerUiEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerFocusEventCallback")) Module["registerFocusEventCallback"] = function() { abort("'registerFocusEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceOrientationEventData")) Module["fillDeviceOrientationEventData"] = function() { abort("'fillDeviceOrientationEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceOrientationEventCallback")) Module["registerDeviceOrientationEventCallback"] = function() { abort("'registerDeviceOrientationEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceMotionEventData")) Module["fillDeviceMotionEventData"] = function() { abort("'fillDeviceMotionEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceMotionEventCallback")) Module["registerDeviceMotionEventCallback"] = function() { abort("'registerDeviceMotionEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "screenOrientation")) Module["screenOrientation"] = function() { abort("'screenOrientation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillOrientationChangeEventData")) Module["fillOrientationChangeEventData"] = function() { abort("'fillOrientationChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerOrientationChangeEventCallback")) Module["registerOrientationChangeEventCallback"] = function() { abort("'registerOrientationChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillFullscreenChangeEventData")) Module["fillFullscreenChangeEventData"] = function() { abort("'fillFullscreenChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerFullscreenChangeEventCallback")) Module["registerFullscreenChangeEventCallback"] = function() { abort("'registerFullscreenChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerRestoreOldStyle")) Module["registerRestoreOldStyle"] = function() { abort("'registerRestoreOldStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "hideEverythingExceptGivenElement")) Module["hideEverythingExceptGivenElement"] = function() { abort("'hideEverythingExceptGivenElement' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "restoreHiddenElements")) Module["restoreHiddenElements"] = function() { abort("'restoreHiddenElements' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "setLetterbox")) Module["setLetterbox"] = function() { abort("'setLetterbox' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "currentFullscreenStrategy")) Module["currentFullscreenStrategy"] = function() { abort("'currentFullscreenStrategy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "restoreOldWindowedStyle")) Module["restoreOldWindowedStyle"] = function() { abort("'restoreOldWindowedStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "softFullscreenResizeWebGLRenderTarget")) Module["softFullscreenResizeWebGLRenderTarget"] = function() { abort("'softFullscreenResizeWebGLRenderTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "doRequestFullscreen")) Module["doRequestFullscreen"] = function() { abort("'doRequestFullscreen' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillPointerlockChangeEventData")) Module["fillPointerlockChangeEventData"] = function() { abort("'fillPointerlockChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockChangeEventCallback")) Module["registerPointerlockChangeEventCallback"] = function() { abort("'registerPointerlockChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockErrorEventCallback")) Module["registerPointerlockErrorEventCallback"] = function() { abort("'registerPointerlockErrorEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "requestPointerLock")) Module["requestPointerLock"] = function() { abort("'requestPointerLock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillVisibilityChangeEventData")) Module["fillVisibilityChangeEventData"] = function() { abort("'fillVisibilityChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerVisibilityChangeEventCallback")) Module["registerVisibilityChangeEventCallback"] = function() { abort("'registerVisibilityChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerTouchEventCallback")) Module["registerTouchEventCallback"] = function() { abort("'registerTouchEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillGamepadEventData")) Module["fillGamepadEventData"] = function() { abort("'fillGamepadEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerGamepadEventCallback")) Module["registerGamepadEventCallback"] = function() { abort("'registerGamepadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerBeforeUnloadEventCallback")) Module["registerBeforeUnloadEventCallback"] = function() { abort("'registerBeforeUnloadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fillBatteryEventData")) Module["fillBatteryEventData"] = function() { abort("'fillBatteryEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "battery")) Module["battery"] = function() { abort("'battery' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "registerBatteryEventCallback")) Module["registerBatteryEventCallback"] = function() { abort("'registerBatteryEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "setCanvasElementSize")) Module["setCanvasElementSize"] = function() { abort("'setCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getCanvasElementSize")) Module["getCanvasElementSize"] = function() { abort("'getCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "polyfillSetImmediate")) Module["polyfillSetImmediate"] = function() { abort("'polyfillSetImmediate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "demangle")) Module["demangle"] = function() { abort("'demangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "demangleAll")) Module["demangleAll"] = function() { abort("'demangleAll' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "jsStackTrace")) Module["jsStackTrace"] = function() { abort("'jsStackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getEnvStrings")) Module["getEnvStrings"] = function() { abort("'getEnvStrings' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "checkWasiClock")) Module["checkWasiClock"] = function() { abort("'checkWasiClock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64")) Module["writeI53ToI64"] = function() { abort("'writeI53ToI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Clamped")) Module["writeI53ToI64Clamped"] = function() { abort("'writeI53ToI64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Signaling")) Module["writeI53ToI64Signaling"] = function() { abort("'writeI53ToI64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Clamped")) Module["writeI53ToU64Clamped"] = function() { abort("'writeI53ToU64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Signaling")) Module["writeI53ToU64Signaling"] = function() { abort("'writeI53ToU64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromI64")) Module["readI53FromI64"] = function() { abort("'readI53FromI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromU64")) Module["readI53FromU64"] = function() { abort("'readI53FromU64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "convertI32PairToI53")) Module["convertI32PairToI53"] = function() { abort("'convertI32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "convertU32PairToI53")) Module["convertU32PairToI53"] = function() { abort("'convertU32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "resolveGlobalSymbol")) Module["resolveGlobalSymbol"] = function() { abort("'resolveGlobalSymbol' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "GOT")) Module["GOT"] = function() { abort("'GOT' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "GOTHandler")) Module["GOTHandler"] = function() { abort("'GOTHandler' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "isInternalSym")) Module["isInternalSym"] = function() { abort("'isInternalSym' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "updateGOT")) Module["updateGOT"] = function() { abort("'updateGOT' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "relocateExports")) Module["relocateExports"] = function() { abort("'relocateExports' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "reportUndefinedSymbols")) Module["reportUndefinedSymbols"] = function() { abort("'reportUndefinedSymbols' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "DLFCN")) Module["DLFCN"] = function() { abort("'DLFCN' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "LDSO")) Module["LDSO"] = function() { abort("'LDSO' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "createInvokeFunction")) Module["createInvokeFunction"] = function() { abort("'createInvokeFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getMemory")) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "fetchBinary")) Module["fetchBinary"] = function() { abort("'fetchBinary' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getDylinkMetadata")) Module["getDylinkMetadata"] = function() { abort("'getDylinkMetadata' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "mergeLibSymbols")) Module["mergeLibSymbols"] = function() { abort("'mergeLibSymbols' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "loadWebAssemblyModule")) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "loadDynamicLibrary")) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "preloadDylibs")) Module["preloadDylibs"] = function() { abort("'preloadDylibs' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "uncaughtExceptionCount")) Module["uncaughtExceptionCount"] = function() { abort("'uncaughtExceptionCount' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionLast")) Module["exceptionLast"] = function() { abort("'exceptionLast' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionCaught")) Module["exceptionCaught"] = function() { abort("'exceptionCaught' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "ExceptionInfoAttrs")) Module["ExceptionInfoAttrs"] = function() { abort("'ExceptionInfoAttrs' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "ExceptionInfo")) Module["ExceptionInfo"] = function() { abort("'ExceptionInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "CatchInfo")) Module["CatchInfo"] = function() { abort("'CatchInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "exception_addRef")) Module["exception_addRef"] = function() { abort("'exception_addRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "exception_decRef")) Module["exception_decRef"] = function() { abort("'exception_decRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "Browser")) Module["Browser"] = function() { abort("'Browser' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "funcWrappers")) Module["funcWrappers"] = function() { abort("'funcWrappers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "setMainLoop")) Module["setMainLoop"] = function() { abort("'setMainLoop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "tempFixedLengthArray")) Module["tempFixedLengthArray"] = function() { abort("'tempFixedLengthArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "miniTempWebGLFloatBuffers")) Module["miniTempWebGLFloatBuffers"] = function() { abort("'miniTempWebGLFloatBuffers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "heapObjectForWebGLType")) Module["heapObjectForWebGLType"] = function() { abort("'heapObjectForWebGLType' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "heapAccessShiftForWebGLHeap")) Module["heapAccessShiftForWebGLHeap"] = function() { abort("'heapAccessShiftForWebGLHeap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGet")) Module["emscriptenWebGLGet"] = function() { abort("'emscriptenWebGLGet' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "computeUnpackAlignedImageSize")) Module["computeUnpackAlignedImageSize"] = function() { abort("'computeUnpackAlignedImageSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetTexPixelData")) Module["emscriptenWebGLGetTexPixelData"] = function() { abort("'emscriptenWebGLGetTexPixelData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetUniform")) Module["emscriptenWebGLGetUniform"] = function() { abort("'emscriptenWebGLGetUniform' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetUniformLocation")) Module["webglGetUniformLocation"] = function() { abort("'webglGetUniformLocation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "webglPrepareUniformLocationsBeforeFirstUse")) Module["webglPrepareUniformLocationsBeforeFirstUse"] = function() { abort("'webglPrepareUniformLocationsBeforeFirstUse' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetLeftBracePos")) Module["webglGetLeftBracePos"] = function() { abort("'webglGetLeftBracePos' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetVertexAttrib")) Module["emscriptenWebGLGetVertexAttrib"] = function() { abort("'emscriptenWebGLGetVertexAttrib' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "writeGLArray")) Module["writeGLArray"] = function() { abort("'writeGLArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "AL")) Module["AL"] = function() { abort("'AL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_unicode")) Module["SDL_unicode"] = function() { abort("'SDL_unicode' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_ttfContext")) Module["SDL_ttfContext"] = function() { abort("'SDL_ttfContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_audio")) Module["SDL_audio"] = function() { abort("'SDL_audio' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "SDL")) Module["SDL"] = function() { abort("'SDL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_gfx")) Module["SDL_gfx"] = function() { abort("'SDL_gfx' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "GLUT")) Module["GLUT"] = function() { abort("'GLUT' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "EGL")) Module["EGL"] = function() { abort("'EGL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW_Window")) Module["GLFW_Window"] = function() { abort("'GLFW_Window' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW")) Module["GLFW"] = function() { abort("'GLFW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "GLEW")) Module["GLEW"] = function() { abort("'GLEW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "IDBStore")) Module["IDBStore"] = function() { abort("'IDBStore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "runAndAbortIfError")) Module["runAndAbortIfError"] = function() { abort("'runAndAbortIfError' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8OnStack")) Module["allocateUTF8OnStack"] = function() { abort("'allocateUTF8OnStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
Module["writeStackCookie"] = writeStackCookie;
Module["checkStackCookie"] = checkStackCookie;
if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromBase64")) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "tryParseAsDataURI")) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); };
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { configurable: true, get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { configurable: true, get: function() { abort("'ALLOC_STACK' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)"); } });

var calledRun;

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  var entryFunction = Module['_main'];

  // Main modules can't tell if they have main() at compile time, since it may
  // arrive from a dynamic library.
  if (!entryFunction) return;

  args = args || [];

  var argc = args.length+1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;

  try {

    var ret = entryFunction(argc, argv);

    // In PROXY_TO_PTHREAD builds, we should never exit the runtime below, as
    // execution is asynchronously handed off to a pthread.
      // if we're not running an evented main loop, it's time to exit
      exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'unwind') {
      // running an evented main loop, don't immediately exit
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      err('exception thrown: ' + toLog);
      quit_(1, e);
    }
  } finally {
    calledMain = true;

  }
}

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  _emscripten_stack_set_limits(5251008, 8128);
  writeStackCookie();
}

var dylibsLoaded = false;

/** @type {function(Array=)} */
async function run(args) {
  args = args || arguments_;

  // 2022-01-14: In the deno env, we're somehow getting here _only once_ and
  // while the wasm module is loading. I don't understand how this works in the
  // browser but I don't want to. We simply await on a promise we created ourselves.

  await wasmInstantiatePromise;

  if (runDependencies > 0) {
    return;
  }

  stackCheckInit();

  if (!dylibsLoaded) {
  // Loading of dynamic libraries needs to happen on each thread, so we can't
  // use the normal __ATPRERUN__ mechanism.
    preloadDylibs();
    dylibsLoaded = true;

    // Loading dylibs can add run dependencies.
    if (runDependencies > 0) {
      return;
    }
  }

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (shouldRunNow) callMain(args);

    postRun();
  }

  doRun();

  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  };
  try { // it doesn't matter if it fails
    var flush = Module['_fflush'];
    if (flush) flush(0);
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

/** @param {boolean|number=} implicit */
function exit(status, implicit) {
  EXITSTATUS = status;

  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && keepRuntimeAlive() && status === 0) {
    return;
  }

  if (keepRuntimeAlive()) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      var msg = 'program exited (with status: ' + status + '), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)';
      err(msg);
    }
  } else {

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);

    ABORT = true;
  }

  quit_(status, new ExitStatus(status));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;

if (Module['noInitialRun']) shouldRunNow = false;

        
const C = Module;
const INTERNAL = {};
const SIZE_OF_INT = 4;
const SIZE_OF_NODE = 5 * SIZE_OF_INT;
const SIZE_OF_POINT = 2 * SIZE_OF_INT;
const SIZE_OF_RANGE = 2 * SIZE_OF_INT + 2 * SIZE_OF_POINT;
const ZERO_POINT = {row: 0, column: 0};
const QUERY_WORD_REGEX = /[\w-.]*/g;

const PREDICATE_STEP_TYPE_CAPTURE = 1;
const PREDICATE_STEP_TYPE_STRING = 2;

const LANGUAGE_FUNCTION_REGEX = /^_?tree_sitter_\w+/;

var VERSION;
var MIN_COMPATIBLE_VERSION;
var TRANSFER_BUFFER;
var currentParseCallback;
var currentLogCallback;

class ParserImpl {
  static init() {
    TRANSFER_BUFFER = C._ts_init();
    VERSION = getValue(TRANSFER_BUFFER, 'i32');
    MIN_COMPATIBLE_VERSION = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
  }

  initialize() {
    C._ts_parser_new_wasm();
    this[0] = getValue(TRANSFER_BUFFER, 'i32');
    this[1] = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
  }

  delete() {
    C._ts_parser_delete(this[0]);
    C._free(this[1]);
    this[0] = 0;
    this[1] = 0;
  }

  setLanguage(language) {
    let address;
    if (!language) {
      address = 0;
      language = null;
    } else if (language.constructor === Language) {
      address = language[0];
      const version = C._ts_language_version(address);
      if (version < MIN_COMPATIBLE_VERSION || VERSION < version) {
        throw new Error(
          `Incompatible language version ${version}. ` +
          `Compatibility range ${MIN_COMPATIBLE_VERSION} through ${VERSION}.`
        );
      }
    } else {
      throw new Error('Argument must be a Language');
    }
    this.language = language;
    C._ts_parser_set_language(this[0], address);
    return this;
  }

  getLanguage() {
    return this.language;
  }

  parse(callback, oldTree, options) {
    if (typeof callback === 'string') {
      currentParseCallback = (index, _, endIndex) => callback.slice(index, endIndex);
    } else if (typeof callback === 'function') {
      currentParseCallback = callback;
    } else {
      throw new Error("Argument must be a string or a function");
    }

    if (this.logCallback) {
      currentLogCallback = this.logCallback;
      C._ts_parser_enable_logger_wasm(this[0], 1);
    } else {
      currentLogCallback = null;
      C._ts_parser_enable_logger_wasm(this[0], 0);
    }

    let rangeCount = 0;
    let rangeAddress = 0;
    if (options && options.includedRanges) {
      rangeCount = options.includedRanges.length;
      rangeAddress = C._calloc(rangeCount, SIZE_OF_RANGE);
      let address = rangeAddress;
      for (let i = 0; i < rangeCount; i++) {
        marshalRange(address, options.includedRanges[i]);
        address += SIZE_OF_RANGE;
      }
    }

    const treeAddress = C._ts_parser_parse_wasm(
      this[0],
      this[1],
      oldTree ? oldTree[0] : 0,
      rangeAddress,
      rangeCount
    );

    if (!treeAddress) {
      currentParseCallback = null;
      currentLogCallback = null;
      throw new Error('Parsing failed');
    }

    const result = new Tree(INTERNAL, treeAddress, this.language, currentParseCallback);
    currentParseCallback = null;
    currentLogCallback = null;
    return result;
  }

  reset() {
    C._ts_parser_reset(this[0]);
  }

  setTimeoutMicros(timeout) {
    C._ts_parser_set_timeout_micros(this[0], timeout);
  }

  getTimeoutMicros() {
    return C._ts_parser_timeout_micros(this[0]);
  }

  setLogger(callback) {
    if (!callback) {
      callback = null;
    } else if (typeof callback !== "function") {
      throw new Error("Logger callback must be a function");
    }
    this.logCallback = callback;
    return this;
  }

  getLogger() {
    return this.logCallback;
  }
}

class Tree {
  constructor(internal, address, language, textCallback) {
    assertInternal(internal);
    this[0] = address;
    this.language = language;
    this.textCallback = textCallback;
  }

  copy() {
    const address = C._ts_tree_copy(this[0]);
    return new Tree(INTERNAL, address, this.language, this.textCallback);
  }

  delete() {
    C._ts_tree_delete(this[0]);
    this[0] = 0;
  }

  edit(edit) {
    marshalEdit(edit);
    C._ts_tree_edit_wasm(this[0]);
  }

  get rootNode() {
    C._ts_tree_root_node_wasm(this[0]);
    return unmarshalNode(this);
  }

  getLanguage() {
    return this.language;
  }

  walk() {
    return this.rootNode.walk();
  }

  getChangedRanges(other) {
    if (other.constructor !== Tree) {
      throw new TypeError('Argument must be a Tree');
    }

    C._ts_tree_get_changed_ranges_wasm(this[0], other[0]);
    const count = getValue(TRANSFER_BUFFER, 'i32');
    const buffer = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i = 0; i < count; i++) {
        result[i] = unmarshalRange(address);
        address += SIZE_OF_RANGE;
      }
      C._free(buffer);
    }
    return result;
  }
}

class Node {
  constructor(internal, tree) {
    assertInternal(internal);
    this.tree = tree;
  }

  get typeId() {
    marshalNode(this);
    return C._ts_node_symbol_wasm(this.tree[0]);
  }

  get type() {
    return this.tree.language.types[this.typeId] || 'ERROR';
  }

  get endPosition() {
    marshalNode(this);
    C._ts_node_end_point_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }

  get endIndex() {
    marshalNode(this);
    return C._ts_node_end_index_wasm(this.tree[0]);
  }

  get text() {
    return getText(this.tree, this.startIndex, this.endIndex);
  }

  isNamed() {
    marshalNode(this);
    return C._ts_node_is_named_wasm(this.tree[0]) === 1;
  }

  hasError() {
    marshalNode(this);
    return C._ts_node_has_error_wasm(this.tree[0]) === 1;
  }

  hasChanges() {
    marshalNode(this);
    return C._ts_node_has_changes_wasm(this.tree[0]) === 1;
  }

  isMissing() {
    marshalNode(this);
    return C._ts_node_is_missing_wasm(this.tree[0]) === 1;
  }

  equals(other) {
    return this.id === other.id;
  }

  child(index) {
    marshalNode(this);
    C._ts_node_child_wasm(this.tree[0], index);
    return unmarshalNode(this.tree);
  }

  namedChild(index) {
    marshalNode(this);
    C._ts_node_named_child_wasm(this.tree[0], index);
    return unmarshalNode(this.tree);
  }

  childForFieldId(fieldId) {
    marshalNode(this);
    C._ts_node_child_by_field_id_wasm(this.tree[0], fieldId);
    return unmarshalNode(this.tree);
  }

  childForFieldName(fieldName) {
    const fieldId = this.tree.language.fields.indexOf(fieldName);
    if (fieldId !== -1) return this.childForFieldId(fieldId);
    return undefined;
  }

  get childCount() {
    marshalNode(this);
    return C._ts_node_child_count_wasm(this.tree[0]);
  }

  get namedChildCount() {
    marshalNode(this);
    return C._ts_node_named_child_count_wasm(this.tree[0]);
  }

  get firstChild() {
    return this.child(0);
  }

  get firstNamedChild() {
    return this.namedChild(0);
  }

  get lastChild() {
    return this.child(this.childCount - 1);
  }

  get lastNamedChild() {
    return this.namedChild(this.namedChildCount - 1);
  }

  get children() {
    if (!this._children) {
      marshalNode(this);
      C._ts_node_children_wasm(this.tree[0]);
      const count = getValue(TRANSFER_BUFFER, 'i32');
      const buffer = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
      this._children = new Array(count);
      if (count > 0) {
        let address = buffer;
        for (let i = 0; i < count; i++) {
          this._children[i] = unmarshalNode(this.tree, address);
          address += SIZE_OF_NODE;
        }
        C._free(buffer);
      }
    }
    return this._children;
  }

  get namedChildren() {
    if (!this._namedChildren) {
      marshalNode(this);
      C._ts_node_named_children_wasm(this.tree[0]);
      const count = getValue(TRANSFER_BUFFER, 'i32');
      const buffer = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
      this._namedChildren = new Array(count);
      if (count > 0) {
        let address = buffer;
        for (let i = 0; i < count; i++) {
          this._namedChildren[i] = unmarshalNode(this.tree, address);
          address += SIZE_OF_NODE;
        }
        C._free(buffer);
      }
    }
    return this._namedChildren;
  }

  descendantsOfType(types, startPosition, endPosition) {
    if (!Array.isArray(types)) types = [types];
    if (!startPosition) startPosition = ZERO_POINT;
    if (!endPosition) endPosition = ZERO_POINT;

    // Convert the type strings to numeric type symbols.
    const symbols = [];
    const typesBySymbol = this.tree.language.types;
    for (let i = 0, n = typesBySymbol.length; i < n; i++) {
      if (types.includes(typesBySymbol[i])) {
        symbols.push(i);
      }
    }

    // Copy the array of symbols to the WASM heap.
    const symbolsAddress = C._malloc(SIZE_OF_INT * symbols.length);
    for (let i = 0, n = symbols.length; i < n; i++) {
      setValue(symbolsAddress + i * SIZE_OF_INT, symbols[i], 'i32');
    }

    // Call the C API to compute the descendants.
    marshalNode(this);
    C._ts_node_descendants_of_type_wasm(
      this.tree[0],
      symbolsAddress,
      symbols.length,
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column
    );

    // Instantiate the nodes based on the data returned.
    const descendantCount = getValue(TRANSFER_BUFFER, 'i32');
    const descendantAddress = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
    const result = new Array(descendantCount);
    if (descendantCount > 0) {
      let address = descendantAddress;
      for (let i = 0; i < descendantCount; i++) {
        result[i] = unmarshalNode(this.tree, address);
        address += SIZE_OF_NODE;
      }
    }

    // Free the intermediate buffers
    C._free(descendantAddress);
    C._free(symbolsAddress);
    return result;
  }

  get nextSibling() {
    marshalNode(this);
    C._ts_node_next_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  get previousSibling() {
    marshalNode(this);
    C._ts_node_prev_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  get nextNamedSibling() {
    marshalNode(this);
    C._ts_node_next_named_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  get previousNamedSibling() {
    marshalNode(this);
    C._ts_node_prev_named_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  get parent() {
    marshalNode(this);
    C._ts_node_parent_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  descendantForIndex(start, end = start) {
    if (typeof start !== 'number' || typeof end !== 'number') {
      throw new Error('Arguments must be numbers');
    }

    marshalNode(this);
    let address = TRANSFER_BUFFER + SIZE_OF_NODE;
    setValue(address, start, 'i32');
    setValue(address + SIZE_OF_INT, end, 'i32');
    C._ts_node_descendant_for_index_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  namedDescendantForIndex(start, end = start) {
    if (typeof start !== 'number' || typeof end !== 'number') {
      throw new Error('Arguments must be numbers');
    }

    marshalNode(this);
    let address = TRANSFER_BUFFER + SIZE_OF_NODE;
    setValue(address, start, 'i32');
    setValue(address + SIZE_OF_INT, end, 'i32');
    C._ts_node_named_descendant_for_index_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  descendantForPosition(start, end = start) {
    if (!isPoint(start) || !isPoint(end)) {
      throw new Error('Arguments must be {row, column} objects');
    }

    marshalNode(this);
    let address = TRANSFER_BUFFER + SIZE_OF_NODE;
    marshalPoint(address, start);
    marshalPoint(address + SIZE_OF_POINT, end);
    C._ts_node_descendant_for_position_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  namedDescendantForPosition(start, end = start) {
    if (!isPoint(start) || !isPoint(end)) {
      throw new Error('Arguments must be {row, column} objects');
    }

    marshalNode(this);
    let address = TRANSFER_BUFFER + SIZE_OF_NODE;
    marshalPoint(address, start);
    marshalPoint(address + SIZE_OF_POINT, end);
    C._ts_node_named_descendant_for_position_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  walk() {
    marshalNode(this);
    C._ts_tree_cursor_new_wasm(this.tree[0]);
    return new TreeCursor(INTERNAL, this.tree);
  }

  toString() {
    marshalNode(this);
    const address = C._ts_node_to_string_wasm(this.tree[0]);
    const result = AsciiToString(address);
    C._free(address);
    return result;
  }
}

class TreeCursor {
  constructor(internal, tree) {
    assertInternal(internal);
    this.tree = tree;
    unmarshalTreeCursor(this);
  }

  delete() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_delete_wasm(this.tree[0]);
    this[0] = this[1] = this[2] = 0;
  }

  reset(node) {
    marshalNode(node);
    marshalTreeCursor(this, TRANSFER_BUFFER + SIZE_OF_NODE);
    C._ts_tree_cursor_reset_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
  }

  get nodeType() {
    return this.tree.language.types[this.nodeTypeId] || 'ERROR';
  }

  get nodeTypeId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_type_id_wasm(this.tree[0]);
  }

  get nodeId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_id_wasm(this.tree[0]);
  }

  get nodeIsNamed() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_is_named_wasm(this.tree[0]) === 1;
  }

  get nodeIsMissing() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_is_missing_wasm(this.tree[0]) === 1;
  }

  get nodeText() {
    marshalTreeCursor(this);
    const startIndex = C._ts_tree_cursor_start_index_wasm(this.tree[0]);
    const endIndex = C._ts_tree_cursor_end_index_wasm(this.tree[0]);
    return getText(this.tree, startIndex, endIndex);
  }

  get startPosition() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_start_position_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }

  get endPosition() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_end_position_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }

  get startIndex() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_start_index_wasm(this.tree[0]);
  }

  get endIndex() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_end_index_wasm(this.tree[0]);
  }

  currentNode() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_current_node_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }

  currentFieldId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_field_id_wasm(this.tree[0]);
  }

  currentFieldName() {
    return this.tree.language.fields[this.currentFieldId()];
  }

  gotoFirstChild() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_first_child_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }

  gotoNextSibling() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_next_sibling_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }

  gotoParent() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_parent_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
}

class Language {
  constructor(internal, address) {
    assertInternal(internal);
    this[0] = address;
    this.types = new Array(C._ts_language_symbol_count(this[0]));
    for (let i = 0, n = this.types.length; i < n; i++) {
      if (C._ts_language_symbol_type(this[0], i) < 2) {
        this.types[i] = UTF8ToString(C._ts_language_symbol_name(this[0], i));
      }
    }
    this.fields = new Array(C._ts_language_field_count(this[0]) + 1);
    for (let i = 0, n = this.fields.length; i < n; i++) {
      const fieldName = C._ts_language_field_name_for_id(this[0], i);
      if (fieldName !== 0) {
        this.fields[i] = UTF8ToString(fieldName);
      } else {
        this.fields[i] = null;
      }
    }
  }

  get version() {
    return C._ts_language_version(this[0]);
  }

  get fieldCount() {
    return this.fields.length - 1;
  }

  fieldIdForName(fieldName) {
    const result = this.fields.indexOf(fieldName);
    if (result !== -1) {
      return result;
    } else {
      return null;
    }
  }

  fieldNameForId(fieldId) {
    return this.fields[fieldId] || null;
  }

  idForNodeType(type, named) {
    const typeLength = lengthBytesUTF8(type);
    const typeAddress = C._malloc(typeLength + 1);
    stringToUTF8(type, typeAddress, typeLength + 1);
    const result = C._ts_language_symbol_for_name(this[0], typeAddress, typeLength, named);
    C._free(typeAddress);
    return result || null;
  }

  get nodeTypeCount() {
    return C._ts_language_symbol_count(this[0]);
  }

  nodeTypeForId(typeId) {
    const name = C._ts_language_symbol_name(this[0], typeId);
    return name ? UTF8ToString(name) : null;
  }

  nodeTypeIsNamed(typeId) {
    return C._ts_language_type_is_named_wasm(this[0], typeId) ? true : false;
  }

  nodeTypeIsVisible(typeId) {
    return C._ts_language_type_is_visible_wasm(this[0], typeId) ? true : false;
  }

  query(source) {
    const sourceLength = lengthBytesUTF8(source);
    const sourceAddress = C._malloc(sourceLength + 1);
    stringToUTF8(source, sourceAddress, sourceLength + 1);
    const address = C._ts_query_new(
      this[0],
      sourceAddress,
      sourceLength,
      TRANSFER_BUFFER,
      TRANSFER_BUFFER + SIZE_OF_INT
    );

    if (!address) {
      const errorId = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
      const errorByte = getValue(TRANSFER_BUFFER, 'i32');
      const errorIndex = UTF8ToString(sourceAddress, errorByte).length;
      const suffix = source.substr(errorIndex, 100).split('\n')[0];
      let word = suffix.match(QUERY_WORD_REGEX)[0];
      let error;
      switch (errorId) {
        case 2:
          error = new RangeError(`Bad node name '${word}'`);
          break;
        case 3:
          error = new RangeError(`Bad field name '${word}'`);
          break;
        case 4:
          error = new RangeError(`Bad capture name @${word}`);
          break;
        case 5:
          error = new TypeError(`Bad pattern structure at offset ${errorIndex}: '${suffix}'...`);
          word = "";
          break;
        default:
          error = new SyntaxError(`Bad syntax at offset ${errorIndex}: '${suffix}'...`);
          word = "";
          break;
      }
      error.index = errorIndex;
      error.length = word.length;
      C._free(sourceAddress);
      throw error;
    }

    const stringCount = C._ts_query_string_count(address);
    const captureCount = C._ts_query_capture_count(address);
    const patternCount = C._ts_query_pattern_count(address);
    const captureNames = new Array(captureCount);
    const stringValues = new Array(stringCount);

    for (let i = 0; i < captureCount; i++) {
      const nameAddress = C._ts_query_capture_name_for_id(
        address,
        i,
        TRANSFER_BUFFER
      );
      const nameLength = getValue(TRANSFER_BUFFER, 'i32');
      captureNames[i] = UTF8ToString(nameAddress, nameLength);
    }

    for (let i = 0; i < stringCount; i++) {
      const valueAddress = C._ts_query_string_value_for_id(
        address,
        i,
        TRANSFER_BUFFER
      );
      const nameLength = getValue(TRANSFER_BUFFER, 'i32');
      stringValues[i] = UTF8ToString(valueAddress, nameLength);
    }

    const setProperties = new Array(patternCount);
    const assertedProperties = new Array(patternCount);
    const refutedProperties = new Array(patternCount);
    const predicates = new Array(patternCount);
    const textPredicates = new Array(patternCount);
    for (let i = 0; i < patternCount; i++) {
      const predicatesAddress = C._ts_query_predicates_for_pattern(
        address,
        i,
        TRANSFER_BUFFER
      );
      const stepCount = getValue(TRANSFER_BUFFER, 'i32');

      predicates[i] = [];
      textPredicates[i] = [];

      const steps = [];
      let stepAddress = predicatesAddress;
      for (let j = 0; j < stepCount; j++) {
        const stepType = getValue(stepAddress, 'i32');
        stepAddress += SIZE_OF_INT;
        const stepValueId = getValue(stepAddress, 'i32');
        stepAddress += SIZE_OF_INT;
        if (stepType === PREDICATE_STEP_TYPE_CAPTURE) {
          steps.push({type: 'capture', name: captureNames[stepValueId]});
        } else if (stepType === PREDICATE_STEP_TYPE_STRING) {
          steps.push({type: 'string', value: stringValues[stepValueId]});
        } else if (steps.length > 0) {
          if (steps[0].type !== 'string') {
            throw new Error('Predicates must begin with a literal value');
          }
          const operator = steps[0].value;
          let isPositive = true;
          switch (operator) {
            case 'not-eq?':
              isPositive = false;
            case 'eq?':
              if (steps.length !== 3) throw new Error(
                `Wrong number of arguments to \`#eq?\` predicate. Expected 2, got ${steps.length - 1}`
              );
              if (steps[1].type !== 'capture') throw new Error(
                `First argument of \`#eq?\` predicate must be a capture. Got "${steps[1].value}"`
              );
              if (steps[2].type === 'capture') {
                const captureName1 = steps[1].name;
                const captureName2 = steps[2].name;
                textPredicates[i].push(function(captures) {
                  let node1, node2;
                  for (const c of captures) {
                    if (c.name === captureName1) node1 = c.node;
                    if (c.name === captureName2) node2 = c.node;
                  }
                  if(node1 === undefined || node2 === undefined) return true;
                  return (node1.text === node2.text) === isPositive;
                });
              } else {
                const captureName = steps[1].name;
                const stringValue = steps[2].value;
                textPredicates[i].push(function(captures) {
                  for (const c of captures) {
                    if (c.name === captureName) {
                      return (c.node.text === stringValue) === isPositive;
                    };
                  }
                  return true;
                });
              }
              break;

            case 'not-match?':
              isPositive = false;
            case 'match?':
              if (steps.length !== 3) throw new Error(
                `Wrong number of arguments to \`#match?\` predicate. Expected 2, got ${steps.length - 1}.`
              );
              if (steps[1].type !== 'capture') throw new Error(
                `First argument of \`#match?\` predicate must be a capture. Got "${steps[1].value}".`
              );
              if (steps[2].type !== 'string') throw new Error(
                `Second argument of \`#match?\` predicate must be a string. Got @${steps[2].value}.`
              );
              const captureName = steps[1].name;
              const regex = new RegExp(steps[2].value);
              textPredicates[i].push(function(captures) {
                for (const c of captures) {
                  if (c.name === captureName) return regex.test(c.node.text) === isPositive;
                }
                return true;
              });
              break;

            case 'set!':
              if (steps.length < 2 || steps.length > 3) throw new Error(
                `Wrong number of arguments to \`#set!\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`
              );
              if (steps.some(s => s.type !== 'string')) throw new Error(
                `Arguments to \`#set!\` predicate must be a strings.".`
              );
              if (!setProperties[i]) setProperties[i] = {};
              setProperties[i][steps[1].value] = steps[2] ? steps[2].value : null;
              break;

            case 'is?':
            case 'is-not?':
              if (steps.length < 2 || steps.length > 3) throw new Error(
                `Wrong number of arguments to \`#${operator}\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`
              );
              if (steps.some(s => s.type !== 'string')) throw new Error(
                `Arguments to \`#${operator}\` predicate must be a strings.".`
              );
              const properties = operator === 'is?' ? assertedProperties : refutedProperties;
              if (!properties[i]) properties[i] = {};
              properties[i][steps[1].value] = steps[2] ? steps[2].value : null;
              break;

            default:
              predicates[i].push({operator, operands: steps.slice(1)});
          }

          steps.length = 0;
        }
      }

      Object.freeze(setProperties[i]);
      Object.freeze(assertedProperties[i]);
      Object.freeze(refutedProperties[i]);
    }

    C._free(sourceAddress);
    return new Query(
      INTERNAL,
      address,
      captureNames,
      textPredicates,
      predicates,
      Object.freeze(setProperties),
      Object.freeze(assertedProperties),
      Object.freeze(refutedProperties)
    );
  }

  static load(input) {
    let bytes;
    if (input instanceof Uint8Array) {
      bytes = Promise.resolve(input);
    } else {
      bytes = Promise.resolve(Deno.readFileSync(input));
    }

    // emscripten-core/emscripten#12969
    const loadModule = loadWebAssemblyModule;

    return bytes
      .then(bytes => loadModule(bytes, {loadAsync: true}))
      .then(mod => {
        const symbolNames = Object.keys(mod);
        const functionName = symbolNames.find(key =>
          LANGUAGE_FUNCTION_REGEX.test(key) &&
          !key.includes("external_scanner_")
        );
        if (!functionName) {
          console.log(`Couldn't find language function in WASM file. Symbols:\n${JSON.stringify(symbolNames, null, 2)}`);
        }
        const languageAddress = mod[functionName]();
        return new Language(INTERNAL, languageAddress);
      });
  }
}

class Query {
  constructor(
    internal, address, captureNames, textPredicates, predicates,
    setProperties, assertedProperties, refutedProperties
  ) {
    assertInternal(internal);
    this[0] = address;
    this.captureNames = captureNames;
    this.textPredicates = textPredicates;
    this.predicates = predicates;
    this.setProperties = setProperties;
    this.assertedProperties = assertedProperties;
    this.refutedProperties = refutedProperties;
    this.exceededMatchLimit = false;
  }

  delete() {
    C._ts_query_delete(this[0]);
    this[0] = 0;
  }

  matches(node, startPosition, endPosition, options) {
    if (!startPosition) startPosition = ZERO_POINT;
    if (!endPosition) endPosition = ZERO_POINT;
    if (!options) options = {};

    let matchLimit = options.matchLimit;
    if (typeof matchLimit === 'undefined') {
      matchLimit = 0;
    } else if (typeof matchLimit !== 'number') {
      throw new Error('Arguments must be numbers');
    }

    marshalNode(node);

    C._ts_query_matches_wasm(
      this[0],
      node.tree[0],
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column,
      matchLimit
    );

    const rawCount = getValue(TRANSFER_BUFFER, 'i32');
    const startAddress = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
    const didExceedMatchLimit = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, 'i32');
    const result = new Array(rawCount);
    this.exceededMatchLimit = !!didExceedMatchLimit;

    let filteredCount = 0;
    let address = startAddress;
    for (let i = 0; i < rawCount; i++) {
      const pattern = getValue(address, 'i32');
      address += SIZE_OF_INT;
      const captureCount = getValue(address, 'i32');
      address += SIZE_OF_INT;

      const captures = new Array(captureCount);
      address = unmarshalCaptures(this, node.tree, address, captures);
      if (this.textPredicates[pattern].every(p => p(captures))) {
        result[filteredCount++] = {pattern, captures};
        const setProperties = this.setProperties[pattern];
        if (setProperties) result[i].setProperties = setProperties;
        const assertedProperties = this.assertedProperties[pattern];
        if (assertedProperties) result[i].assertedProperties = assertedProperties;
        const refutedProperties = this.refutedProperties[pattern];
        if (refutedProperties) result[i].refutedProperties = refutedProperties;
      }
    }
    result.length = filteredCount;

    C._free(startAddress);
    return result;
  }

  captures(node, startPosition, endPosition, options) {
    if (!startPosition) startPosition = ZERO_POINT;
    if (!endPosition) endPosition = ZERO_POINT;
    if (!options) options = {};

    let matchLimit = options.matchLimit;
    if (typeof matchLimit === 'undefined') {
      matchLimit = 0;
    } else if (typeof matchLimit !== 'number') {
      throw new Error('Arguments must be numbers');
    }

    marshalNode(node);

    C._ts_query_captures_wasm(
      this[0],
      node.tree[0],
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column,
      matchLimit
    );

    const count = getValue(TRANSFER_BUFFER, 'i32');
    const startAddress = getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
    const didExceedMatchLimit = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, 'i32');
    const result = [];
    this.exceededMatchLimit = !!didExceedMatchLimit;

    const captures = [];
    let address = startAddress;
    for (let i = 0; i < count; i++) {
      const pattern = getValue(address, 'i32');
      address += SIZE_OF_INT;
      const captureCount = getValue(address, 'i32');
      address += SIZE_OF_INT;
      const captureIndex = getValue(address, 'i32');
      address += SIZE_OF_INT;

      captures.length = captureCount;
      address = unmarshalCaptures(this, node.tree, address, captures);

      if (this.textPredicates[pattern].every(p => p(captures))) {
        const capture = captures[captureIndex];
        const setProperties = this.setProperties[pattern];
        if (setProperties) capture.setProperties = setProperties;
        const assertedProperties = this.assertedProperties[pattern];
        if (assertedProperties) capture.assertedProperties = assertedProperties;
        const refutedProperties = this.refutedProperties[pattern];
        if (refutedProperties) capture.refutedProperties = refutedProperties;
        result.push(capture);
      }
    }

    C._free(startAddress);
    return result;
  }

  predicatesForPattern(patternIndex) {
    return this.predicates[patternIndex];
  }

  didExceedMatchLimit() {
    return this.exceededMatchLimit;
  }
}

function getText(tree, startIndex, endIndex) {
  const length = endIndex - startIndex;
  let result = tree.textCallback(startIndex, null, endIndex);
  startIndex += result.length;
  while (startIndex < endIndex) {
    const string = tree.textCallback(startIndex, null, endIndex);
    if (string && string.length > 0) {
      startIndex += string.length;
      result += string;
    } else {
      break;
    }
  }
  if (startIndex > endIndex) {
    result = result.slice(0, length);
  }
  return result;
}

function unmarshalCaptures(query, tree, address, result) {
  for (let i = 0, n = result.length; i < n; i++) {
    const captureIndex = getValue(address, 'i32');
    address += SIZE_OF_INT;
    const node = unmarshalNode(tree, address);
    address += SIZE_OF_NODE;
    result[i] = {name: query.captureNames[captureIndex], node};
  }
  return address;
}

function assertInternal(x) {
  if (x !== INTERNAL) throw new Error('Illegal constructor');
}

function isPoint(point) {
  return (
    point &&
    typeof point.row === 'number' &&
    typeof point.column === 'number'
  );
}

function marshalNode(node) {
  let address = TRANSFER_BUFFER;
  setValue(address, node.id, 'i32');
  address += SIZE_OF_INT;
  setValue(address, node.startIndex, 'i32');
  address += SIZE_OF_INT;
  setValue(address, node.startPosition.row, 'i32');
  address += SIZE_OF_INT;
  setValue(address, node.startPosition.column, 'i32');
  address += SIZE_OF_INT;
  setValue(address, node[0], 'i32');
}

function unmarshalNode(tree, address = TRANSFER_BUFFER) {
  const id = getValue(address, 'i32');
  address += SIZE_OF_INT;
  if (id === 0) return null;

  const index = getValue(address, 'i32');
  address += SIZE_OF_INT;
  const row = getValue(address, 'i32');
  address += SIZE_OF_INT;
  const column = getValue(address, 'i32');
  address += SIZE_OF_INT;
  const other = getValue(address, 'i32');

  const result = new Node(INTERNAL, tree);
  result.id = id;
  result.startIndex = index;
  result.startPosition = {row, column};
  result[0] = other;

  return result;
}

function marshalTreeCursor(cursor, address = TRANSFER_BUFFER) {
  setValue(address + 0 * SIZE_OF_INT, cursor[0], 'i32'),
  setValue(address + 1 * SIZE_OF_INT, cursor[1], 'i32'),
  setValue(address + 2 * SIZE_OF_INT, cursor[2], 'i32');
}

function unmarshalTreeCursor(cursor) {
  cursor[0] = getValue(TRANSFER_BUFFER + 0 * SIZE_OF_INT, 'i32'),
  cursor[1] = getValue(TRANSFER_BUFFER + 1 * SIZE_OF_INT, 'i32'),
  cursor[2] = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, 'i32');
}

function marshalPoint(address, point) {
  setValue(address, point.row, 'i32');
  setValue(address + SIZE_OF_INT, point.column, 'i32');
}

function unmarshalPoint(address) {
  return {
    row: getValue(address, 'i32'),
    column: getValue(address + SIZE_OF_INT, 'i32')
  };
}

function marshalRange(address, range) {
  marshalPoint(address, range.startPosition); address += SIZE_OF_POINT;
  marshalPoint(address, range.endPosition); address += SIZE_OF_POINT;
  setValue(address, range.startIndex, 'i32'); address += SIZE_OF_INT;
  setValue(address, range.endIndex, 'i32'); address += SIZE_OF_INT;
}

function unmarshalRange(address) {
  const result = {};
  result.startPosition = unmarshalPoint(address); address += SIZE_OF_POINT;
  result.endPosition = unmarshalPoint(address); address += SIZE_OF_POINT;
  result.startIndex = getValue(address, 'i32'); address += SIZE_OF_INT;
  result.endIndex = getValue(address, 'i32');
  return result;
}

function marshalEdit(edit) {
  let address = TRANSFER_BUFFER;
  marshalPoint(address, edit.startPosition); address += SIZE_OF_POINT;
  marshalPoint(address, edit.oldEndPosition); address += SIZE_OF_POINT;
  marshalPoint(address, edit.newEndPosition); address += SIZE_OF_POINT;
  setValue(address, edit.startIndex, 'i32'); address += SIZE_OF_INT;
  setValue(address, edit.oldEndIndex, 'i32'); address += SIZE_OF_INT;
  setValue(address, edit.newEndIndex, 'i32'); address += SIZE_OF_INT;
}
        for (const name of Object.getOwnPropertyNames(ParserImpl.prototype)) {
          Object.defineProperty(Parser.prototype, name, {
            value: ParserImpl.prototype[name],
            enumerable: false,
            writable: false,
          });
        }

        Parser.Language = Language;
        Module.onRuntimeInitialized = () => {
          ParserImpl.init();
        };

// 2022-01-14: since run is now async, we wait on it here. _after_ onRuntimeInitialized is set.
await run();

      init = true;
    
    }
  }

  return Parser;
}();
