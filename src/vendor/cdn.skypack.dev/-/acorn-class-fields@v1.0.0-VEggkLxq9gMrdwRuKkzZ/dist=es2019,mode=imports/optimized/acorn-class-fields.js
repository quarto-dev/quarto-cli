import privateClassElements from "/-/acorn-private-class-elements@v1.0.0-74UyKouPfmJKyVmXndKD/dist=es2019,mode=imports/optimized/acorn-private-class-elements.js";
import * as acorn from "/-/acorn@v8.4.0-TUBEehokUmfefnUMjao9/dist=es2019,mode=imports/optimized/acorn.js";
function getDefaultExportFromNamespaceIfNotNamed(n) {
  return n && Object.prototype.hasOwnProperty.call(n, "default") && Object.keys(n).length === 1 ? n["default"] : n;
}
var require$$0 = /* @__PURE__ */ getDefaultExportFromNamespaceIfNotNamed(acorn);
var acornClassFields = function(Parser) {
  const acorn2 = Parser.acorn || require$$0;
  const tt = acorn2.tokTypes;
  Parser = privateClassElements(Parser);
  return class extends Parser {
    _maybeParseFieldValue(field) {
      if (this.eat(tt.eq)) {
        const oldInFieldValue = this._inFieldValue;
        this._inFieldValue = true;
        if (this.type === tt.name && this.value === "await" && (this.inAsync || this.options.allowAwaitOutsideFunction)) {
          field.value = this.parseAwait();
        } else
          field.value = this.parseExpression();
        this._inFieldValue = oldInFieldValue;
      } else
        field.value = null;
    }
    parseClassElement(_constructorAllowsSuper) {
      if (this.options.ecmaVersion >= 8 && (this.type == tt.name || this.type.keyword || this.type == this.privateIdentifierToken || this.type == tt.bracketL || this.type == tt.string || this.type == tt.num)) {
        const branch = this._branch();
        if (branch.type == tt.bracketL) {
          let count = 0;
          do {
            if (branch.eat(tt.bracketL))
              ++count;
            else if (branch.eat(tt.bracketR))
              --count;
            else
              branch.next();
          } while (count > 0);
        } else
          branch.next(true);
        let isField = branch.type == tt.eq || branch.type == tt.semi;
        if (!isField && branch.canInsertSemicolon()) {
          isField = branch.type != tt.parenL;
        }
        if (isField) {
          const node = this.startNode();
          if (this.type == this.privateIdentifierToken) {
            this.parsePrivateClassElementName(node);
          } else {
            this.parsePropertyName(node);
          }
          if (node.key.type === "Identifier" && node.key.name === "constructor" || node.key.type === "Literal" && node.key.value === "constructor") {
            this.raise(node.key.start, "Classes may not have a field called constructor");
          }
          this.enterScope(64 | 2 | 1);
          this._maybeParseFieldValue(node);
          this.exitScope();
          this.finishNode(node, "PropertyDefinition");
          this.semicolon();
          return node;
        }
      }
      return super.parseClassElement.apply(this, arguments);
    }
    parseIdent(liberal, isBinding) {
      const ident = super.parseIdent(liberal, isBinding);
      if (this._inFieldValue && ident.name == "arguments")
        this.raise(ident.start, "A class field initializer may not contain arguments");
      return ident;
    }
  };
};
export default acornClassFields;
