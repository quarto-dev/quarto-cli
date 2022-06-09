import {Parser, tokTypes, TokContext, getLineInfo} from "/-/acorn@v7.4.1-aIeX4aKa0RO2JeS9dtPa/dist=es2019,mode=imports/optimized/acorn.js";
import {make, ancestor, simple} from "/-/acorn-walk@v7.2.0-HE7wS37ePcNncqJvsD8k/dist=es2019,mode=imports/optimized/acorn-walk.js";
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
var walk = make({
  Import() {
  },
  ViewExpression(node, st, c) {
    c(node.id, st, "Identifier");
  },
  MutableExpression(node, st, c) {
    c(node.id, st, "Identifier");
  }
});
function isScope(node) {
  return node.type === "FunctionExpression" || node.type === "FunctionDeclaration" || node.type === "ArrowFunctionExpression" || node.type === "Program";
}
function isBlockScope(node) {
  return node.type === "BlockStatement" || node.type === "ForInStatement" || node.type === "ForOfStatement" || node.type === "ForStatement" || isScope(node);
}
function declaresArguments(node) {
  return node.type === "FunctionExpression" || node.type === "FunctionDeclaration";
}
function findReferences(cell, globals) {
  const ast = {type: "Program", body: [cell.body]};
  const locals = new Map();
  const globalSet = new Set(globals);
  const references = [];
  function hasLocal(node, name) {
    const l = locals.get(node);
    return l ? l.has(name) : false;
  }
  function declareLocal(node, id) {
    const l = locals.get(node);
    if (l)
      l.add(id.name);
    else
      locals.set(node, new Set([id.name]));
  }
  function declareClass(node) {
    if (node.id)
      declareLocal(node, node.id);
  }
  function declareFunction(node) {
    node.params.forEach((param) => declarePattern(param, node));
    if (node.id)
      declareLocal(node, node.id);
  }
  function declareCatchClause(node) {
    if (node.param)
      declarePattern(node.param, node);
  }
  function declarePattern(node, parent) {
    switch (node.type) {
      case "Identifier":
        declareLocal(parent, node);
        break;
      case "ObjectPattern":
        node.properties.forEach((node2) => declarePattern(node2, parent));
        break;
      case "ArrayPattern":
        node.elements.forEach((node2) => node2 && declarePattern(node2, parent));
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
  ancestor(ast, {
    VariableDeclaration: (node, parents) => {
      let parent = null;
      for (let i = parents.length - 1; i >= 0 && parent === null; --i) {
        if (node.kind === "var" ? isScope(parents[i]) : isBlockScope(parents[i])) {
          parent = parents[i];
        }
      }
      node.declarations.forEach((declaration) => declarePattern(declaration.id, parent));
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
  }, walk);
  function identifier(node, parents) {
    let name = node.name;
    if (name === "undefined")
      return;
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
  ancestor(ast, {
    VariablePattern: identifier,
    Identifier: identifier
  }, walk);
  function checkConst(node, parents) {
    if (!node)
      return;
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
  ancestor(ast, {
    AssignmentExpression: checkConstLeft,
    AssignmentPattern: checkConstLeft,
    UpdateExpression: checkConstArgument,
    ForOfStatement: checkConstLeft,
    ForInStatement: checkConstLeft
  }, walk);
  return references;
}
function findFeatures(cell, featureName) {
  const ast = {type: "Program", body: [cell.body]};
  const features = new Map();
  const {references} = cell;
  simple(ast, {
    CallExpression: (node) => {
      const {callee, arguments: args} = node;
      if (callee.type !== "Identifier" || callee.name !== featureName || references.indexOf(callee) < 0)
        return;
      if (args.length !== 1 || !(args[0].type === "Literal" && /^['"]/.test(args[0].raw) || args[0].type === "TemplateLiteral" && args[0].expressions.length === 0)) {
        throw Object.assign(new SyntaxError(`${featureName} requires a single literal string argument`), {node});
      }
      const [arg] = args;
      const name = arg.type === "Literal" ? arg.value : arg.quasis[0].value.cooked;
      const location = {start: arg.start, end: arg.end};
      if (features.has(name))
        features.get(name).push(location);
      else
        features.set(name, [location]);
    }
  }, walk);
  return features;
}
const SCOPE_FUNCTION = 2;
const SCOPE_ASYNC = 4;
const SCOPE_GENERATOR = 8;
const STATE_START = Symbol("start");
const STATE_MODIFIER = Symbol("modifier");
const STATE_FUNCTION = Symbol("function");
const STATE_NAME = Symbol("name");
function parseCell(input, {tag, raw, globals, ...options} = {}) {
  let cell;
  if (tag != null && input) {
    cell = TemplateCellParser.parse(input, options);
    cell.tag = tag;
    cell.raw = !!raw;
  } else {
    cell = CellParser.parse(input, options);
  }
  parseReferences(cell, input, globals);
  parseFeatures(cell);
  return cell;
}
function peekId(input) {
  let state = STATE_START;
  let name;
  try {
    for (const token of Parser.tokenizer(input, {ecmaVersion: 11})) {
      switch (state) {
        case STATE_START:
        case STATE_MODIFIER: {
          if (token.type === tokTypes.name) {
            if (state === STATE_START && (token.value === "viewof" || token.value === "mutable" || token.value === "async")) {
              state = STATE_MODIFIER;
              continue;
            }
            state = STATE_NAME;
            name = token;
            continue;
          }
          if (token.type === tokTypes._function || token.type === tokTypes._class) {
            state = STATE_FUNCTION;
            continue;
          }
          break;
        }
        case STATE_NAME: {
          if (token.type === tokTypes.eq)
            return name.value;
          break;
        }
        case STATE_FUNCTION: {
          if (token.type === tokTypes.star)
            continue;
          if (token.type === tokTypes.name && token.end < input.length)
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
    if (flags & SCOPE_FUNCTION)
      ++this.O_function;
    return super.enterScope(flags);
  }
  exitScope() {
    if (this.currentScope().flags & SCOPE_FUNCTION)
      --this.O_function;
    return super.exitScope();
  }
  parseForIn(node, init) {
    if (this.O_function === 1 && node.await)
      this.O_async = true;
    return super.parseForIn(node, init);
  }
  parseAwait() {
    if (this.O_function === 1)
      this.O_async = true;
    return super.parseAwait();
  }
  parseYield(noIn) {
    if (this.O_function === 1)
      this.O_generator = true;
    return super.parseYield(noIn);
  }
  parseImport(node) {
    this.next();
    node.specifiers = this.parseImportSpecifiers();
    if (this.type === tokTypes._with) {
      this.next();
      node.injections = this.parseImportSpecifiers();
    }
    this.expectContextual("from");
    node.source = this.type === tokTypes.string ? this.parseExprAtom() : this.unexpected();
    return this.finishNode(node, "ImportDeclaration");
  }
  parseImportSpecifiers() {
    const nodes = [];
    const identifiers = new Set();
    let first = true;
    this.expect(tokTypes.braceL);
    while (!this.eat(tokTypes.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tokTypes.comma);
        if (this.afterTrailingComma(tokTypes.braceR))
          break;
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
    return this.parseMaybeKeywordExpression("viewof", "ViewExpression") || this.parseMaybeKeywordExpression("mutable", "MutableExpression") || super.parseExprAtom(refDestructuringErrors);
  }
  startCell() {
    this.O_function = 0;
    this.O_async = false;
    this.O_generator = false;
    this.strict = true;
    this.enterScope(SCOPE_FUNCTION | SCOPE_ASYNC | SCOPE_GENERATOR);
  }
  finishCell(node, body, id) {
    if (id)
      this.checkLocal(id);
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
    if (token.type === tokTypes._import && lookahead.getToken().type !== tokTypes.parenL) {
      body = this.parseImport(this.startNode());
    } else if (token.type !== tokTypes.eof && token.type !== tokTypes.semi) {
      if (token.type === tokTypes.name) {
        if (token.value === "viewof" || token.value === "mutable") {
          token = lookahead.getToken();
          if (token.type !== tokTypes.name) {
            lookahead.unexpected();
          }
        }
        token = lookahead.getToken();
        if (token.type === tokTypes.eq) {
          id = this.parseMaybeKeywordExpression("viewof", "ViewExpression") || this.parseMaybeKeywordExpression("mutable", "MutableExpression") || this.parseIdent();
          token = lookahead.getToken();
          this.expect(tokTypes.eq);
        }
      }
      if (token.type === tokTypes.braceL) {
        body = this.parseBlock();
      } else {
        body = this.parseExpression();
        if (id === null && (body.type === "FunctionExpression" || body.type === "ClassExpression")) {
          id = body.id;
        }
      }
    }
    this.semicolon();
    if (eof)
      this.expect(tokTypes.eof);
    return this.finishCell(node, body, id);
  }
  parseTopLevel(node) {
    return this.parseCell(node, true);
  }
  toAssignable(node, isBinding, refDestructuringErrors) {
    return node.type === "MutableExpression" ? node : super.toAssignable(node, isBinding, refDestructuringErrors);
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
    return super.checkLVal(expr.type === "MutableExpression" ? expr.id : expr, bindingType, checkClashes);
  }
  unexpected(pos) {
    this.raise(pos != null ? pos : this.start, this.type === tokTypes.eof ? "Unexpected end of input" : "Unexpected token");
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
const o_tmpl = new TokContext("`", true, true, (parser) => readTemplateToken.call(parser));
class TemplateCellParser extends CellParser {
  constructor(...args) {
    super(...args);
    this.type = tokTypes.backQuote;
    this.exprAllowed = false;
  }
  initialContext() {
    return [o_tmpl];
  }
  parseCell(node) {
    this.startCell();
    if (this.type === tokTypes.eof)
      this.value = "";
    const isTagged = true;
    const body = this.startNode();
    body.expressions = [];
    let curElt = this.parseTemplateElement({isTagged});
    body.quasis = [curElt];
    while (this.type !== tokTypes.eof) {
      this.expect(tokTypes.dollarBraceL);
      body.expressions.push(this.parseExpression());
      this.expect(tokTypes.braceR);
      body.quasis.push(curElt = this.parseTemplateElement({isTagged}));
    }
    curElt.tail = true;
    this.next();
    this.finishNode(body, "TemplateLiteral");
    this.expect(tokTypes.eof);
    return this.finishCell(node, body, null);
  }
}
function readTemplateToken() {
  out:
    for (; this.pos < this.input.length; this.pos++) {
      switch (this.input.charCodeAt(this.pos)) {
        case 92: {
          if (this.pos < this.input.length - 1)
            ++this.pos;
          break;
        }
        case 36: {
          if (this.input.charCodeAt(this.pos + 1) === 123) {
            if (this.pos === this.start && this.type === tokTypes.invalidTemplate) {
              this.pos += 2;
              return this.finishToken(tokTypes.dollarBraceL);
            }
            break out;
          }
          break;
        }
      }
    }
  return this.finishToken(tokTypes.invalidTemplate, this.input.slice(this.start, this.pos));
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
    if (!node.cells)
      node.cells = [];
    while (this.type !== tokTypes.eof) {
      const cell = this.parseCell(this.startNode());
      cell.input = this.input;
      node.cells.push(cell);
    }
    this.next();
    return this.finishNode(node, "Program");
  }
}
function parseReferences(cell, input, globals = defaultGlobals) {
  if (!cell.body) {
    cell.references = [];
  } else if (cell.body.type === "ImportDeclaration") {
    cell.references = cell.body.injections ? cell.body.injections.map((i) => i.imported) : [];
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
export {CellParser, ModuleParser, TemplateCellParser, parseCell, parseModule, peekId, walk};
export default null;
