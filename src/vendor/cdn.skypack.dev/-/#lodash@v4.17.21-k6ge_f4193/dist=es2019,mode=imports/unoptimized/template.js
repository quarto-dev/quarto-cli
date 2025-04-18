import assignInWith2 from "../unoptimized/assignInWith.js";
import attempt2 from "../unoptimized/attempt.js";
import baseValues2 from "../unoptimized/_baseValues.js";
import customDefaultsAssignIn2 from "../unoptimized/_customDefaultsAssignIn.js";
import escapeStringChar2 from "../unoptimized/_escapeStringChar.js";
import isError2 from "../unoptimized/isError.js";
import isIterateeCall2 from "../unoptimized/_isIterateeCall.js";
import keys2 from "../unoptimized/keys.js";
import reInterpolate2 from "../unoptimized/_reInterpolate.js";
import templateSettings2 from "../unoptimized/templateSettings.js";
import toString2 from "../unoptimized/toString.js";
var INVALID_TEMPL_VAR_ERROR_TEXT = "Invalid `variable` option passed into `_.template`";
var reEmptyStringLeading = /\b__p \+= '';/g, reEmptyStringMiddle = /\b(__p \+=) '' \+/g, reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;
var reForbiddenIdentifierChars = /[()=,{}\[\]\/\s]/;
var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
var reNoMatch = /($^)/;
var reUnescapedString = /['\n\r\u2028\u2029\\]/g;
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function template(string, options, guard) {
  var settings = templateSettings2.imports._.templateSettings || templateSettings2;
  if (guard && isIterateeCall2(string, options, guard)) {
    options = void 0;
  }
  string = toString2(string);
  options = assignInWith2({}, options, settings, customDefaultsAssignIn2);
  var imports = assignInWith2({}, options.imports, settings.imports, customDefaultsAssignIn2), importsKeys = keys2(imports), importsValues = baseValues2(imports, importsKeys);
  var isEscaping, isEvaluating, index = 0, interpolate = options.interpolate || reNoMatch, source = "__p += '";
  var reDelimiters = RegExp((options.escape || reNoMatch).source + "|" + interpolate.source + "|" + (interpolate === reInterpolate2 ? reEsTemplate : reNoMatch).source + "|" + (options.evaluate || reNoMatch).source + "|$", "g");
  var sourceURL = hasOwnProperty.call(options, "sourceURL") ? "//# sourceURL=" + (options.sourceURL + "").replace(/\s/g, " ") + "\n" : "";
  string.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
    interpolateValue || (interpolateValue = esTemplateValue);
    source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar2);
    if (escapeValue) {
      isEscaping = true;
      source += "' +\n__e(" + escapeValue + ") +\n'";
    }
    if (evaluateValue) {
      isEvaluating = true;
      source += "';\n" + evaluateValue + ";\n__p += '";
    }
    if (interpolateValue) {
      source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
    }
    index = offset + match.length;
    return match;
  });
  source += "';\n";
  var variable = hasOwnProperty.call(options, "variable") && options.variable;
  if (!variable) {
    source = "with (obj) {\n" + source + "\n}\n";
  } else if (reForbiddenIdentifierChars.test(variable)) {
    throw new Error(INVALID_TEMPL_VAR_ERROR_TEXT);
  }
  source = (isEvaluating ? source.replace(reEmptyStringLeading, "") : source).replace(reEmptyStringMiddle, "$1").replace(reEmptyStringTrailing, "$1;");
  source = "function(" + (variable || "obj") + ") {\n" + (variable ? "" : "obj || (obj = {});\n") + "var __t, __p = ''" + (isEscaping ? ", __e = _.escape" : "") + (isEvaluating ? ", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n" : ";\n") + source + "return __p\n}";
  var result = attempt2(function() {
    return Function(importsKeys, sourceURL + "return " + source).apply(void 0, importsValues);
  });
  result.source = source;
  if (isError2(result)) {
    throw result;
  }
  return result;
}
var __VIRTUAL_FILE = template;
export default __VIRTUAL_FILE;
