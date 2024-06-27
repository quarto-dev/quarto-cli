var escapeRe = /([-.*+?^${}()|[\]\/\\])/g, unescapeRe = /\\/g;
var escape = function(string) {
  return (string + "").replace(escapeRe, "\\$1");
};
var unescape = function(string) {
  return (string + "").replace(unescapeRe, "");
};
var slickRe = RegExp(`^(?:\\s*(,)\\s*|\\s*(<combinator>+)\\s*|(\\s+)|(<unicode>+|\\*)|\\#(<unicode>+)|\\.(<unicode>+)|\\[\\s*(<unicode1>+)(?:\\s*([*^$!~|]?=)(?:\\s*(?:(["']?)(.*?)\\9)))?\\s*\\](?!\\])|(:+)(<unicode>+)(?:\\((?:(?:(["'])([^\\13]*)\\13)|((?:\\([^)]+\\)|[^()]*)+))\\))?)`.replace(/<combinator>/, "[" + escape(">+~`!@$%^&={}\\;</") + "]").replace(/<unicode>/g, "(?:[\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])").replace(/<unicode1>/g, "(?:[:\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])"));
var Part = function Part2(combinator) {
  this.combinator = combinator || " ";
  this.tag = "*";
};
Part.prototype.toString = function() {
  if (!this.raw) {
    var xpr = "", k, part;
    xpr += this.tag || "*";
    if (this.id)
      xpr += "#" + this.id;
    if (this.classes)
      xpr += "." + this.classList.join(".");
    if (this.attributes)
      for (k = 0; part = this.attributes[k++]; ) {
        xpr += "[" + part.name + (part.operator ? part.operator + '"' + part.value + '"' : "") + "]";
      }
    if (this.pseudos)
      for (k = 0; part = this.pseudos[k++]; ) {
        xpr += ":" + part.name;
        if (part.value)
          xpr += "(" + part.value + ")";
      }
    this.raw = xpr;
  }
  return this.raw;
};
var Expression = function Expression2() {
  this.length = 0;
};
Expression.prototype.toString = function() {
  if (!this.raw) {
    var xpr = "";
    for (var j = 0, bit; bit = this[j++]; ) {
      if (j !== 1)
        xpr += " ";
      if (bit.combinator !== " ")
        xpr += bit.combinator + " ";
      xpr += bit;
    }
    this.raw = xpr;
  }
  return this.raw;
};
var replacer = function(rawMatch, separator, combinator, combinatorChildren, tagName, id, className, attributeKey, attributeOperator, attributeQuote, attributeValue, pseudoMarker, pseudoClass, pseudoQuote, pseudoClassQuotedValue, pseudoClassValue) {
  var expression, current;
  if (separator || !this.length) {
    expression = this[this.length++] = new Expression();
    if (separator)
      return "";
  }
  if (!expression)
    expression = this[this.length - 1];
  if (combinator || combinatorChildren || !expression.length) {
    current = expression[expression.length++] = new Part(combinator);
  }
  if (!current)
    current = expression[expression.length - 1];
  if (tagName) {
    current.tag = unescape(tagName);
  } else if (id) {
    current.id = unescape(id);
  } else if (className) {
    var unescaped = unescape(className);
    var classes = current.classes || (current.classes = {});
    if (!classes[unescaped]) {
      classes[unescaped] = escape(className);
      var classList = current.classList || (current.classList = []);
      classList.push(unescaped);
      classList.sort();
    }
  } else if (pseudoClass) {
    pseudoClassValue = pseudoClassValue || pseudoClassQuotedValue;
    (current.pseudos || (current.pseudos = [])).push({
      type: pseudoMarker.length == 1 ? "class" : "element",
      name: unescape(pseudoClass),
      escapedName: escape(pseudoClass),
      value: pseudoClassValue ? unescape(pseudoClassValue) : null,
      escapedValue: pseudoClassValue ? escape(pseudoClassValue) : null
    });
  } else if (attributeKey) {
    attributeValue = attributeValue ? escape(attributeValue) : null;
    (current.attributes || (current.attributes = [])).push({
      operator: attributeOperator,
      name: unescape(attributeKey),
      escapedName: escape(attributeKey),
      value: attributeValue ? unescape(attributeValue) : null,
      escapedValue: attributeValue ? escape(attributeValue) : null
    });
  }
  return "";
};
var Expressions = function Expressions2(expression) {
  this.length = 0;
  var self = this;
  var original = expression, replaced;
  while (expression) {
    replaced = expression.replace(slickRe, function() {
      return replacer.apply(self, arguments);
    });
    if (replaced === expression)
      throw new Error(original + " is an invalid expression");
    expression = replaced;
  }
};
Expressions.prototype.toString = function() {
  if (!this.raw) {
    var expressions = [];
    for (var i = 0, expression; expression = this[i++]; )
      expressions.push(expression);
    this.raw = expressions.join(", ");
  }
  return this.raw;
};
var cache = {};
var parse = function(expression) {
  if (expression == null)
    return null;
  expression = ("" + expression).replace(/^\s+|\s+$/g, "");
  return cache[expression] || (cache[expression] = new Expressions(expression));
};
var __VIRTUAL_FILE = parse;
export default __VIRTUAL_FILE;
