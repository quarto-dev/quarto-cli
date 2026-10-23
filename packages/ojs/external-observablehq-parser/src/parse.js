import {getLineInfo, TokContext, tokTypes as tt, Parser} from "acorn";
import defaultGlobals from "./globals.js";
import findReferences from "./references.js";
import findFeatures from "./features.js";

const SCOPE_FUNCTION = 2;
const SCOPE_ASYNC = 4;
const SCOPE_GENERATOR = 8;

export function parseCell(input, {tag, raw, globals, ...options} = {}) {
  let cell;
  // Parse empty input as JavaScript to keep ensure resulting ast
  // is consistent for all empty input cases.
  if (tag != null && input) {
    cell = TemplateCellParser.parse(input, options);
    const parsedTag = CellTagParser.parse(tag, options);
    parseReferences(parsedTag, tag, globals);
    parseFeatures(parsedTag, tag);
    cell.tag = parsedTag;
    cell.raw = !!raw;
  } else {
    cell = CellParser.parse(input, options);
  }
  parseReferences(cell, input, globals);
  parseFeatures(cell, input);
  return cell;
}

export class CellParser extends Parser {
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
    if (this.type === tt._with) {
      this.next();
      node.injections = this.parseImportSpecifiers();
    }
    this.expectContextual("from");
    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
    return this.finishNode(node, "ImportDeclaration");
  }
  parseImportSpecifiers() {
    const nodes = [];
    const identifiers = new Set;
    let first = true;
    this.expect(tt.braceL);
    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.afterTrailingComma(tt.braceR)) break;
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
    if (token.type === tt._import && lookahead.getToken().type !== tt.parenL) {
      body = this.parseImport(this.startNode());
    }

    // A non-empty cell?
    else if (token.type !== tt.eof && token.type !== tt.semi) {
      // A named cell?
      if (token.type === tt.name) {
        if (token.value === "viewof" || token.value === "mutable") {
          token = lookahead.getToken();
          if (token.type !== tt.name) {
            lookahead.unexpected();
          }
        }
        token = lookahead.getToken();
        if (token.type === tt.eq) {
          id =
            this.parseMaybeKeywordExpression("viewof", "ViewExpression") ||
            this.parseMaybeKeywordExpression("mutable", "MutableExpression") ||
            this.parseIdent();
          token = lookahead.getToken();
          this.expect(tt.eq);
        }
      }

      // A block?
      if (token.type === tt.braceL) {
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
    if (eof) this.expect(tt.eof); // TODO

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
      this.type === tt.eof ? "Unexpected end of input" : "Unexpected token"
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
const o_tmpl = new TokContext(
  "`", // token
  true, // isExpr
  true, // preserveSpace
  parser => readTemplateToken.call(parser) // override
);

export class TemplateCellParser extends CellParser {
  constructor(...args) {
    super(...args);
    // Initialize the type so that we're inside a backQuote
    this.type = tt.backQuote;
    this.exprAllowed = false;
  }
  initialContext() {
    // Provide our custom TokContext
    return [o_tmpl];
  }
  parseCell(node) {
    this.startCell();

    // Fix for nextToken calling finishToken(tt.eof)
    if (this.type === tt.eof) this.value = "";

    // Based on acorn.Parser.parseTemplate
    const isTagged = true;
    const body = this.startNode();
    body.expressions = [];
    let curElt = this.parseTemplateElement({isTagged});
    body.quasis = [curElt];
    while (this.type !== tt.eof) {
      this.expect(tt.dollarBraceL);
      body.expressions.push(this.parseExpression());
      this.expect(tt.braceR);
      body.quasis.push(curElt = this.parseTemplateElement({isTagged}));
    }
    curElt.tail = true;
    this.next();
    this.finishNode(body, "TemplateLiteral");

    this.expect(tt.eof);
    return this.finishCell(node, body, null);
  }
}

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
          if (this.pos === this.start && this.type === tt.invalidTemplate) {
            this.pos += 2;
            return this.finishToken(tt.dollarBraceL);
          }
          break out;
        }
        break;
      }
    }
  }
  return this.finishToken(tt.invalidTemplate, this.input.slice(this.start, this.pos));
}

export class CellTagParser extends Parser {
  constructor(options, ...args) {
    super(Object.assign({ecmaVersion: 12}, options), ...args);
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
  parseTopLevel(node) {
    this.O_function = 0;
    this.O_async = false;
    this.O_generator = false;
    this.strict = true;
    this.enterScope(SCOPE_FUNCTION | SCOPE_ASYNC | SCOPE_GENERATOR);
    node.body = this.parseExpression();
    node.input = this.input;
    node.async = this.O_async;
    node.generator = this.O_generator;
    this.exitScope();
    return this.finishNode(node, "CellTag");
  }
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
      cell.notificationClients = findFeatures(cell, "NotificationClient");
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
    cell.notificationClients = new Map();
  }
  return cell;
}

/* Fork changes begin here */

export function parseModule(input, {globals} = {}) {
  const program = ModuleParser.parse(input);
  for (const cell of program.cells) {
    parseReferences(cell, input, globals);
    parseFeatures(cell, input, globals);
  }
  return program;
}

export class ModuleParser extends CellParser {
  parseTopLevel(node) {
    if (!node.cells) node.cells = [];
    while (this.type !== tt.eof) {
      const cell = this.parseCell(this.startNode());
      cell.input = this.input;
      node.cells.push(cell);
    }
    this.next();
    return this.finishNode(node, "Program");
  }
}

/* Fork changes end here */
