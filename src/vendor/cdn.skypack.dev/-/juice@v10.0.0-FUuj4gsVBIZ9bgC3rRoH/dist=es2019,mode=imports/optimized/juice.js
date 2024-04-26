import * as cheerio$1 from "/-/cheerio@v1.0.0-rc.12-d2orEfV7mEyxhcmv8Jbn/dist=es2019,mode=imports/optimized/cheerio.js";
import mensch2 from "/-/mensch@v0.3.4-bYdFVPGjq4ZCCd5bQOiD/dist=es2019,mode=imports/optimized/mensch.js";
import parser2 from "/-/slick@v1.12.2-aV7vJdJVxGxCoP6YSykY/dist=es2019,mode=imports/unoptimized/parser.js";
function createCommonjsModule(fn, basedir, module) {
  return module = {
    path: basedir,
    exports: {},
    require: function(path, base) {
      return commonjsRequire(path, base === void 0 || base === null ? module.path : base);
    }
  }, fn(module, module.exports), module.exports;
}
function getDefaultExportFromNamespaceIfNotNamed(n) {
  return n && Object.prototype.hasOwnProperty.call(n, "default") && Object.keys(n).length === 1 ? n["default"] : n;
}
function commonjsRequire() {
  throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
var selector = createCommonjsModule(function(module, exports) {
  module.exports = Selector;
  function Selector(text, styleAttribute) {
    this.text = text;
    this.spec = void 0;
    this.styleAttribute = styleAttribute || false;
  }
  Selector.prototype.parsed = function() {
    if (!this.tokens) {
      this.tokens = parse(this.text);
    }
    return this.tokens;
  };
  Selector.prototype.specificity = function() {
    var styleAttribute = this.styleAttribute;
    if (!this.spec) {
      this.spec = specificity(this.text, this.parsed());
    }
    return this.spec;
    function specificity(text, parsed) {
      var expressions = parsed || parse(text);
      var spec = [styleAttribute ? 1 : 0, 0, 0, 0];
      var nots = [];
      for (var i = 0; i < expressions.length; i++) {
        var expression = expressions[i];
        var pseudos = expression.pseudos;
        if (expression.id) {
          spec[1]++;
        }
        if (expression.attributes) {
          spec[2] += expression.attributes.length;
        }
        if (expression.classList) {
          spec[2] += expression.classList.length;
        }
        if (expression.tag && expression.tag !== "*") {
          spec[3]++;
        }
        if (pseudos) {
          spec[3] += pseudos.length;
          for (var p = 0; p < pseudos.length; p++) {
            if (pseudos[p].name === "not") {
              nots.push(pseudos[p].value);
              spec[3]--;
            }
          }
        }
      }
      for (var ii = nots.length; ii--; ) {
        var not = specificity(nots[ii]);
        for (var jj = 4; jj--; ) {
          spec[jj] += not[jj];
        }
      }
      return spec;
    }
  };
  function parse(text) {
    try {
      return parser2(text)[0];
    } catch (e) {
      return [];
    }
  }
});
var property = createCommonjsModule(function(module, exports) {
  module.exports = Property;
  function Property(prop, value, selector2, priority, additionalPriority) {
    this.prop = prop;
    this.value = value;
    this.selector = selector2;
    this.priority = priority || 0;
    this.additionalPriority = additionalPriority || [];
  }
  Property.prototype.compareFunc = function(property2) {
    var a = [];
    a.push.apply(a, this.selector.specificity());
    a.push.apply(a, this.additionalPriority);
    a[0] += this.priority;
    var b = [];
    b.push.apply(b, property2.selector.specificity());
    b.push.apply(b, property2.additionalPriority);
    b[0] += property2.priority;
    return utils.compareFunc(a, b);
  };
  Property.prototype.compare = function(property2) {
    var winner = this.compareFunc(property2);
    if (winner === 1) {
      return this;
    }
    return property2;
  };
  Property.prototype.toString = function() {
    return this.prop + ": " + this.value.replace(/['"]+/g, "") + ";";
  };
});
var utils = createCommonjsModule(function(module, exports) {
  exports.Selector = selector;
  exports.Property = property;
  /**
   * Returns an array of the selectors.
   *
   * @license Sizzle CSS Selector Engine - MIT
   * @param {String} selectorText from mensch
   * @api public
   */
  exports.extract = function extract(selectorText) {
    var attr = 0;
    var sels = [];
    var sel = "";
    for (var i = 0, l = selectorText.length; i < l; i++) {
      var c = selectorText.charAt(i);
      if (attr) {
        if (c === "]" || c === ")") {
          attr--;
        }
        sel += c;
      } else {
        if (c === ",") {
          sels.push(sel);
          sel = "";
        } else {
          if (c === "[" || c === "(") {
            attr++;
          }
          if (sel.length || c !== "," && c !== "\n" && c !== " ") {
            sel += c;
          }
        }
      }
    }
    if (sel.length) {
      sels.push(sel);
    }
    return sels;
  };
  exports.parseCSS = function(css) {
    var parsed = mensch2.parse(css, {position: true, comments: true});
    var rules = typeof parsed.stylesheet != "undefined" && parsed.stylesheet.rules ? parsed.stylesheet.rules : [];
    var ret = [];
    for (var i = 0, l = rules.length; i < l; i++) {
      if (rules[i].type == "rule") {
        var rule = rules[i];
        var selectors = rule.selectors;
        for (var ii = 0, ll = selectors.length; ii < ll; ii++) {
          ret.push([selectors[ii], rule.declarations]);
        }
      }
    }
    return ret;
  };
  exports.getPreservedText = function(css, options, ignoredPseudos) {
    var parsed = mensch2.parse(css, {position: true, comments: true});
    var rules = typeof parsed.stylesheet != "undefined" && parsed.stylesheet.rules ? parsed.stylesheet.rules : [];
    var preserved = [];
    for (var i = rules.length - 1; i >= 0; i--) {
      if (options.fontFaces && rules[i].type === "font-face" || options.mediaQueries && rules[i].type === "media" || options.keyFrames && rules[i].type === "keyframes" || options.pseudos && rules[i].selectors && this.matchesPseudo(rules[i].selectors[0], ignoredPseudos)) {
        preserved.unshift(mensch2.stringify({stylesheet: {rules: [rules[i]]}}, {comments: false, indentation: "  "}));
      }
      rules[i].position.start;
    }
    if (preserved.length === 0) {
      return false;
    }
    return "\n" + preserved.join("\n") + "\n";
  };
  exports.normalizeLineEndings = function(text) {
    return text.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  };
  exports.matchesPseudo = function(needle, haystack) {
    return haystack.find(function(element) {
      return needle.indexOf(element) > -1;
    });
  };
  exports.compareFunc = function(a, b) {
    var min = Math.min(a.length, b.length);
    for (var i = 0; i < min; i++) {
      if (a[i] === b[i]) {
        continue;
      }
      if (a[i] > b[i]) {
        return 1;
      }
      return -1;
    }
    return a.length - b.length;
  };
  exports.compare = function(a, b) {
    return exports.compareFunc(a, b) == 1 ? a : b;
  };
  exports.getDefaultOptions = function(options) {
    var result = Object.assign({
      extraCss: "",
      insertPreservedExtraCss: true,
      applyStyleTags: true,
      removeStyleTags: true,
      preserveMediaQueries: true,
      preserveFontFaces: true,
      preserveKeyFrames: true,
      preservePseudos: true,
      applyWidthAttributes: true,
      applyHeightAttributes: true,
      applyAttributesTableElements: true,
      resolveCSSVariables: true,
      url: ""
    }, options);
    result.webResources = result.webResources || {};
    return result;
  };
});
var cheerio = /* @__PURE__ */ getDefaultExportFromNamespaceIfNotNamed(cheerio$1);
var cheerio_1 = createCommonjsModule(function(module) {
  var cheerioLoad = function(html, options, encodeEntities) {
    options = Object.assign({decodeEntities: false, _useHtmlParser2: true}, options);
    html = encodeEntities(html);
    return cheerio.load(html, options);
  };
  var createEntityConverters = function() {
    var codeBlockLookup = [];
    var encodeCodeBlocks = function(html) {
      var blocks = module.exports.codeBlocks;
      Object.keys(blocks).forEach(function(key) {
        var re = new RegExp(blocks[key].start + "([\\S\\s]*?)" + blocks[key].end, "g");
        html = html.replace(re, function(match, subMatch) {
          codeBlockLookup.push(match);
          return "JUICE_CODE_BLOCK_" + (codeBlockLookup.length - 1) + "_";
        });
      });
      return html;
    };
    var decodeCodeBlocks = function(html) {
      for (var index = 0; index < codeBlockLookup.length; index++) {
        var re = new RegExp("JUICE_CODE_BLOCK_" + index + '_(="")?', "gi");
        html = html.replace(re, function() {
          return codeBlockLookup[index];
        });
      }
      return html;
    };
    return {
      encodeEntities: encodeCodeBlocks,
      decodeEntities: decodeCodeBlocks
    };
  };
  module.exports = function(html, options, callback, callbackExtraArguments) {
    var entityConverters = createEntityConverters();
    var $ = cheerioLoad(html, options, entityConverters.encodeEntities);
    var args = [$];
    args.push.apply(args, callbackExtraArguments);
    var doc = callback.apply(void 0, args) || $;
    if (options && options.xmlMode) {
      return entityConverters.decodeEntities(doc.xml());
    }
    return entityConverters.decodeEntities(doc.html());
  };
  module.exports.codeBlocks = {
    EJS: {start: "<%", end: "%>"},
    HBS: {start: "{{", end: "}}"}
  };
});
var romanize = function(num) {
  if (isNaN(num))
    return NaN;
  var digits = String(+num).split(""), key = [
    "",
    "C",
    "CC",
    "CCC",
    "CD",
    "D",
    "DC",
    "DCC",
    "DCCC",
    "CM",
    "",
    "X",
    "XX",
    "XXX",
    "XL",
    "L",
    "LX",
    "LXX",
    "LXXX",
    "XC",
    "",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX"
  ], roman = "", i = 3;
  while (i--)
    roman = (key[+digits.pop() + i * 10] || "") + roman;
  return Array(+digits.join("") + 1).join("M") + roman;
};
var alphanumeric = function(num) {
  var s = "", t;
  while (num > 0) {
    t = (num - 1) % 26;
    s = String.fromCharCode(65 + t) + s;
    num = (num - t) / 26 | 0;
  }
  return s || void 0;
};
var numbers = {
  romanize,
  alphanumeric
};
const uniqueString = (string) => {
  let str = "";
  do {
    str = (Math.random() + 1).toString(36).substring(2);
  } while (string.indexOf(str) !== -1);
  return str;
};
const replaceVariables = (el, value) => {
  let funcReg = /([a-z\-]+)\s*\(\s*([^\(\)]*?)\s*(?:,\s*([^\(\)]*?)\s*)?\s*\)/i;
  let replacements = [];
  let match;
  let uniq = uniqueString(value);
  while ((match = funcReg.exec(value)) !== null) {
    let i2 = `${replacements.length}`;
    if (match[1].toLowerCase() == "var") {
      const varValue = findVariableValue(el, match[2]);
      if (varValue) {
        value = value.replace(match[0], varValue);
        continue;
      }
      if (match[3]) {
        value = value.replace(match[0], match[3]);
        continue;
      }
    }
    let placeholder = `${uniq}${i2.padStart(5, "-")}`;
    value = value.replace(match[0], placeholder);
    replacements.push({placeholder, replace: match[0]});
  }
  for (var i = replacements.length - 1; i >= 0; i--) {
    const replacement = replacements[i];
    value = value.replace(replacement.placeholder, replacement.replace);
  }
  return value;
};
const findVariableValue = (el, variable) => {
  while (el) {
    if (el.styleProps && variable in el.styleProps) {
      return el.styleProps[variable].value;
    }
    var el = el.pseudoElementParent || el.parent;
  }
};
var variables = {replaceVariables, findVariableValue};
var inline = function makeJuiceClient(juiceClient2) {
  juiceClient2.ignoredPseudos = ["hover", "active", "focus", "visited", "link"];
  juiceClient2.widthElements = ["TABLE", "TD", "TH", "IMG"];
  juiceClient2.heightElements = ["TABLE", "TD", "TH", "IMG"];
  juiceClient2.tableElements = ["TABLE", "TH", "TR", "TD", "CAPTION", "COLGROUP", "COL", "THEAD", "TBODY", "TFOOT"];
  juiceClient2.nonVisualElements = ["HEAD", "TITLE", "BASE", "LINK", "STYLE", "META", "SCRIPT", "NOSCRIPT"];
  juiceClient2.styleToAttribute = {
    "background-color": "bgcolor",
    "background-image": "background",
    "text-align": "align",
    "vertical-align": "valign"
  };
  juiceClient2.excludedProperties = [];
  juiceClient2.juiceDocument = juiceDocument2;
  juiceClient2.inlineDocument = inlineDocument;
  function inlineDocument($, css, options) {
    options = options || {};
    var rules = utils.parseCSS(css);
    var editedElements = [];
    var styleAttributeName = "style";
    var counters = {};
    if (options.styleAttributeName) {
      styleAttributeName = options.styleAttributeName;
    }
    rules.forEach(handleRule);
    editedElements.forEach(setStyleAttrs);
    if (options.inlinePseudoElements) {
      editedElements.forEach(inlinePseudoElements);
    }
    if (options.applyWidthAttributes) {
      editedElements.forEach(function(el) {
        setDimensionAttrs(el, "width");
      });
    }
    if (options.applyHeightAttributes) {
      editedElements.forEach(function(el) {
        setDimensionAttrs(el, "height");
      });
    }
    if (options.applyAttributesTableElements) {
      editedElements.forEach(setAttributesOnTableElements);
    }
    if (options.insertPreservedExtraCss && options.extraCss) {
      var preservedText = utils.getPreservedText(options.extraCss, {
        mediaQueries: options.preserveMediaQueries,
        fontFaces: options.preserveFontFaces,
        keyFrames: options.preserveKeyFrames
      });
      if (preservedText) {
        var $appendTo = null;
        if (options.insertPreservedExtraCss !== true) {
          $appendTo = $(options.insertPreservedExtraCss);
        } else {
          $appendTo = $("head");
          if (!$appendTo.length) {
            $appendTo = $("body");
          }
          if (!$appendTo.length) {
            $appendTo = $.root();
          }
        }
        $appendTo.first().append("<style>" + preservedText + "</style>");
      }
    }
    function handleRule(rule) {
      var sel = rule[0];
      var style = rule[1];
      var selector2 = new utils.Selector(sel);
      var parsedSelector = selector2.parsed();
      if (!parsedSelector) {
        return;
      }
      var pseudoElementType = getPseudoElementType(parsedSelector);
      for (var i = 0; i < parsedSelector.length; ++i) {
        var subSel = parsedSelector[i];
        if (subSel.pseudos) {
          for (var j = 0; j < subSel.pseudos.length; ++j) {
            var subSelPseudo = subSel.pseudos[j];
            if (juiceClient2.ignoredPseudos.indexOf(subSelPseudo.name) >= 0) {
              return;
            }
          }
        }
      }
      if (pseudoElementType) {
        var last = parsedSelector[parsedSelector.length - 1];
        var pseudos = last.pseudos;
        last.pseudos = filterElementPseudos(last.pseudos);
        sel = parsedSelector.toString();
        last.pseudos = pseudos;
      }
      var els;
      try {
        els = $(sel);
      } catch (err) {
        return;
      }
      els.each(function() {
        var el = this;
        if (el.name && juiceClient2.nonVisualElements.indexOf(el.name.toUpperCase()) >= 0) {
          return;
        }
        if (!el.counterProps) {
          el.counterProps = el.parent && el.parent.counterProps ? Object.create(el.parent.counterProps) : {};
        }
        if (pseudoElementType) {
          var pseudoElPropName = "pseudo" + pseudoElementType;
          var pseudoEl = el[pseudoElPropName];
          if (!pseudoEl) {
            pseudoEl = el[pseudoElPropName] = $("<span />").get(0);
            pseudoEl.pseudoElementType = pseudoElementType;
            pseudoEl.pseudoElementParent = el;
            pseudoEl.counterProps = el.counterProps;
            el[pseudoElPropName] = pseudoEl;
          }
          el = pseudoEl;
        }
        if (!el.styleProps) {
          el.styleProps = {};
          if ($(el).attr(styleAttributeName)) {
            var cssText = "* { " + $(el).attr(styleAttributeName) + " } ";
            addProps(utils.parseCSS(cssText)[0][1], new utils.Selector("<style>", true));
          }
          editedElements.push(el);
        }
        function resetCounter(el2, value) {
          var tokens = value.split(/\s+/);
          for (var j2 = 0; j2 < tokens.length; j2++) {
            var counter = tokens[j2];
            var resetval = parseInt(tokens[j2 + 1], 10);
            isNaN(resetval) ? el2.counterProps[counter] = counters[counter] = 0 : el2.counterProps[counter] = counters[tokens[j2++]] = resetval;
          }
        }
        function incrementCounter(el2, value) {
          var tokens = value.split(/\s+/);
          for (var j2 = 0; j2 < tokens.length; j2++) {
            var counter = tokens[j2];
            if (el2.counterProps[counter] === void 0) {
              continue;
            }
            var incrval = parseInt(tokens[j2 + 1], 10);
            isNaN(incrval) ? el2.counterProps[counter] = counters[counter] += 1 : el2.counterProps[counter] = counters[tokens[j2++]] += incrval;
          }
        }
        function addProps(style2, selector3) {
          for (var i2 = 0, l = style2.length; i2 < l; i2++) {
            if (style2[i2].type == "property") {
              var name = style2[i2].name;
              var value = style2[i2].value;
              if (name === "counter-reset") {
                resetCounter(el, value);
              }
              if (name === "counter-increment") {
                incrementCounter(el, value);
              }
              var important = value.match(/!important$/) !== null;
              if (important && !options.preserveImportant)
                value = removeImportant(value);
              var additionalPriority = [style2[i2].position.start.line, style2[i2].position.start.col];
              var prop = new utils.Property(name, value, selector3, important ? 2 : 0, additionalPriority);
              var existing = el.styleProps[name];
              if (juiceClient2.excludedProperties.indexOf(name) < 0) {
                if (existing && existing.compare(prop) === prop || !existing) {
                  if (existing && existing.selector !== selector3) {
                    delete el.styleProps[name];
                  } else if (existing) {
                    prop.nextProp = existing;
                  }
                  el.styleProps[name] = prop;
                }
              }
            }
          }
        }
        addProps(style, selector2);
      });
    }
    function setStyleAttrs(el) {
      var l = Object.keys(el.styleProps).length;
      var props = [];
      Object.keys(el.styleProps).forEach(function(key) {
        var np = el.styleProps[key];
        while (typeof np !== "undefined") {
          props.push(np);
          np = np.nextProp;
        }
      });
      props.sort(function(a, b) {
        return a.compareFunc(b);
      });
      var string = props.filter(function(prop) {
        if (options.resolveCSSVariables && prop.prop.indexOf("--") === 0) {
          return false;
        }
        return prop.prop !== "content";
      }).map(function(prop) {
        if (options.resolveCSSVariables) {
          prop.value = variables.replaceVariables(el, prop.value);
        }
        return prop.prop + ": " + prop.value.replace(/["]/g, "'") + ";";
      }).join(" ");
      if (string) {
        $(el).attr(styleAttributeName, string);
      }
    }
    function inlinePseudoElements(el) {
      if (el.pseudoElementType && el.styleProps.content) {
        var parsed = parseContent(el);
        if (parsed.img) {
          el.name = "img";
          $(el).attr("src", parsed.img);
        } else {
          $(el).text(parsed);
        }
        var parent = el.pseudoElementParent;
        if (el.pseudoElementType === "before") {
          $(parent).prepend(el);
        } else {
          $(parent).append(el);
        }
      }
    }
    function setDimensionAttrs(el, dimension) {
      if (!el.name) {
        return;
      }
      var elName = el.name.toUpperCase();
      if (juiceClient2[dimension + "Elements"].indexOf(elName) > -1) {
        for (var i in el.styleProps) {
          if (el.styleProps[i].prop === dimension) {
            var value = el.styleProps[i].value;
            if (options.preserveImportant) {
              value = removeImportant(value);
            }
            if (value.match(/(px|auto)/)) {
              var size = value.replace("px", "");
              $(el).attr(dimension, size);
              return;
            }
            if (juiceClient2.tableElements.indexOf(elName) > -1 && value.match(/\%/)) {
              $(el).attr(dimension, value);
              return;
            }
          }
        }
      }
    }
    function extractBackgroundUrl(value) {
      return value.indexOf("url(") !== 0 ? value : value.replace(/^url\((["'])?([^"']+)\1\)$/, "$2");
    }
    function setAttributesOnTableElements(el) {
      if (!el.name) {
        return;
      }
      var elName = el.name.toUpperCase();
      var styleProps = Object.keys(juiceClient2.styleToAttribute);
      if (juiceClient2.tableElements.indexOf(elName) > -1) {
        for (var i in el.styleProps) {
          if (styleProps.indexOf(el.styleProps[i].prop) > -1) {
            var prop = juiceClient2.styleToAttribute[el.styleProps[i].prop];
            var value = el.styleProps[i].value;
            if (options.preserveImportant) {
              value = removeImportant(value);
            }
            if (prop === "background") {
              value = extractBackgroundUrl(value);
            }
            if (/(linear|radial)-gradient\(/i.test(value)) {
              continue;
            }
            $(el).attr(prop, value);
          }
        }
      }
    }
  }
  function removeImportant(value) {
    return value.replace(/\s*!important$/, "");
  }
  function applyCounterStyle(counter, style) {
    switch (style) {
      case "lower-roman":
        return numbers.romanize(counter).toLowerCase();
      case "upper-roman":
        return numbers.romanize(counter);
      case "lower-latin":
      case "lower-alpha":
        return numbers.alphanumeric(counter).toLowerCase();
      case "upper-latin":
      case "upper-alpha":
        return numbers.alphanumeric(counter);
      default:
        return counter.toString();
    }
  }
  function parseContent(el) {
    var content = el.styleProps.content.value;
    if (content === "none" || content === "normal") {
      return "";
    }
    var imageUrlMatch = content.match(/^\s*url\s*\(\s*(.*?)\s*\)\s*$/i);
    if (imageUrlMatch) {
      var url = imageUrlMatch[1].replace(/^['"]|['"]$/g, "");
      return {img: url};
    }
    var parsed = [];
    var tokens = content.split(/['"]/);
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] === "")
        continue;
      var varMatch = tokens[i].match(/var\s*\(\s*(.*?)\s*(,\s*(.*?)\s*)?\s*\)/i);
      if (varMatch) {
        var variable = variables.findVariableValue(el, varMatch[1]) || varMatch[2];
        parsed.push(variable.replace(/^['"]|['"]$/g, ""));
        continue;
      }
      var counterMatch = tokens[i].match(/counter\s*\(\s*(.*?)\s*(,\s*(.*?)\s*)?\s*\)/i);
      if (counterMatch && counterMatch[1] in el.counterProps) {
        var counter = el.counterProps[counterMatch[1]];
        parsed.push(applyCounterStyle(counter, counterMatch[3]));
        continue;
      }
      var attrMatch = tokens[i].match(/attr\s*\(\s*(.*?)\s*\)/i);
      if (attrMatch) {
        var attr = attrMatch[1];
        parsed.push(el.pseudoElementParent ? el.pseudoElementParent.attribs[attr] : el.attribs[attr]);
        continue;
      }
      parsed.push(tokens[i]);
    }
    content = parsed.join("");
    content = content.replace(/\\/g, "");
    return content;
  }
  function getPseudoElementType(selector2) {
    if (selector2.length === 0) {
      return;
    }
    var pseudos = selector2[selector2.length - 1].pseudos;
    if (!pseudos) {
      return;
    }
    for (var i = 0; i < pseudos.length; i++) {
      if (isPseudoElementName(pseudos[i])) {
        return pseudos[i].name;
      }
    }
  }
  function isPseudoElementName(pseudo) {
    return pseudo.name === "before" || pseudo.name === "after";
  }
  function filterElementPseudos(pseudos) {
    return pseudos.filter(function(pseudo) {
      return !isPseudoElementName(pseudo);
    });
  }
  function juiceDocument2($, options) {
    options = utils.getDefaultOptions(options);
    var css = extractCssFromDocument($, options);
    css += "\n" + options.extraCss;
    inlineDocument($, css, options);
    return $;
  }
  function getStylesData($, options) {
    var results = [];
    var stylesList = $("style");
    var styleDataList, styleData, styleElement;
    stylesList.each(function() {
      styleElement = this;
      var usingParse5 = !!styleElement.childNodes;
      styleDataList = usingParse5 ? styleElement.childNodes : styleElement.children;
      if (styleDataList.length !== 1) {
        if (options.removeStyleTags) {
          $(styleElement).remove();
        }
        return;
      }
      styleData = styleDataList[0].data;
      if (options.applyStyleTags && $(styleElement).attr("data-embed") === void 0) {
        results.push(styleData);
      }
      if (options.removeStyleTags && $(styleElement).attr("data-embed") === void 0) {
        var text = usingParse5 ? styleElement.childNodes[0].nodeValue : styleElement.children[0].data;
        var preservedText = utils.getPreservedText(text, {
          mediaQueries: options.preserveMediaQueries,
          fontFaces: options.preserveFontFaces,
          keyFrames: options.preserveKeyFrames,
          pseudos: options.preservePseudos
        }, juiceClient2.ignoredPseudos);
        if (preservedText) {
          if (usingParse5) {
            styleElement.childNodes[0].nodeValue = preservedText;
          } else {
            styleElement.children[0].data = preservedText;
          }
        } else {
          $(styleElement).remove();
        }
      }
      $(styleElement).removeAttr("data-embed");
    });
    return results;
  }
  function extractCssFromDocument($, options) {
    var results = getStylesData($, options);
    var css = results.join("\n");
    return css;
  }
  return juiceClient2;
};
var juiceClient = inline(function(html, options) {
  return cheerio_1(html, {xmlMode: options && options.xmlMode}, juiceDocument, [options]);
});
var juiceDocument = function(html, options) {
  return juiceClient.juiceDocument(html, options);
};
juiceClient.inlineContent = function(html, css, options) {
  return cheerio_1(html, {xmlMode: options && options.xmlMode}, juiceClient.inlineDocument, [css, options]);
};
juiceClient.codeBlocks = cheerio_1.codeBlocks;
var client = juiceClient;
export default client;
