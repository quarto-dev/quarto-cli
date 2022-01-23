// ../binary-search.ts
function glb(array, value, compare) {
  compare = compare || ((a, b) => a - b);
  if (array.length === 0) {
    return -1;
  }
  if (array.length === 1) {
    if (compare(value, array[0]) < 0) {
      return -1;
    } else {
      return 0;
    }
  }
  let left = 0;
  let right = array.length - 1;
  const vLeft = array[left], vRight = array[right];
  if (compare(value, vRight) >= 0) {
    return right;
  }
  if (compare(value, vLeft) < 0) {
    return -1;
  }
  while (right - left > 1) {
    const center = left + (right - left >> 1);
    const vCenter = array[center];
    const cmp = compare(value, vCenter);
    if (cmp < 0) {
      right = center;
    } else if (cmp === 0) {
      left = center;
    } else {
      left = center;
    }
  }
  return left;
}

// ../external/colors.ts
var Deno;
try {
  Deno = globalThis.Deno;
} catch (_e) {
}
var noColor = typeof (Deno && Deno.noColor) === "boolean" ? Deno.noColor : true;
var enabled = !noColor;
function code(open, close) {
  return {
    open: `[${open.join(";")}m`,
    close: `[${close}m`,
    regexp: new RegExp(`\\x1b\\[${close}m`, "g")
  };
}
function run(str, code2) {
  return enabled ? `${code2.open}${str.replace(code2.regexp, code2.open)}${code2.close}` : str;
}
function red(str) {
  return run(str, code([31], 39));
}
function blue(str) {
  return run(str, code([34], 39));
}
function clampAndTruncate(n, max = 255, min = 0) {
  return Math.trunc(Math.max(Math.min(n, max), min));
}
function rgb24(str, color) {
  if (typeof color === "number") {
    return run(str, code([38, 2, color >> 16 & 255, color >> 8 & 255, color & 255], 39));
  }
  return run(str, code([
    38,
    2,
    clampAndTruncate(color.r),
    clampAndTruncate(color.g),
    clampAndTruncate(color.b)
  ], 39));
}
var ANSI_PATTERN = new RegExp([
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
  "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
].join("|"), "g");

// ../errors.ts
function tidyverseInfo(msg) {
  return `${blue("\u2139")} ${msg}`;
}
function tidyverseError(msg) {
  return `${red("\u2716")} ${msg}`;
}
function tidyverseFormatError(msg) {
  let { heading, error, info } = msg;
  if (msg.location) {
    heading = `${locationString(msg.location)} ${heading}`;
  }
  if (msg.fileName) {
    heading = `In file ${msg.fileName} ${heading}`;
  }
  const strings = [
    heading,
    msg.sourceContext,
    ...error.map(tidyverseError),
    ...info.map(tidyverseInfo)
  ];
  return strings.join("\n");
}
function quotedStringColor(msg) {
  return rgb24(msg, 12369186);
}
function addFileInfo(msg, src) {
  if (src.fileName !== void 0) {
    msg.fileName = src.fileName;
  }
}
function addInstancePathInfo(msg, instancePath) {
  if (instancePath !== "") {
    msg.info.push(`The error happened in the field ${instancePath}.`);
  }
}
function locationString(loc) {
  const { start, end } = loc;
  const locStr = start.line === end.line ? `(line ${start.line + 1}, columns ${start.column + 1}--${end.column + 1})` : `(line ${start.line + 1}, column ${start.column + 1} through line ${end.line + 1}, column ${end.column + 1})`;
  return locStr;
}

// ../text.ts
function lines(text) {
  return text.split(/\r?\n/);
}
function* matchAll(text, regexp) {
  if (!regexp.global) {
    throw new Error("matchAll requires global regexps");
  }
  let match;
  while ((match = regexp.exec(text)) !== null) {
    yield match;
  }
}
function* lineOffsets(text) {
  yield 0;
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index + match[0].length;
  }
}
function indexToRowCol(text) {
  const offsets = Array.from(lineOffsets(text));
  return function(offset) {
    if (offset === 0) {
      return {
        line: 0,
        column: 0
      };
    }
    const startIndex = glb(offsets, offset);
    return {
      line: startIndex,
      column: offset - offsets[startIndex]
    };
  };
}
function rowColToIndex(text) {
  const offsets = Array.from(lineOffsets(text));
  return function(position) {
    return offsets[position.row] + position.column;
  };
}
function formatLineRange(text, firstLine, lastLine) {
  const lineWidth = Math.max(String(firstLine + 1).length, String(lastLine + 1).length);
  const pad = " ".repeat(lineWidth);
  const ls = lines(text);
  const result = [];
  for (let i = firstLine; i <= lastLine; ++i) {
    const numberStr = `${pad}${i + 1}: `.slice(-(lineWidth + 2));
    const lineStr = ls[i];
    result.push({
      lineNumber: i,
      content: numberStr + quotedStringColor(lineStr),
      rawLine: ls[i]
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result
  };
}

// tree-sitter-annotated-yaml.ts
function buildAnnotated(tree, mappedSource2) {
  const singletonBuild = (node) => {
    return buildNode(node.firstChild, node.endIndex);
  };
  const buildNode = (node, endIndex) => {
    if (node === null) {
      return annotateEmpty(endIndex === void 0 ? -1 : endIndex);
    }
    if (dispatch[node.type] === void 0) {
      return annotateEmpty(endIndex || node.endIndex || -1);
    }
    return dispatch[node.type](node);
  };
  const annotateEmpty = (position) => {
    return {
      start: position,
      end: position,
      result: null,
      kind: "<<EMPTY>>",
      components: []
    };
  };
  const annotate = (node, result2, components) => {
    return {
      start: node.startIndex,
      end: node.endIndex,
      result: result2,
      kind: node.type,
      components
    };
  };
  const buildPair = (node) => {
    let key, value;
    if (node.childCount === 3) {
      key = annotate(node.child(0), node.child(0).text, []);
      value = buildNode(node.child(2), node.endIndex);
    } else if (node.childCount === 2) {
      key = annotate(node.child(0), node.child(0).text, []);
      value = annotateEmpty(node.endIndex);
    } else {
      key = annotateEmpty(node.endIndex);
      value = annotateEmpty(node.endIndex);
    }
    return annotate(node, {
      key: key.result,
      value: value.result
    }, [key, value]);
  };
  const dispatch = {
    "stream": singletonBuild,
    "document": singletonBuild,
    "block_node": singletonBuild,
    "flow_node": singletonBuild,
    "block_scalar": (node) => {
      if (!node.text.startsWith("|")) {
        return annotateEmpty(node.endIndex);
      }
      const ls = lines(node.text);
      if (ls.length < 2) {
        return annotateEmpty(node.endIndex);
      }
      const indent = ls[1].length - ls[1].trimStart().length;
      const result2 = ls.slice(1).map((l) => l.slice(indent)).join("\n");
      return annotate(node, result2, []);
    },
    "block_sequence": (node) => {
      const result2 = [], components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type !== "block_sequence_item") {
          continue;
        }
        const component = buildNode(child, node.endIndex);
        components.push(component);
        result2.push(component && component.result);
      }
      return annotate(node, result2, components);
    },
    "block_sequence_item": (node) => {
      if (node.childCount < 2) {
        return annotateEmpty(node.endIndex);
      } else {
        return buildNode(node.child(1), node.endIndex);
      }
    },
    "double_quote_scalar": (node) => {
      return annotate(node, JSON.parse(node.text), []);
    },
    "single_quote_scalar": (node) => {
      const str = node.text.slice(1, -1);
      const matches = [
        -2,
        ...Array.from(matchAll(str, /''/g)).map((x) => x.index),
        str.length
      ];
      const lst = [];
      for (let i = 0; i < matches.length - 1; ++i) {
        lst.push(str.substring(matches[i] + 2, matches[i + 1]));
      }
      const result2 = lst.join("'");
      return annotate(node, result2, []);
    },
    "plain_scalar": (node) => {
      function getV() {
        try {
          return JSON.parse(node.text);
        } catch (_e) {
          return node.text;
        }
      }
      const v = getV();
      return annotate(node, v, []);
    },
    "flow_sequence": (node) => {
      const result2 = [], components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type !== "flow_node") {
          continue;
        }
        const component = buildNode(child, node.endIndex);
        components.push(component);
        result2.push(component.result);
      }
      return annotate(node, result2, components);
    },
    "block_mapping": (node) => {
      const result2 = {}, components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        let component;
        if (child.type === "ERROR") {
          result2[child.text] = "<<ERROR>>";
          const key2 = annotate(child, child.text, []);
          const value2 = annotateEmpty(child.endIndex);
          component = annotate(child, {
            key: key2.result,
            value: value2.result
          }, [key2, value2]);
        } else if (child.type !== "block_mapping_pair") {
          continue;
        } else {
          component = buildNode(child, node.endIndex);
        }
        const { key, value } = component.result;
        result2[String(key)] = value;
        components.push(...component.components);
      }
      return annotate(node, result2, components);
    },
    "flow_pair": buildPair,
    "flow_mapping": (node) => {
      const result2 = {}, components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type === "flow_node") {
          continue;
        }
        if (child.type === "flow_pair") {
          let component;
          component = buildNode(child, node.endIndex);
          const { key, value } = component.result;
          result2[String(key)] = value;
          components.push(...component.components);
        }
      }
      return annotate(node, result2, components);
    },
    "block_mapping_pair": buildPair
  };
  const result = buildNode(tree.rootNode, tree.rootNode.endIndex);
  const parsedSize = tree.rootNode.text.trim().length;
  const codeSize = mappedSource2.value.trim().length;
  const lossage = parsedSize / codeSize;
  if (lossage < 0.95) {
    return null;
  }
  return result;
}
function locateCursor(annotation, position) {
  let failedLast = false;
  const kInternalLocateError = "Internal error: cursor outside bounds in sequence locate?";
  function locate(node, pathSoFar) {
    if (node.kind === "block_mapping" || node.kind === "flow_mapping") {
      for (let i = 0; i < node.components.length; i += 2) {
        const keyC = node.components[i], valueC = node.components[i + 1];
        if (keyC.start <= position && position <= keyC.end) {
          return [keyC.result, pathSoFar];
        } else if (valueC.start <= position && position <= valueC.end) {
          return locate(valueC, [keyC.result, pathSoFar]);
        }
      }
      failedLast = true;
      return pathSoFar;
    } else if (node.kind === "block_sequence" || node.kind === "flow_sequence") {
      for (let i = 0; i < node.components.length; ++i) {
        const valueC = node.components[i];
        if (valueC.start <= position && position <= valueC.end) {
          return locate(valueC, [i, pathSoFar]);
        }
        if (valueC.start > position) {
          if (i === 0) {
            return pathSoFar;
          } else {
            return [i - 1, pathSoFar];
          }
        }
      }
      throw new Error(kInternalLocateError);
    } else {
      if (node.kind !== "<<EMPTY>>") {
        return [node.result, pathSoFar];
      } else {
        return pathSoFar;
      }
    }
  }
  try {
    const value = locate(annotation, []).flat(Infinity).reverse();
    return {
      withError: failedLast,
      value
    };
  } catch (e) {
    if (e.message === kInternalLocateError) {
      return {
        withError: true,
        value: void 0
      };
    } else {
      throw e;
    }
  }
}

// paths.ts
var mainPath = "";
function setMainPath(path) {
  mainPath = path;
}
function getLocalPath(filename) {
  const result = new URL(mainPath);
  result.pathname = [...result.pathname.split("/").slice(0, -1), filename].join("/");
  return result.toString();
}

// ../mapped-text.ts
function mappedString(source, pieces, fileName) {
  if (typeof source === "string") {
    const offsetInfo = [];
    let offset = 0;
    const resultList = pieces.filter((piece) => typeof piece === "string" || piece.start !== piece.end).map((piece) => {
      if (typeof piece === "string") {
        offsetInfo.push({
          fromSource: false,
          length: piece.length,
          offset
        });
        offset += piece.length;
        return piece;
      } else {
        const resultPiece = source.substring(piece.start, piece.end);
        offsetInfo.push({
          fromSource: true,
          length: resultPiece.length,
          offset,
          range: {
            start: piece.start,
            end: piece.end
          }
        });
        offset += resultPiece.length;
        return resultPiece;
      }
    });
    const value = resultList.join("");
    const map = (targetOffset) => {
      const ix = glb(offsetInfo, { offset: targetOffset }, (a, b) => a.offset - b.offset);
      if (ix < 0) {
        return void 0;
      }
      const info = offsetInfo[ix];
      if (!info.fromSource) {
        return void 0;
      }
      const localOffset = targetOffset - info.offset;
      if (localOffset >= info.length) {
        return void 0;
      }
      return info.range.start + localOffset;
    };
    const mapClosest = (targetOffset) => {
      if (offsetInfo.length === 0 || targetOffset < 0) {
        return void 0;
      }
      const firstIx = glb(offsetInfo, { offset: targetOffset }, (a, b) => a.offset - b.offset);
      let ix = firstIx;
      let smallestSourceInfo = void 0;
      while (ix >= 0) {
        const info = offsetInfo[ix];
        if (!info.fromSource) {
          ix--;
          continue;
        }
        smallestSourceInfo = info;
        if (ix === firstIx) {
          const localOffset = targetOffset - info.offset;
          if (localOffset < info.length) {
            return info.range.start + localOffset;
          }
        }
        return info.range.end - 1;
      }
      if (smallestSourceInfo === void 0) {
        return void 0;
      } else {
        return smallestSourceInfo.range.start;
      }
    };
    return {
      value,
      originalString: source,
      fileName,
      map,
      mapClosest
    };
  } else {
    const {
      value,
      originalString,
      map: previousMap,
      mapClosest: previousMapClosest,
      fileName: previousFileName
    } = source;
    const {
      value: resultValue,
      map: nextMap,
      mapClosest: nextMapClosest
    } = mappedString(value, pieces);
    const composeMap = (offset) => {
      const v = nextMap(offset);
      if (v === void 0) {
        return v;
      }
      return previousMap(v);
    };
    const composeMapClosest = (offset) => {
      const v = nextMapClosest(offset);
      if (v === void 0) {
        return v;
      }
      return previousMapClosest(v);
    };
    return {
      value: resultValue,
      originalString,
      map: composeMap,
      mapClosest: composeMapClosest,
      fileName: previousFileName
    };
  }
}
function asMappedString(str, fileName) {
  if (typeof str === "string") {
    return {
      value: str,
      originalString: str,
      map: (x) => x,
      mapClosest: (x) => x,
      fileName
    };
  } else if (fileName !== void 0) {
    throw new Error("Internal error: can't change the fileName of an existing MappedString");
  } else {
    return str;
  }
}
function mappedIndexToRowCol(eitherText) {
  const text = asMappedString(eitherText);
  const f = indexToRowCol(text.originalString);
  return function(offset) {
    const n = text.mapClosest(offset);
    if (n === void 0) {
      throw new Error("Internal Error: bad offset in mappedIndexRowCol");
    }
    return f(n);
  };
}

// ../ranged-text.ts
function matchAll2(str, regex) {
  let match;
  regex = new RegExp(regex);
  const result = [];
  while ((match = regex.exec(str)) != null) {
    result.push(match);
  }
  return result;
}
function rangedLines(text, includeNewLines = false) {
  const regex = /\r?\n/g;
  const result = [];
  let startOffset = 0;
  if (!includeNewLines) {
    for (const r of matchAll2(text, regex)) {
      result.push({
        substring: text.substring(startOffset, r.index),
        range: {
          start: startOffset,
          end: r.index
        }
      });
      startOffset = r.index + r[0].length;
    }
    result.push({
      substring: text.substring(startOffset, text.length),
      range: {
        start: startOffset,
        end: text.length
      }
    });
    return result;
  } else {
    const matches = matchAll2(text, regex);
    let prevOffset = 0;
    for (const r of matches) {
      const stringEnd = r.index + 1;
      result.push({
        substring: text.substring(prevOffset, stringEnd),
        range: {
          start: prevOffset,
          end: stringEnd
        }
      });
      prevOffset = stringEnd;
    }
    result.push({
      substring: text.substring(prevOffset, text.length),
      range: {
        start: prevOffset,
        end: text.length
      }
    });
    return result;
  }
}

// parsing.ts
var _parser;
async function getTreeSitter() {
  if (_parser) {
    return _parser;
  }
  const Parser = window.TreeSitter;
  await Parser.init();
  _parser = new Parser();
  const YAML = await Parser.Language.load(getLocalPath("tree-sitter-yaml.wasm"));
  _parser.setLanguage(YAML);
  return _parser;
}
function* attemptParsesAtLine(context, parser) {
  const {
    position
  } = context;
  const code2 = asMappedString(context.code);
  try {
    const tree = parser.parse(code2.value);
    if (tree.rootNode.type !== "ERROR") {
      yield {
        parse: tree,
        code: code2,
        deletions: 0
      };
    }
  } catch (_e) {
    return;
  }
  const codeLines = rangedLines(code2.value, true);
  if (position.row >= codeLines.length || position.row < 0) {
    return;
  }
  const currentLine = codeLines[position.row].substring;
  let currentColumn = position.column;
  let deletions = 0;
  const locF = rowColToIndex(code2.value);
  while (currentColumn > 0) {
    currentColumn--;
    deletions++;
    const chunks = [];
    if (position.row > 0) {
      chunks.push({
        start: 0,
        end: codeLines[position.row - 1].range.end
      });
    }
    if (position.column > deletions) {
      chunks.push({
        start: locF({ row: position.row, column: 0 }),
        end: locF({ row: position.row, column: position.column - deletions })
      });
    }
    if (position.row + 1 < codeLines.length) {
      chunks.push({
        start: locF({ row: position.row, column: currentLine.length - 1 }),
        end: locF({ row: position.row + 1, column: 0 })
      });
      chunks.push({
        start: codeLines[position.row + 1].range.start,
        end: codeLines[codeLines.length - 1].range.end
      });
    }
    const newCode = mappedString(code2, chunks);
    const tree = parser.parse(newCode.value);
    if (tree.rootNode.type !== "ERROR") {
      yield {
        parse: tree,
        code: newCode,
        deletions
      };
    }
  }
}
function getIndent(l) {
  return l.length - l.trimStart().length;
}
function getYamlPredecessors(code2, row) {
  const yamlIndentTree = getYamlIndentTree(code2).predecessor;
  const result = [];
  while (row !== void 0 && row !== -1 && row >= 0 && row < yamlIndentTree.length) {
    result.push(row);
    row = yamlIndentTree[row];
  }
  return result;
}
function getYamlIndentTree(code2) {
  const ls = lines(code2);
  const predecessor = [];
  const indents = [];
  let indentation = -1;
  let prevPredecessor = -1;
  for (let i = 0; i < ls.length; ++i) {
    const line = ls[i];
    const lineIndent = getIndent(line);
    indents.push(lineIndent);
    if (lineIndent > indentation) {
      predecessor[i] = prevPredecessor;
      prevPredecessor = i;
      indentation = lineIndent;
    } else if (line.trim().length === 0) {
      predecessor[i] = predecessor[prevPredecessor];
    } else if (lineIndent === indentation) {
      predecessor[i] = predecessor[prevPredecessor];
      prevPredecessor = i;
    } else if (lineIndent < indentation) {
      let v = prevPredecessor;
      while (v >= 0 && indents[v] >= lineIndent) {
        v = predecessor[v];
      }
      predecessor[i] = v;
      prevPredecessor = i;
      indentation = lineIndent;
    } else {
      throw new Error("Internal error, should never have arrived here");
    }
  }
  return {
    predecessor,
    indentation: indents
  };
}
function locateFromIndentation(context) {
  const {
    line,
    code: mappedCode,
    position
  } = context;
  const code2 = asMappedString(mappedCode).value;
  const { predecessor, indentation } = getYamlIndentTree(code2);
  const ls = lines(code2);
  let lineNo = position.row;
  const path = [];
  const lineIndent = getIndent(line);
  while (lineNo !== -1) {
    const trimmed = ls[lineNo].trim();
    if (trimmed.length === 0) {
      let prev = lineNo;
      while (prev >= 0 && ls[prev].trim().length === 0) {
        prev--;
      }
      if (prev === -1) {
        break;
      }
      const prevIndent = getIndent(ls[prev]);
      if (prevIndent < lineIndent) {
        lineNo = prev;
        continue;
      } else if (prevIndent > lineIndent) {
        do {
          prev--;
        } while (prev >= 0 && (ls[prev].trim().length === 0 || getIndent(ls[prev]) >= lineIndent));
        lineNo = prev;
        continue;
      }
    }
    if (lineIndent >= indentation[lineNo]) {
      if (trimmed.startsWith("-")) {
        path.push(0);
      } else if (trimmed.endsWith(":")) {
        path.push(trimmed.substring(0, trimmed.length - 1));
      }
    }
    lineNo = predecessor[lineNo];
  }
  path.reverse();
  return path;
}

// ../semaphore.ts
var Semaphore = class {
  constructor(value) {
    this.value = value;
    this.tasks = [];
  }
  release() {
    this.value += 1;
    if (this.tasks.length) {
      const { resolve } = this.tasks.pop();
      resolve();
    }
  }
  async acquire() {
    if (this.value > 0) {
      this.value -= 1;
      return;
    }
    const result = new Promise((resolve, reject) => {
      this.tasks.push({ resolve, reject });
    });
    await result;
    await this.acquire();
  }
  async runExclusive(fun) {
    await this.acquire();
    try {
      fun();
    } finally {
      this.release();
    }
  }
};

// ../yaml-validation/state.ts
function makeInitializer(thunk) {
  let initStarted = false;
  const hasInitSemaphore = new Semaphore(0);
  return async () => {
    if (initStarted) {
      await hasInitSemaphore.runExclusive(async () => {
      });
      return;
    }
    initStarted = true;
    await thunk();
    hasInitSemaphore.release();
  };
}
var initializer = () => {
  throw new Error("initializer not set!!");
};
async function initState() {
  await initializer();
}
var hasSet = false;
function setInitializer(init) {
  if (hasSet) {
    return;
  }
  initializer = makeInitializer(init);
  hasSet = true;
}

// ../yaml-validation/schema.ts
function schemaAccepts(schema, testType) {
  const t = schemaType(schema);
  if (t === testType) {
    return true;
  }
  switch (t) {
    case "oneOf":
      return schema.oneOf.some((s) => schemaAccepts(s, testType));
    case "anyOf":
      return schema.anyOf.some((s) => schemaAccepts(s, testType));
    case "allOf":
      return schema.allOf.every((s) => schemaAccepts(s, testType));
  }
  return false;
}
function schemaType(schema) {
  const t = schema.type;
  if (t) {
    return t;
  }
  if (schema.anyOf) {
    return "anyOf";
  }
  if (schema.oneOf) {
    return "oneOf";
  }
  if (schema.allOf) {
    return "allOf";
  }
  if (schema.enum) {
    return "enum";
  }
  return "any";
}
function schemaCompletions(schema) {
  const normalize = (completions2) => {
    const result = (completions2 || []).map((c) => {
      if (typeof c === "string") {
        return {
          type: "value",
          display: c,
          value: c,
          description: "",
          suggest_on_accept: false,
          schema
        };
      }
      return {
        ...c,
        schema
      };
    });
    return result;
  };
  if (schema.completions && schema.completions.length) {
    return normalize(schema.completions);
  }
  switch (schemaType(schema)) {
    case "array":
      if (schema.items) {
        return schemaCompletions(schema.items);
      } else {
        return [];
      }
    case "anyOf":
      return schema.anyOf.map(schemaCompletions).flat();
    case "oneOf":
      return schema.oneOf.map(schemaCompletions).flat();
    case "allOf":
      return schema.allOf.map(schemaCompletions).flat();
    default:
      return [];
  }
}
var definitionsObject = {};
function hasSchemaDefinition(key) {
  return definitionsObject[key] !== void 0;
}
function getSchemaDefinition(key) {
  if (definitionsObject[key] === void 0) {
    throw new Error(`Internal Error: Schema ${key} not found.`);
  }
  return definitionsObject[key];
}
function setSchemaDefinition(schema) {
  if (definitionsObject[schema.$id] === void 0) {
    definitionsObject[schema.$id] = schema;
  }
}
function expandAliasesFrom(lst, defs) {
  const aliases = defs;
  const result = [];
  lst = lst.slice();
  for (let i = 0; i < lst.length; ++i) {
    const el = lst[i];
    if (el.startsWith("$")) {
      const v = aliases[el.slice(1)];
      if (v === void 0) {
        throw new Error(`Internal Error: ${el} doesn't have an entry in the aliases map`);
      }
      lst.push(...v);
    } else {
      result.push(el);
    }
  }
  return result;
}

// ../yaml-validation/validator.ts
function validateBoolean(value, _schema) {
  return typeof value === "boolean";
}
function validateNumber(value, _schema) {
  return typeof value === "number";
}
function validateString(value, schema) {
  if (typeof value !== "string") {
    return false;
  }
  if (schema.pattern === void 0) {
    return true;
  }
  if (value.match(new RegExp(schema.pattern))) {
    return true;
  } else {
    return false;
  }
}
function validateNull(value, _schema) {
  return value === null;
}
function validateEnum(value, schema) {
  return schema["enum"].indexOf(value) !== -1;
}
function validateOneOf(value, schema) {
  let count = 0;
  for (const subSchema of schema.oneOf) {
    if (validate(value, subSchema)) {
      count += 1;
      if (count > 1) {
        return false;
      }
    }
  }
  return count === 1;
}
function validateAnyOf(value, schema) {
  for (const subSchema of schema.anyOf) {
    if (validate(value, subSchema)) {
      return true;
    }
  }
  return false;
}
function validateAllOf(value, schema) {
  for (const subSchema of schema.allOf) {
    if (!validate(value, subSchema)) {
      return false;
    }
  }
  return true;
}
function validateObject(value, schema) {
  if (typeof value !== "object" || Array.isArray(value) || value === null) {
    return false;
  }
  const inspectedProps = new Set();
  if (schema.properties) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (value[key] && !validate(value[key], subSchema)) {
        return false;
      } else {
        inspectedProps.add(key);
      }
    }
  }
  if (schema.patternProperties) {
    for (const [key, subSchema] of Object.entries(schema.patternProperties)) {
      const regexp = new RegExp(key);
      for (const [objectKey, val] of Object.entries(value)) {
        if (objectKey.match(regexp) && !validate(val, subSchema)) {
          return false;
        } else {
          inspectedProps.add(objectKey);
        }
      }
    }
  }
  if (schema.additionalProperties) {
    for (const [objectKey, val] of Object.entries(value)) {
      if (inspectedProps.has(objectKey)) {
        continue;
      }
      if (!validate(val, schema.additionalProperties)) {
        return false;
      }
    }
  }
  for (const reqKey of schema.required || []) {
    if (value[reqKey] === void 0) {
      return false;
    }
  }
  return true;
}
function validateArray(value, schema) {
  if (!Array.isArray(value)) {
    return false;
  }
  if (schema.items) {
    return value.every((entry) => validate(entry, schema.items));
  }
  return true;
}
function validate(value, schema) {
  const validators = {
    "boolean": validateBoolean,
    "number": validateNumber,
    "string": validateString,
    "null": validateNull,
    "enum": validateEnum,
    "oneOf": validateOneOf,
    "anyOf": validateAnyOf,
    "allOf": validateAllOf,
    "object": validateObject,
    "array": validateArray
  };
  while (schema.$ref) {
    schema = getSchemaDefinition(schema.$ref);
  }
  if (validators[schemaType(schema)]) {
    return validators[schemaType(schema)](value, schema);
  } else {
    throw new Error(`Don't know how to validate ${schema.type}`);
  }
}

// ../yaml-validation/staged-validator.ts
var _module = void 0;
var validatorModulePath = "";
async function ensureValidatorModule() {
  if (_module) {
    return _module;
  }
  if (validatorModulePath === "") {
    throw new Error("Internal Error: validator module path is not set");
  }
  const path = new URL(validatorModulePath, import.meta.url).href;
  const _mod = await import(path);
  _module = _mod.default;
  return _module;
}
function setValidatorModulePath(path) {
  validatorModulePath = path;
}
function stagedValidator(schema) {
  const schemaName = schema.$id || schema.$ref;
  if (!hasSchemaDefinition(schemaName)) {
    throw new Error(`Internal error: can't find schema ${schemaName}`);
  }
  schema = getSchemaDefinition(schemaName);
  return async (value) => {
    if (validate(value, schema)) {
      return [];
    }
    await ensureValidatorModule();
    const validator = _module[schema.$id || schema.$ref];
    if (validator(value)) {
      throw new Error(`Internal error: validators disagree on schema ${schema.$id}`);
    }
    return JSON.parse(JSON.stringify(validator.errors));
  };
}

// ../guess-chunk-options-format.ts
function guessChunkOptionsFormat(options) {
  const noIndentOrColon = /^[^:\s]+[^:]+$/;
  const chunkLines = lines(options);
  if (chunkLines.filter((l) => l.match(noIndentOrColon)).length === 0) {
    return "yaml";
  }
  if (chunkLines.some((l) => l.trim() !== "" && !l.trimRight().endsWith(",") && l.indexOf("=") === -1)) {
    return "yaml";
  }
  return "knitr";
}

// ../partition-cell-options.ts
function mappedSource(source, substrs) {
  const params = [];
  for (const { range } of substrs) {
    params.push(range);
  }
  return mappedString(source, params);
}
async function partitionCellOptionsMapped(language, source, _validate = false, _engine = "") {
  const commentChars = langCommentChars(language);
  const optionPrefix = optionCommentPrefix(commentChars[0]);
  const optionSuffix = commentChars[1] || "";
  const optionsSource = [];
  const yamlLines = [];
  let endOfYaml = 0;
  for (const line of rangedLines(source.value, true)) {
    if (line.substring.startsWith(optionPrefix)) {
      if (!optionSuffix || line.substring.trimRight().endsWith(optionSuffix)) {
        let yamlOption = line.substring.substring(optionPrefix.length);
        if (optionSuffix) {
          yamlOption = yamlOption.trimRight();
          yamlOption = yamlOption.substring(0, yamlOption.length - optionSuffix.length);
        }
        endOfYaml = line.range.start + optionPrefix.length + yamlOption.length - optionSuffix.length;
        const rangedYamlOption = {
          substring: yamlOption,
          range: {
            start: line.range.start + optionPrefix.length,
            end: endOfYaml
          }
        };
        yamlLines.push(rangedYamlOption);
        optionsSource.push(line);
        continue;
      }
    }
    break;
  }
  const mappedYaml = yamlLines.length ? mappedSource(source, yamlLines) : void 0;
  return {
    yaml: mappedYaml,
    optionsSource,
    source: mappedString(source, [{
      start: endOfYaml,
      end: source.value.length
    }]),
    sourceStartLine: yamlLines.length
  };
}
function langCommentChars(lang) {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}
function optionCommentPrefix(comment) {
  return comment + "| ";
}
var kLangCommentChars = {
  r: "#",
  python: "#",
  julia: "#",
  scala: "//",
  matlab: "%",
  csharp: "//",
  fsharp: "//",
  c: ["/*", "*/"],
  css: ["/*", "*/"],
  sas: ["*", ";"],
  powershell: "#",
  bash: "#",
  sql: "--",
  mysql: "--",
  psql: "--",
  lua: "--",
  cpp: "//",
  cc: "//",
  stan: "#",
  octave: "#",
  fortran: "!",
  fortran95: "!",
  awk: "#",
  gawk: "#",
  stata: "*",
  java: "//",
  groovy: "//",
  sed: "#",
  perl: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  ojs: "//"
};

// ../break-quarto-md.ts
async function breakQuartoMd(src, validate2 = false) {
  const nb = {
    cells: []
  };
  const yamlRegEx = /^---\s*$/;
  const startCodeCellRegEx = new RegExp("^\\s*```+\\s*\\{([=A-Za-z]+)( *[ ,].*)?\\}\\s*$");
  const startCodeRegEx = /^```/;
  const endCodeRegEx = /^```\s*$/;
  const delimitMathBlockRegEx = /^\$\$/;
  let language = "";
  let cellStartLine = 0;
  const lineBuffer = [];
  const flushLineBuffer = async (cell_type, index) => {
    if (lineBuffer.length) {
      const mappedChunks = [];
      for (const line of lineBuffer) {
        mappedChunks.push(line.range);
      }
      const source = mappedString(src, mappedChunks);
      const cell = {
        cell_type: cell_type === "code" ? { language } : cell_type,
        source,
        sourceOffset: 0,
        sourceStartLine: 0,
        sourceVerbatim: source,
        cellStartLine
      };
      cellStartLine = index + 1;
      if (cell_type === "code" && (language === "ojs" || language === "dot")) {
        const { yaml, source: source2, sourceStartLine } = await partitionCellOptionsMapped(language, cell.source, validate2);
        const breaks = Array.from(lineOffsets(cell.source.value)).slice(1);
        let strUpToLastBreak = "";
        if (sourceStartLine > 0) {
          if (breaks.length) {
            const lastBreak = breaks[Math.min(sourceStartLine - 1, breaks.length - 1)];
            strUpToLastBreak = cell.source.value.substring(0, lastBreak);
          } else {
            strUpToLastBreak = cell.source.value;
          }
        }
        cell.sourceOffset = strUpToLastBreak.length + "```{ojs}\n".length;
        cell.sourceVerbatim = mappedString(cell.sourceVerbatim, [
          "```{ojs}\n",
          { start: 0, end: cell.sourceVerbatim.value.length },
          "\n```"
        ]);
        cell.source = source2;
        cell.options = yaml;
        cell.sourceStartLine = sourceStartLine;
      }
      if (mdTrimEmptyLines(lines(cell.source.value)).length > 0) {
        nb.cells.push(cell);
      }
      lineBuffer.splice(0, lineBuffer.length);
    }
  };
  let inYaml = false, inMathBlock = false, inCodeCell = false, inCode = false;
  const srcLines = rangedLines(src.value, true);
  for (let i = 0; i < srcLines.length; ++i) {
    const line = srcLines[i];
    if (yamlRegEx.test(line.substring) && !inCodeCell && !inCode && !inMathBlock) {
      if (inYaml) {
        lineBuffer.push(line);
        await flushLineBuffer("raw", i);
        inYaml = false;
      } else {
        await flushLineBuffer("markdown", i);
        lineBuffer.push(line);
        inYaml = true;
      }
    } else if (startCodeCellRegEx.test(line.substring)) {
      const m = line.substring.match(startCodeCellRegEx);
      language = m[1];
      await flushLineBuffer("markdown", i);
      inCodeCell = true;
    } else if (endCodeRegEx.test(line.substring)) {
      if (inCodeCell) {
        inCodeCell = false;
        await flushLineBuffer("code", i);
      } else {
        inCode = !inCode;
        lineBuffer.push(line);
      }
    } else if (startCodeRegEx.test(line.substring)) {
      inCode = true;
      lineBuffer.push(line);
    } else if (delimitMathBlockRegEx.test(line.substring)) {
      if (inMathBlock) {
        await flushLineBuffer("math", i);
      } else {
        if (inYaml || inCode || inCodeCell) {
        } else {
          await flushLineBuffer("markdown", i);
        }
      }
      inMathBlock = !inMathBlock;
      lineBuffer.push(line);
    } else {
      lineBuffer.push(line);
    }
  }
  await flushLineBuffer("markdown", srcLines.length);
  return nb;
}
function mdTrimEmptyLines(lines2) {
  const firstNonEmpty = lines2.findIndex((line) => line.trim().length > 0);
  if (firstNonEmpty === -1) {
    return [];
  }
  lines2 = lines2.slice(firstNonEmpty);
  let lastNonEmpty = -1;
  for (let i = lines2.length - 1; i >= 0; i--) {
    if (lines2[i].trim().length > 0) {
      lastNonEmpty = i;
      break;
    }
  }
  if (lastNonEmpty > -1) {
    lines2 = lines2.slice(0, lastNonEmpty + 1);
  }
  return lines2;
}

// ../yaml-validation/yaml-schema.ts
function getVerbatimInput(error) {
  return error.source.value.substring(error.violatingObject.start, error.violatingObject.end);
}
function navigate(path, annotation, returnKey = false, pathIndex = 0) {
  if (annotation === void 0) {
    throw new Error("Can't navigate an undefined annotation");
  }
  if (pathIndex >= path.length) {
    return annotation;
  }
  if (annotation.kind === "mapping" || annotation.kind === "block_mapping") {
    const { components } = annotation;
    const searchKey = path[pathIndex];
    const lastKeyIndex = ~~((components.length - 1) / 2) * 2;
    for (let i = lastKeyIndex; i >= 0; i -= 2) {
      const key = components[i].result;
      if (key === searchKey) {
        if (returnKey && pathIndex === path.length - 1) {
          return navigate(path, components[i], returnKey, pathIndex + 1);
        } else {
          return navigate(path, components[i + 1], returnKey, pathIndex + 1);
        }
      }
    }
    throw new Error(`Internal error: searchKey ${searchKey} (path: ${path}) not found in mapping object`);
  } else if (["sequence", "block_sequence", "flow_sequence"].indexOf(annotation.kind) !== -1) {
    const searchKey = Number(path[pathIndex]);
    return navigate(path, annotation.components[searchKey], returnKey, pathIndex + 1);
  } else {
    throw new Error(`Internal error: unexpected kind ${annotation.kind}`);
  }
}
function navigateSchema(path, schema, pathIndex = 0) {
  if (schema.$ref) {
    schema = getSchemaDefinition(schema.$ref);
  }
  if (pathIndex >= path.length - 1) {
    return [schema];
  }
  const pathVal = path[pathIndex];
  if (schema.allOf !== void 0) {
    return schema.allOf.map((s) => navigateSchema(path, s, pathIndex)).flat();
  } else if (pathVal === "patternProperties" && schema.patternProperties) {
    const key = path[pathIndex + 1];
    const subSchema = schema.patternProperties[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "properties" && schema.properties) {
    const key = path[pathIndex + 1];
    const subSchema = schema.properties[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "anyOf" && schema.anyOf) {
    const key = Number(path[pathIndex + 1]);
    const subSchema = schema.anyOf[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "oneOf" && schema.oneOf) {
    const key = Number(path[pathIndex + 1]);
    const subSchema = schema.oneOf[key];
    return navigateSchema(path, subSchema, pathIndex + 2);
  } else if (pathVal === "items" && schema.items) {
    const subSchema = schema.items;
    return navigateSchema(path, subSchema, pathIndex + 1);
  } else {
    return [];
  }
}
function isProperPrefix(a, b) {
  return b.length > a.length && b.substring(0, a.length) === a;
}
function groupBy(lst, f) {
  const record = {};
  const result = [];
  for (const el of lst) {
    const key = f(el);
    if (record[key] === void 0) {
      const lst2 = [];
      const entry = {
        key,
        values: lst2
      };
      record[key] = lst2;
      result.push(entry);
    }
    record[key].push(el);
  }
  return result;
}
function groupByEntries(entries) {
  const result = [];
  for (const { values } of entries) {
    result.push(...values);
  }
  return result;
}
function narrowOneOfError(oneOf, suberrors) {
  const subschemaErrors = groupBy(suberrors.filter((error) => error.schemaPath !== oneOf.schemaPath), (error) => error.schemaPath.substring(0, error.schemaPath.lastIndexOf("/")));
  const onlyAdditionalProperties = subschemaErrors.filter(({ values }) => values.every((v) => v.keyword === "additionalProperties"));
  if (onlyAdditionalProperties.length) {
    return onlyAdditionalProperties[0].values;
  }
  return [];
}
function localizeAndPruneErrors(annotation, validationErrors, source, schema) {
  const result = [];
  const locF = mappedIndexToRowCol(source);
  let errorsPerInstanceList = groupBy(validationErrors, (error) => error.instancePath);
  do {
    const newErrors = [];
    errorsPerInstanceList = errorsPerInstanceList.filter(({ key: pathA }) => errorsPerInstanceList.filter(({ key: pathB }) => isProperPrefix(pathA, pathB)).length === 0);
    for (const { key: instancePath, values: errors } of errorsPerInstanceList) {
      let errorsPerSchemaList = groupBy(errors, (error) => error.schemaPath);
      errorsPerSchemaList = errorsPerSchemaList.filter(({ key: pathA }) => errorsPerSchemaList.filter(({ key: pathB }) => isProperPrefix(pathB, pathA)).length === 0);
      for (const error of groupByEntries(errorsPerSchemaList)) {
        if (error.hasBeenTransformed) {
          continue;
        }
        if (error.keyword === "oneOf") {
          error.hasBeenTransformed = true;
          newErrors.push(...narrowOneOfError(error, errors));
        } else if (error.keyword === "additionalProperties") {
          error.hasBeenTransformed = true;
          newErrors.push({
            ...error,
            instancePath: `${instancePath}/${error.params.additionalProperty}`,
            keyword: "_custom_invalidProperty",
            message: `property ${error.params.additionalProperty} not allowed in object`,
            params: {
              ...error.params,
              originalError: error
            },
            schemaPath: error.schemaPath.slice(0, -21)
          });
        }
      }
    }
    if (newErrors.length) {
      errorsPerInstanceList.push(...groupBy(newErrors, (error) => error.instancePath));
    } else {
      break;
    }
  } while (true);
  for (const { key: instancePath, values: allErrors } of errorsPerInstanceList) {
    const path = instancePath.split("/").slice(1);
    const errors = allErrors.filter(({ schemaPath: pathA }) => !(allErrors.filter(({ schemaPath: pathB }) => isProperPrefix(pathB, pathA)).length > 0));
    for (const error of errors) {
      const returnKey = error.keyword === "_custom_invalidProperty";
      const violatingObject = navigate(path, annotation, returnKey);
      const schemaPath = error.schemaPath.split("/").slice(1);
      const start = locF(violatingObject.start);
      const end = locF(violatingObject.end);
      let niceError = {
        heading: "",
        error: [],
        info: [],
        location: { start, end }
      };
      if (error.keyword.startsWith("_custom_")) {
        niceError = {
          ...niceError,
          heading: error.message === void 0 ? "" : error.message
        };
      } else {
        if (instancePath === "") {
          niceError = {
            ...niceError,
            heading: `(top-level error) ${error.message}`
          };
        } else {
          const errorSchema = error.params && error.params.schema || error.parentSchema;
          const innerSchema = errorSchema ? [errorSchema] : navigateSchema(schemaPath.map(decodeURIComponent), schema);
          if (innerSchema.length === 0) {
            niceError = {
              ...niceError,
              heading: `Schema ${schemaPath}: ${error.message}`
            };
          } else {
            const rawVerbatimInput = source.value.substring(violatingObject.start, violatingObject.end);
            if (rawVerbatimInput.length === 0) {
              niceError = {
                ...niceError,
                heading: `Empty value found where it must instead ${innerSchema.map((s) => s.description).join(", ")}.`
              };
            } else {
              const verbatimInput = quotedStringColor(source.value.substring(violatingObject.start, violatingObject.end));
              niceError = {
                ...niceError,
                heading: `The value ${verbatimInput} must ${innerSchema.map((s) => s.description).join(", ")}.`
              };
            }
          }
        }
      }
      niceError.location = { start, end };
      addFileInfo(niceError, source);
      addInstancePathInfo(niceError, instancePath);
      result.push({
        instancePath,
        message: error.message === void 0 ? "" : error.message,
        violatingObject,
        location: { start, end },
        source,
        ajvError: error,
        niceError
      });
    }
  }
  result.sort((a, b) => a.violatingObject.start - b.violatingObject.start);
  return result;
}
var YAMLSchema = class {
  constructor(schema) {
    this.errorHandlers = [];
    this.schema = schema;
    this.validate = stagedValidator(this.schema);
  }
  addHandler(handler) {
    this.errorHandlers.push(handler);
  }
  transformErrors(annotation, errors) {
    return errors.map((error) => {
      for (const handler of this.errorHandlers) {
        error = handler(error, annotation, this.schema);
      }
      return error;
    });
  }
  async validateParse(src, annotation) {
    const validationErrors = await this.validate(annotation.result);
    if (validationErrors.length) {
      const localizedErrors = this.transformErrors(annotation, localizeAndPruneErrors(annotation, validationErrors, src, this.schema));
      return {
        result: annotation.result,
        errors: localizedErrors
      };
    } else {
      return {
        result: annotation.result,
        errors: []
      };
    }
  }
  reportErrorsInSource(result, src, message, error, log) {
    if (result.errors.length) {
      const locF = mappedIndexToRowCol(src);
      const nLines = lines(src.originalString).length;
      error(message);
      for (const err of result.errors) {
        let startO = err.violatingObject.start;
        let endO = err.violatingObject.end;
        while (src.mapClosest(startO) < src.originalString.length - 1 && src.originalString[src.mapClosest(startO)].match(/\s/)) {
          startO++;
        }
        while (src.mapClosest(endO) > src.mapClosest(startO) && src.originalString[src.mapClosest(endO)].match(/\s/)) {
          endO--;
        }
        const start = locF(startO);
        const end = locF(endO);
        const {
          prefixWidth,
          lines: lines2
        } = formatLineRange(src.originalString, Math.max(0, start.line - 1), Math.min(end.line + 1, nLines - 1));
        const contextLines = [];
        for (const { lineNumber, content, rawLine } of lines2) {
          contextLines.push(content);
          if (lineNumber >= start.line && lineNumber <= end.line) {
            const startColumn = lineNumber > start.line ? 0 : start.column;
            const endColumn = lineNumber < end.line ? rawLine.length : end.column;
            contextLines.push(" ".repeat(prefixWidth + startColumn) + blue("~".repeat(endColumn - startColumn + 1)));
          }
        }
        err.niceError.sourceContext = contextLines.join("\n");
        log(tidyverseFormatError(err.niceError));
      }
    }
    return result;
  }
  async validateParseWithErrors(src, annotation, message, error, log) {
    const result = await this.validateParse(src, annotation);
    this.reportErrorsInSource(result, src, message, error, log);
    return result;
  }
};

// ../promise.ts
var PromiseQueue = class {
  constructor() {
    this.queue = new Array();
    this.running = false;
  }
  enqueue(promise, clearPending = false) {
    return new Promise((resolve, reject) => {
      if (clearPending) {
        this.queue.splice(0, this.queue.length);
      }
      this.queue.push({
        promise,
        resolve,
        reject
      });
      this.dequeue();
    });
  }
  dequeue() {
    if (this.running) {
      return false;
    }
    const item = this.queue.shift();
    if (!item) {
      return false;
    }
    try {
      this.running = true;
      item.promise().then((value) => {
        this.running = false;
        item.resolve(value);
        this.dequeue();
      }).catch((err) => {
        this.running = false;
        item.reject(err);
        this.dequeue();
      });
    } catch (err) {
      this.running = false;
      item.reject(err);
      this.dequeue();
    }
    return true;
  }
};

// ../yaml-validation/validator-queue.ts
var yamlValidators = {};
var validatorQueues = {};
function checkForTypeMismatch(error, _parse, _schema) {
  const verbatimInput = quotedStringColor(getVerbatimInput(error));
  if (error.ajvError.keyword === "type") {
    const newError = {
      heading: `The value ${verbatimInput} must be a ${error.ajvError.params.type}.`,
      error: [
        `The value ${verbatimInput} is a ${typeof error.violatingObject.result}.`
      ],
      info: [],
      location: error.niceError.location
    };
    addInstancePathInfo(newError, error.ajvError.instancePath);
    addFileInfo(newError, error.source);
    return {
      ...error,
      niceError: newError
    };
  }
  return error;
}
function checkForBadBoolean(error, _parse, schema) {
  schema = error.ajvError.params.schema;
  if (!(typeof error.violatingObject.result === "string" && error.ajvError.keyword === "type" && (schema && schema.type === "boolean"))) {
    return error;
  }
  const strValue = error.violatingObject.result;
  const verbatimInput = quotedStringColor(getVerbatimInput(error));
  const yesses = new Set("y|Y|yes|Yes|YES|true|True|TRUE|on|On|ON".split("|"));
  const nos = new Set("n|N|no|No|NO|false|False|FALSE|off|Off|OFF".split("|"));
  let fix;
  if (yesses.has(strValue)) {
    fix = true;
  } else if (nos.has(strValue)) {
    fix = false;
  } else {
    return error;
  }
  const heading = `The value ${verbatimInput} must be a boolean`;
  const errorMessage = `The value ${verbatimInput} is a string.`;
  const suggestion1 = `Quarto uses YAML 1.2, which interprets booleans strictly.`;
  const suggestion2 = `Try using ${quotedStringColor(String(fix))} instead.`;
  const newError = {
    heading,
    error: [errorMessage],
    info: [],
    location: error.niceError.location
  };
  addInstancePathInfo(newError, error.ajvError.instancePath);
  addFileInfo(newError, error.source);
  newError.info.push(suggestion1, suggestion2);
  return {
    ...error,
    niceError: newError
  };
}
function getSchemaName(schema) {
  const schemaName = schema["$id"] || schema["$ref"];
  if (schemaName === void 0) {
    throw new Error("Expected schema to be named");
  }
  return schemaName;
}
function getValidator(schema) {
  const schemaName = getSchemaName(schema);
  if (yamlValidators[schemaName]) {
    return yamlValidators[schemaName];
  }
  const validator = new YAMLSchema(schema);
  yamlValidators[schemaName] = validator;
  validator.addHandler(checkForTypeMismatch);
  validator.addHandler(checkForBadBoolean);
  return validator;
}
async function withValidator(schema, fun) {
  const schemaName = getSchemaName(schema);
  if (validatorQueues[schemaName] === void 0) {
    validatorQueues[schemaName] = new PromiseQueue();
  }
  const queue = validatorQueues[schemaName];
  let result;
  let error;
  await queue.enqueue(async () => {
    try {
      const validator = getValidator(schema);
      result = await fun(validator);
    } catch (e) {
      error = e;
    }
  });
  if (error !== void 0) {
    throw error;
  }
  return result;
}

// ../external/regexpp.mjs
var DataSet = class {
  constructor(raw2018, raw2019, raw2020, raw2021) {
    this._raw2018 = raw2018;
    this._raw2019 = raw2019;
    this._raw2020 = raw2020;
    this._raw2021 = raw2021;
  }
  get es2018() {
    return this._set2018 || (this._set2018 = new Set(this._raw2018.split(" ")));
  }
  get es2019() {
    return this._set2019 || (this._set2019 = new Set(this._raw2019.split(" ")));
  }
  get es2020() {
    return this._set2020 || (this._set2020 = new Set(this._raw2020.split(" ")));
  }
  get es2021() {
    return this._set2021 || (this._set2021 = new Set(this._raw2021.split(" ")));
  }
};
var gcNameSet = new Set(["General_Category", "gc"]);
var scNameSet = new Set(["Script", "Script_Extensions", "sc", "scx"]);
var gcValueSets = new DataSet("C Cased_Letter Cc Cf Close_Punctuation Cn Co Combining_Mark Connector_Punctuation Control Cs Currency_Symbol Dash_Punctuation Decimal_Number Enclosing_Mark Final_Punctuation Format Initial_Punctuation L LC Letter Letter_Number Line_Separator Ll Lm Lo Lowercase_Letter Lt Lu M Mark Math_Symbol Mc Me Mn Modifier_Letter Modifier_Symbol N Nd Nl No Nonspacing_Mark Number Open_Punctuation Other Other_Letter Other_Number Other_Punctuation Other_Symbol P Paragraph_Separator Pc Pd Pe Pf Pi Po Private_Use Ps Punctuation S Sc Separator Sk Sm So Space_Separator Spacing_Mark Surrogate Symbol Titlecase_Letter Unassigned Uppercase_Letter Z Zl Zp Zs cntrl digit punct", "", "", "");
var scValueSets = new DataSet("Adlam Adlm Aghb Ahom Anatolian_Hieroglyphs Arab Arabic Armenian Armi Armn Avestan Avst Bali Balinese Bamu Bamum Bass Bassa_Vah Batak Batk Beng Bengali Bhaiksuki Bhks Bopo Bopomofo Brah Brahmi Brai Braille Bugi Buginese Buhd Buhid Cakm Canadian_Aboriginal Cans Cari Carian Caucasian_Albanian Chakma Cham Cher Cherokee Common Copt Coptic Cprt Cuneiform Cypriot Cyrillic Cyrl Deseret Deva Devanagari Dsrt Dupl Duployan Egyp Egyptian_Hieroglyphs Elba Elbasan Ethi Ethiopic Geor Georgian Glag Glagolitic Gonm Goth Gothic Gran Grantha Greek Grek Gujarati Gujr Gurmukhi Guru Han Hang Hangul Hani Hano Hanunoo Hatr Hatran Hebr Hebrew Hira Hiragana Hluw Hmng Hung Imperial_Aramaic Inherited Inscriptional_Pahlavi Inscriptional_Parthian Ital Java Javanese Kaithi Kali Kana Kannada Katakana Kayah_Li Khar Kharoshthi Khmer Khmr Khoj Khojki Khudawadi Knda Kthi Lana Lao Laoo Latin Latn Lepc Lepcha Limb Limbu Lina Linb Linear_A Linear_B Lisu Lyci Lycian Lydi Lydian Mahajani Mahj Malayalam Mand Mandaic Mani Manichaean Marc Marchen Masaram_Gondi Meetei_Mayek Mend Mende_Kikakui Merc Mero Meroitic_Cursive Meroitic_Hieroglyphs Miao Mlym Modi Mong Mongolian Mro Mroo Mtei Mult Multani Myanmar Mymr Nabataean Narb Nbat New_Tai_Lue Newa Nko Nkoo Nshu Nushu Ogam Ogham Ol_Chiki Olck Old_Hungarian Old_Italic Old_North_Arabian Old_Permic Old_Persian Old_South_Arabian Old_Turkic Oriya Orkh Orya Osage Osge Osma Osmanya Pahawh_Hmong Palm Palmyrene Pau_Cin_Hau Pauc Perm Phag Phags_Pa Phli Phlp Phnx Phoenician Plrd Prti Psalter_Pahlavi Qaac Qaai Rejang Rjng Runic Runr Samaritan Samr Sarb Saur Saurashtra Sgnw Sharada Shavian Shaw Shrd Sidd Siddham SignWriting Sind Sinh Sinhala Sora Sora_Sompeng Soyo Soyombo Sund Sundanese Sylo Syloti_Nagri Syrc Syriac Tagalog Tagb Tagbanwa Tai_Le Tai_Tham Tai_Viet Takr Takri Tale Talu Tamil Taml Tang Tangut Tavt Telu Telugu Tfng Tglg Thaa Thaana Thai Tibetan Tibt Tifinagh Tirh Tirhuta Ugar Ugaritic Vai Vaii Wara Warang_Citi Xpeo Xsux Yi Yiii Zanabazar_Square Zanb Zinh Zyyy", "Dogr Dogra Gong Gunjala_Gondi Hanifi_Rohingya Maka Makasar Medefaidrin Medf Old_Sogdian Rohg Sogd Sogdian Sogo", "Elym Elymaic Hmnp Nand Nandinagari Nyiakeng_Puachue_Hmong Wancho Wcho", "Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi");
var binPropertySets = new DataSet("AHex ASCII ASCII_Hex_Digit Alpha Alphabetic Any Assigned Bidi_C Bidi_Control Bidi_M Bidi_Mirrored CI CWCF CWCM CWKCF CWL CWT CWU Case_Ignorable Cased Changes_When_Casefolded Changes_When_Casemapped Changes_When_Lowercased Changes_When_NFKC_Casefolded Changes_When_Titlecased Changes_When_Uppercased DI Dash Default_Ignorable_Code_Point Dep Deprecated Dia Diacritic Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Ext Extender Gr_Base Gr_Ext Grapheme_Base Grapheme_Extend Hex Hex_Digit IDC IDS IDSB IDST IDS_Binary_Operator IDS_Trinary_Operator ID_Continue ID_Start Ideo Ideographic Join_C Join_Control LOE Logical_Order_Exception Lower Lowercase Math NChar Noncharacter_Code_Point Pat_Syn Pat_WS Pattern_Syntax Pattern_White_Space QMark Quotation_Mark RI Radical Regional_Indicator SD STerm Sentence_Terminal Soft_Dotted Term Terminal_Punctuation UIdeo Unified_Ideograph Upper Uppercase VS Variation_Selector White_Space XIDC XIDS XID_Continue XID_Start space", "Extended_Pictographic", "", "EBase EComp EMod EPres ExtPict");

// ../yaml-validation/schema-utils.ts
var _schemas;
function setSchemas(schemas) {
  _schemas = schemas;
}
function getSchemas() {
  if (_schemas) {
    return _schemas;
  } else {
    throw new Error("Internal error: schemas not set");
  }
}

// yaml-intelligence.ts
function positionInTicks(context) {
  const code2 = asMappedString(context.code);
  const {
    position
  } = context;
  const codeLines = lines(code2.value);
  return code2.value.startsWith("---") && position.row === 0 || code2.value.trimEnd().endsWith("---") && position.row === codeLines.length - 1;
}
function trimTicks(context) {
  let code2 = asMappedString(context.code);
  if (code2.value.startsWith("---")) {
    code2 = mappedString(code2, [{ start: 3, end: code2.value.length }]);
    context = { ...context, code: code2 };
  }
  if (code2.value.trimEnd().endsWith("---")) {
    code2 = mappedString(code2, [{
      start: 0,
      end: code2.value.lastIndexOf("---")
    }]);
    context = { ...context, code: code2 };
  }
  return context;
}
async function validationFromGoodParseYAML(context) {
  const code2 = asMappedString(context.code);
  const result = await withValidator(context.schema, async (validator) => {
    const parser = await getTreeSitter();
    for (const parseResult of attemptParsesAtLine(context, parser) || []) {
      const lints = [];
      const {
        parse: tree,
        code: mappedCode
      } = parseResult;
      const annotation = buildAnnotated(tree, mappedCode);
      if (annotation === null) {
        continue;
      }
      const validationResult = await validator.validateParse(code2, annotation);
      for (const error of validationResult.errors) {
        let text;
        if (error.niceError && error.niceError.heading) {
          text = error.niceError.heading;
        } else {
          text = error.message;
        }
        lints.push({
          "start.row": error.location.start.line,
          "start.column": error.location.start.column,
          "end.row": error.location.end.line,
          "end.column": error.location.end.column,
          "text": text,
          "type": "error"
        });
      }
      return lints;
    }
    return [];
  });
  const predecessors = getYamlPredecessors(code2.value, context.position.row - 1);
  if (context.explicit === void 0) {
    return result;
  }
  if (!context.explicit) {
    return result.filter((lint) => predecessors.indexOf(lint["start.row"] - 1) === -1);
  } else {
    return result;
  }
}
async function completionsFromGoodParseYAML(context) {
  const {
    line,
    position,
    schema
  } = context;
  const commentPrefix = context.commentPrefix || "";
  const parser = await getTreeSitter();
  let word = "";
  if (line.slice(-1) !== ":" && line.trimLeft()[0] !== "-") {
    word = line.split(" ").slice(-1)[0];
  }
  if (line.trim().length === 0) {
    const path = locateFromIndentation(context);
    const indent2 = line.length;
    const rawCompletions = await completions({
      schema,
      path,
      word,
      indent: indent2,
      commentPrefix,
      context
    });
    rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "key");
    return rawCompletions;
  }
  const indent = line.trimEnd().length - line.trim().length;
  const completeEmptyLineOnIndentation = async (deletions, mappedCode) => {
    const path = locateFromIndentation({
      line: line.slice(0, -deletions),
      code: mappedCode.value,
      position: {
        row: position.row,
        column: position.column - deletions
      }
    });
    const rawCompletions = await completions({
      schema,
      path,
      word,
      indent,
      commentPrefix,
      context
    });
    rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "key");
    return rawCompletions;
  };
  for (const parseResult of attemptParsesAtLine(context, parser)) {
    const {
      parse: tree,
      code: mappedCode,
      deletions
    } = parseResult;
    const lineAfterDeletions = line.substring(0, line.length - deletions);
    if (lineAfterDeletions.trim().length === 0) {
      const result = await completeEmptyLineOnIndentation(deletions, mappedCode);
      return result;
    } else {
      const doc = buildAnnotated(tree, mappedCode);
      if (doc === null) {
        continue;
      }
      const index = rowColToIndex(mappedCode.value)({
        row: position.row,
        column: position.column - deletions
      });
      let { withError: locateFailed, value: maybePath } = locateCursor(doc, index);
      if (locateFailed) {
        if (lineAfterDeletions.trim().length === 0) {
          const result = await completeEmptyLineOnIndentation(deletions, mappedCode);
          return result;
        }
        maybePath = locateFromIndentation({
          line: lineAfterDeletions,
          code: mappedCode.value,
          position: {
            row: position.row,
            column: position.column - deletions
          }
        });
      }
      const path = maybePath;
      if (path[path.length - 1] === word) {
        path.pop();
      }
      const rawCompletions = await completions({
        schema,
        path,
        word,
        indent,
        commentPrefix,
        context
      });
      if (line.indexOf(":") !== -1) {
        rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "value").map((completion) => ({ ...completion, suggest_on_accept: false }));
      } else if (line.indexOf("-") === -1) {
        rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "key");
      }
      return rawCompletions;
    }
  }
  return noCompletions;
}
var noCompletions = {
  token: "",
  completions: [],
  cacheable: false
};
function uniqBy(lst, keyFun) {
  const itemSet = new Set();
  return lst.filter((item) => {
    const key = keyFun(item);
    if (key === void 0) {
      return true;
    }
    if (itemSet.has(key)) {
      return false;
    }
    itemSet.add(key);
    return true;
  });
}
function dropCompletionsFromSchema(obj, completion, definitions) {
  let matchingSchema = syncResolveSchema(completion.schema, definitions);
  const {
    path
  } = obj;
  if (completion.type === "value") {
    return false;
  }
  let subPath = [completion.value.slice(0, -2)];
  let matchingSubSchemas = syncNavigateSchema(matchingSchema, subPath, definitions);
  if (matchingSubSchemas.length === 0) {
    return false;
  }
  return !(path.length > 0 && path[0] === "execute") && matchingSubSchemas.every((s) => s.tags && s.tags["execute-only"]);
}
async function completions(obj) {
  const {
    schema,
    path,
    word,
    indent,
    commentPrefix,
    context
  } = obj;
  const { definitions } = getSchemas();
  const matchingSchemas = uniqBy(syncNavigateSchema(schema, path, definitions), (schema2) => schema2.$id);
  const { aliases } = getSchemas();
  const formats = [
    ...Array.from(context.formats),
    ...Array.from(context.project_formats)
  ].filter((x) => aliases["pandoc-all"].indexOf(x) !== -1);
  let completions2 = matchingSchemas.map((schema2) => {
    const result = schemaCompletions(schema2);
    return result.filter((completion) => !dropCompletionsFromSchema(obj, completion, definitions)).map((completion) => {
      if (!completion.suggest_on_accept || completion.type === "value" || !schemaAccepts(completion.schema, "object")) {
        return completion;
      }
      const key = completion.value.split(":")[0];
      const matchingSubSchemas = syncNavigateSchema(completion.schema, [key], definitions);
      if (matchingSubSchemas.some((subSchema) => schemaAccepts(subSchema, "object"))) {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix + " ".repeat(indent + 2)
        };
      } else if (matchingSubSchemas.some((subSchema) => schemaAccepts(subSchema, "array"))) {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix + " ".repeat(indent + 2) + "- "
        };
      } else {
        return completion;
      }
    });
  }).flat().filter((c) => c.value.startsWith(word)).filter((c) => {
    if (formats.length === 0) {
      return true;
    }
    let formatTags = [];
    if (c.type === "key") {
      let value = c.schema.properties[c.display];
      if (value === void 0) {
        for (const key of Object.keys(c.schema.patternProperties)) {
          const regexp = new RegExp(key);
          if (c.display.match(regexp)) {
            value = c.schema.patternProperties[key];
            break;
          }
        }
      }
      if (value === void 0) {
        return true;
      }
      formatTags = value && value.tags && value.tags.formats || [];
    } else if (c.type === "value") {
      formatTags = c.schema && c.schema.tags && c.schema.tags.formats || [];
    } else {
      return false;
    }
    const enabled2 = formatTags.filter((tag) => !tag.startsWith("!"));
    const enabledSet = new Set();
    if (enabled2.length === 0) {
      for (const el of aliases["pandoc-all"]) {
        enabledSet.add(el);
      }
    } else {
      for (const tag of enabled2) {
        for (const el of expandAliasesFrom([tag], aliases)) {
          enabledSet.add(el);
        }
      }
    }
    for (let tag of formatTags.filter((tag2) => tag2.startsWith("!"))) {
      tag = tag.slice(1);
      for (const el of expandAliasesFrom([tag], aliases)) {
        enabledSet.delete(el);
      }
    }
    return formats.some((f) => enabledSet.has(f));
  }).map((c) => {
    if (c.documentation === "" || c.documentation === void 0) {
      return c;
    }
    if (c.description !== void 0 && c.description !== "") {
      return c;
    }
    return {
      ...c,
      description: c.documentation
    };
  });
  completions2 = uniqBy(completions2, (completion) => completion.value);
  return {
    token: word,
    completions: completions2,
    cacheable: true
  };
}
async function automationFromGoodParseMarkdown(kind, context) {
  const {
    position,
    line
  } = context;
  const result = await breakQuartoMd(asMappedString(context.code));
  const adjustedCellSize = (cell) => {
    const cellLines = lines(cell.source.value);
    let size = cellLines.length;
    if (cell.cell_type !== "raw" && cell.cell_type !== "markdown") {
      size += 2;
    } else if (cellLines[size - 1].trim().length === 0) {
      size -= 1;
    }
    return size;
  };
  if (kind === "completions") {
    let foundCell = void 0;
    for (const cell of result.cells) {
      const size = lines(cell.source.value).length;
      if (size + cell.cellStartLine > position.row) {
        foundCell = cell;
        break;
      }
    }
    if (foundCell === void 0) {
      return noCompletions;
    }
    if (foundCell.cell_type === "raw") {
      const schema = getSchemas().schemas["front-matter"];
      context = {
        ...context,
        line,
        position,
        schema,
        code: foundCell.source,
        schemaName: "front-matter"
      };
      if (positionInTicks(context)) {
        return noCompletions;
      }
      context = trimTicks(context);
      return automationFromGoodParseYAML(kind, context);
    } else if (foundCell.cell_type === "math") {
      throw new Error(`internal error, don't know how to complete cell of type ${foundCell.cell_type}`);
    } else if (foundCell.cell_type === "markdown") {
      return noCompletions;
    } else if (foundCell.cell_type.language) {
      return automationFromGoodParseScript(kind, {
        ...context,
        language: foundCell.cell_type.language,
        code: foundCell.source,
        position: {
          row: position.row - foundCell.cellStartLine,
          column: position.column
        },
        line
      });
    } else {
      throw new Error(`internal error, don't know how to complete cell of type ${foundCell.cell_type}`);
    }
  } else {
    let linesSoFar = 0;
    const lints = [];
    for (const cell of result.cells) {
      if (cell.cell_type === "raw") {
        const innerLints = await automationFromGoodParseYAML(kind, trimTicks({
          ...context,
          filetype: "yaml",
          code: cell.source,
          schema: getSchemas().schemas["front-matter"],
          schemaName: "front-matter",
          line,
          position
        }));
        lints.push(...innerLints);
      } else if (cell.cell_type === "markdown" || cell.cell_type === "math") {
        continue;
      } else if (cell.cell_type.language) {
        const innerLints = await automationFromGoodParseScript(kind, {
          ...context,
          filetype: "script",
          code: cell.source,
          language: cell.cell_type.language,
          line,
          position: {
            ...position,
            row: position.row - (linesSoFar + 1)
          }
        });
        lints.push(...innerLints);
      }
      linesSoFar += adjustedCellSize(cell);
    }
    return lints;
  }
}
async function automationFromGoodParseYAML(kind, context) {
  if (kind === "completions" && positionInTicks(context)) {
    return noCompletions;
  }
  context = trimTicks(context);
  if (guessChunkOptionsFormat(asMappedString(context.code).value) === "knitr") {
    if (kind === "validation") {
      return [];
    } else {
      return noCompletions;
    }
  }
  const func = kind === "completions" ? completionsFromGoodParseYAML : validationFromGoodParseYAML;
  return func(context);
}
async function automationFromGoodParseScript(kind, context) {
  const codeLines = rangedLines(asMappedString(context.code).value);
  let language;
  let codeStartLine;
  if (!context.language) {
    if (codeLines.length < 2) {
      if (kind === "completions") {
        return noCompletions;
      } else {
        return [];
      }
    }
    const m = codeLines[0].substring.match(/.*{([a-z]+)}/);
    if (!m) {
      if (kind === "completions") {
        return noCompletions;
      } else {
        return [];
      }
    }
    codeStartLine = 1;
    language = m[1];
  } else {
    codeStartLine = 0;
    language = context.language;
  }
  const mappedCode = mappedString(context.code, [{
    start: codeLines[codeStartLine].range.start,
    end: codeLines[codeLines.length - 1].range.end
  }]);
  const {
    yaml
  } = await partitionCellOptionsMapped(language, mappedCode);
  if (yaml === void 0) {
    if (kind === "completions") {
      return noCompletions;
    } else {
      return [];
    }
  }
  const schemas = getSchemas().schemas;
  const schema = schemas.engines[context.engine || "markdown"];
  const commentPrefix = kLangCommentChars[language] + "| ";
  context = {
    ...context,
    line: context.line.slice(commentPrefix.length),
    code: yaml,
    commentPrefix,
    position: {
      row: context.position.row - codeStartLine,
      column: context.position.column - commentPrefix.length
    },
    schema,
    schemaName: language
  };
  return automationFromGoodParseYAML(kind, context);
}
async function automationFileTypeDispatch(filetype, kind, context) {
  switch (filetype) {
    case "markdown":
      return automationFromGoodParseMarkdown(kind, context);
    case "yaml":
      return automationFromGoodParseYAML(kind, context);
    case "script":
      return automationFromGoodParseScript(kind, context);
    default:
      return null;
  }
}
function exportSmokeTest(kind, context) {
  console.error(JSON.stringify({ kind, context }, null, 2));
}
async function getAutomation(kind, context) {
  const extension = context.path === null ? "" : context.path.split(".").pop() || "";
  const schemas = getSchemas().schemas;
  const schema = {
    "yaml": extension === "qmd" ? schemas["front-matter"] : schemas.config,
    "markdown": void 0,
    "script": void 0
  }[context.filetype];
  const schemaName = {
    "yaml": extension === "qmd" ? "front-matter" : "config",
    "markdown": void 0,
    "script": void 0
  }[context.filetype];
  const result = await automationFileTypeDispatch(context.filetype, kind, {
    ...context,
    code: asMappedString(context.code),
    schema,
    schemaName
  });
  return result || null;
}
var initializer2 = async () => {
  const before = performance.now();
  setValidatorModulePath(getLocalPath("standalone-schema-validators.js"));
  const response = await fetch(getLocalPath("quarto-json-schemas.json"));
  const _schemas2 = await response.json();
  setSchemas(_schemas2);
  const schemaDefs = getSchemas().definitions;
  for (const [_key, value] of Object.entries(schemaDefs)) {
    setSchemaDefinition(value);
    await withValidator(value, async (_validator) => {
    });
  }
  const after = performance.now();
};
var QuartoYamlEditorTools = {
  getAutomation: function(params) {
    const {
      context,
      kind
    } = params;
    return getAutomation(kind, context);
  },
  exportSmokeTest,
  getCompletions: async function(context, path) {
    try {
      setMainPath(path);
      setInitializer(initializer2);
      await initState();
      return await getAutomation("completions", context);
    } catch (e) {
      console.log("Error found during autocomplete", e);
      exportSmokeTest("completions", context);
      return null;
    }
  },
  getLint: async function(context, path) {
    try {
      setMainPath(path);
      setInitializer(initializer2);
      await initState();
      return await getAutomation("validation", context);
    } catch (e) {
      console.log("Error found during linting", e);
      exportSmokeTest("validation", context);
      return null;
    }
  }
};
export {
  QuartoYamlEditorTools,
  getAutomation,
  validationFromGoodParseYAML
};
/*! @author Toru Nagashima <https://github.com/mysticatea> */
