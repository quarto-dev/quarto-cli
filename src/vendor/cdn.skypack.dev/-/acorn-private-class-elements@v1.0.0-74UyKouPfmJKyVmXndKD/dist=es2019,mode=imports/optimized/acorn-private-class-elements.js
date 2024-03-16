import * as acorn from "/-/acorn@v8.4.0-TUBEehokUmfefnUMjao9/dist=es2019,mode=imports/optimized/acorn.js";
function getDefaultExportFromNamespaceIfNotNamed(n) {
  return n && Object.prototype.hasOwnProperty.call(n, "default") && Object.keys(n).length === 1 ? n["default"] : n;
}
var require$$0 = /* @__PURE__ */ getDefaultExportFromNamespaceIfNotNamed(acorn);
const getPrototype = Object.getPrototypeOf || ((o) => o.__proto__);
const getAcorn = (Parser) => {
  if (Parser.acorn)
    return Parser.acorn;
  const acorn2 = require$$0;
  if (acorn2.version.indexOf("6.") != 0 && acorn2.version.indexOf("6.0.") == 0 && acorn2.version.indexOf("7.") != 0) {
    throw new Error(`acorn-private-class-elements requires acorn@^6.1.0 or acorn@7.0.0, not ${acorn2.version}`);
  }
  for (let cur = Parser; cur && cur !== acorn2.Parser; cur = getPrototype(cur)) {
    if (cur !== acorn2.Parser) {
      throw new Error("acorn-private-class-elements does not support mixing different acorn copies");
    }
  }
  return acorn2;
};
var acornPrivateClassElements = function(Parser) {
  if (Parser.prototype.parsePrivateName) {
    return Parser;
  }
  const acorn2 = getAcorn(Parser);
  Parser = class extends Parser {
    _branch() {
      this.__branch = this.__branch || new Parser({ecmaVersion: this.options.ecmaVersion}, this.input);
      this.__branch.end = this.end;
      this.__branch.pos = this.pos;
      this.__branch.type = this.type;
      this.__branch.value = this.value;
      this.__branch.containsEsc = this.containsEsc;
      return this.__branch;
    }
    parsePrivateClassElementName(element) {
      element.computed = false;
      element.key = this.parsePrivateName();
      if (element.key.name == "constructor")
        this.raise(element.key.start, "Classes may not have a private element named constructor");
      const accept = {get: "set", set: "get"}[element.kind];
      const privateBoundNames = this._privateBoundNames;
      if (Object.prototype.hasOwnProperty.call(privateBoundNames, element.key.name) && privateBoundNames[element.key.name] !== accept) {
        this.raise(element.start, "Duplicate private element");
      }
      privateBoundNames[element.key.name] = element.kind || true;
      delete this._unresolvedPrivateNames[element.key.name];
      return element.key;
    }
    parsePrivateName() {
      const node = this.startNode();
      node.name = this.value;
      this.next();
      this.finishNode(node, "PrivateIdentifier");
      if (this.options.allowReserved == "never")
        this.checkUnreserved(node);
      return node;
    }
    getTokenFromCode(code) {
      if (code === 35) {
        ++this.pos;
        const word = this.readWord1();
        return this.finishToken(this.privateIdentifierToken, word);
      }
      return super.getTokenFromCode(code);
    }
    parseClass(node, isStatement) {
      const oldOuterPrivateBoundNames = this._outerPrivateBoundNames;
      this._outerPrivateBoundNames = this._privateBoundNames;
      this._privateBoundNames = Object.create(this._privateBoundNames || null);
      const oldOuterUnresolvedPrivateNames = this._outerUnresolvedPrivateNames;
      this._outerUnresolvedPrivateNames = this._unresolvedPrivateNames;
      this._unresolvedPrivateNames = Object.create(null);
      const _return = super.parseClass(node, isStatement);
      const unresolvedPrivateNames = this._unresolvedPrivateNames;
      this._privateBoundNames = this._outerPrivateBoundNames;
      this._outerPrivateBoundNames = oldOuterPrivateBoundNames;
      this._unresolvedPrivateNames = this._outerUnresolvedPrivateNames;
      this._outerUnresolvedPrivateNames = oldOuterUnresolvedPrivateNames;
      if (!this._unresolvedPrivateNames) {
        const names = Object.keys(unresolvedPrivateNames);
        if (names.length) {
          names.sort((n1, n2) => unresolvedPrivateNames[n1] - unresolvedPrivateNames[n2]);
          this.raise(unresolvedPrivateNames[names[0]], "Usage of undeclared private name");
        }
      } else
        Object.assign(this._unresolvedPrivateNames, unresolvedPrivateNames);
      return _return;
    }
    parseClassSuper(node) {
      const privateBoundNames = this._privateBoundNames;
      this._privateBoundNames = this._outerPrivateBoundNames;
      const unresolvedPrivateNames = this._unresolvedPrivateNames;
      this._unresolvedPrivateNames = this._outerUnresolvedPrivateNames;
      const _return = super.parseClassSuper(node);
      this._privateBoundNames = privateBoundNames;
      this._unresolvedPrivateNames = unresolvedPrivateNames;
      return _return;
    }
    parseSubscript(base, startPos, startLoc, _noCalls, _maybeAsyncArrow, _optionalChained) {
      const optionalSupported = this.options.ecmaVersion >= 11 && acorn2.tokTypes.questionDot;
      const branch = this._branch();
      if (!((branch.eat(acorn2.tokTypes.dot) || optionalSupported && branch.eat(acorn2.tokTypes.questionDot)) && branch.type == this.privateIdentifierToken)) {
        return super.parseSubscript.apply(this, arguments);
      }
      let optional = false;
      if (!this.eat(acorn2.tokTypes.dot)) {
        this.expect(acorn2.tokTypes.questionDot);
        optional = true;
      }
      let node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.computed = false;
      if (optionalSupported) {
        node.optional = optional;
      }
      if (this.type == this.privateIdentifierToken) {
        if (base.type == "Super") {
          this.raise(this.start, "Cannot access private element on super");
        }
        node.property = this.parsePrivateName();
        if (!this._privateBoundNames || !this._privateBoundNames[node.property.name]) {
          if (!this._unresolvedPrivateNames) {
            this.raise(node.property.start, "Usage of undeclared private name");
          }
          this._unresolvedPrivateNames[node.property.name] = node.property.start;
        }
      } else {
        node.property = this.parseIdent(true);
      }
      return this.finishNode(node, "MemberExpression");
    }
    parseMaybeUnary(refDestructuringErrors, sawUnary) {
      const _return = super.parseMaybeUnary(refDestructuringErrors, sawUnary);
      if (_return.operator == "delete") {
        if (_return.argument.type == "MemberExpression" && _return.argument.property.type == "PrivateIdentifier") {
          this.raise(_return.start, "Private elements may not be deleted");
        }
      }
      return _return;
    }
  };
  Parser.prototype.privateIdentifierToken = new acorn2.TokenType("privateIdentifier");
  return Parser;
};
export default acornPrivateClassElements;
