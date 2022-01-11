// deno-cache:https://cdn.skypack.dev/-/@alex.garcia/unofficial-observablehq-compiler@v0.6.0-alpha.9-8FDPFOqnYyMwEoy3sS1w/dist=es2019,mode=imports/optimized/@alex.garcia/unofficial-observablehq-compiler.js
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function createCommonjsModule(fn, basedir, module) {
  return module = {
    path: basedir,
    exports: {},
    require: function(path, base2) {
      return commonjsRequire(path, base2 === void 0 || base2 === null ? module.path : base2);
    }
  }, fn(module, module.exports), module.exports;
}
function commonjsRequire() {
  throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
var dist = createCommonjsModule(function(module, exports) {
  (function(g2, f2) {
    f2(exports);
  })(commonjsGlobal, function(exports2) {
    var reservedWords2 = {
      3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
      5: "class enum extends super const export import",
      6: "enum",
      strict: "implements interface let package private protected public static yield",
      strictBind: "eval arguments"
    };
    var ecma5AndLessKeywords2 = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";
    var keywords2 = {
      5: ecma5AndLessKeywords2,
      "5module": ecma5AndLessKeywords2 + " export import",
      6: ecma5AndLessKeywords2 + " const class extends export import super"
    };
    var keywordRelationalOperator2 = /^in(stanceof)?$/;
    var nonASCIIidentifierStartChars2 = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08C7\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7BF\uA7C2-\uA7CA\uA7F5-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
    var nonASCIIidentifierChars2 = "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECD\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF\u1AC0\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F";
    var nonASCIIidentifierStart2 = new RegExp("[" + nonASCIIidentifierStartChars2 + "]");
    var nonASCIIidentifier2 = new RegExp("[" + nonASCIIidentifierStartChars2 + nonASCIIidentifierChars2 + "]");
    nonASCIIidentifierStartChars2 = nonASCIIidentifierChars2 = null;
    var astralIdentifierStartCodes2 = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 349, 41, 7, 1, 79, 28, 11, 0, 9, 21, 107, 20, 28, 22, 13, 52, 76, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 85, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 230, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 35, 56, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 190, 0, 80, 921, 103, 110, 18, 195, 2749, 1070, 4050, 582, 8634, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 689, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 43, 8, 8952, 286, 50, 2, 18, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 2357, 44, 11, 6, 17, 0, 370, 43, 1301, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42717, 35, 4148, 12, 221, 3, 5761, 15, 7472, 3104, 541, 1507, 4938];
    var astralIdentifierCodes2 = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 370, 1, 154, 10, 176, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 161, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 19306, 9, 135, 4, 60, 6, 26, 9, 1014, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 262, 6, 10, 9, 419, 13, 1495, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];
    function isInAstralSet2(code, set) {
      var pos = 65536;
      for (var i2 = 0; i2 < set.length; i2 += 2) {
        pos += set[i2];
        if (pos > code) {
          return false;
        }
        pos += set[i2 + 1];
        if (pos >= code) {
          return true;
        }
      }
    }
    function isIdentifierStart2(code, astral) {
      if (code < 65) {
        return code === 36;
      }
      if (code < 91) {
        return true;
      }
      if (code < 97) {
        return code === 95;
      }
      if (code < 123) {
        return true;
      }
      if (code <= 65535) {
        return code >= 170 && nonASCIIidentifierStart2.test(String.fromCharCode(code));
      }
      if (astral === false) {
        return false;
      }
      return isInAstralSet2(code, astralIdentifierStartCodes2);
    }
    function isIdentifierChar2(code, astral) {
      if (code < 48) {
        return code === 36;
      }
      if (code < 58) {
        return true;
      }
      if (code < 65) {
        return false;
      }
      if (code < 91) {
        return true;
      }
      if (code < 97) {
        return code === 95;
      }
      if (code < 123) {
        return true;
      }
      if (code <= 65535) {
        return code >= 170 && nonASCIIidentifier2.test(String.fromCharCode(code));
      }
      if (astral === false) {
        return false;
      }
      return isInAstralSet2(code, astralIdentifierStartCodes2) || isInAstralSet2(code, astralIdentifierCodes2);
    }
    var TokenType3 = function TokenType22(label, conf) {
      if (conf === void 0)
        conf = {};
      this.label = label;
      this.keyword = conf.keyword;
      this.beforeExpr = !!conf.beforeExpr;
      this.startsExpr = !!conf.startsExpr;
      this.isLoop = !!conf.isLoop;
      this.isAssign = !!conf.isAssign;
      this.prefix = !!conf.prefix;
      this.postfix = !!conf.postfix;
      this.binop = conf.binop || null;
      this.updateContext = null;
    };
    function binop2(name, prec) {
      return new TokenType3(name, { beforeExpr: true, binop: prec });
    }
    var beforeExpr2 = { beforeExpr: true }, startsExpr2 = { startsExpr: true };
    var keywords$12 = {};
    function kw2(name, options) {
      if (options === void 0)
        options = {};
      options.keyword = name;
      return keywords$12[name] = new TokenType3(name, options);
    }
    var types2 = {
      num: new TokenType3("num", startsExpr2),
      regexp: new TokenType3("regexp", startsExpr2),
      string: new TokenType3("string", startsExpr2),
      name: new TokenType3("name", startsExpr2),
      eof: new TokenType3("eof"),
      bracketL: new TokenType3("[", { beforeExpr: true, startsExpr: true }),
      bracketR: new TokenType3("]"),
      braceL: new TokenType3("{", { beforeExpr: true, startsExpr: true }),
      braceR: new TokenType3("}"),
      parenL: new TokenType3("(", { beforeExpr: true, startsExpr: true }),
      parenR: new TokenType3(")"),
      comma: new TokenType3(",", beforeExpr2),
      semi: new TokenType3(";", beforeExpr2),
      colon: new TokenType3(":", beforeExpr2),
      dot: new TokenType3("."),
      question: new TokenType3("?", beforeExpr2),
      questionDot: new TokenType3("?."),
      arrow: new TokenType3("=>", beforeExpr2),
      template: new TokenType3("template"),
      invalidTemplate: new TokenType3("invalidTemplate"),
      ellipsis: new TokenType3("...", beforeExpr2),
      backQuote: new TokenType3("`", startsExpr2),
      dollarBraceL: new TokenType3("${", { beforeExpr: true, startsExpr: true }),
      eq: new TokenType3("=", { beforeExpr: true, isAssign: true }),
      assign: new TokenType3("_=", { beforeExpr: true, isAssign: true }),
      incDec: new TokenType3("++/--", { prefix: true, postfix: true, startsExpr: true }),
      prefix: new TokenType3("!/~", { beforeExpr: true, prefix: true, startsExpr: true }),
      logicalOR: binop2("||", 1),
      logicalAND: binop2("&&", 2),
      bitwiseOR: binop2("|", 3),
      bitwiseXOR: binop2("^", 4),
      bitwiseAND: binop2("&", 5),
      equality: binop2("==/!=/===/!==", 6),
      relational: binop2("</>/<=/>=", 7),
      bitShift: binop2("<</>>/>>>", 8),
      plusMin: new TokenType3("+/-", { beforeExpr: true, binop: 9, prefix: true, startsExpr: true }),
      modulo: binop2("%", 10),
      star: binop2("*", 10),
      slash: binop2("/", 10),
      starstar: new TokenType3("**", { beforeExpr: true }),
      coalesce: binop2("??", 1),
      _break: kw2("break"),
      _case: kw2("case", beforeExpr2),
      _catch: kw2("catch"),
      _continue: kw2("continue"),
      _debugger: kw2("debugger"),
      _default: kw2("default", beforeExpr2),
      _do: kw2("do", { isLoop: true, beforeExpr: true }),
      _else: kw2("else", beforeExpr2),
      _finally: kw2("finally"),
      _for: kw2("for", { isLoop: true }),
      _function: kw2("function", startsExpr2),
      _if: kw2("if"),
      _return: kw2("return", beforeExpr2),
      _switch: kw2("switch"),
      _throw: kw2("throw", beforeExpr2),
      _try: kw2("try"),
      _var: kw2("var"),
      _const: kw2("const"),
      _while: kw2("while", { isLoop: true }),
      _with: kw2("with"),
      _new: kw2("new", { beforeExpr: true, startsExpr: true }),
      _this: kw2("this", startsExpr2),
      _super: kw2("super", startsExpr2),
      _class: kw2("class", startsExpr2),
      _extends: kw2("extends", beforeExpr2),
      _export: kw2("export"),
      _import: kw2("import", startsExpr2),
      _null: kw2("null", startsExpr2),
      _true: kw2("true", startsExpr2),
      _false: kw2("false", startsExpr2),
      _in: kw2("in", { beforeExpr: true, binop: 7 }),
      _instanceof: kw2("instanceof", { beforeExpr: true, binop: 7 }),
      _typeof: kw2("typeof", { beforeExpr: true, prefix: true, startsExpr: true }),
      _void: kw2("void", { beforeExpr: true, prefix: true, startsExpr: true }),
      _delete: kw2("delete", { beforeExpr: true, prefix: true, startsExpr: true })
    };
    var lineBreak2 = /\r\n?|\n|\u2028|\u2029/;
    var lineBreakG2 = new RegExp(lineBreak2.source, "g");
    function isNewLine2(code, ecma2019String) {
      return code === 10 || code === 13 || !ecma2019String && (code === 8232 || code === 8233);
    }
    var nonASCIIwhitespace2 = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
    var skipWhiteSpace2 = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
    var ref2 = Object.prototype;
    var hasOwnProperty4 = ref2.hasOwnProperty;
    var toString3 = ref2.toString;
    function has2(obj, propName) {
      return hasOwnProperty4.call(obj, propName);
    }
    var isArray2 = Array.isArray || function(obj) {
      return toString3.call(obj) === "[object Array]";
    };
    function wordsRegexp2(words) {
      return new RegExp("^(?:" + words.replace(/ /g, "|") + ")$");
    }
    var Position3 = function Position22(line, col) {
      this.line = line;
      this.column = col;
    };
    Position3.prototype.offset = function offset2(n2) {
      return new Position3(this.line, this.column + n2);
    };
    var SourceLocation3 = function SourceLocation22(p2, start, end) {
      this.start = start;
      this.end = end;
      if (p2.sourceFile !== null) {
        this.source = p2.sourceFile;
      }
    };
    function getLineInfo2(input2, offset2) {
      for (var line = 1, cur = 0; ; ) {
        lineBreakG2.lastIndex = cur;
        var match = lineBreakG2.exec(input2);
        if (match && match.index < offset2) {
          ++line;
          cur = match.index + match[0].length;
        } else {
          return new Position3(line, offset2 - cur);
        }
      }
    }
    var defaultOptions2 = {
      ecmaVersion: 10,
      sourceType: "script",
      onInsertedSemicolon: null,
      onTrailingComma: null,
      allowReserved: null,
      allowReturnOutsideFunction: false,
      allowImportExportEverywhere: false,
      allowAwaitOutsideFunction: false,
      allowHashBang: false,
      locations: false,
      onToken: null,
      onComment: null,
      ranges: false,
      program: null,
      sourceFile: null,
      directSourceFile: null,
      preserveParens: false
    };
    function getOptions2(opts) {
      var options = {};
      for (var opt in defaultOptions2) {
        options[opt] = opts && has2(opts, opt) ? opts[opt] : defaultOptions2[opt];
      }
      if (options.ecmaVersion >= 2015) {
        options.ecmaVersion -= 2009;
      }
      if (options.allowReserved == null) {
        options.allowReserved = options.ecmaVersion < 5;
      }
      if (isArray2(options.onToken)) {
        var tokens = options.onToken;
        options.onToken = function(token) {
          return tokens.push(token);
        };
      }
      if (isArray2(options.onComment)) {
        options.onComment = pushComment2(options, options.onComment);
      }
      return options;
    }
    function pushComment2(options, array) {
      return function(block, text2, start, end, startLoc, endLoc) {
        var comment = {
          type: block ? "Block" : "Line",
          value: text2,
          start,
          end
        };
        if (options.locations) {
          comment.loc = new SourceLocation3(this, startLoc, endLoc);
        }
        if (options.ranges) {
          comment.range = [start, end];
        }
        array.push(comment);
      };
    }
    var SCOPE_TOP2 = 1, SCOPE_FUNCTION3 = 2, SCOPE_VAR2 = SCOPE_TOP2 | SCOPE_FUNCTION3, SCOPE_ASYNC3 = 4, SCOPE_GENERATOR3 = 8, SCOPE_ARROW2 = 16, SCOPE_SIMPLE_CATCH2 = 32, SCOPE_SUPER2 = 64, SCOPE_DIRECT_SUPER2 = 128;
    function functionFlags2(async, generator) {
      return SCOPE_FUNCTION3 | (async ? SCOPE_ASYNC3 : 0) | (generator ? SCOPE_GENERATOR3 : 0);
    }
    var BIND_NONE2 = 0, BIND_VAR2 = 1, BIND_LEXICAL2 = 2, BIND_FUNCTION2 = 3, BIND_SIMPLE_CATCH2 = 4, BIND_OUTSIDE2 = 5;
    var Parser3 = function Parser22(options, input2, startPos) {
      this.options = options = getOptions2(options);
      this.sourceFile = options.sourceFile;
      this.keywords = wordsRegexp2(keywords2[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
      var reserved = "";
      if (options.allowReserved !== true) {
        for (var v2 = options.ecmaVersion; ; v2--) {
          if (reserved = reservedWords2[v2]) {
            break;
          }
        }
        if (options.sourceType === "module") {
          reserved += " await";
        }
      }
      this.reservedWords = wordsRegexp2(reserved);
      var reservedStrict = (reserved ? reserved + " " : "") + reservedWords2.strict;
      this.reservedWordsStrict = wordsRegexp2(reservedStrict);
      this.reservedWordsStrictBind = wordsRegexp2(reservedStrict + " " + reservedWords2.strictBind);
      this.input = String(input2);
      this.containsEsc = false;
      if (startPos) {
        this.pos = startPos;
        this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
        this.curLine = this.input.slice(0, this.lineStart).split(lineBreak2).length;
      } else {
        this.pos = this.lineStart = 0;
        this.curLine = 1;
      }
      this.type = types2.eof;
      this.value = null;
      this.start = this.end = this.pos;
      this.startLoc = this.endLoc = this.curPosition();
      this.lastTokEndLoc = this.lastTokStartLoc = null;
      this.lastTokStart = this.lastTokEnd = this.pos;
      this.context = this.initialContext();
      this.exprAllowed = true;
      this.inModule = options.sourceType === "module";
      this.strict = this.inModule || this.strictDirective(this.pos);
      this.potentialArrowAt = -1;
      this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
      this.labels = [];
      this.undefinedExports = {};
      if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!") {
        this.skipLineComment(2);
      }
      this.scopeStack = [];
      this.enterScope(SCOPE_TOP2);
      this.regexpState = null;
    };
    var prototypeAccessors2 = { inFunction: { configurable: true }, inGenerator: { configurable: true }, inAsync: { configurable: true }, allowSuper: { configurable: true }, allowDirectSuper: { configurable: true }, treatFunctionsAsVar: { configurable: true } };
    Parser3.prototype.parse = function parse3() {
      var node = this.options.program || this.startNode();
      this.nextToken();
      return this.parseTopLevel(node);
    };
    prototypeAccessors2.inFunction.get = function() {
      return (this.currentVarScope().flags & SCOPE_FUNCTION3) > 0;
    };
    prototypeAccessors2.inGenerator.get = function() {
      return (this.currentVarScope().flags & SCOPE_GENERATOR3) > 0;
    };
    prototypeAccessors2.inAsync.get = function() {
      return (this.currentVarScope().flags & SCOPE_ASYNC3) > 0;
    };
    prototypeAccessors2.allowSuper.get = function() {
      return (this.currentThisScope().flags & SCOPE_SUPER2) > 0;
    };
    prototypeAccessors2.allowDirectSuper.get = function() {
      return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER2) > 0;
    };
    prototypeAccessors2.treatFunctionsAsVar.get = function() {
      return this.treatFunctionsAsVarInScope(this.currentScope());
    };
    Parser3.prototype.inNonArrowFunction = function inNonArrowFunction2() {
      return (this.currentThisScope().flags & SCOPE_FUNCTION3) > 0;
    };
    Parser3.extend = function extend2() {
      var plugins = [], len = arguments.length;
      while (len--)
        plugins[len] = arguments[len];
      var cls = this;
      for (var i2 = 0; i2 < plugins.length; i2++) {
        cls = plugins[i2](cls);
      }
      return cls;
    };
    Parser3.parse = function parse3(input2, options) {
      return new this(options, input2).parse();
    };
    Parser3.parseExpressionAt = function parseExpressionAt2(input2, pos, options) {
      var parser2 = new this(options, input2, pos);
      parser2.nextToken();
      return parser2.parseExpression();
    };
    Parser3.tokenizer = function tokenizer2(input2, options) {
      return new this(options, input2);
    };
    Object.defineProperties(Parser3.prototype, prototypeAccessors2);
    var pp2 = Parser3.prototype;
    var literal2 = /^(?:'((?:\\.|[^'\\])*?)'|"((?:\\.|[^"\\])*?)")/;
    pp2.strictDirective = function(start) {
      for (; ; ) {
        skipWhiteSpace2.lastIndex = start;
        start += skipWhiteSpace2.exec(this.input)[0].length;
        var match = literal2.exec(this.input.slice(start));
        if (!match) {
          return false;
        }
        if ((match[1] || match[2]) === "use strict") {
          skipWhiteSpace2.lastIndex = start + match[0].length;
          var spaceAfter = skipWhiteSpace2.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
          var next = this.input.charAt(end);
          return next === ";" || next === "}" || lineBreak2.test(spaceAfter[0]) && !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "=");
        }
        start += match[0].length;
        skipWhiteSpace2.lastIndex = start;
        start += skipWhiteSpace2.exec(this.input)[0].length;
        if (this.input[start] === ";") {
          start++;
        }
      }
    };
    pp2.eat = function(type) {
      if (this.type === type) {
        this.next();
        return true;
      } else {
        return false;
      }
    };
    pp2.isContextual = function(name) {
      return this.type === types2.name && this.value === name && !this.containsEsc;
    };
    pp2.eatContextual = function(name) {
      if (!this.isContextual(name)) {
        return false;
      }
      this.next();
      return true;
    };
    pp2.expectContextual = function(name) {
      if (!this.eatContextual(name)) {
        this.unexpected();
      }
    };
    pp2.canInsertSemicolon = function() {
      return this.type === types2.eof || this.type === types2.braceR || lineBreak2.test(this.input.slice(this.lastTokEnd, this.start));
    };
    pp2.insertSemicolon = function() {
      if (this.canInsertSemicolon()) {
        if (this.options.onInsertedSemicolon) {
          this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
        }
        return true;
      }
    };
    pp2.semicolon = function() {
      if (!this.eat(types2.semi) && !this.insertSemicolon()) {
        this.unexpected();
      }
    };
    pp2.afterTrailingComma = function(tokType, notNext) {
      if (this.type === tokType) {
        if (this.options.onTrailingComma) {
          this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
        }
        if (!notNext) {
          this.next();
        }
        return true;
      }
    };
    pp2.expect = function(type) {
      this.eat(type) || this.unexpected();
    };
    pp2.unexpected = function(pos) {
      this.raise(pos != null ? pos : this.start, "Unexpected token");
    };
    function DestructuringErrors2() {
      this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
    }
    pp2.checkPatternErrors = function(refDestructuringErrors, isAssign) {
      if (!refDestructuringErrors) {
        return;
      }
      if (refDestructuringErrors.trailingComma > -1) {
        this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element");
      }
      var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
      if (parens > -1) {
        this.raiseRecoverable(parens, "Parenthesized pattern");
      }
    };
    pp2.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
      if (!refDestructuringErrors) {
        return false;
      }
      var shorthandAssign = refDestructuringErrors.shorthandAssign;
      var doubleProto = refDestructuringErrors.doubleProto;
      if (!andThrow) {
        return shorthandAssign >= 0 || doubleProto >= 0;
      }
      if (shorthandAssign >= 0) {
        this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns");
      }
      if (doubleProto >= 0) {
        this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property");
      }
    };
    pp2.checkYieldAwaitInDefaultParams = function() {
      if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos)) {
        this.raise(this.yieldPos, "Yield expression cannot be a default value");
      }
      if (this.awaitPos) {
        this.raise(this.awaitPos, "Await expression cannot be a default value");
      }
    };
    pp2.isSimpleAssignTarget = function(expr) {
      if (expr.type === "ParenthesizedExpression") {
        return this.isSimpleAssignTarget(expr.expression);
      }
      return expr.type === "Identifier" || expr.type === "MemberExpression";
    };
    var pp$12 = Parser3.prototype;
    pp$12.parseTopLevel = function(node) {
      var exports3 = {};
      if (!node.body) {
        node.body = [];
      }
      while (this.type !== types2.eof) {
        var stmt = this.parseStatement(null, true, exports3);
        node.body.push(stmt);
      }
      if (this.inModule) {
        for (var i2 = 0, list = Object.keys(this.undefinedExports); i2 < list.length; i2 += 1) {
          var name = list[i2];
          this.raiseRecoverable(this.undefinedExports[name].start, "Export '" + name + "' is not defined");
        }
      }
      this.adaptDirectivePrologue(node.body);
      this.next();
      node.sourceType = this.options.sourceType;
      return this.finishNode(node, "Program");
    };
    var loopLabel2 = { kind: "loop" }, switchLabel2 = { kind: "switch" };
    pp$12.isLet = function(context) {
      if (this.options.ecmaVersion < 6 || !this.isContextual("let")) {
        return false;
      }
      skipWhiteSpace2.lastIndex = this.pos;
      var skip = skipWhiteSpace2.exec(this.input);
      var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
      if (nextCh === 91) {
        return true;
      }
      if (context) {
        return false;
      }
      if (nextCh === 123) {
        return true;
      }
      if (isIdentifierStart2(nextCh, true)) {
        var pos = next + 1;
        while (isIdentifierChar2(this.input.charCodeAt(pos), true)) {
          ++pos;
        }
        var ident = this.input.slice(next, pos);
        if (!keywordRelationalOperator2.test(ident)) {
          return true;
        }
      }
      return false;
    };
    pp$12.isAsyncFunction = function() {
      if (this.options.ecmaVersion < 8 || !this.isContextual("async")) {
        return false;
      }
      skipWhiteSpace2.lastIndex = this.pos;
      var skip = skipWhiteSpace2.exec(this.input);
      var next = this.pos + skip[0].length;
      return !lineBreak2.test(this.input.slice(this.pos, next)) && this.input.slice(next, next + 8) === "function" && (next + 8 === this.input.length || !isIdentifierChar2(this.input.charAt(next + 8)));
    };
    pp$12.parseStatement = function(context, topLevel, exports3) {
      var starttype = this.type, node = this.startNode(), kind;
      if (this.isLet(context)) {
        starttype = types2._var;
        kind = "let";
      }
      switch (starttype) {
        case types2._break:
        case types2._continue:
          return this.parseBreakContinueStatement(node, starttype.keyword);
        case types2._debugger:
          return this.parseDebuggerStatement(node);
        case types2._do:
          return this.parseDoStatement(node);
        case types2._for:
          return this.parseForStatement(node);
        case types2._function:
          if (context && (this.strict || context !== "if" && context !== "label") && this.options.ecmaVersion >= 6) {
            this.unexpected();
          }
          return this.parseFunctionStatement(node, false, !context);
        case types2._class:
          if (context) {
            this.unexpected();
          }
          return this.parseClass(node, true);
        case types2._if:
          return this.parseIfStatement(node);
        case types2._return:
          return this.parseReturnStatement(node);
        case types2._switch:
          return this.parseSwitchStatement(node);
        case types2._throw:
          return this.parseThrowStatement(node);
        case types2._try:
          return this.parseTryStatement(node);
        case types2._const:
        case types2._var:
          kind = kind || this.value;
          if (context && kind !== "var") {
            this.unexpected();
          }
          return this.parseVarStatement(node, kind);
        case types2._while:
          return this.parseWhileStatement(node);
        case types2._with:
          return this.parseWithStatement(node);
        case types2.braceL:
          return this.parseBlock(true, node);
        case types2.semi:
          return this.parseEmptyStatement(node);
        case types2._export:
        case types2._import:
          if (this.options.ecmaVersion > 10 && starttype === types2._import) {
            skipWhiteSpace2.lastIndex = this.pos;
            var skip = skipWhiteSpace2.exec(this.input);
            var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
            if (nextCh === 40 || nextCh === 46) {
              return this.parseExpressionStatement(node, this.parseExpression());
            }
          }
          if (!this.options.allowImportExportEverywhere) {
            if (!topLevel) {
              this.raise(this.start, "'import' and 'export' may only appear at the top level");
            }
            if (!this.inModule) {
              this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
            }
          }
          return starttype === types2._import ? this.parseImport(node) : this.parseExport(node, exports3);
        default:
          if (this.isAsyncFunction()) {
            if (context) {
              this.unexpected();
            }
            this.next();
            return this.parseFunctionStatement(node, true, !context);
          }
          var maybeName = this.value, expr = this.parseExpression();
          if (starttype === types2.name && expr.type === "Identifier" && this.eat(types2.colon)) {
            return this.parseLabeledStatement(node, maybeName, expr, context);
          } else {
            return this.parseExpressionStatement(node, expr);
          }
      }
    };
    pp$12.parseBreakContinueStatement = function(node, keyword) {
      var isBreak = keyword === "break";
      this.next();
      if (this.eat(types2.semi) || this.insertSemicolon()) {
        node.label = null;
      } else if (this.type !== types2.name) {
        this.unexpected();
      } else {
        node.label = this.parseIdent();
        this.semicolon();
      }
      var i2 = 0;
      for (; i2 < this.labels.length; ++i2) {
        var lab = this.labels[i2];
        if (node.label == null || lab.name === node.label.name) {
          if (lab.kind != null && (isBreak || lab.kind === "loop")) {
            break;
          }
          if (node.label && isBreak) {
            break;
          }
        }
      }
      if (i2 === this.labels.length) {
        this.raise(node.start, "Unsyntactic " + keyword);
      }
      return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
    };
    pp$12.parseDebuggerStatement = function(node) {
      this.next();
      this.semicolon();
      return this.finishNode(node, "DebuggerStatement");
    };
    pp$12.parseDoStatement = function(node) {
      this.next();
      this.labels.push(loopLabel2);
      node.body = this.parseStatement("do");
      this.labels.pop();
      this.expect(types2._while);
      node.test = this.parseParenExpression();
      if (this.options.ecmaVersion >= 6) {
        this.eat(types2.semi);
      } else {
        this.semicolon();
      }
      return this.finishNode(node, "DoWhileStatement");
    };
    pp$12.parseForStatement = function(node) {
      this.next();
      var awaitAt = this.options.ecmaVersion >= 9 && (this.inAsync || !this.inFunction && this.options.allowAwaitOutsideFunction) && this.eatContextual("await") ? this.lastTokStart : -1;
      this.labels.push(loopLabel2);
      this.enterScope(0);
      this.expect(types2.parenL);
      if (this.type === types2.semi) {
        if (awaitAt > -1) {
          this.unexpected(awaitAt);
        }
        return this.parseFor(node, null);
      }
      var isLet = this.isLet();
      if (this.type === types2._var || this.type === types2._const || isLet) {
        var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
        this.next();
        this.parseVar(init$1, true, kind);
        this.finishNode(init$1, "VariableDeclaration");
        if ((this.type === types2._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && init$1.declarations.length === 1) {
          if (this.options.ecmaVersion >= 9) {
            if (this.type === types2._in) {
              if (awaitAt > -1) {
                this.unexpected(awaitAt);
              }
            } else {
              node.await = awaitAt > -1;
            }
          }
          return this.parseForIn(node, init$1);
        }
        if (awaitAt > -1) {
          this.unexpected(awaitAt);
        }
        return this.parseFor(node, init$1);
      }
      var refDestructuringErrors = new DestructuringErrors2();
      var init = this.parseExpression(true, refDestructuringErrors);
      if (this.type === types2._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) {
        if (this.options.ecmaVersion >= 9) {
          if (this.type === types2._in) {
            if (awaitAt > -1) {
              this.unexpected(awaitAt);
            }
          } else {
            node.await = awaitAt > -1;
          }
        }
        this.toAssignable(init, false, refDestructuringErrors);
        this.checkLVal(init);
        return this.parseForIn(node, init);
      } else {
        this.checkExpressionErrors(refDestructuringErrors, true);
      }
      if (awaitAt > -1) {
        this.unexpected(awaitAt);
      }
      return this.parseFor(node, init);
    };
    pp$12.parseFunctionStatement = function(node, isAsync, declarationPosition) {
      this.next();
      return this.parseFunction(node, FUNC_STATEMENT2 | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT2), false, isAsync);
    };
    pp$12.parseIfStatement = function(node) {
      this.next();
      node.test = this.parseParenExpression();
      node.consequent = this.parseStatement("if");
      node.alternate = this.eat(types2._else) ? this.parseStatement("if") : null;
      return this.finishNode(node, "IfStatement");
    };
    pp$12.parseReturnStatement = function(node) {
      if (!this.inFunction && !this.options.allowReturnOutsideFunction) {
        this.raise(this.start, "'return' outside of function");
      }
      this.next();
      if (this.eat(types2.semi) || this.insertSemicolon()) {
        node.argument = null;
      } else {
        node.argument = this.parseExpression();
        this.semicolon();
      }
      return this.finishNode(node, "ReturnStatement");
    };
    pp$12.parseSwitchStatement = function(node) {
      this.next();
      node.discriminant = this.parseParenExpression();
      node.cases = [];
      this.expect(types2.braceL);
      this.labels.push(switchLabel2);
      this.enterScope(0);
      var cur;
      for (var sawDefault = false; this.type !== types2.braceR; ) {
        if (this.type === types2._case || this.type === types2._default) {
          var isCase = this.type === types2._case;
          if (cur) {
            this.finishNode(cur, "SwitchCase");
          }
          node.cases.push(cur = this.startNode());
          cur.consequent = [];
          this.next();
          if (isCase) {
            cur.test = this.parseExpression();
          } else {
            if (sawDefault) {
              this.raiseRecoverable(this.lastTokStart, "Multiple default clauses");
            }
            sawDefault = true;
            cur.test = null;
          }
          this.expect(types2.colon);
        } else {
          if (!cur) {
            this.unexpected();
          }
          cur.consequent.push(this.parseStatement(null));
        }
      }
      this.exitScope();
      if (cur) {
        this.finishNode(cur, "SwitchCase");
      }
      this.next();
      this.labels.pop();
      return this.finishNode(node, "SwitchStatement");
    };
    pp$12.parseThrowStatement = function(node) {
      this.next();
      if (lineBreak2.test(this.input.slice(this.lastTokEnd, this.start))) {
        this.raise(this.lastTokEnd, "Illegal newline after throw");
      }
      node.argument = this.parseExpression();
      this.semicolon();
      return this.finishNode(node, "ThrowStatement");
    };
    var empty2 = [];
    pp$12.parseTryStatement = function(node) {
      this.next();
      node.block = this.parseBlock();
      node.handler = null;
      if (this.type === types2._catch) {
        var clause = this.startNode();
        this.next();
        if (this.eat(types2.parenL)) {
          clause.param = this.parseBindingAtom();
          var simple22 = clause.param.type === "Identifier";
          this.enterScope(simple22 ? SCOPE_SIMPLE_CATCH2 : 0);
          this.checkLVal(clause.param, simple22 ? BIND_SIMPLE_CATCH2 : BIND_LEXICAL2);
          this.expect(types2.parenR);
        } else {
          if (this.options.ecmaVersion < 10) {
            this.unexpected();
          }
          clause.param = null;
          this.enterScope(0);
        }
        clause.body = this.parseBlock(false);
        this.exitScope();
        node.handler = this.finishNode(clause, "CatchClause");
      }
      node.finalizer = this.eat(types2._finally) ? this.parseBlock() : null;
      if (!node.handler && !node.finalizer) {
        this.raise(node.start, "Missing catch or finally clause");
      }
      return this.finishNode(node, "TryStatement");
    };
    pp$12.parseVarStatement = function(node, kind) {
      this.next();
      this.parseVar(node, false, kind);
      this.semicolon();
      return this.finishNode(node, "VariableDeclaration");
    };
    pp$12.parseWhileStatement = function(node) {
      this.next();
      node.test = this.parseParenExpression();
      this.labels.push(loopLabel2);
      node.body = this.parseStatement("while");
      this.labels.pop();
      return this.finishNode(node, "WhileStatement");
    };
    pp$12.parseWithStatement = function(node) {
      if (this.strict) {
        this.raise(this.start, "'with' in strict mode");
      }
      this.next();
      node.object = this.parseParenExpression();
      node.body = this.parseStatement("with");
      return this.finishNode(node, "WithStatement");
    };
    pp$12.parseEmptyStatement = function(node) {
      this.next();
      return this.finishNode(node, "EmptyStatement");
    };
    pp$12.parseLabeledStatement = function(node, maybeName, expr, context) {
      for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1) {
        var label = list[i$1];
        if (label.name === maybeName) {
          this.raise(expr.start, "Label '" + maybeName + "' is already declared");
        }
      }
      var kind = this.type.isLoop ? "loop" : this.type === types2._switch ? "switch" : null;
      for (var i2 = this.labels.length - 1; i2 >= 0; i2--) {
        var label$1 = this.labels[i2];
        if (label$1.statementStart === node.start) {
          label$1.statementStart = this.start;
          label$1.kind = kind;
        } else {
          break;
        }
      }
      this.labels.push({ name: maybeName, kind, statementStart: this.start });
      node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
      this.labels.pop();
      node.label = expr;
      return this.finishNode(node, "LabeledStatement");
    };
    pp$12.parseExpressionStatement = function(node, expr) {
      node.expression = expr;
      this.semicolon();
      return this.finishNode(node, "ExpressionStatement");
    };
    pp$12.parseBlock = function(createNewLexicalScope, node, exitStrict) {
      if (createNewLexicalScope === void 0)
        createNewLexicalScope = true;
      if (node === void 0)
        node = this.startNode();
      node.body = [];
      this.expect(types2.braceL);
      if (createNewLexicalScope) {
        this.enterScope(0);
      }
      while (this.type !== types2.braceR) {
        var stmt = this.parseStatement(null);
        node.body.push(stmt);
      }
      if (exitStrict) {
        this.strict = false;
      }
      this.next();
      if (createNewLexicalScope) {
        this.exitScope();
      }
      return this.finishNode(node, "BlockStatement");
    };
    pp$12.parseFor = function(node, init) {
      node.init = init;
      this.expect(types2.semi);
      node.test = this.type === types2.semi ? null : this.parseExpression();
      this.expect(types2.semi);
      node.update = this.type === types2.parenR ? null : this.parseExpression();
      this.expect(types2.parenR);
      node.body = this.parseStatement("for");
      this.exitScope();
      this.labels.pop();
      return this.finishNode(node, "ForStatement");
    };
    pp$12.parseForIn = function(node, init) {
      var isForIn = this.type === types2._in;
      this.next();
      if (init.type === "VariableDeclaration" && init.declarations[0].init != null && (!isForIn || this.options.ecmaVersion < 8 || this.strict || init.kind !== "var" || init.declarations[0].id.type !== "Identifier")) {
        this.raise(init.start, (isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer");
      } else if (init.type === "AssignmentPattern") {
        this.raise(init.start, "Invalid left-hand side in for-loop");
      }
      node.left = init;
      node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
      this.expect(types2.parenR);
      node.body = this.parseStatement("for");
      this.exitScope();
      this.labels.pop();
      return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement");
    };
    pp$12.parseVar = function(node, isFor, kind) {
      node.declarations = [];
      node.kind = kind;
      for (; ; ) {
        var decl = this.startNode();
        this.parseVarId(decl, kind);
        if (this.eat(types2.eq)) {
          decl.init = this.parseMaybeAssign(isFor);
        } else if (kind === "const" && !(this.type === types2._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
          this.unexpected();
        } else if (decl.id.type !== "Identifier" && !(isFor && (this.type === types2._in || this.isContextual("of")))) {
          this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
        } else {
          decl.init = null;
        }
        node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
        if (!this.eat(types2.comma)) {
          break;
        }
      }
      return node;
    };
    pp$12.parseVarId = function(decl, kind) {
      decl.id = this.parseBindingAtom();
      this.checkLVal(decl.id, kind === "var" ? BIND_VAR2 : BIND_LEXICAL2, false);
    };
    var FUNC_STATEMENT2 = 1, FUNC_HANGING_STATEMENT2 = 2, FUNC_NULLABLE_ID2 = 4;
    pp$12.parseFunction = function(node, statement, allowExpressionBody, isAsync) {
      this.initFunction(node);
      if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
        if (this.type === types2.star && statement & FUNC_HANGING_STATEMENT2) {
          this.unexpected();
        }
        node.generator = this.eat(types2.star);
      }
      if (this.options.ecmaVersion >= 8) {
        node.async = !!isAsync;
      }
      if (statement & FUNC_STATEMENT2) {
        node.id = statement & FUNC_NULLABLE_ID2 && this.type !== types2.name ? null : this.parseIdent();
        if (node.id && !(statement & FUNC_HANGING_STATEMENT2)) {
          this.checkLVal(node.id, this.strict || node.generator || node.async ? this.treatFunctionsAsVar ? BIND_VAR2 : BIND_LEXICAL2 : BIND_FUNCTION2);
        }
      }
      var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
      this.yieldPos = 0;
      this.awaitPos = 0;
      this.awaitIdentPos = 0;
      this.enterScope(functionFlags2(node.async, node.generator));
      if (!(statement & FUNC_STATEMENT2)) {
        node.id = this.type === types2.name ? this.parseIdent() : null;
      }
      this.parseFunctionParams(node);
      this.parseFunctionBody(node, allowExpressionBody, false);
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      this.awaitIdentPos = oldAwaitIdentPos;
      return this.finishNode(node, statement & FUNC_STATEMENT2 ? "FunctionDeclaration" : "FunctionExpression");
    };
    pp$12.parseFunctionParams = function(node) {
      this.expect(types2.parenL);
      node.params = this.parseBindingList(types2.parenR, false, this.options.ecmaVersion >= 8);
      this.checkYieldAwaitInDefaultParams();
    };
    pp$12.parseClass = function(node, isStatement) {
      this.next();
      var oldStrict = this.strict;
      this.strict = true;
      this.parseClassId(node, isStatement);
      this.parseClassSuper(node);
      var classBody = this.startNode();
      var hadConstructor = false;
      classBody.body = [];
      this.expect(types2.braceL);
      while (this.type !== types2.braceR) {
        var element2 = this.parseClassElement(node.superClass !== null);
        if (element2) {
          classBody.body.push(element2);
          if (element2.type === "MethodDefinition" && element2.kind === "constructor") {
            if (hadConstructor) {
              this.raise(element2.start, "Duplicate constructor in the same class");
            }
            hadConstructor = true;
          }
        }
      }
      this.strict = oldStrict;
      this.next();
      node.body = this.finishNode(classBody, "ClassBody");
      return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
    };
    pp$12.parseClassElement = function(constructorAllowsSuper) {
      var this$1 = this;
      if (this.eat(types2.semi)) {
        return null;
      }
      var method = this.startNode();
      var tryContextual = function(k2, noLineBreak) {
        if (noLineBreak === void 0)
          noLineBreak = false;
        var start = this$1.start, startLoc = this$1.startLoc;
        if (!this$1.eatContextual(k2)) {
          return false;
        }
        if (this$1.type !== types2.parenL && (!noLineBreak || !this$1.canInsertSemicolon())) {
          return true;
        }
        if (method.key) {
          this$1.unexpected();
        }
        method.computed = false;
        method.key = this$1.startNodeAt(start, startLoc);
        method.key.name = k2;
        this$1.finishNode(method.key, "Identifier");
        return false;
      };
      method.kind = "method";
      method.static = tryContextual("static");
      var isGenerator = this.eat(types2.star);
      var isAsync = false;
      if (!isGenerator) {
        if (this.options.ecmaVersion >= 8 && tryContextual("async", true)) {
          isAsync = true;
          isGenerator = this.options.ecmaVersion >= 9 && this.eat(types2.star);
        } else if (tryContextual("get")) {
          method.kind = "get";
        } else if (tryContextual("set")) {
          method.kind = "set";
        }
      }
      if (!method.key) {
        this.parsePropertyName(method);
      }
      var key = method.key;
      var allowsDirectSuper = false;
      if (!method.computed && !method.static && (key.type === "Identifier" && key.name === "constructor" || key.type === "Literal" && key.value === "constructor")) {
        if (method.kind !== "method") {
          this.raise(key.start, "Constructor can't have get/set modifier");
        }
        if (isGenerator) {
          this.raise(key.start, "Constructor can't be a generator");
        }
        if (isAsync) {
          this.raise(key.start, "Constructor can't be an async method");
        }
        method.kind = "constructor";
        allowsDirectSuper = constructorAllowsSuper;
      } else if (method.static && key.type === "Identifier" && key.name === "prototype") {
        this.raise(key.start, "Classes may not have a static property named prototype");
      }
      this.parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper);
      if (method.kind === "get" && method.value.params.length !== 0) {
        this.raiseRecoverable(method.value.start, "getter should have no params");
      }
      if (method.kind === "set" && method.value.params.length !== 1) {
        this.raiseRecoverable(method.value.start, "setter should have exactly one param");
      }
      if (method.kind === "set" && method.value.params[0].type === "RestElement") {
        this.raiseRecoverable(method.value.params[0].start, "Setter cannot use rest params");
      }
      return method;
    };
    pp$12.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
      method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
      return this.finishNode(method, "MethodDefinition");
    };
    pp$12.parseClassId = function(node, isStatement) {
      if (this.type === types2.name) {
        node.id = this.parseIdent();
        if (isStatement) {
          this.checkLVal(node.id, BIND_LEXICAL2, false);
        }
      } else {
        if (isStatement === true) {
          this.unexpected();
        }
        node.id = null;
      }
    };
    pp$12.parseClassSuper = function(node) {
      node.superClass = this.eat(types2._extends) ? this.parseExprSubscripts() : null;
    };
    pp$12.parseExport = function(node, exports3) {
      this.next();
      if (this.eat(types2.star)) {
        if (this.options.ecmaVersion >= 11) {
          if (this.eatContextual("as")) {
            node.exported = this.parseIdent(true);
            this.checkExport(exports3, node.exported.name, this.lastTokStart);
          } else {
            node.exported = null;
          }
        }
        this.expectContextual("from");
        if (this.type !== types2.string) {
          this.unexpected();
        }
        node.source = this.parseExprAtom();
        this.semicolon();
        return this.finishNode(node, "ExportAllDeclaration");
      }
      if (this.eat(types2._default)) {
        this.checkExport(exports3, "default", this.lastTokStart);
        var isAsync;
        if (this.type === types2._function || (isAsync = this.isAsyncFunction())) {
          var fNode = this.startNode();
          this.next();
          if (isAsync) {
            this.next();
          }
          node.declaration = this.parseFunction(fNode, FUNC_STATEMENT2 | FUNC_NULLABLE_ID2, false, isAsync);
        } else if (this.type === types2._class) {
          var cNode = this.startNode();
          node.declaration = this.parseClass(cNode, "nullableID");
        } else {
          node.declaration = this.parseMaybeAssign();
          this.semicolon();
        }
        return this.finishNode(node, "ExportDefaultDeclaration");
      }
      if (this.shouldParseExportStatement()) {
        node.declaration = this.parseStatement(null);
        if (node.declaration.type === "VariableDeclaration") {
          this.checkVariableExport(exports3, node.declaration.declarations);
        } else {
          this.checkExport(exports3, node.declaration.id.name, node.declaration.id.start);
        }
        node.specifiers = [];
        node.source = null;
      } else {
        node.declaration = null;
        node.specifiers = this.parseExportSpecifiers(exports3);
        if (this.eatContextual("from")) {
          if (this.type !== types2.string) {
            this.unexpected();
          }
          node.source = this.parseExprAtom();
        } else {
          for (var i2 = 0, list = node.specifiers; i2 < list.length; i2 += 1) {
            var spec = list[i2];
            this.checkUnreserved(spec.local);
            this.checkLocalExport(spec.local);
          }
          node.source = null;
        }
        this.semicolon();
      }
      return this.finishNode(node, "ExportNamedDeclaration");
    };
    pp$12.checkExport = function(exports3, name, pos) {
      if (!exports3) {
        return;
      }
      if (has2(exports3, name)) {
        this.raiseRecoverable(pos, "Duplicate export '" + name + "'");
      }
      exports3[name] = true;
    };
    pp$12.checkPatternExport = function(exports3, pat) {
      var type = pat.type;
      if (type === "Identifier") {
        this.checkExport(exports3, pat.name, pat.start);
      } else if (type === "ObjectPattern") {
        for (var i2 = 0, list = pat.properties; i2 < list.length; i2 += 1) {
          var prop = list[i2];
          this.checkPatternExport(exports3, prop);
        }
      } else if (type === "ArrayPattern") {
        for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
          var elt = list$1[i$1];
          if (elt) {
            this.checkPatternExport(exports3, elt);
          }
        }
      } else if (type === "Property") {
        this.checkPatternExport(exports3, pat.value);
      } else if (type === "AssignmentPattern") {
        this.checkPatternExport(exports3, pat.left);
      } else if (type === "RestElement") {
        this.checkPatternExport(exports3, pat.argument);
      } else if (type === "ParenthesizedExpression") {
        this.checkPatternExport(exports3, pat.expression);
      }
    };
    pp$12.checkVariableExport = function(exports3, decls) {
      if (!exports3) {
        return;
      }
      for (var i2 = 0, list = decls; i2 < list.length; i2 += 1) {
        var decl = list[i2];
        this.checkPatternExport(exports3, decl.id);
      }
    };
    pp$12.shouldParseExportStatement = function() {
      return this.type.keyword === "var" || this.type.keyword === "const" || this.type.keyword === "class" || this.type.keyword === "function" || this.isLet() || this.isAsyncFunction();
    };
    pp$12.parseExportSpecifiers = function(exports3) {
      var nodes = [], first2 = true;
      this.expect(types2.braceL);
      while (!this.eat(types2.braceR)) {
        if (!first2) {
          this.expect(types2.comma);
          if (this.afterTrailingComma(types2.braceR)) {
            break;
          }
        } else {
          first2 = false;
        }
        var node = this.startNode();
        node.local = this.parseIdent(true);
        node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
        this.checkExport(exports3, node.exported.name, node.exported.start);
        nodes.push(this.finishNode(node, "ExportSpecifier"));
      }
      return nodes;
    };
    pp$12.parseImport = function(node) {
      this.next();
      if (this.type === types2.string) {
        node.specifiers = empty2;
        node.source = this.parseExprAtom();
      } else {
        node.specifiers = this.parseImportSpecifiers();
        this.expectContextual("from");
        node.source = this.type === types2.string ? this.parseExprAtom() : this.unexpected();
      }
      this.semicolon();
      return this.finishNode(node, "ImportDeclaration");
    };
    pp$12.parseImportSpecifiers = function() {
      var nodes = [], first2 = true;
      if (this.type === types2.name) {
        var node = this.startNode();
        node.local = this.parseIdent();
        this.checkLVal(node.local, BIND_LEXICAL2);
        nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
        if (!this.eat(types2.comma)) {
          return nodes;
        }
      }
      if (this.type === types2.star) {
        var node$1 = this.startNode();
        this.next();
        this.expectContextual("as");
        node$1.local = this.parseIdent();
        this.checkLVal(node$1.local, BIND_LEXICAL2);
        nodes.push(this.finishNode(node$1, "ImportNamespaceSpecifier"));
        return nodes;
      }
      this.expect(types2.braceL);
      while (!this.eat(types2.braceR)) {
        if (!first2) {
          this.expect(types2.comma);
          if (this.afterTrailingComma(types2.braceR)) {
            break;
          }
        } else {
          first2 = false;
        }
        var node$2 = this.startNode();
        node$2.imported = this.parseIdent(true);
        if (this.eatContextual("as")) {
          node$2.local = this.parseIdent();
        } else {
          this.checkUnreserved(node$2.imported);
          node$2.local = node$2.imported;
        }
        this.checkLVal(node$2.local, BIND_LEXICAL2);
        nodes.push(this.finishNode(node$2, "ImportSpecifier"));
      }
      return nodes;
    };
    pp$12.adaptDirectivePrologue = function(statements) {
      for (var i2 = 0; i2 < statements.length && this.isDirectiveCandidate(statements[i2]); ++i2) {
        statements[i2].directive = statements[i2].expression.raw.slice(1, -1);
      }
    };
    pp$12.isDirectiveCandidate = function(statement) {
      return statement.type === "ExpressionStatement" && statement.expression.type === "Literal" && typeof statement.expression.value === "string" && (this.input[statement.start] === '"' || this.input[statement.start] === "'");
    };
    var pp$22 = Parser3.prototype;
    pp$22.toAssignable = function(node, isBinding, refDestructuringErrors) {
      if (this.options.ecmaVersion >= 6 && node) {
        switch (node.type) {
          case "Identifier":
            if (this.inAsync && node.name === "await") {
              this.raise(node.start, "Cannot use 'await' as identifier inside an async function");
            }
            break;
          case "ObjectPattern":
          case "ArrayPattern":
          case "RestElement":
            break;
          case "ObjectExpression":
            node.type = "ObjectPattern";
            if (refDestructuringErrors) {
              this.checkPatternErrors(refDestructuringErrors, true);
            }
            for (var i2 = 0, list = node.properties; i2 < list.length; i2 += 1) {
              var prop = list[i2];
              this.toAssignable(prop, isBinding);
              if (prop.type === "RestElement" && (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")) {
                this.raise(prop.argument.start, "Unexpected token");
              }
            }
            break;
          case "Property":
            if (node.kind !== "init") {
              this.raise(node.key.start, "Object pattern can't contain getter or setter");
            }
            this.toAssignable(node.value, isBinding);
            break;
          case "ArrayExpression":
            node.type = "ArrayPattern";
            if (refDestructuringErrors) {
              this.checkPatternErrors(refDestructuringErrors, true);
            }
            this.toAssignableList(node.elements, isBinding);
            break;
          case "SpreadElement":
            node.type = "RestElement";
            this.toAssignable(node.argument, isBinding);
            if (node.argument.type === "AssignmentPattern") {
              this.raise(node.argument.start, "Rest elements cannot have a default value");
            }
            break;
          case "AssignmentExpression":
            if (node.operator !== "=") {
              this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
            }
            node.type = "AssignmentPattern";
            delete node.operator;
            this.toAssignable(node.left, isBinding);
          case "AssignmentPattern":
            break;
          case "ParenthesizedExpression":
            this.toAssignable(node.expression, isBinding, refDestructuringErrors);
            break;
          case "ChainExpression":
            this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
            break;
          case "MemberExpression":
            if (!isBinding) {
              break;
            }
          default:
            this.raise(node.start, "Assigning to rvalue");
        }
      } else if (refDestructuringErrors) {
        this.checkPatternErrors(refDestructuringErrors, true);
      }
      return node;
    };
    pp$22.toAssignableList = function(exprList, isBinding) {
      var end = exprList.length;
      for (var i2 = 0; i2 < end; i2++) {
        var elt = exprList[i2];
        if (elt) {
          this.toAssignable(elt, isBinding);
        }
      }
      if (end) {
        var last = exprList[end - 1];
        if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier") {
          this.unexpected(last.argument.start);
        }
      }
      return exprList;
    };
    pp$22.parseSpread = function(refDestructuringErrors) {
      var node = this.startNode();
      this.next();
      node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
      return this.finishNode(node, "SpreadElement");
    };
    pp$22.parseRestBinding = function() {
      var node = this.startNode();
      this.next();
      if (this.options.ecmaVersion === 6 && this.type !== types2.name) {
        this.unexpected();
      }
      node.argument = this.parseBindingAtom();
      return this.finishNode(node, "RestElement");
    };
    pp$22.parseBindingAtom = function() {
      if (this.options.ecmaVersion >= 6) {
        switch (this.type) {
          case types2.bracketL:
            var node = this.startNode();
            this.next();
            node.elements = this.parseBindingList(types2.bracketR, true, true);
            return this.finishNode(node, "ArrayPattern");
          case types2.braceL:
            return this.parseObj(true);
        }
      }
      return this.parseIdent();
    };
    pp$22.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
      var elts = [], first2 = true;
      while (!this.eat(close)) {
        if (first2) {
          first2 = false;
        } else {
          this.expect(types2.comma);
        }
        if (allowEmpty && this.type === types2.comma) {
          elts.push(null);
        } else if (allowTrailingComma && this.afterTrailingComma(close)) {
          break;
        } else if (this.type === types2.ellipsis) {
          var rest = this.parseRestBinding();
          this.parseBindingListItem(rest);
          elts.push(rest);
          if (this.type === types2.comma) {
            this.raise(this.start, "Comma is not permitted after the rest element");
          }
          this.expect(close);
          break;
        } else {
          var elem = this.parseMaybeDefault(this.start, this.startLoc);
          this.parseBindingListItem(elem);
          elts.push(elem);
        }
      }
      return elts;
    };
    pp$22.parseBindingListItem = function(param) {
      return param;
    };
    pp$22.parseMaybeDefault = function(startPos, startLoc, left) {
      left = left || this.parseBindingAtom();
      if (this.options.ecmaVersion < 6 || !this.eat(types2.eq)) {
        return left;
      }
      var node = this.startNodeAt(startPos, startLoc);
      node.left = left;
      node.right = this.parseMaybeAssign();
      return this.finishNode(node, "AssignmentPattern");
    };
    pp$22.checkLVal = function(expr, bindingType, checkClashes) {
      if (bindingType === void 0)
        bindingType = BIND_NONE2;
      switch (expr.type) {
        case "Identifier":
          if (bindingType === BIND_LEXICAL2 && expr.name === "let") {
            this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name");
          }
          if (this.strict && this.reservedWordsStrictBind.test(expr.name)) {
            this.raiseRecoverable(expr.start, (bindingType ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
          }
          if (checkClashes) {
            if (has2(checkClashes, expr.name)) {
              this.raiseRecoverable(expr.start, "Argument name clash");
            }
            checkClashes[expr.name] = true;
          }
          if (bindingType !== BIND_NONE2 && bindingType !== BIND_OUTSIDE2) {
            this.declareName(expr.name, bindingType, expr.start);
          }
          break;
        case "ChainExpression":
          this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
          break;
        case "MemberExpression":
          if (bindingType) {
            this.raiseRecoverable(expr.start, "Binding member expression");
          }
          break;
        case "ObjectPattern":
          for (var i2 = 0, list = expr.properties; i2 < list.length; i2 += 1) {
            var prop = list[i2];
            this.checkLVal(prop, bindingType, checkClashes);
          }
          break;
        case "Property":
          this.checkLVal(expr.value, bindingType, checkClashes);
          break;
        case "ArrayPattern":
          for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
            var elem = list$1[i$1];
            if (elem) {
              this.checkLVal(elem, bindingType, checkClashes);
            }
          }
          break;
        case "AssignmentPattern":
          this.checkLVal(expr.left, bindingType, checkClashes);
          break;
        case "RestElement":
          this.checkLVal(expr.argument, bindingType, checkClashes);
          break;
        case "ParenthesizedExpression":
          this.checkLVal(expr.expression, bindingType, checkClashes);
          break;
        default:
          this.raise(expr.start, (bindingType ? "Binding" : "Assigning to") + " rvalue");
      }
    };
    var pp$32 = Parser3.prototype;
    pp$32.checkPropClash = function(prop, propHash, refDestructuringErrors) {
      if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement") {
        return;
      }
      if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand)) {
        return;
      }
      var key = prop.key;
      var name;
      switch (key.type) {
        case "Identifier":
          name = key.name;
          break;
        case "Literal":
          name = String(key.value);
          break;
        default:
          return;
      }
      var kind = prop.kind;
      if (this.options.ecmaVersion >= 6) {
        if (name === "__proto__" && kind === "init") {
          if (propHash.proto) {
            if (refDestructuringErrors) {
              if (refDestructuringErrors.doubleProto < 0) {
                refDestructuringErrors.doubleProto = key.start;
              }
            } else {
              this.raiseRecoverable(key.start, "Redefinition of __proto__ property");
            }
          }
          propHash.proto = true;
        }
        return;
      }
      name = "$" + name;
      var other = propHash[name];
      if (other) {
        var redefinition;
        if (kind === "init") {
          redefinition = this.strict && other.init || other.get || other.set;
        } else {
          redefinition = other.init || other[kind];
        }
        if (redefinition) {
          this.raiseRecoverable(key.start, "Redefinition of property");
        }
      } else {
        other = propHash[name] = {
          init: false,
          get: false,
          set: false
        };
      }
      other[kind] = true;
    };
    pp$32.parseExpression = function(noIn, refDestructuringErrors) {
      var startPos = this.start, startLoc = this.startLoc;
      var expr = this.parseMaybeAssign(noIn, refDestructuringErrors);
      if (this.type === types2.comma) {
        var node = this.startNodeAt(startPos, startLoc);
        node.expressions = [expr];
        while (this.eat(types2.comma)) {
          node.expressions.push(this.parseMaybeAssign(noIn, refDestructuringErrors));
        }
        return this.finishNode(node, "SequenceExpression");
      }
      return expr;
    };
    pp$32.parseMaybeAssign = function(noIn, refDestructuringErrors, afterLeftParse) {
      if (this.isContextual("yield")) {
        if (this.inGenerator) {
          return this.parseYield(noIn);
        } else {
          this.exprAllowed = false;
        }
      }
      var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1;
      if (refDestructuringErrors) {
        oldParenAssign = refDestructuringErrors.parenthesizedAssign;
        oldTrailingComma = refDestructuringErrors.trailingComma;
        refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
      } else {
        refDestructuringErrors = new DestructuringErrors2();
        ownDestructuringErrors = true;
      }
      var startPos = this.start, startLoc = this.startLoc;
      if (this.type === types2.parenL || this.type === types2.name) {
        this.potentialArrowAt = this.start;
      }
      var left = this.parseMaybeConditional(noIn, refDestructuringErrors);
      if (afterLeftParse) {
        left = afterLeftParse.call(this, left, startPos, startLoc);
      }
      if (this.type.isAssign) {
        var node = this.startNodeAt(startPos, startLoc);
        node.operator = this.value;
        node.left = this.type === types2.eq ? this.toAssignable(left, false, refDestructuringErrors) : left;
        if (!ownDestructuringErrors) {
          refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
        }
        if (refDestructuringErrors.shorthandAssign >= node.left.start) {
          refDestructuringErrors.shorthandAssign = -1;
        }
        this.checkLVal(left);
        this.next();
        node.right = this.parseMaybeAssign(noIn);
        return this.finishNode(node, "AssignmentExpression");
      } else {
        if (ownDestructuringErrors) {
          this.checkExpressionErrors(refDestructuringErrors, true);
        }
      }
      if (oldParenAssign > -1) {
        refDestructuringErrors.parenthesizedAssign = oldParenAssign;
      }
      if (oldTrailingComma > -1) {
        refDestructuringErrors.trailingComma = oldTrailingComma;
      }
      return left;
    };
    pp$32.parseMaybeConditional = function(noIn, refDestructuringErrors) {
      var startPos = this.start, startLoc = this.startLoc;
      var expr = this.parseExprOps(noIn, refDestructuringErrors);
      if (this.checkExpressionErrors(refDestructuringErrors)) {
        return expr;
      }
      if (this.eat(types2.question)) {
        var node = this.startNodeAt(startPos, startLoc);
        node.test = expr;
        node.consequent = this.parseMaybeAssign();
        this.expect(types2.colon);
        node.alternate = this.parseMaybeAssign(noIn);
        return this.finishNode(node, "ConditionalExpression");
      }
      return expr;
    };
    pp$32.parseExprOps = function(noIn, refDestructuringErrors) {
      var startPos = this.start, startLoc = this.startLoc;
      var expr = this.parseMaybeUnary(refDestructuringErrors, false);
      if (this.checkExpressionErrors(refDestructuringErrors)) {
        return expr;
      }
      return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, noIn);
    };
    pp$32.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, noIn) {
      var prec = this.type.binop;
      if (prec != null && (!noIn || this.type !== types2._in)) {
        if (prec > minPrec) {
          var logical = this.type === types2.logicalOR || this.type === types2.logicalAND;
          var coalesce = this.type === types2.coalesce;
          if (coalesce) {
            prec = types2.logicalAND.binop;
          }
          var op = this.value;
          this.next();
          var startPos = this.start, startLoc = this.startLoc;
          var right = this.parseExprOp(this.parseMaybeUnary(null, false), startPos, startLoc, prec, noIn);
          var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);
          if (logical && this.type === types2.coalesce || coalesce && (this.type === types2.logicalOR || this.type === types2.logicalAND)) {
            this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
          }
          return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
        }
      }
      return left;
    };
    pp$32.buildBinary = function(startPos, startLoc, left, right, op, logical) {
      var node = this.startNodeAt(startPos, startLoc);
      node.left = left;
      node.operator = op;
      node.right = right;
      return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression");
    };
    pp$32.parseMaybeUnary = function(refDestructuringErrors, sawUnary) {
      var startPos = this.start, startLoc = this.startLoc, expr;
      if (this.isContextual("await") && (this.inAsync || !this.inFunction && this.options.allowAwaitOutsideFunction)) {
        expr = this.parseAwait();
        sawUnary = true;
      } else if (this.type.prefix) {
        var node = this.startNode(), update = this.type === types2.incDec;
        node.operator = this.value;
        node.prefix = true;
        this.next();
        node.argument = this.parseMaybeUnary(null, true);
        this.checkExpressionErrors(refDestructuringErrors, true);
        if (update) {
          this.checkLVal(node.argument);
        } else if (this.strict && node.operator === "delete" && node.argument.type === "Identifier") {
          this.raiseRecoverable(node.start, "Deleting local variable in strict mode");
        } else {
          sawUnary = true;
        }
        expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
      } else {
        expr = this.parseExprSubscripts(refDestructuringErrors);
        if (this.checkExpressionErrors(refDestructuringErrors)) {
          return expr;
        }
        while (this.type.postfix && !this.canInsertSemicolon()) {
          var node$1 = this.startNodeAt(startPos, startLoc);
          node$1.operator = this.value;
          node$1.prefix = false;
          node$1.argument = expr;
          this.checkLVal(expr);
          this.next();
          expr = this.finishNode(node$1, "UpdateExpression");
        }
      }
      if (!sawUnary && this.eat(types2.starstar)) {
        return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false), "**", false);
      } else {
        return expr;
      }
    };
    pp$32.parseExprSubscripts = function(refDestructuringErrors) {
      var startPos = this.start, startLoc = this.startLoc;
      var expr = this.parseExprAtom(refDestructuringErrors);
      if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")") {
        return expr;
      }
      var result = this.parseSubscripts(expr, startPos, startLoc);
      if (refDestructuringErrors && result.type === "MemberExpression") {
        if (refDestructuringErrors.parenthesizedAssign >= result.start) {
          refDestructuringErrors.parenthesizedAssign = -1;
        }
        if (refDestructuringErrors.parenthesizedBind >= result.start) {
          refDestructuringErrors.parenthesizedBind = -1;
        }
      }
      return result;
    };
    pp$32.parseSubscripts = function(base22, startPos, startLoc, noCalls) {
      var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base22.type === "Identifier" && base22.name === "async" && this.lastTokEnd === base22.end && !this.canInsertSemicolon() && base22.end - base22.start === 5 && this.potentialArrowAt === base22.start;
      var optionalChained = false;
      while (true) {
        var element2 = this.parseSubscript(base22, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained);
        if (element2.optional) {
          optionalChained = true;
        }
        if (element2 === base22 || element2.type === "ArrowFunctionExpression") {
          if (optionalChained) {
            var chainNode = this.startNodeAt(startPos, startLoc);
            chainNode.expression = element2;
            element2 = this.finishNode(chainNode, "ChainExpression");
          }
          return element2;
        }
        base22 = element2;
      }
    };
    pp$32.parseSubscript = function(base22, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained) {
      var optionalSupported = this.options.ecmaVersion >= 11;
      var optional = optionalSupported && this.eat(types2.questionDot);
      if (noCalls && optional) {
        this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions");
      }
      var computed = this.eat(types2.bracketL);
      if (computed || optional && this.type !== types2.parenL && this.type !== types2.backQuote || this.eat(types2.dot)) {
        var node = this.startNodeAt(startPos, startLoc);
        node.object = base22;
        node.property = computed ? this.parseExpression() : this.parseIdent(this.options.allowReserved !== "never");
        node.computed = !!computed;
        if (computed) {
          this.expect(types2.bracketR);
        }
        if (optionalSupported) {
          node.optional = optional;
        }
        base22 = this.finishNode(node, "MemberExpression");
      } else if (!noCalls && this.eat(types2.parenL)) {
        var refDestructuringErrors = new DestructuringErrors2(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
        this.yieldPos = 0;
        this.awaitPos = 0;
        this.awaitIdentPos = 0;
        var exprList = this.parseExprList(types2.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
        if (maybeAsyncArrow && !optional && !this.canInsertSemicolon() && this.eat(types2.arrow)) {
          this.checkPatternErrors(refDestructuringErrors, false);
          this.checkYieldAwaitInDefaultParams();
          if (this.awaitIdentPos > 0) {
            this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function");
          }
          this.yieldPos = oldYieldPos;
          this.awaitPos = oldAwaitPos;
          this.awaitIdentPos = oldAwaitIdentPos;
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true);
        }
        this.checkExpressionErrors(refDestructuringErrors, true);
        this.yieldPos = oldYieldPos || this.yieldPos;
        this.awaitPos = oldAwaitPos || this.awaitPos;
        this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
        var node$1 = this.startNodeAt(startPos, startLoc);
        node$1.callee = base22;
        node$1.arguments = exprList;
        if (optionalSupported) {
          node$1.optional = optional;
        }
        base22 = this.finishNode(node$1, "CallExpression");
      } else if (this.type === types2.backQuote) {
        if (optional || optionalChained) {
          this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
        }
        var node$2 = this.startNodeAt(startPos, startLoc);
        node$2.tag = base22;
        node$2.quasi = this.parseTemplate({ isTagged: true });
        base22 = this.finishNode(node$2, "TaggedTemplateExpression");
      }
      return base22;
    };
    pp$32.parseExprAtom = function(refDestructuringErrors) {
      if (this.type === types2.slash) {
        this.readRegexp();
      }
      var node, canBeArrow = this.potentialArrowAt === this.start;
      switch (this.type) {
        case types2._super:
          if (!this.allowSuper) {
            this.raise(this.start, "'super' keyword outside a method");
          }
          node = this.startNode();
          this.next();
          if (this.type === types2.parenL && !this.allowDirectSuper) {
            this.raise(node.start, "super() call outside constructor of a subclass");
          }
          if (this.type !== types2.dot && this.type !== types2.bracketL && this.type !== types2.parenL) {
            this.unexpected();
          }
          return this.finishNode(node, "Super");
        case types2._this:
          node = this.startNode();
          this.next();
          return this.finishNode(node, "ThisExpression");
        case types2.name:
          var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
          var id = this.parseIdent(false);
          if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(types2._function)) {
            return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true);
          }
          if (canBeArrow && !this.canInsertSemicolon()) {
            if (this.eat(types2.arrow)) {
              return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false);
            }
            if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === types2.name && !containsEsc) {
              id = this.parseIdent(false);
              if (this.canInsertSemicolon() || !this.eat(types2.arrow)) {
                this.unexpected();
              }
              return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true);
            }
          }
          return id;
        case types2.regexp:
          var value = this.value;
          node = this.parseLiteral(value.value);
          node.regex = { pattern: value.pattern, flags: value.flags };
          return node;
        case types2.num:
        case types2.string:
          return this.parseLiteral(this.value);
        case types2._null:
        case types2._true:
        case types2._false:
          node = this.startNode();
          node.value = this.type === types2._null ? null : this.type === types2._true;
          node.raw = this.type.keyword;
          this.next();
          return this.finishNode(node, "Literal");
        case types2.parenL:
          var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow);
          if (refDestructuringErrors) {
            if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr)) {
              refDestructuringErrors.parenthesizedAssign = start;
            }
            if (refDestructuringErrors.parenthesizedBind < 0) {
              refDestructuringErrors.parenthesizedBind = start;
            }
          }
          return expr;
        case types2.bracketL:
          node = this.startNode();
          this.next();
          node.elements = this.parseExprList(types2.bracketR, true, true, refDestructuringErrors);
          return this.finishNode(node, "ArrayExpression");
        case types2.braceL:
          return this.parseObj(false, refDestructuringErrors);
        case types2._function:
          node = this.startNode();
          this.next();
          return this.parseFunction(node, 0);
        case types2._class:
          return this.parseClass(this.startNode(), false);
        case types2._new:
          return this.parseNew();
        case types2.backQuote:
          return this.parseTemplate();
        case types2._import:
          if (this.options.ecmaVersion >= 11) {
            return this.parseExprImport();
          } else {
            return this.unexpected();
          }
        default:
          this.unexpected();
      }
    };
    pp$32.parseExprImport = function() {
      var node = this.startNode();
      if (this.containsEsc) {
        this.raiseRecoverable(this.start, "Escape sequence in keyword import");
      }
      var meta = this.parseIdent(true);
      switch (this.type) {
        case types2.parenL:
          return this.parseDynamicImport(node);
        case types2.dot:
          node.meta = meta;
          return this.parseImportMeta(node);
        default:
          this.unexpected();
      }
    };
    pp$32.parseDynamicImport = function(node) {
      this.next();
      node.source = this.parseMaybeAssign();
      if (!this.eat(types2.parenR)) {
        var errorPos = this.start;
        if (this.eat(types2.comma) && this.eat(types2.parenR)) {
          this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
        } else {
          this.unexpected(errorPos);
        }
      }
      return this.finishNode(node, "ImportExpression");
    };
    pp$32.parseImportMeta = function(node) {
      this.next();
      var containsEsc = this.containsEsc;
      node.property = this.parseIdent(true);
      if (node.property.name !== "meta") {
        this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'");
      }
      if (containsEsc) {
        this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters");
      }
      if (this.options.sourceType !== "module") {
        this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module");
      }
      return this.finishNode(node, "MetaProperty");
    };
    pp$32.parseLiteral = function(value) {
      var node = this.startNode();
      node.value = value;
      node.raw = this.input.slice(this.start, this.end);
      if (node.raw.charCodeAt(node.raw.length - 1) === 110) {
        node.bigint = node.raw.slice(0, -1).replace(/_/g, "");
      }
      this.next();
      return this.finishNode(node, "Literal");
    };
    pp$32.parseParenExpression = function() {
      this.expect(types2.parenL);
      var val = this.parseExpression();
      this.expect(types2.parenR);
      return val;
    };
    pp$32.parseParenAndDistinguishExpression = function(canBeArrow) {
      var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
      if (this.options.ecmaVersion >= 6) {
        this.next();
        var innerStartPos = this.start, innerStartLoc = this.startLoc;
        var exprList = [], first2 = true, lastIsComma = false;
        var refDestructuringErrors = new DestructuringErrors2(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
        this.yieldPos = 0;
        this.awaitPos = 0;
        while (this.type !== types2.parenR) {
          first2 ? first2 = false : this.expect(types2.comma);
          if (allowTrailingComma && this.afterTrailingComma(types2.parenR, true)) {
            lastIsComma = true;
            break;
          } else if (this.type === types2.ellipsis) {
            spreadStart = this.start;
            exprList.push(this.parseParenItem(this.parseRestBinding()));
            if (this.type === types2.comma) {
              this.raise(this.start, "Comma is not permitted after the rest element");
            }
            break;
          } else {
            exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
          }
        }
        var innerEndPos = this.start, innerEndLoc = this.startLoc;
        this.expect(types2.parenR);
        if (canBeArrow && !this.canInsertSemicolon() && this.eat(types2.arrow)) {
          this.checkPatternErrors(refDestructuringErrors, false);
          this.checkYieldAwaitInDefaultParams();
          this.yieldPos = oldYieldPos;
          this.awaitPos = oldAwaitPos;
          return this.parseParenArrowList(startPos, startLoc, exprList);
        }
        if (!exprList.length || lastIsComma) {
          this.unexpected(this.lastTokStart);
        }
        if (spreadStart) {
          this.unexpected(spreadStart);
        }
        this.checkExpressionErrors(refDestructuringErrors, true);
        this.yieldPos = oldYieldPos || this.yieldPos;
        this.awaitPos = oldAwaitPos || this.awaitPos;
        if (exprList.length > 1) {
          val = this.startNodeAt(innerStartPos, innerStartLoc);
          val.expressions = exprList;
          this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
        } else {
          val = exprList[0];
        }
      } else {
        val = this.parseParenExpression();
      }
      if (this.options.preserveParens) {
        var par = this.startNodeAt(startPos, startLoc);
        par.expression = val;
        return this.finishNode(par, "ParenthesizedExpression");
      } else {
        return val;
      }
    };
    pp$32.parseParenItem = function(item) {
      return item;
    };
    pp$32.parseParenArrowList = function(startPos, startLoc, exprList) {
      return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList);
    };
    var empty$12 = [];
    pp$32.parseNew = function() {
      if (this.containsEsc) {
        this.raiseRecoverable(this.start, "Escape sequence in keyword new");
      }
      var node = this.startNode();
      var meta = this.parseIdent(true);
      if (this.options.ecmaVersion >= 6 && this.eat(types2.dot)) {
        node.meta = meta;
        var containsEsc = this.containsEsc;
        node.property = this.parseIdent(true);
        if (node.property.name !== "target") {
          this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'");
        }
        if (containsEsc) {
          this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters");
        }
        if (!this.inNonArrowFunction()) {
          this.raiseRecoverable(node.start, "'new.target' can only be used in functions");
        }
        return this.finishNode(node, "MetaProperty");
      }
      var startPos = this.start, startLoc = this.startLoc, isImport = this.type === types2._import;
      node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
      if (isImport && node.callee.type === "ImportExpression") {
        this.raise(startPos, "Cannot use new with import()");
      }
      if (this.eat(types2.parenL)) {
        node.arguments = this.parseExprList(types2.parenR, this.options.ecmaVersion >= 8, false);
      } else {
        node.arguments = empty$12;
      }
      return this.finishNode(node, "NewExpression");
    };
    pp$32.parseTemplateElement = function(ref22) {
      var isTagged = ref22.isTagged;
      var elem = this.startNode();
      if (this.type === types2.invalidTemplate) {
        if (!isTagged) {
          this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
        }
        elem.value = {
          raw: this.value,
          cooked: null
        };
      } else {
        elem.value = {
          raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
          cooked: this.value
        };
      }
      this.next();
      elem.tail = this.type === types2.backQuote;
      return this.finishNode(elem, "TemplateElement");
    };
    pp$32.parseTemplate = function(ref22) {
      if (ref22 === void 0)
        ref22 = {};
      var isTagged = ref22.isTagged;
      if (isTagged === void 0)
        isTagged = false;
      var node = this.startNode();
      this.next();
      node.expressions = [];
      var curElt = this.parseTemplateElement({ isTagged });
      node.quasis = [curElt];
      while (!curElt.tail) {
        if (this.type === types2.eof) {
          this.raise(this.pos, "Unterminated template literal");
        }
        this.expect(types2.dollarBraceL);
        node.expressions.push(this.parseExpression());
        this.expect(types2.braceR);
        node.quasis.push(curElt = this.parseTemplateElement({ isTagged }));
      }
      this.next();
      return this.finishNode(node, "TemplateLiteral");
    };
    pp$32.isAsyncProp = function(prop) {
      return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" && (this.type === types2.name || this.type === types2.num || this.type === types2.string || this.type === types2.bracketL || this.type.keyword || this.options.ecmaVersion >= 9 && this.type === types2.star) && !lineBreak2.test(this.input.slice(this.lastTokEnd, this.start));
    };
    pp$32.parseObj = function(isPattern, refDestructuringErrors) {
      var node = this.startNode(), first2 = true, propHash = {};
      node.properties = [];
      this.next();
      while (!this.eat(types2.braceR)) {
        if (!first2) {
          this.expect(types2.comma);
          if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types2.braceR)) {
            break;
          }
        } else {
          first2 = false;
        }
        var prop = this.parseProperty(isPattern, refDestructuringErrors);
        if (!isPattern) {
          this.checkPropClash(prop, propHash, refDestructuringErrors);
        }
        node.properties.push(prop);
      }
      return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
    };
    pp$32.parseProperty = function(isPattern, refDestructuringErrors) {
      var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
      if (this.options.ecmaVersion >= 9 && this.eat(types2.ellipsis)) {
        if (isPattern) {
          prop.argument = this.parseIdent(false);
          if (this.type === types2.comma) {
            this.raise(this.start, "Comma is not permitted after the rest element");
          }
          return this.finishNode(prop, "RestElement");
        }
        if (this.type === types2.parenL && refDestructuringErrors) {
          if (refDestructuringErrors.parenthesizedAssign < 0) {
            refDestructuringErrors.parenthesizedAssign = this.start;
          }
          if (refDestructuringErrors.parenthesizedBind < 0) {
            refDestructuringErrors.parenthesizedBind = this.start;
          }
        }
        prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
        if (this.type === types2.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
          refDestructuringErrors.trailingComma = this.start;
        }
        return this.finishNode(prop, "SpreadElement");
      }
      if (this.options.ecmaVersion >= 6) {
        prop.method = false;
        prop.shorthand = false;
        if (isPattern || refDestructuringErrors) {
          startPos = this.start;
          startLoc = this.startLoc;
        }
        if (!isPattern) {
          isGenerator = this.eat(types2.star);
        }
      }
      var containsEsc = this.containsEsc;
      this.parsePropertyName(prop);
      if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
        isAsync = true;
        isGenerator = this.options.ecmaVersion >= 9 && this.eat(types2.star);
        this.parsePropertyName(prop, refDestructuringErrors);
      } else {
        isAsync = false;
      }
      this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
      return this.finishNode(prop, "Property");
    };
    pp$32.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
      if ((isGenerator || isAsync) && this.type === types2.colon) {
        this.unexpected();
      }
      if (this.eat(types2.colon)) {
        prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
        prop.kind = "init";
      } else if (this.options.ecmaVersion >= 6 && this.type === types2.parenL) {
        if (isPattern) {
          this.unexpected();
        }
        prop.kind = "init";
        prop.method = true;
        prop.value = this.parseMethod(isGenerator, isAsync);
      } else if (!isPattern && !containsEsc && this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type !== types2.comma && this.type !== types2.braceR && this.type !== types2.eq)) {
        if (isGenerator || isAsync) {
          this.unexpected();
        }
        prop.kind = prop.key.name;
        this.parsePropertyName(prop);
        prop.value = this.parseMethod(false);
        var paramCount = prop.kind === "get" ? 0 : 1;
        if (prop.value.params.length !== paramCount) {
          var start = prop.value.start;
          if (prop.kind === "get") {
            this.raiseRecoverable(start, "getter should have no params");
          } else {
            this.raiseRecoverable(start, "setter should have exactly one param");
          }
        } else {
          if (prop.kind === "set" && prop.value.params[0].type === "RestElement") {
            this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params");
          }
        }
      } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
        if (isGenerator || isAsync) {
          this.unexpected();
        }
        this.checkUnreserved(prop.key);
        if (prop.key.name === "await" && !this.awaitIdentPos) {
          this.awaitIdentPos = startPos;
        }
        prop.kind = "init";
        if (isPattern) {
          prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
        } else if (this.type === types2.eq && refDestructuringErrors) {
          if (refDestructuringErrors.shorthandAssign < 0) {
            refDestructuringErrors.shorthandAssign = this.start;
          }
          prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
        } else {
          prop.value = prop.key;
        }
        prop.shorthand = true;
      } else {
        this.unexpected();
      }
    };
    pp$32.parsePropertyName = function(prop) {
      if (this.options.ecmaVersion >= 6) {
        if (this.eat(types2.bracketL)) {
          prop.computed = true;
          prop.key = this.parseMaybeAssign();
          this.expect(types2.bracketR);
          return prop.key;
        } else {
          prop.computed = false;
        }
      }
      return prop.key = this.type === types2.num || this.type === types2.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
    };
    pp$32.initFunction = function(node) {
      node.id = null;
      if (this.options.ecmaVersion >= 6) {
        node.generator = node.expression = false;
      }
      if (this.options.ecmaVersion >= 8) {
        node.async = false;
      }
    };
    pp$32.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
      var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
      this.initFunction(node);
      if (this.options.ecmaVersion >= 6) {
        node.generator = isGenerator;
      }
      if (this.options.ecmaVersion >= 8) {
        node.async = !!isAsync;
      }
      this.yieldPos = 0;
      this.awaitPos = 0;
      this.awaitIdentPos = 0;
      this.enterScope(functionFlags2(isAsync, node.generator) | SCOPE_SUPER2 | (allowDirectSuper ? SCOPE_DIRECT_SUPER2 : 0));
      this.expect(types2.parenL);
      node.params = this.parseBindingList(types2.parenR, false, this.options.ecmaVersion >= 8);
      this.checkYieldAwaitInDefaultParams();
      this.parseFunctionBody(node, false, true);
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      this.awaitIdentPos = oldAwaitIdentPos;
      return this.finishNode(node, "FunctionExpression");
    };
    pp$32.parseArrowExpression = function(node, params, isAsync) {
      var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
      this.enterScope(functionFlags2(isAsync, false) | SCOPE_ARROW2);
      this.initFunction(node);
      if (this.options.ecmaVersion >= 8) {
        node.async = !!isAsync;
      }
      this.yieldPos = 0;
      this.awaitPos = 0;
      this.awaitIdentPos = 0;
      node.params = this.toAssignableList(params, true);
      this.parseFunctionBody(node, true, false);
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      this.awaitIdentPos = oldAwaitIdentPos;
      return this.finishNode(node, "ArrowFunctionExpression");
    };
    pp$32.parseFunctionBody = function(node, isArrowFunction, isMethod) {
      var isExpression = isArrowFunction && this.type !== types2.braceL;
      var oldStrict = this.strict, useStrict = false;
      if (isExpression) {
        node.body = this.parseMaybeAssign();
        node.expression = true;
        this.checkParams(node, false);
      } else {
        var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
        if (!oldStrict || nonSimple) {
          useStrict = this.strictDirective(this.end);
          if (useStrict && nonSimple) {
            this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list");
          }
        }
        var oldLabels = this.labels;
        this.labels = [];
        if (useStrict) {
          this.strict = true;
        }
        this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
        if (this.strict && node.id) {
          this.checkLVal(node.id, BIND_OUTSIDE2);
        }
        node.body = this.parseBlock(false, void 0, useStrict && !oldStrict);
        node.expression = false;
        this.adaptDirectivePrologue(node.body.body);
        this.labels = oldLabels;
      }
      this.exitScope();
    };
    pp$32.isSimpleParamList = function(params) {
      for (var i2 = 0, list = params; i2 < list.length; i2 += 1) {
        var param = list[i2];
        if (param.type !== "Identifier") {
          return false;
        }
      }
      return true;
    };
    pp$32.checkParams = function(node, allowDuplicates) {
      var nameHash = {};
      for (var i2 = 0, list = node.params; i2 < list.length; i2 += 1) {
        var param = list[i2];
        this.checkLVal(param, BIND_VAR2, allowDuplicates ? null : nameHash);
      }
    };
    pp$32.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
      var elts = [], first2 = true;
      while (!this.eat(close)) {
        if (!first2) {
          this.expect(types2.comma);
          if (allowTrailingComma && this.afterTrailingComma(close)) {
            break;
          }
        } else {
          first2 = false;
        }
        var elt = void 0;
        if (allowEmpty && this.type === types2.comma) {
          elt = null;
        } else if (this.type === types2.ellipsis) {
          elt = this.parseSpread(refDestructuringErrors);
          if (refDestructuringErrors && this.type === types2.comma && refDestructuringErrors.trailingComma < 0) {
            refDestructuringErrors.trailingComma = this.start;
          }
        } else {
          elt = this.parseMaybeAssign(false, refDestructuringErrors);
        }
        elts.push(elt);
      }
      return elts;
    };
    pp$32.checkUnreserved = function(ref22) {
      var start = ref22.start;
      var end = ref22.end;
      var name = ref22.name;
      if (this.inGenerator && name === "yield") {
        this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator");
      }
      if (this.inAsync && name === "await") {
        this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function");
      }
      if (this.keywords.test(name)) {
        this.raise(start, "Unexpected keyword '" + name + "'");
      }
      if (this.options.ecmaVersion < 6 && this.input.slice(start, end).indexOf("\\") !== -1) {
        return;
      }
      var re2 = this.strict ? this.reservedWordsStrict : this.reservedWords;
      if (re2.test(name)) {
        if (!this.inAsync && name === "await") {
          this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function");
        }
        this.raiseRecoverable(start, "The keyword '" + name + "' is reserved");
      }
    };
    pp$32.parseIdent = function(liberal, isBinding) {
      var node = this.startNode();
      if (this.type === types2.name) {
        node.name = this.value;
      } else if (this.type.keyword) {
        node.name = this.type.keyword;
        if ((node.name === "class" || node.name === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
          this.context.pop();
        }
      } else {
        this.unexpected();
      }
      this.next(!!liberal);
      this.finishNode(node, "Identifier");
      if (!liberal) {
        this.checkUnreserved(node);
        if (node.name === "await" && !this.awaitIdentPos) {
          this.awaitIdentPos = node.start;
        }
      }
      return node;
    };
    pp$32.parseYield = function(noIn) {
      if (!this.yieldPos) {
        this.yieldPos = this.start;
      }
      var node = this.startNode();
      this.next();
      if (this.type === types2.semi || this.canInsertSemicolon() || this.type !== types2.star && !this.type.startsExpr) {
        node.delegate = false;
        node.argument = null;
      } else {
        node.delegate = this.eat(types2.star);
        node.argument = this.parseMaybeAssign(noIn);
      }
      return this.finishNode(node, "YieldExpression");
    };
    pp$32.parseAwait = function() {
      if (!this.awaitPos) {
        this.awaitPos = this.start;
      }
      var node = this.startNode();
      this.next();
      node.argument = this.parseMaybeUnary(null, false);
      return this.finishNode(node, "AwaitExpression");
    };
    var pp$42 = Parser3.prototype;
    pp$42.raise = function(pos, message) {
      var loc = getLineInfo2(this.input, pos);
      message += " (" + loc.line + ":" + loc.column + ")";
      var err = new SyntaxError(message);
      err.pos = pos;
      err.loc = loc;
      err.raisedAt = this.pos;
      throw err;
    };
    pp$42.raiseRecoverable = pp$42.raise;
    pp$42.curPosition = function() {
      if (this.options.locations) {
        return new Position3(this.curLine, this.pos - this.lineStart);
      }
    };
    var pp$52 = Parser3.prototype;
    var Scope3 = function Scope22(flags) {
      this.flags = flags;
      this.var = [];
      this.lexical = [];
      this.functions = [];
    };
    pp$52.enterScope = function(flags) {
      this.scopeStack.push(new Scope3(flags));
    };
    pp$52.exitScope = function() {
      this.scopeStack.pop();
    };
    pp$52.treatFunctionsAsVarInScope = function(scope) {
      return scope.flags & SCOPE_FUNCTION3 || !this.inModule && scope.flags & SCOPE_TOP2;
    };
    pp$52.declareName = function(name, bindingType, pos) {
      var redeclared = false;
      if (bindingType === BIND_LEXICAL2) {
        var scope = this.currentScope();
        redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
        scope.lexical.push(name);
        if (this.inModule && scope.flags & SCOPE_TOP2) {
          delete this.undefinedExports[name];
        }
      } else if (bindingType === BIND_SIMPLE_CATCH2) {
        var scope$1 = this.currentScope();
        scope$1.lexical.push(name);
      } else if (bindingType === BIND_FUNCTION2) {
        var scope$2 = this.currentScope();
        if (this.treatFunctionsAsVar) {
          redeclared = scope$2.lexical.indexOf(name) > -1;
        } else {
          redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1;
        }
        scope$2.functions.push(name);
      } else {
        for (var i2 = this.scopeStack.length - 1; i2 >= 0; --i2) {
          var scope$3 = this.scopeStack[i2];
          if (scope$3.lexical.indexOf(name) > -1 && !(scope$3.flags & SCOPE_SIMPLE_CATCH2 && scope$3.lexical[0] === name) || !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
            redeclared = true;
            break;
          }
          scope$3.var.push(name);
          if (this.inModule && scope$3.flags & SCOPE_TOP2) {
            delete this.undefinedExports[name];
          }
          if (scope$3.flags & SCOPE_VAR2) {
            break;
          }
        }
      }
      if (redeclared) {
        this.raiseRecoverable(pos, "Identifier '" + name + "' has already been declared");
      }
    };
    pp$52.checkLocalExport = function(id) {
      if (this.scopeStack[0].lexical.indexOf(id.name) === -1 && this.scopeStack[0].var.indexOf(id.name) === -1) {
        this.undefinedExports[id.name] = id;
      }
    };
    pp$52.currentScope = function() {
      return this.scopeStack[this.scopeStack.length - 1];
    };
    pp$52.currentVarScope = function() {
      for (var i2 = this.scopeStack.length - 1; ; i2--) {
        var scope = this.scopeStack[i2];
        if (scope.flags & SCOPE_VAR2) {
          return scope;
        }
      }
    };
    pp$52.currentThisScope = function() {
      for (var i2 = this.scopeStack.length - 1; ; i2--) {
        var scope = this.scopeStack[i2];
        if (scope.flags & SCOPE_VAR2 && !(scope.flags & SCOPE_ARROW2)) {
          return scope;
        }
      }
    };
    var Node3 = function Node23(parser2, pos, loc) {
      this.type = "";
      this.start = pos;
      this.end = 0;
      if (parser2.options.locations) {
        this.loc = new SourceLocation3(parser2, loc);
      }
      if (parser2.options.directSourceFile) {
        this.sourceFile = parser2.options.directSourceFile;
      }
      if (parser2.options.ranges) {
        this.range = [pos, 0];
      }
    };
    var pp$62 = Parser3.prototype;
    pp$62.startNode = function() {
      return new Node3(this, this.start, this.startLoc);
    };
    pp$62.startNodeAt = function(pos, loc) {
      return new Node3(this, pos, loc);
    };
    function finishNodeAt2(node, type, pos, loc) {
      node.type = type;
      node.end = pos;
      if (this.options.locations) {
        node.loc.end = loc;
      }
      if (this.options.ranges) {
        node.range[1] = pos;
      }
      return node;
    }
    pp$62.finishNode = function(node, type) {
      return finishNodeAt2.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
    };
    pp$62.finishNodeAt = function(node, type, pos, loc) {
      return finishNodeAt2.call(this, node, type, pos, loc);
    };
    var TokContext3 = function TokContext22(token, isExpr, preserveSpace, override, generator) {
      this.token = token;
      this.isExpr = !!isExpr;
      this.preserveSpace = !!preserveSpace;
      this.override = override;
      this.generator = !!generator;
    };
    var types$12 = {
      b_stat: new TokContext3("{", false),
      b_expr: new TokContext3("{", true),
      b_tmpl: new TokContext3("${", false),
      p_stat: new TokContext3("(", false),
      p_expr: new TokContext3("(", true),
      q_tmpl: new TokContext3("`", true, true, function(p2) {
        return p2.tryReadTemplateToken();
      }),
      f_stat: new TokContext3("function", false),
      f_expr: new TokContext3("function", true),
      f_expr_gen: new TokContext3("function", true, false, null, true),
      f_gen: new TokContext3("function", false, false, null, true)
    };
    var pp$72 = Parser3.prototype;
    pp$72.initialContext = function() {
      return [types$12.b_stat];
    };
    pp$72.braceIsBlock = function(prevType) {
      var parent = this.curContext();
      if (parent === types$12.f_expr || parent === types$12.f_stat) {
        return true;
      }
      if (prevType === types2.colon && (parent === types$12.b_stat || parent === types$12.b_expr)) {
        return !parent.isExpr;
      }
      if (prevType === types2._return || prevType === types2.name && this.exprAllowed) {
        return lineBreak2.test(this.input.slice(this.lastTokEnd, this.start));
      }
      if (prevType === types2._else || prevType === types2.semi || prevType === types2.eof || prevType === types2.parenR || prevType === types2.arrow) {
        return true;
      }
      if (prevType === types2.braceL) {
        return parent === types$12.b_stat;
      }
      if (prevType === types2._var || prevType === types2._const || prevType === types2.name) {
        return false;
      }
      return !this.exprAllowed;
    };
    pp$72.inGeneratorContext = function() {
      for (var i2 = this.context.length - 1; i2 >= 1; i2--) {
        var context = this.context[i2];
        if (context.token === "function") {
          return context.generator;
        }
      }
      return false;
    };
    pp$72.updateContext = function(prevType) {
      var update, type = this.type;
      if (type.keyword && prevType === types2.dot) {
        this.exprAllowed = false;
      } else if (update = type.updateContext) {
        update.call(this, prevType);
      } else {
        this.exprAllowed = type.beforeExpr;
      }
    };
    types2.parenR.updateContext = types2.braceR.updateContext = function() {
      if (this.context.length === 1) {
        this.exprAllowed = true;
        return;
      }
      var out = this.context.pop();
      if (out === types$12.b_stat && this.curContext().token === "function") {
        out = this.context.pop();
      }
      this.exprAllowed = !out.isExpr;
    };
    types2.braceL.updateContext = function(prevType) {
      this.context.push(this.braceIsBlock(prevType) ? types$12.b_stat : types$12.b_expr);
      this.exprAllowed = true;
    };
    types2.dollarBraceL.updateContext = function() {
      this.context.push(types$12.b_tmpl);
      this.exprAllowed = true;
    };
    types2.parenL.updateContext = function(prevType) {
      var statementParens = prevType === types2._if || prevType === types2._for || prevType === types2._with || prevType === types2._while;
      this.context.push(statementParens ? types$12.p_stat : types$12.p_expr);
      this.exprAllowed = true;
    };
    types2.incDec.updateContext = function() {
    };
    types2._function.updateContext = types2._class.updateContext = function(prevType) {
      if (prevType.beforeExpr && prevType !== types2.semi && prevType !== types2._else && !(prevType === types2._return && lineBreak2.test(this.input.slice(this.lastTokEnd, this.start))) && !((prevType === types2.colon || prevType === types2.braceL) && this.curContext() === types$12.b_stat)) {
        this.context.push(types$12.f_expr);
      } else {
        this.context.push(types$12.f_stat);
      }
      this.exprAllowed = false;
    };
    types2.backQuote.updateContext = function() {
      if (this.curContext() === types$12.q_tmpl) {
        this.context.pop();
      } else {
        this.context.push(types$12.q_tmpl);
      }
      this.exprAllowed = false;
    };
    types2.star.updateContext = function(prevType) {
      if (prevType === types2._function) {
        var index2 = this.context.length - 1;
        if (this.context[index2] === types$12.f_expr) {
          this.context[index2] = types$12.f_expr_gen;
        } else {
          this.context[index2] = types$12.f_gen;
        }
      }
      this.exprAllowed = true;
    };
    types2.name.updateContext = function(prevType) {
      var allowed = false;
      if (this.options.ecmaVersion >= 6 && prevType !== types2.dot) {
        if (this.value === "of" && !this.exprAllowed || this.value === "yield" && this.inGeneratorContext()) {
          allowed = true;
        }
      }
      this.exprAllowed = allowed;
    };
    var ecma9BinaryProperties2 = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
    var ecma10BinaryProperties2 = ecma9BinaryProperties2 + " Extended_Pictographic";
    var ecma11BinaryProperties2 = ecma10BinaryProperties2;
    var unicodeBinaryProperties2 = {
      9: ecma9BinaryProperties2,
      10: ecma10BinaryProperties2,
      11: ecma11BinaryProperties2
    };
    var unicodeGeneralCategoryValues2 = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";
    var ecma9ScriptValues2 = "Adlam Adlm Ahom Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
    var ecma10ScriptValues2 = ecma9ScriptValues2 + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
    var ecma11ScriptValues2 = ecma10ScriptValues2 + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
    var unicodeScriptValues2 = {
      9: ecma9ScriptValues2,
      10: ecma10ScriptValues2,
      11: ecma11ScriptValues2
    };
    var data2 = {};
    function buildUnicodeData2(ecmaVersion) {
      var d2 = data2[ecmaVersion] = {
        binary: wordsRegexp2(unicodeBinaryProperties2[ecmaVersion] + " " + unicodeGeneralCategoryValues2),
        nonBinary: {
          General_Category: wordsRegexp2(unicodeGeneralCategoryValues2),
          Script: wordsRegexp2(unicodeScriptValues2[ecmaVersion])
        }
      };
      d2.nonBinary.Script_Extensions = d2.nonBinary.Script;
      d2.nonBinary.gc = d2.nonBinary.General_Category;
      d2.nonBinary.sc = d2.nonBinary.Script;
      d2.nonBinary.scx = d2.nonBinary.Script_Extensions;
    }
    buildUnicodeData2(9);
    buildUnicodeData2(10);
    buildUnicodeData2(11);
    var pp$82 = Parser3.prototype;
    var RegExpValidationState3 = function RegExpValidationState22(parser2) {
      this.parser = parser2;
      this.validFlags = "gim" + (parser2.options.ecmaVersion >= 6 ? "uy" : "") + (parser2.options.ecmaVersion >= 9 ? "s" : "");
      this.unicodeProperties = data2[parser2.options.ecmaVersion >= 11 ? 11 : parser2.options.ecmaVersion];
      this.source = "";
      this.flags = "";
      this.start = 0;
      this.switchU = false;
      this.switchN = false;
      this.pos = 0;
      this.lastIntValue = 0;
      this.lastStringValue = "";
      this.lastAssertionIsQuantifiable = false;
      this.numCapturingParens = 0;
      this.maxBackReference = 0;
      this.groupNames = [];
      this.backReferenceNames = [];
    };
    RegExpValidationState3.prototype.reset = function reset2(start, pattern, flags) {
      var unicode = flags.indexOf("u") !== -1;
      this.start = start | 0;
      this.source = pattern + "";
      this.flags = flags;
      this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
      this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
    };
    RegExpValidationState3.prototype.raise = function raise2(message) {
      this.parser.raiseRecoverable(this.start, "Invalid regular expression: /" + this.source + "/: " + message);
    };
    RegExpValidationState3.prototype.at = function at2(i2, forceU) {
      if (forceU === void 0)
        forceU = false;
      var s2 = this.source;
      var l2 = s2.length;
      if (i2 >= l2) {
        return -1;
      }
      var c2 = s2.charCodeAt(i2);
      if (!(forceU || this.switchU) || c2 <= 55295 || c2 >= 57344 || i2 + 1 >= l2) {
        return c2;
      }
      var next = s2.charCodeAt(i2 + 1);
      return next >= 56320 && next <= 57343 ? (c2 << 10) + next - 56613888 : c2;
    };
    RegExpValidationState3.prototype.nextIndex = function nextIndex2(i2, forceU) {
      if (forceU === void 0)
        forceU = false;
      var s2 = this.source;
      var l2 = s2.length;
      if (i2 >= l2) {
        return l2;
      }
      var c2 = s2.charCodeAt(i2), next;
      if (!(forceU || this.switchU) || c2 <= 55295 || c2 >= 57344 || i2 + 1 >= l2 || (next = s2.charCodeAt(i2 + 1)) < 56320 || next > 57343) {
        return i2 + 1;
      }
      return i2 + 2;
    };
    RegExpValidationState3.prototype.current = function current2(forceU) {
      if (forceU === void 0)
        forceU = false;
      return this.at(this.pos, forceU);
    };
    RegExpValidationState3.prototype.lookahead = function lookahead2(forceU) {
      if (forceU === void 0)
        forceU = false;
      return this.at(this.nextIndex(this.pos, forceU), forceU);
    };
    RegExpValidationState3.prototype.advance = function advance2(forceU) {
      if (forceU === void 0)
        forceU = false;
      this.pos = this.nextIndex(this.pos, forceU);
    };
    RegExpValidationState3.prototype.eat = function eat2(ch, forceU) {
      if (forceU === void 0)
        forceU = false;
      if (this.current(forceU) === ch) {
        this.advance(forceU);
        return true;
      }
      return false;
    };
    function codePointToString2(ch) {
      if (ch <= 65535) {
        return String.fromCharCode(ch);
      }
      ch -= 65536;
      return String.fromCharCode((ch >> 10) + 55296, (ch & 1023) + 56320);
    }
    pp$82.validateRegExpFlags = function(state) {
      var validFlags = state.validFlags;
      var flags = state.flags;
      for (var i2 = 0; i2 < flags.length; i2++) {
        var flag = flags.charAt(i2);
        if (validFlags.indexOf(flag) === -1) {
          this.raise(state.start, "Invalid regular expression flag");
        }
        if (flags.indexOf(flag, i2 + 1) > -1) {
          this.raise(state.start, "Duplicate regular expression flag");
        }
      }
    };
    pp$82.validateRegExpPattern = function(state) {
      this.regexp_pattern(state);
      if (!state.switchN && this.options.ecmaVersion >= 9 && state.groupNames.length > 0) {
        state.switchN = true;
        this.regexp_pattern(state);
      }
    };
    pp$82.regexp_pattern = function(state) {
      state.pos = 0;
      state.lastIntValue = 0;
      state.lastStringValue = "";
      state.lastAssertionIsQuantifiable = false;
      state.numCapturingParens = 0;
      state.maxBackReference = 0;
      state.groupNames.length = 0;
      state.backReferenceNames.length = 0;
      this.regexp_disjunction(state);
      if (state.pos !== state.source.length) {
        if (state.eat(41)) {
          state.raise("Unmatched ')'");
        }
        if (state.eat(93) || state.eat(125)) {
          state.raise("Lone quantifier brackets");
        }
      }
      if (state.maxBackReference > state.numCapturingParens) {
        state.raise("Invalid escape");
      }
      for (var i2 = 0, list = state.backReferenceNames; i2 < list.length; i2 += 1) {
        var name = list[i2];
        if (state.groupNames.indexOf(name) === -1) {
          state.raise("Invalid named capture referenced");
        }
      }
    };
    pp$82.regexp_disjunction = function(state) {
      this.regexp_alternative(state);
      while (state.eat(124)) {
        this.regexp_alternative(state);
      }
      if (this.regexp_eatQuantifier(state, true)) {
        state.raise("Nothing to repeat");
      }
      if (state.eat(123)) {
        state.raise("Lone quantifier brackets");
      }
    };
    pp$82.regexp_alternative = function(state) {
      while (state.pos < state.source.length && this.regexp_eatTerm(state)) {
      }
    };
    pp$82.regexp_eatTerm = function(state) {
      if (this.regexp_eatAssertion(state)) {
        if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
          if (state.switchU) {
            state.raise("Invalid quantifier");
          }
        }
        return true;
      }
      if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
        this.regexp_eatQuantifier(state);
        return true;
      }
      return false;
    };
    pp$82.regexp_eatAssertion = function(state) {
      var start = state.pos;
      state.lastAssertionIsQuantifiable = false;
      if (state.eat(94) || state.eat(36)) {
        return true;
      }
      if (state.eat(92)) {
        if (state.eat(66) || state.eat(98)) {
          return true;
        }
        state.pos = start;
      }
      if (state.eat(40) && state.eat(63)) {
        var lookbehind = false;
        if (this.options.ecmaVersion >= 9) {
          lookbehind = state.eat(60);
        }
        if (state.eat(61) || state.eat(33)) {
          this.regexp_disjunction(state);
          if (!state.eat(41)) {
            state.raise("Unterminated group");
          }
          state.lastAssertionIsQuantifiable = !lookbehind;
          return true;
        }
      }
      state.pos = start;
      return false;
    };
    pp$82.regexp_eatQuantifier = function(state, noError) {
      if (noError === void 0)
        noError = false;
      if (this.regexp_eatQuantifierPrefix(state, noError)) {
        state.eat(63);
        return true;
      }
      return false;
    };
    pp$82.regexp_eatQuantifierPrefix = function(state, noError) {
      return state.eat(42) || state.eat(43) || state.eat(63) || this.regexp_eatBracedQuantifier(state, noError);
    };
    pp$82.regexp_eatBracedQuantifier = function(state, noError) {
      var start = state.pos;
      if (state.eat(123)) {
        var min = 0, max = -1;
        if (this.regexp_eatDecimalDigits(state)) {
          min = state.lastIntValue;
          if (state.eat(44) && this.regexp_eatDecimalDigits(state)) {
            max = state.lastIntValue;
          }
          if (state.eat(125)) {
            if (max !== -1 && max < min && !noError) {
              state.raise("numbers out of order in {} quantifier");
            }
            return true;
          }
        }
        if (state.switchU && !noError) {
          state.raise("Incomplete quantifier");
        }
        state.pos = start;
      }
      return false;
    };
    pp$82.regexp_eatAtom = function(state) {
      return this.regexp_eatPatternCharacters(state) || state.eat(46) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state);
    };
    pp$82.regexp_eatReverseSolidusAtomEscape = function(state) {
      var start = state.pos;
      if (state.eat(92)) {
        if (this.regexp_eatAtomEscape(state)) {
          return true;
        }
        state.pos = start;
      }
      return false;
    };
    pp$82.regexp_eatUncapturingGroup = function(state) {
      var start = state.pos;
      if (state.eat(40)) {
        if (state.eat(63) && state.eat(58)) {
          this.regexp_disjunction(state);
          if (state.eat(41)) {
            return true;
          }
          state.raise("Unterminated group");
        }
        state.pos = start;
      }
      return false;
    };
    pp$82.regexp_eatCapturingGroup = function(state) {
      if (state.eat(40)) {
        if (this.options.ecmaVersion >= 9) {
          this.regexp_groupSpecifier(state);
        } else if (state.current() === 63) {
          state.raise("Invalid group");
        }
        this.regexp_disjunction(state);
        if (state.eat(41)) {
          state.numCapturingParens += 1;
          return true;
        }
        state.raise("Unterminated group");
      }
      return false;
    };
    pp$82.regexp_eatExtendedAtom = function(state) {
      return state.eat(46) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state) || this.regexp_eatInvalidBracedQuantifier(state) || this.regexp_eatExtendedPatternCharacter(state);
    };
    pp$82.regexp_eatInvalidBracedQuantifier = function(state) {
      if (this.regexp_eatBracedQuantifier(state, true)) {
        state.raise("Nothing to repeat");
      }
      return false;
    };
    pp$82.regexp_eatSyntaxCharacter = function(state) {
      var ch = state.current();
      if (isSyntaxCharacter2(ch)) {
        state.lastIntValue = ch;
        state.advance();
        return true;
      }
      return false;
    };
    function isSyntaxCharacter2(ch) {
      return ch === 36 || ch >= 40 && ch <= 43 || ch === 46 || ch === 63 || ch >= 91 && ch <= 94 || ch >= 123 && ch <= 125;
    }
    pp$82.regexp_eatPatternCharacters = function(state) {
      var start = state.pos;
      var ch = 0;
      while ((ch = state.current()) !== -1 && !isSyntaxCharacter2(ch)) {
        state.advance();
      }
      return state.pos !== start;
    };
    pp$82.regexp_eatExtendedPatternCharacter = function(state) {
      var ch = state.current();
      if (ch !== -1 && ch !== 36 && !(ch >= 40 && ch <= 43) && ch !== 46 && ch !== 63 && ch !== 91 && ch !== 94 && ch !== 124) {
        state.advance();
        return true;
      }
      return false;
    };
    pp$82.regexp_groupSpecifier = function(state) {
      if (state.eat(63)) {
        if (this.regexp_eatGroupName(state)) {
          if (state.groupNames.indexOf(state.lastStringValue) !== -1) {
            state.raise("Duplicate capture group name");
          }
          state.groupNames.push(state.lastStringValue);
          return;
        }
        state.raise("Invalid group");
      }
    };
    pp$82.regexp_eatGroupName = function(state) {
      state.lastStringValue = "";
      if (state.eat(60)) {
        if (this.regexp_eatRegExpIdentifierName(state) && state.eat(62)) {
          return true;
        }
        state.raise("Invalid capture group name");
      }
      return false;
    };
    pp$82.regexp_eatRegExpIdentifierName = function(state) {
      state.lastStringValue = "";
      if (this.regexp_eatRegExpIdentifierStart(state)) {
        state.lastStringValue += codePointToString2(state.lastIntValue);
        while (this.regexp_eatRegExpIdentifierPart(state)) {
          state.lastStringValue += codePointToString2(state.lastIntValue);
        }
        return true;
      }
      return false;
    };
    pp$82.regexp_eatRegExpIdentifierStart = function(state) {
      var start = state.pos;
      var forceU = this.options.ecmaVersion >= 11;
      var ch = state.current(forceU);
      state.advance(forceU);
      if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
        ch = state.lastIntValue;
      }
      if (isRegExpIdentifierStart2(ch)) {
        state.lastIntValue = ch;
        return true;
      }
      state.pos = start;
      return false;
    };
    function isRegExpIdentifierStart2(ch) {
      return isIdentifierStart2(ch, true) || ch === 36 || ch === 95;
    }
    pp$82.regexp_eatRegExpIdentifierPart = function(state) {
      var start = state.pos;
      var forceU = this.options.ecmaVersion >= 11;
      var ch = state.current(forceU);
      state.advance(forceU);
      if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
        ch = state.lastIntValue;
      }
      if (isRegExpIdentifierPart2(ch)) {
        state.lastIntValue = ch;
        return true;
      }
      state.pos = start;
      return false;
    };
    function isRegExpIdentifierPart2(ch) {
      return isIdentifierChar2(ch, true) || ch === 36 || ch === 95 || ch === 8204 || ch === 8205;
    }
    pp$82.regexp_eatAtomEscape = function(state) {
      if (this.regexp_eatBackReference(state) || this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state) || state.switchN && this.regexp_eatKGroupName(state)) {
        return true;
      }
      if (state.switchU) {
        if (state.current() === 99) {
          state.raise("Invalid unicode escape");
        }
        state.raise("Invalid escape");
      }
      return false;
    };
    pp$82.regexp_eatBackReference = function(state) {
      var start = state.pos;
      if (this.regexp_eatDecimalEscape(state)) {
        var n2 = state.lastIntValue;
        if (state.switchU) {
          if (n2 > state.maxBackReference) {
            state.maxBackReference = n2;
          }
          return true;
        }
        if (n2 <= state.numCapturingParens) {
          return true;
        }
        state.pos = start;
      }
      return false;
    };
    pp$82.regexp_eatKGroupName = function(state) {
      if (state.eat(107)) {
        if (this.regexp_eatGroupName(state)) {
          state.backReferenceNames.push(state.lastStringValue);
          return true;
        }
        state.raise("Invalid named reference");
      }
      return false;
    };
    pp$82.regexp_eatCharacterEscape = function(state) {
      return this.regexp_eatControlEscape(state) || this.regexp_eatCControlLetter(state) || this.regexp_eatZero(state) || this.regexp_eatHexEscapeSequence(state) || this.regexp_eatRegExpUnicodeEscapeSequence(state, false) || !state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state) || this.regexp_eatIdentityEscape(state);
    };
    pp$82.regexp_eatCControlLetter = function(state) {
      var start = state.pos;
      if (state.eat(99)) {
        if (this.regexp_eatControlLetter(state)) {
          return true;
        }
        state.pos = start;
      }
      return false;
    };
    pp$82.regexp_eatZero = function(state) {
      if (state.current() === 48 && !isDecimalDigit2(state.lookahead())) {
        state.lastIntValue = 0;
        state.advance();
        return true;
      }
      return false;
    };
    pp$82.regexp_eatControlEscape = function(state) {
      var ch = state.current();
      if (ch === 116) {
        state.lastIntValue = 9;
        state.advance();
        return true;
      }
      if (ch === 110) {
        state.lastIntValue = 10;
        state.advance();
        return true;
      }
      if (ch === 118) {
        state.lastIntValue = 11;
        state.advance();
        return true;
      }
      if (ch === 102) {
        state.lastIntValue = 12;
        state.advance();
        return true;
      }
      if (ch === 114) {
        state.lastIntValue = 13;
        state.advance();
        return true;
      }
      return false;
    };
    pp$82.regexp_eatControlLetter = function(state) {
      var ch = state.current();
      if (isControlLetter2(ch)) {
        state.lastIntValue = ch % 32;
        state.advance();
        return true;
      }
      return false;
    };
    function isControlLetter2(ch) {
      return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122;
    }
    pp$82.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
      if (forceU === void 0)
        forceU = false;
      var start = state.pos;
      var switchU = forceU || state.switchU;
      if (state.eat(117)) {
        if (this.regexp_eatFixedHexDigits(state, 4)) {
          var lead = state.lastIntValue;
          if (switchU && lead >= 55296 && lead <= 56319) {
            var leadSurrogateEnd = state.pos;
            if (state.eat(92) && state.eat(117) && this.regexp_eatFixedHexDigits(state, 4)) {
              var trail = state.lastIntValue;
              if (trail >= 56320 && trail <= 57343) {
                state.lastIntValue = (lead - 55296) * 1024 + (trail - 56320) + 65536;
                return true;
              }
            }
            state.pos = leadSurrogateEnd;
            state.lastIntValue = lead;
          }
          return true;
        }
        if (switchU && state.eat(123) && this.regexp_eatHexDigits(state) && state.eat(125) && isValidUnicode2(state.lastIntValue)) {
          return true;
        }
        if (switchU) {
          state.raise("Invalid unicode escape");
        }
        state.pos = start;
      }
      return false;
    };
    function isValidUnicode2(ch) {
      return ch >= 0 && ch <= 1114111;
    }
    pp$82.regexp_eatIdentityEscape = function(state) {
      if (state.switchU) {
        if (this.regexp_eatSyntaxCharacter(state)) {
          return true;
        }
        if (state.eat(47)) {
          state.lastIntValue = 47;
          return true;
        }
        return false;
      }
      var ch = state.current();
      if (ch !== 99 && (!state.switchN || ch !== 107)) {
        state.lastIntValue = ch;
        state.advance();
        return true;
      }
      return false;
    };
    pp$82.regexp_eatDecimalEscape = function(state) {
      state.lastIntValue = 0;
      var ch = state.current();
      if (ch >= 49 && ch <= 57) {
        do {
          state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
          state.advance();
        } while ((ch = state.current()) >= 48 && ch <= 57);
        return true;
      }
      return false;
    };
    pp$82.regexp_eatCharacterClassEscape = function(state) {
      var ch = state.current();
      if (isCharacterClassEscape2(ch)) {
        state.lastIntValue = -1;
        state.advance();
        return true;
      }
      if (state.switchU && this.options.ecmaVersion >= 9 && (ch === 80 || ch === 112)) {
        state.lastIntValue = -1;
        state.advance();
        if (state.eat(123) && this.regexp_eatUnicodePropertyValueExpression(state) && state.eat(125)) {
          return true;
        }
        state.raise("Invalid property name");
      }
      return false;
    };
    function isCharacterClassEscape2(ch) {
      return ch === 100 || ch === 68 || ch === 115 || ch === 83 || ch === 119 || ch === 87;
    }
    pp$82.regexp_eatUnicodePropertyValueExpression = function(state) {
      var start = state.pos;
      if (this.regexp_eatUnicodePropertyName(state) && state.eat(61)) {
        var name = state.lastStringValue;
        if (this.regexp_eatUnicodePropertyValue(state)) {
          var value = state.lastStringValue;
          this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
          return true;
        }
      }
      state.pos = start;
      if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
        var nameOrValue = state.lastStringValue;
        this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
        return true;
      }
      return false;
    };
    pp$82.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
      if (!has2(state.unicodeProperties.nonBinary, name)) {
        state.raise("Invalid property name");
      }
      if (!state.unicodeProperties.nonBinary[name].test(value)) {
        state.raise("Invalid property value");
      }
    };
    pp$82.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
      if (!state.unicodeProperties.binary.test(nameOrValue)) {
        state.raise("Invalid property name");
      }
    };
    pp$82.regexp_eatUnicodePropertyName = function(state) {
      var ch = 0;
      state.lastStringValue = "";
      while (isUnicodePropertyNameCharacter2(ch = state.current())) {
        state.lastStringValue += codePointToString2(ch);
        state.advance();
      }
      return state.lastStringValue !== "";
    };
    function isUnicodePropertyNameCharacter2(ch) {
      return isControlLetter2(ch) || ch === 95;
    }
    pp$82.regexp_eatUnicodePropertyValue = function(state) {
      var ch = 0;
      state.lastStringValue = "";
      while (isUnicodePropertyValueCharacter2(ch = state.current())) {
        state.lastStringValue += codePointToString2(ch);
        state.advance();
      }
      return state.lastStringValue !== "";
    };
    function isUnicodePropertyValueCharacter2(ch) {
      return isUnicodePropertyNameCharacter2(ch) || isDecimalDigit2(ch);
    }
    pp$82.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
      return this.regexp_eatUnicodePropertyValue(state);
    };
    pp$82.regexp_eatCharacterClass = function(state) {
      if (state.eat(91)) {
        state.eat(94);
        this.regexp_classRanges(state);
        if (state.eat(93)) {
          return true;
        }
        state.raise("Unterminated character class");
      }
      return false;
    };
    pp$82.regexp_classRanges = function(state) {
      while (this.regexp_eatClassAtom(state)) {
        var left = state.lastIntValue;
        if (state.eat(45) && this.regexp_eatClassAtom(state)) {
          var right = state.lastIntValue;
          if (state.switchU && (left === -1 || right === -1)) {
            state.raise("Invalid character class");
          }
          if (left !== -1 && right !== -1 && left > right) {
            state.raise("Range out of order in character class");
          }
        }
      }
    };
    pp$82.regexp_eatClassAtom = function(state) {
      var start = state.pos;
      if (state.eat(92)) {
        if (this.regexp_eatClassEscape(state)) {
          return true;
        }
        if (state.switchU) {
          var ch$1 = state.current();
          if (ch$1 === 99 || isOctalDigit2(ch$1)) {
            state.raise("Invalid class escape");
          }
          state.raise("Invalid escape");
        }
        state.pos = start;
      }
      var ch = state.current();
      if (ch !== 93) {
        state.lastIntValue = ch;
        state.advance();
        return true;
      }
      return false;
    };
    pp$82.regexp_eatClassEscape = function(state) {
      var start = state.pos;
      if (state.eat(98)) {
        state.lastIntValue = 8;
        return true;
      }
      if (state.switchU && state.eat(45)) {
        state.lastIntValue = 45;
        return true;
      }
      if (!state.switchU && state.eat(99)) {
        if (this.regexp_eatClassControlLetter(state)) {
          return true;
        }
        state.pos = start;
      }
      return this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state);
    };
    pp$82.regexp_eatClassControlLetter = function(state) {
      var ch = state.current();
      if (isDecimalDigit2(ch) || ch === 95) {
        state.lastIntValue = ch % 32;
        state.advance();
        return true;
      }
      return false;
    };
    pp$82.regexp_eatHexEscapeSequence = function(state) {
      var start = state.pos;
      if (state.eat(120)) {
        if (this.regexp_eatFixedHexDigits(state, 2)) {
          return true;
        }
        if (state.switchU) {
          state.raise("Invalid escape");
        }
        state.pos = start;
      }
      return false;
    };
    pp$82.regexp_eatDecimalDigits = function(state) {
      var start = state.pos;
      var ch = 0;
      state.lastIntValue = 0;
      while (isDecimalDigit2(ch = state.current())) {
        state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
        state.advance();
      }
      return state.pos !== start;
    };
    function isDecimalDigit2(ch) {
      return ch >= 48 && ch <= 57;
    }
    pp$82.regexp_eatHexDigits = function(state) {
      var start = state.pos;
      var ch = 0;
      state.lastIntValue = 0;
      while (isHexDigit2(ch = state.current())) {
        state.lastIntValue = 16 * state.lastIntValue + hexToInt2(ch);
        state.advance();
      }
      return state.pos !== start;
    };
    function isHexDigit2(ch) {
      return ch >= 48 && ch <= 57 || ch >= 65 && ch <= 70 || ch >= 97 && ch <= 102;
    }
    function hexToInt2(ch) {
      if (ch >= 65 && ch <= 70) {
        return 10 + (ch - 65);
      }
      if (ch >= 97 && ch <= 102) {
        return 10 + (ch - 97);
      }
      return ch - 48;
    }
    pp$82.regexp_eatLegacyOctalEscapeSequence = function(state) {
      if (this.regexp_eatOctalDigit(state)) {
        var n1 = state.lastIntValue;
        if (this.regexp_eatOctalDigit(state)) {
          var n2 = state.lastIntValue;
          if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
            state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
          } else {
            state.lastIntValue = n1 * 8 + n2;
          }
        } else {
          state.lastIntValue = n1;
        }
        return true;
      }
      return false;
    };
    pp$82.regexp_eatOctalDigit = function(state) {
      var ch = state.current();
      if (isOctalDigit2(ch)) {
        state.lastIntValue = ch - 48;
        state.advance();
        return true;
      }
      state.lastIntValue = 0;
      return false;
    };
    function isOctalDigit2(ch) {
      return ch >= 48 && ch <= 55;
    }
    pp$82.regexp_eatFixedHexDigits = function(state, length2) {
      var start = state.pos;
      state.lastIntValue = 0;
      for (var i2 = 0; i2 < length2; ++i2) {
        var ch = state.current();
        if (!isHexDigit2(ch)) {
          state.pos = start;
          return false;
        }
        state.lastIntValue = 16 * state.lastIntValue + hexToInt2(ch);
        state.advance();
      }
      return true;
    };
    var Token3 = function Token22(p2) {
      this.type = p2.type;
      this.value = p2.value;
      this.start = p2.start;
      this.end = p2.end;
      if (p2.options.locations) {
        this.loc = new SourceLocation3(p2, p2.startLoc, p2.endLoc);
      }
      if (p2.options.ranges) {
        this.range = [p2.start, p2.end];
      }
    };
    var pp$92 = Parser3.prototype;
    pp$92.next = function(ignoreEscapeSequenceInKeyword) {
      if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc) {
        this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword);
      }
      if (this.options.onToken) {
        this.options.onToken(new Token3(this));
      }
      this.lastTokEnd = this.end;
      this.lastTokStart = this.start;
      this.lastTokEndLoc = this.endLoc;
      this.lastTokStartLoc = this.startLoc;
      this.nextToken();
    };
    pp$92.getToken = function() {
      this.next();
      return new Token3(this);
    };
    if (typeof Symbol !== "undefined") {
      pp$92[Symbol.iterator] = function() {
        var this$1 = this;
        return {
          next: function() {
            var token = this$1.getToken();
            return {
              done: token.type === types2.eof,
              value: token
            };
          }
        };
      };
    }
    pp$92.curContext = function() {
      return this.context[this.context.length - 1];
    };
    pp$92.nextToken = function() {
      var curContext = this.curContext();
      if (!curContext || !curContext.preserveSpace) {
        this.skipSpace();
      }
      this.start = this.pos;
      if (this.options.locations) {
        this.startLoc = this.curPosition();
      }
      if (this.pos >= this.input.length) {
        return this.finishToken(types2.eof);
      }
      if (curContext.override) {
        return curContext.override(this);
      } else {
        this.readToken(this.fullCharCodeAtPos());
      }
    };
    pp$92.readToken = function(code) {
      if (isIdentifierStart2(code, this.options.ecmaVersion >= 6) || code === 92) {
        return this.readWord();
      }
      return this.getTokenFromCode(code);
    };
    pp$92.fullCharCodeAtPos = function() {
      var code = this.input.charCodeAt(this.pos);
      if (code <= 55295 || code >= 57344) {
        return code;
      }
      var next = this.input.charCodeAt(this.pos + 1);
      return (code << 10) + next - 56613888;
    };
    pp$92.skipBlockComment = function() {
      var startLoc = this.options.onComment && this.curPosition();
      var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
      if (end === -1) {
        this.raise(this.pos - 2, "Unterminated comment");
      }
      this.pos = end + 2;
      if (this.options.locations) {
        lineBreakG2.lastIndex = start;
        var match;
        while ((match = lineBreakG2.exec(this.input)) && match.index < this.pos) {
          ++this.curLine;
          this.lineStart = match.index + match[0].length;
        }
      }
      if (this.options.onComment) {
        this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.curPosition());
      }
    };
    pp$92.skipLineComment = function(startSkip) {
      var start = this.pos;
      var startLoc = this.options.onComment && this.curPosition();
      var ch = this.input.charCodeAt(this.pos += startSkip);
      while (this.pos < this.input.length && !isNewLine2(ch)) {
        ch = this.input.charCodeAt(++this.pos);
      }
      if (this.options.onComment) {
        this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos, startLoc, this.curPosition());
      }
    };
    pp$92.skipSpace = function() {
      loop:
        while (this.pos < this.input.length) {
          var ch = this.input.charCodeAt(this.pos);
          switch (ch) {
            case 32:
            case 160:
              ++this.pos;
              break;
            case 13:
              if (this.input.charCodeAt(this.pos + 1) === 10) {
                ++this.pos;
              }
            case 10:
            case 8232:
            case 8233:
              ++this.pos;
              if (this.options.locations) {
                ++this.curLine;
                this.lineStart = this.pos;
              }
              break;
            case 47:
              switch (this.input.charCodeAt(this.pos + 1)) {
                case 42:
                  this.skipBlockComment();
                  break;
                case 47:
                  this.skipLineComment(2);
                  break;
                default:
                  break loop;
              }
              break;
            default:
              if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace2.test(String.fromCharCode(ch))) {
                ++this.pos;
              } else {
                break loop;
              }
          }
        }
    };
    pp$92.finishToken = function(type, val) {
      this.end = this.pos;
      if (this.options.locations) {
        this.endLoc = this.curPosition();
      }
      var prevType = this.type;
      this.type = type;
      this.value = val;
      this.updateContext(prevType);
    };
    pp$92.readToken_dot = function() {
      var next = this.input.charCodeAt(this.pos + 1);
      if (next >= 48 && next <= 57) {
        return this.readNumber(true);
      }
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
        this.pos += 3;
        return this.finishToken(types2.ellipsis);
      } else {
        ++this.pos;
        return this.finishToken(types2.dot);
      }
    };
    pp$92.readToken_slash = function() {
      var next = this.input.charCodeAt(this.pos + 1);
      if (this.exprAllowed) {
        ++this.pos;
        return this.readRegexp();
      }
      if (next === 61) {
        return this.finishOp(types2.assign, 2);
      }
      return this.finishOp(types2.slash, 1);
    };
    pp$92.readToken_mult_modulo_exp = function(code) {
      var next = this.input.charCodeAt(this.pos + 1);
      var size = 1;
      var tokentype = code === 42 ? types2.star : types2.modulo;
      if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
        ++size;
        tokentype = types2.starstar;
        next = this.input.charCodeAt(this.pos + 2);
      }
      if (next === 61) {
        return this.finishOp(types2.assign, size + 1);
      }
      return this.finishOp(tokentype, size);
    };
    pp$92.readToken_pipe_amp = function(code) {
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === code) {
        if (this.options.ecmaVersion >= 12) {
          var next2 = this.input.charCodeAt(this.pos + 2);
          if (next2 === 61) {
            return this.finishOp(types2.assign, 3);
          }
        }
        return this.finishOp(code === 124 ? types2.logicalOR : types2.logicalAND, 2);
      }
      if (next === 61) {
        return this.finishOp(types2.assign, 2);
      }
      return this.finishOp(code === 124 ? types2.bitwiseOR : types2.bitwiseAND, 1);
    };
    pp$92.readToken_caret = function() {
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 61) {
        return this.finishOp(types2.assign, 2);
      }
      return this.finishOp(types2.bitwiseXOR, 1);
    };
    pp$92.readToken_plus_min = function(code) {
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === code) {
        if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 && (this.lastTokEnd === 0 || lineBreak2.test(this.input.slice(this.lastTokEnd, this.pos)))) {
          this.skipLineComment(3);
          this.skipSpace();
          return this.nextToken();
        }
        return this.finishOp(types2.incDec, 2);
      }
      if (next === 61) {
        return this.finishOp(types2.assign, 2);
      }
      return this.finishOp(types2.plusMin, 1);
    };
    pp$92.readToken_lt_gt = function(code) {
      var next = this.input.charCodeAt(this.pos + 1);
      var size = 1;
      if (next === code) {
        size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
        if (this.input.charCodeAt(this.pos + size) === 61) {
          return this.finishOp(types2.assign, size + 1);
        }
        return this.finishOp(types2.bitShift, size);
      }
      if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 && this.input.charCodeAt(this.pos + 3) === 45) {
        this.skipLineComment(4);
        this.skipSpace();
        return this.nextToken();
      }
      if (next === 61) {
        size = 2;
      }
      return this.finishOp(types2.relational, size);
    };
    pp$92.readToken_eq_excl = function(code) {
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 61) {
        return this.finishOp(types2.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
      }
      if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
        this.pos += 2;
        return this.finishToken(types2.arrow);
      }
      return this.finishOp(code === 61 ? types2.eq : types2.prefix, 1);
    };
    pp$92.readToken_question = function() {
      var ecmaVersion = this.options.ecmaVersion;
      if (ecmaVersion >= 11) {
        var next = this.input.charCodeAt(this.pos + 1);
        if (next === 46) {
          var next2 = this.input.charCodeAt(this.pos + 2);
          if (next2 < 48 || next2 > 57) {
            return this.finishOp(types2.questionDot, 2);
          }
        }
        if (next === 63) {
          if (ecmaVersion >= 12) {
            var next2$1 = this.input.charCodeAt(this.pos + 2);
            if (next2$1 === 61) {
              return this.finishOp(types2.assign, 3);
            }
          }
          return this.finishOp(types2.coalesce, 2);
        }
      }
      return this.finishOp(types2.question, 1);
    };
    pp$92.getTokenFromCode = function(code) {
      switch (code) {
        case 46:
          return this.readToken_dot();
        case 40:
          ++this.pos;
          return this.finishToken(types2.parenL);
        case 41:
          ++this.pos;
          return this.finishToken(types2.parenR);
        case 59:
          ++this.pos;
          return this.finishToken(types2.semi);
        case 44:
          ++this.pos;
          return this.finishToken(types2.comma);
        case 91:
          ++this.pos;
          return this.finishToken(types2.bracketL);
        case 93:
          ++this.pos;
          return this.finishToken(types2.bracketR);
        case 123:
          ++this.pos;
          return this.finishToken(types2.braceL);
        case 125:
          ++this.pos;
          return this.finishToken(types2.braceR);
        case 58:
          ++this.pos;
          return this.finishToken(types2.colon);
        case 96:
          if (this.options.ecmaVersion < 6) {
            break;
          }
          ++this.pos;
          return this.finishToken(types2.backQuote);
        case 48:
          var next = this.input.charCodeAt(this.pos + 1);
          if (next === 120 || next === 88) {
            return this.readRadixNumber(16);
          }
          if (this.options.ecmaVersion >= 6) {
            if (next === 111 || next === 79) {
              return this.readRadixNumber(8);
            }
            if (next === 98 || next === 66) {
              return this.readRadixNumber(2);
            }
          }
        case 49:
        case 50:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
          return this.readNumber(false);
        case 34:
        case 39:
          return this.readString(code);
        case 47:
          return this.readToken_slash();
        case 37:
        case 42:
          return this.readToken_mult_modulo_exp(code);
        case 124:
        case 38:
          return this.readToken_pipe_amp(code);
        case 94:
          return this.readToken_caret();
        case 43:
        case 45:
          return this.readToken_plus_min(code);
        case 60:
        case 62:
          return this.readToken_lt_gt(code);
        case 61:
        case 33:
          return this.readToken_eq_excl(code);
        case 63:
          return this.readToken_question();
        case 126:
          return this.finishOp(types2.prefix, 1);
      }
      this.raise(this.pos, "Unexpected character '" + codePointToString$12(code) + "'");
    };
    pp$92.finishOp = function(type, size) {
      var str = this.input.slice(this.pos, this.pos + size);
      this.pos += size;
      return this.finishToken(type, str);
    };
    pp$92.readRegexp = function() {
      var escaped, inClass, start = this.pos;
      for (; ; ) {
        if (this.pos >= this.input.length) {
          this.raise(start, "Unterminated regular expression");
        }
        var ch = this.input.charAt(this.pos);
        if (lineBreak2.test(ch)) {
          this.raise(start, "Unterminated regular expression");
        }
        if (!escaped) {
          if (ch === "[") {
            inClass = true;
          } else if (ch === "]" && inClass) {
            inClass = false;
          } else if (ch === "/" && !inClass) {
            break;
          }
          escaped = ch === "\\";
        } else {
          escaped = false;
        }
        ++this.pos;
      }
      var pattern = this.input.slice(start, this.pos);
      ++this.pos;
      var flagsStart = this.pos;
      var flags = this.readWord1();
      if (this.containsEsc) {
        this.unexpected(flagsStart);
      }
      var state = this.regexpState || (this.regexpState = new RegExpValidationState3(this));
      state.reset(start, pattern, flags);
      this.validateRegExpFlags(state);
      this.validateRegExpPattern(state);
      var value = null;
      try {
        value = new RegExp(pattern, flags);
      } catch (e2) {
      }
      return this.finishToken(types2.regexp, { pattern, flags, value });
    };
    pp$92.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
      var allowSeparators = this.options.ecmaVersion >= 12 && len === void 0;
      var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;
      var start = this.pos, total = 0, lastCode = 0;
      for (var i2 = 0, e2 = len == null ? Infinity : len; i2 < e2; ++i2, ++this.pos) {
        var code = this.input.charCodeAt(this.pos), val = void 0;
        if (allowSeparators && code === 95) {
          if (isLegacyOctalNumericLiteral) {
            this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals");
          }
          if (lastCode === 95) {
            this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore");
          }
          if (i2 === 0) {
            this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits");
          }
          lastCode = code;
          continue;
        }
        if (code >= 97) {
          val = code - 97 + 10;
        } else if (code >= 65) {
          val = code - 65 + 10;
        } else if (code >= 48 && code <= 57) {
          val = code - 48;
        } else {
          val = Infinity;
        }
        if (val >= radix) {
          break;
        }
        lastCode = code;
        total = total * radix + val;
      }
      if (allowSeparators && lastCode === 95) {
        this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits");
      }
      if (this.pos === start || len != null && this.pos - start !== len) {
        return null;
      }
      return total;
    };
    function stringToNumber2(str, isLegacyOctalNumericLiteral) {
      if (isLegacyOctalNumericLiteral) {
        return parseInt(str, 8);
      }
      return parseFloat(str.replace(/_/g, ""));
    }
    function stringToBigInt2(str) {
      if (typeof BigInt !== "function") {
        return null;
      }
      return BigInt(str.replace(/_/g, ""));
    }
    pp$92.readRadixNumber = function(radix) {
      var start = this.pos;
      this.pos += 2;
      var val = this.readInt(radix);
      if (val == null) {
        this.raise(this.start + 2, "Expected number in radix " + radix);
      }
      if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
        val = stringToBigInt2(this.input.slice(start, this.pos));
        ++this.pos;
      } else if (isIdentifierStart2(this.fullCharCodeAtPos())) {
        this.raise(this.pos, "Identifier directly after number");
      }
      return this.finishToken(types2.num, val);
    };
    pp$92.readNumber = function(startsWithDot) {
      var start = this.pos;
      if (!startsWithDot && this.readInt(10, void 0, true) === null) {
        this.raise(start, "Invalid number");
      }
      var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
      if (octal && this.strict) {
        this.raise(start, "Invalid number");
      }
      var next = this.input.charCodeAt(this.pos);
      if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
        var val$1 = stringToBigInt2(this.input.slice(start, this.pos));
        ++this.pos;
        if (isIdentifierStart2(this.fullCharCodeAtPos())) {
          this.raise(this.pos, "Identifier directly after number");
        }
        return this.finishToken(types2.num, val$1);
      }
      if (octal && /[89]/.test(this.input.slice(start, this.pos))) {
        octal = false;
      }
      if (next === 46 && !octal) {
        ++this.pos;
        this.readInt(10);
        next = this.input.charCodeAt(this.pos);
      }
      if ((next === 69 || next === 101) && !octal) {
        next = this.input.charCodeAt(++this.pos);
        if (next === 43 || next === 45) {
          ++this.pos;
        }
        if (this.readInt(10) === null) {
          this.raise(start, "Invalid number");
        }
      }
      if (isIdentifierStart2(this.fullCharCodeAtPos())) {
        this.raise(this.pos, "Identifier directly after number");
      }
      var val = stringToNumber2(this.input.slice(start, this.pos), octal);
      return this.finishToken(types2.num, val);
    };
    pp$92.readCodePoint = function() {
      var ch = this.input.charCodeAt(this.pos), code;
      if (ch === 123) {
        if (this.options.ecmaVersion < 6) {
          this.unexpected();
        }
        var codePos = ++this.pos;
        code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
        ++this.pos;
        if (code > 1114111) {
          this.invalidStringToken(codePos, "Code point out of bounds");
        }
      } else {
        code = this.readHexChar(4);
      }
      return code;
    };
    function codePointToString$12(code) {
      if (code <= 65535) {
        return String.fromCharCode(code);
      }
      code -= 65536;
      return String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
    }
    pp$92.readString = function(quote) {
      var out = "", chunkStart = ++this.pos;
      for (; ; ) {
        if (this.pos >= this.input.length) {
          this.raise(this.start, "Unterminated string constant");
        }
        var ch = this.input.charCodeAt(this.pos);
        if (ch === quote) {
          break;
        }
        if (ch === 92) {
          out += this.input.slice(chunkStart, this.pos);
          out += this.readEscapedChar(false);
          chunkStart = this.pos;
        } else {
          if (isNewLine2(ch, this.options.ecmaVersion >= 10)) {
            this.raise(this.start, "Unterminated string constant");
          }
          ++this.pos;
        }
      }
      out += this.input.slice(chunkStart, this.pos++);
      return this.finishToken(types2.string, out);
    };
    var INVALID_TEMPLATE_ESCAPE_ERROR2 = {};
    pp$92.tryReadTemplateToken = function() {
      this.inTemplateElement = true;
      try {
        this.readTmplToken();
      } catch (err) {
        if (err === INVALID_TEMPLATE_ESCAPE_ERROR2) {
          this.readInvalidTemplateToken();
        } else {
          throw err;
        }
      }
      this.inTemplateElement = false;
    };
    pp$92.invalidStringToken = function(position, message) {
      if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
        throw INVALID_TEMPLATE_ESCAPE_ERROR2;
      } else {
        this.raise(position, message);
      }
    };
    pp$92.readTmplToken = function() {
      var out = "", chunkStart = this.pos;
      for (; ; ) {
        if (this.pos >= this.input.length) {
          this.raise(this.start, "Unterminated template");
        }
        var ch = this.input.charCodeAt(this.pos);
        if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
          if (this.pos === this.start && (this.type === types2.template || this.type === types2.invalidTemplate)) {
            if (ch === 36) {
              this.pos += 2;
              return this.finishToken(types2.dollarBraceL);
            } else {
              ++this.pos;
              return this.finishToken(types2.backQuote);
            }
          }
          out += this.input.slice(chunkStart, this.pos);
          return this.finishToken(types2.template, out);
        }
        if (ch === 92) {
          out += this.input.slice(chunkStart, this.pos);
          out += this.readEscapedChar(true);
          chunkStart = this.pos;
        } else if (isNewLine2(ch)) {
          out += this.input.slice(chunkStart, this.pos);
          ++this.pos;
          switch (ch) {
            case 13:
              if (this.input.charCodeAt(this.pos) === 10) {
                ++this.pos;
              }
            case 10:
              out += "\n";
              break;
            default:
              out += String.fromCharCode(ch);
              break;
          }
          if (this.options.locations) {
            ++this.curLine;
            this.lineStart = this.pos;
          }
          chunkStart = this.pos;
        } else {
          ++this.pos;
        }
      }
    };
    pp$92.readInvalidTemplateToken = function() {
      for (; this.pos < this.input.length; this.pos++) {
        switch (this.input[this.pos]) {
          case "\\":
            ++this.pos;
            break;
          case "$":
            if (this.input[this.pos + 1] !== "{") {
              break;
            }
          case "`":
            return this.finishToken(types2.invalidTemplate, this.input.slice(this.start, this.pos));
        }
      }
      this.raise(this.start, "Unterminated template");
    };
    pp$92.readEscapedChar = function(inTemplate) {
      var ch = this.input.charCodeAt(++this.pos);
      ++this.pos;
      switch (ch) {
        case 110:
          return "\n";
        case 114:
          return "\r";
        case 120:
          return String.fromCharCode(this.readHexChar(2));
        case 117:
          return codePointToString$12(this.readCodePoint());
        case 116:
          return "	";
        case 98:
          return "\b";
        case 118:
          return "\v";
        case 102:
          return "\f";
        case 13:
          if (this.input.charCodeAt(this.pos) === 10) {
            ++this.pos;
          }
        case 10:
          if (this.options.locations) {
            this.lineStart = this.pos;
            ++this.curLine;
          }
          return "";
        case 56:
        case 57:
          if (inTemplate) {
            var codePos = this.pos - 1;
            this.invalidStringToken(codePos, "Invalid escape sequence in template string");
            return null;
          }
        default:
          if (ch >= 48 && ch <= 55) {
            var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
            var octal = parseInt(octalStr, 8);
            if (octal > 255) {
              octalStr = octalStr.slice(0, -1);
              octal = parseInt(octalStr, 8);
            }
            this.pos += octalStr.length - 1;
            ch = this.input.charCodeAt(this.pos);
            if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
              this.invalidStringToken(this.pos - 1 - octalStr.length, inTemplate ? "Octal literal in template string" : "Octal literal in strict mode");
            }
            return String.fromCharCode(octal);
          }
          if (isNewLine2(ch)) {
            return "";
          }
          return String.fromCharCode(ch);
      }
    };
    pp$92.readHexChar = function(len) {
      var codePos = this.pos;
      var n2 = this.readInt(16, len);
      if (n2 === null) {
        this.invalidStringToken(codePos, "Bad character escape sequence");
      }
      return n2;
    };
    pp$92.readWord1 = function() {
      this.containsEsc = false;
      var word = "", first2 = true, chunkStart = this.pos;
      var astral = this.options.ecmaVersion >= 6;
      while (this.pos < this.input.length) {
        var ch = this.fullCharCodeAtPos();
        if (isIdentifierChar2(ch, astral)) {
          this.pos += ch <= 65535 ? 1 : 2;
        } else if (ch === 92) {
          this.containsEsc = true;
          word += this.input.slice(chunkStart, this.pos);
          var escStart = this.pos;
          if (this.input.charCodeAt(++this.pos) !== 117) {
            this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX");
          }
          ++this.pos;
          var esc = this.readCodePoint();
          if (!(first2 ? isIdentifierStart2 : isIdentifierChar2)(esc, astral)) {
            this.invalidStringToken(escStart, "Invalid Unicode escape");
          }
          word += codePointToString$12(esc);
          chunkStart = this.pos;
        } else {
          break;
        }
        first2 = false;
      }
      return word + this.input.slice(chunkStart, this.pos);
    };
    pp$92.readWord = function() {
      var word = this.readWord1();
      var type = types2.name;
      if (this.keywords.test(word)) {
        type = keywords$12[word];
      }
      return this.finishToken(type, word);
    };
    var version2 = "7.4.1";
    Parser3.acorn = {
      Parser: Parser3,
      version: version2,
      defaultOptions: defaultOptions2,
      Position: Position3,
      SourceLocation: SourceLocation3,
      getLineInfo: getLineInfo2,
      Node: Node3,
      TokenType: TokenType3,
      tokTypes: types2,
      keywordTypes: keywords$12,
      TokContext: TokContext3,
      tokContexts: types$12,
      isIdentifierChar: isIdentifierChar2,
      isIdentifierStart: isIdentifierStart2,
      Token: Token3,
      isNewLine: isNewLine2,
      lineBreak: lineBreak2,
      lineBreakG: lineBreakG2,
      nonASCIIwhitespace: nonASCIIwhitespace2
    };
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
    function simple2(node, visitors, baseVisitor, state, override) {
      if (!baseVisitor) {
        baseVisitor = base2;
      }
      (function c2(node2, st, override2) {
        var type = override2 || node2.type, found = visitors[type];
        baseVisitor[type](node2, st, c2);
        if (found) {
          found(node2, st);
        }
      })(node, state, override);
    }
    function ancestor2(node, visitors, baseVisitor, state) {
      var ancestors = [];
      if (!baseVisitor) {
        baseVisitor = base2;
      }
      (function c2(node2, st, override) {
        var type = override || node2.type, found = visitors[type];
        var isNew = node2 !== ancestors[ancestors.length - 1];
        if (isNew) {
          ancestors.push(node2);
        }
        baseVisitor[type](node2, st, c2);
        if (found) {
          found(node2, st || ancestors, ancestors);
        }
        if (isNew) {
          ancestors.pop();
        }
      })(node, state);
    }
    var create2 = Object.create || function(proto) {
      function Ctor() {
      }
      Ctor.prototype = proto;
      return new Ctor();
    };
    function make2(funcs, baseVisitor) {
      var visitor = create2(baseVisitor || base2);
      for (var type in funcs) {
        visitor[type] = funcs[type];
      }
      return visitor;
    }
    function skipThrough2(node, st, c2) {
      c2(node, st);
    }
    function ignore2(_node, _st, _c) {
    }
    var base2 = {};
    base2.Program = base2.BlockStatement = function(node, st, c2) {
      for (var i2 = 0, list = node.body; i2 < list.length; i2 += 1) {
        var stmt = list[i2];
        c2(stmt, st, "Statement");
      }
    };
    base2.Statement = skipThrough2;
    base2.EmptyStatement = ignore2;
    base2.ExpressionStatement = base2.ParenthesizedExpression = function(node, st, c2) {
      return c2(node.expression, st, "Expression");
    };
    base2.IfStatement = function(node, st, c2) {
      c2(node.test, st, "Expression");
      c2(node.consequent, st, "Statement");
      if (node.alternate) {
        c2(node.alternate, st, "Statement");
      }
    };
    base2.LabeledStatement = function(node, st, c2) {
      return c2(node.body, st, "Statement");
    };
    base2.BreakStatement = base2.ContinueStatement = ignore2;
    base2.WithStatement = function(node, st, c2) {
      c2(node.object, st, "Expression");
      c2(node.body, st, "Statement");
    };
    base2.SwitchStatement = function(node, st, c2) {
      c2(node.discriminant, st, "Expression");
      for (var i$1 = 0, list$1 = node.cases; i$1 < list$1.length; i$1 += 1) {
        var cs = list$1[i$1];
        if (cs.test) {
          c2(cs.test, st, "Expression");
        }
        for (var i2 = 0, list = cs.consequent; i2 < list.length; i2 += 1) {
          var cons = list[i2];
          c2(cons, st, "Statement");
        }
      }
    };
    base2.SwitchCase = function(node, st, c2) {
      if (node.test) {
        c2(node.test, st, "Expression");
      }
      for (var i2 = 0, list = node.consequent; i2 < list.length; i2 += 1) {
        var cons = list[i2];
        c2(cons, st, "Statement");
      }
    };
    base2.ReturnStatement = base2.YieldExpression = base2.AwaitExpression = function(node, st, c2) {
      if (node.argument) {
        c2(node.argument, st, "Expression");
      }
    };
    base2.ThrowStatement = base2.SpreadElement = function(node, st, c2) {
      return c2(node.argument, st, "Expression");
    };
    base2.TryStatement = function(node, st, c2) {
      c2(node.block, st, "Statement");
      if (node.handler) {
        c2(node.handler, st);
      }
      if (node.finalizer) {
        c2(node.finalizer, st, "Statement");
      }
    };
    base2.CatchClause = function(node, st, c2) {
      if (node.param) {
        c2(node.param, st, "Pattern");
      }
      c2(node.body, st, "Statement");
    };
    base2.WhileStatement = base2.DoWhileStatement = function(node, st, c2) {
      c2(node.test, st, "Expression");
      c2(node.body, st, "Statement");
    };
    base2.ForStatement = function(node, st, c2) {
      if (node.init) {
        c2(node.init, st, "ForInit");
      }
      if (node.test) {
        c2(node.test, st, "Expression");
      }
      if (node.update) {
        c2(node.update, st, "Expression");
      }
      c2(node.body, st, "Statement");
    };
    base2.ForInStatement = base2.ForOfStatement = function(node, st, c2) {
      c2(node.left, st, "ForInit");
      c2(node.right, st, "Expression");
      c2(node.body, st, "Statement");
    };
    base2.ForInit = function(node, st, c2) {
      if (node.type === "VariableDeclaration") {
        c2(node, st);
      } else {
        c2(node, st, "Expression");
      }
    };
    base2.DebuggerStatement = ignore2;
    base2.FunctionDeclaration = function(node, st, c2) {
      return c2(node, st, "Function");
    };
    base2.VariableDeclaration = function(node, st, c2) {
      for (var i2 = 0, list = node.declarations; i2 < list.length; i2 += 1) {
        var decl = list[i2];
        c2(decl, st);
      }
    };
    base2.VariableDeclarator = function(node, st, c2) {
      c2(node.id, st, "Pattern");
      if (node.init) {
        c2(node.init, st, "Expression");
      }
    };
    base2.Function = function(node, st, c2) {
      if (node.id) {
        c2(node.id, st, "Pattern");
      }
      for (var i2 = 0, list = node.params; i2 < list.length; i2 += 1) {
        var param = list[i2];
        c2(param, st, "Pattern");
      }
      c2(node.body, st, node.expression ? "Expression" : "Statement");
    };
    base2.Pattern = function(node, st, c2) {
      if (node.type === "Identifier") {
        c2(node, st, "VariablePattern");
      } else if (node.type === "MemberExpression") {
        c2(node, st, "MemberPattern");
      } else {
        c2(node, st);
      }
    };
    base2.VariablePattern = ignore2;
    base2.MemberPattern = skipThrough2;
    base2.RestElement = function(node, st, c2) {
      return c2(node.argument, st, "Pattern");
    };
    base2.ArrayPattern = function(node, st, c2) {
      for (var i2 = 0, list = node.elements; i2 < list.length; i2 += 1) {
        var elt = list[i2];
        if (elt) {
          c2(elt, st, "Pattern");
        }
      }
    };
    base2.ObjectPattern = function(node, st, c2) {
      for (var i2 = 0, list = node.properties; i2 < list.length; i2 += 1) {
        var prop = list[i2];
        if (prop.type === "Property") {
          if (prop.computed) {
            c2(prop.key, st, "Expression");
          }
          c2(prop.value, st, "Pattern");
        } else if (prop.type === "RestElement") {
          c2(prop.argument, st, "Pattern");
        }
      }
    };
    base2.Expression = skipThrough2;
    base2.ThisExpression = base2.Super = base2.MetaProperty = ignore2;
    base2.ArrayExpression = function(node, st, c2) {
      for (var i2 = 0, list = node.elements; i2 < list.length; i2 += 1) {
        var elt = list[i2];
        if (elt) {
          c2(elt, st, "Expression");
        }
      }
    };
    base2.ObjectExpression = function(node, st, c2) {
      for (var i2 = 0, list = node.properties; i2 < list.length; i2 += 1) {
        var prop = list[i2];
        c2(prop, st);
      }
    };
    base2.FunctionExpression = base2.ArrowFunctionExpression = base2.FunctionDeclaration;
    base2.SequenceExpression = function(node, st, c2) {
      for (var i2 = 0, list = node.expressions; i2 < list.length; i2 += 1) {
        var expr = list[i2];
        c2(expr, st, "Expression");
      }
    };
    base2.TemplateLiteral = function(node, st, c2) {
      for (var i2 = 0, list = node.quasis; i2 < list.length; i2 += 1) {
        var quasi = list[i2];
        c2(quasi, st);
      }
      for (var i$1 = 0, list$1 = node.expressions; i$1 < list$1.length; i$1 += 1) {
        var expr = list$1[i$1];
        c2(expr, st, "Expression");
      }
    };
    base2.TemplateElement = ignore2;
    base2.UnaryExpression = base2.UpdateExpression = function(node, st, c2) {
      c2(node.argument, st, "Expression");
    };
    base2.BinaryExpression = base2.LogicalExpression = function(node, st, c2) {
      c2(node.left, st, "Expression");
      c2(node.right, st, "Expression");
    };
    base2.AssignmentExpression = base2.AssignmentPattern = function(node, st, c2) {
      c2(node.left, st, "Pattern");
      c2(node.right, st, "Expression");
    };
    base2.ConditionalExpression = function(node, st, c2) {
      c2(node.test, st, "Expression");
      c2(node.consequent, st, "Expression");
      c2(node.alternate, st, "Expression");
    };
    base2.NewExpression = base2.CallExpression = function(node, st, c2) {
      c2(node.callee, st, "Expression");
      if (node.arguments) {
        for (var i2 = 0, list = node.arguments; i2 < list.length; i2 += 1) {
          var arg = list[i2];
          c2(arg, st, "Expression");
        }
      }
    };
    base2.MemberExpression = function(node, st, c2) {
      c2(node.object, st, "Expression");
      if (node.computed) {
        c2(node.property, st, "Expression");
      }
    };
    base2.ExportNamedDeclaration = base2.ExportDefaultDeclaration = function(node, st, c2) {
      if (node.declaration) {
        c2(node.declaration, st, node.type === "ExportNamedDeclaration" || node.declaration.id ? "Statement" : "Expression");
      }
      if (node.source) {
        c2(node.source, st, "Expression");
      }
    };
    base2.ExportAllDeclaration = function(node, st, c2) {
      c2(node.source, st, "Expression");
    };
    base2.ImportDeclaration = function(node, st, c2) {
      for (var i2 = 0, list = node.specifiers; i2 < list.length; i2 += 1) {
        var spec = list[i2];
        c2(spec, st);
      }
      c2(node.source, st, "Expression");
    };
    base2.ImportExpression = function(node, st, c2) {
      c2(node.source, st, "Expression");
    };
    base2.ImportSpecifier = base2.ImportDefaultSpecifier = base2.ImportNamespaceSpecifier = base2.Identifier = base2.Literal = ignore2;
    base2.TaggedTemplateExpression = function(node, st, c2) {
      c2(node.tag, st, "Expression");
      c2(node.quasi, st, "Expression");
    };
    base2.ClassDeclaration = base2.ClassExpression = function(node, st, c2) {
      return c2(node, st, "Class");
    };
    base2.Class = function(node, st, c2) {
      if (node.id) {
        c2(node.id, st, "Pattern");
      }
      if (node.superClass) {
        c2(node.superClass, st, "Expression");
      }
      c2(node.body, st);
    };
    base2.ClassBody = function(node, st, c2) {
      for (var i2 = 0, list = node.body; i2 < list.length; i2 += 1) {
        var elt = list[i2];
        c2(elt, st);
      }
    };
    base2.MethodDefinition = base2.Property = function(node, st, c2) {
      if (node.computed) {
        c2(node.key, st, "Expression");
      }
      c2(node.value, st, "Expression");
    };
    var walk = make2({
      Import() {
      },
      ViewExpression(node, st, c2) {
        c2(node.id, st, "Identifier");
      },
      MutableExpression(node, st, c2) {
        c2(node.id, st, "Identifier");
      }
    });
    function isScope2(node) {
      return node.type === "FunctionExpression" || node.type === "FunctionDeclaration" || node.type === "ArrowFunctionExpression" || node.type === "Program";
    }
    function isBlockScope2(node) {
      return node.type === "BlockStatement" || node.type === "ForInStatement" || node.type === "ForOfStatement" || node.type === "ForStatement" || isScope2(node);
    }
    function declaresArguments2(node) {
      return node.type === "FunctionExpression" || node.type === "FunctionDeclaration";
    }
    function findReferences2(cell, globals) {
      const ast = { type: "Program", body: [cell.body] };
      const locals = new Map();
      const globalSet = new Set(globals);
      const references2 = [];
      function hasLocal(node, name) {
        const l2 = locals.get(node);
        return l2 ? l2.has(name) : false;
      }
      function declareLocal(node, id) {
        const l2 = locals.get(node);
        if (l2)
          l2.add(id.name);
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
      ancestor2(ast, {
        VariableDeclaration: (node, parents) => {
          let parent = null;
          for (let i2 = parents.length - 1; i2 >= 0 && parent === null; --i2) {
            if (node.kind === "var" ? isScope2(parents[i2]) : isBlockScope2(parents[i2])) {
              parent = parents[i2];
            }
          }
          node.declarations.forEach((declaration) => declarePattern(declaration.id, parent));
        },
        FunctionDeclaration: (node, parents) => {
          let parent = null;
          for (let i2 = parents.length - 2; i2 >= 0 && parent === null; --i2) {
            if (isScope2(parents[i2])) {
              parent = parents[i2];
            }
          }
          declareLocal(parent, node.id);
          declareFunction(node);
        },
        Function: declareFunction,
        ClassDeclaration: (node, parents) => {
          let parent = null;
          for (let i2 = parents.length - 2; i2 >= 0 && parent === null; i2--) {
            if (isScope2(parents[i2])) {
              parent = parents[i2];
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
        for (let i2 = parents.length - 2; i2 >= 0; --i2) {
          if (name === "arguments") {
            if (declaresArguments2(parents[i2])) {
              return;
            }
          }
          if (hasLocal(parents[i2], name)) {
            return;
          }
          if (parents[i2].type === "ViewExpression") {
            node = parents[i2];
            name = `viewof ${node.id.name}`;
          }
          if (parents[i2].type === "MutableExpression") {
            node = parents[i2];
            name = `mutable ${node.id.name}`;
          }
        }
        if (!globalSet.has(name)) {
          if (name === "arguments") {
            throw Object.assign(new SyntaxError(`arguments is not allowed`), { node });
          }
          references2.push(node);
        }
      }
      ancestor2(ast, {
        VariablePattern: identifier,
        Identifier: identifier
      }, walk);
      function checkConst(node, parents) {
        switch (node.type) {
          case "Identifier":
          case "VariablePattern": {
            identifier2(node, parents);
            break;
          }
          case "ArrayPattern":
          case "ObjectPattern": {
            ancestor2(node, {
              Identifier: identifier2,
              VariablePattern: identifier2
            }, walk);
            break;
          }
        }
        function identifier2(node2, nodeParents) {
          for (const parent of parents) {
            if (hasLocal(parent, node2.name)) {
              return;
            }
          }
          if (nodeParents[nodeParents.length - 2].type === "MutableExpression") {
            return;
          }
          throw Object.assign(new SyntaxError(`Assignment to constant variable ${node2.name}`), { node: node2 });
        }
      }
      function checkConstArgument(node, parents) {
        checkConst(node.argument, parents);
      }
      function checkConstLeft(node, parents) {
        checkConst(node.left, parents);
      }
      ancestor2(ast, {
        AssignmentExpression: checkConstLeft,
        UpdateExpression: checkConstArgument,
        ForOfStatement: checkConstLeft,
        ForInStatement: checkConstLeft
      }, walk);
      return references2;
    }
    function findFeatures2(cell, featureName) {
      const ast = { type: "Program", body: [cell.body] };
      const features = new Map();
      const { references: references2 } = cell;
      simple2(ast, {
        CallExpression: (node) => {
          const { callee, arguments: args } = node;
          if (callee.type !== "Identifier" || callee.name !== featureName || references2.indexOf(callee) < 0)
            return;
          if (args.length !== 1 || !(args[0].type === "Literal" && /^['"]/.test(args[0].raw) || args[0].type === "TemplateLiteral" && args[0].expressions.length === 0)) {
            throw Object.assign(new SyntaxError(`${featureName} requires a single literal string argument`), { node });
          }
          const [arg] = args;
          const name = arg.type === "Literal" ? arg.value : arg.quasis[0].value.cooked;
          const location2 = { start: arg.start, end: arg.end };
          if (features.has(name))
            features.get(name).push(location2);
          else
            features.set(name, [location2]);
        }
      }, walk);
      return features;
    }
    const SCOPE_FUNCTION$1 = 2;
    const SCOPE_ASYNC$1 = 4;
    const SCOPE_GENERATOR$1 = 8;
    const STATE_START2 = Symbol("start");
    const STATE_MODIFIER2 = Symbol("modifier");
    const STATE_FUNCTION2 = Symbol("function");
    const STATE_NAME2 = Symbol("name");
    function parseCell(input2, { globals } = {}) {
      const cell = CellParser2.parse(input2);
      parseReferences2(cell, input2, globals);
      parseFeatures2(cell);
      return cell;
    }
    function peekId(input2) {
      let state = STATE_START2;
      let name;
      try {
        for (const token of Parser3.tokenizer(input2, { ecmaVersion: 11 })) {
          switch (state) {
            case STATE_START2:
            case STATE_MODIFIER2: {
              if (token.type === types2.name) {
                if (state === STATE_START2 && (token.value === "viewof" || token.value === "mutable" || token.value === "async")) {
                  state = STATE_MODIFIER2;
                  continue;
                }
                state = STATE_NAME2;
                name = token;
                continue;
              }
              if (token.type === types2._function || token.type === types2._class) {
                state = STATE_FUNCTION2;
                continue;
              }
              break;
            }
            case STATE_NAME2: {
              if (token.type === types2.eq)
                return name.value;
              break;
            }
            case STATE_FUNCTION2: {
              if (token.type === types2.star)
                continue;
              if (token.type === types2.name && token.end < input2.length)
                return token.value;
              break;
            }
          }
          return;
        }
      } catch (ignore22) {
        return;
      }
    }
    class CellParser2 extends Parser3 {
      constructor(options, ...args) {
        super(Object.assign({ ecmaVersion: 12 }, options), ...args);
      }
      enterScope(flags) {
        if (flags & SCOPE_FUNCTION$1)
          ++this.O_function;
        return super.enterScope(flags);
      }
      exitScope() {
        if (this.currentScope().flags & SCOPE_FUNCTION$1)
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
        if (this.type === types2._with) {
          this.next();
          node.injections = this.parseImportSpecifiers();
        }
        this.expectContextual("from");
        node.source = this.type === types2.string ? this.parseExprAtom() : this.unexpected();
        return this.finishNode(node, "ImportDeclaration");
      }
      parseImportSpecifiers() {
        const nodes = [];
        const identifiers = new Set();
        let first2 = true;
        this.expect(types2.braceL);
        while (!this.eat(types2.braceR)) {
          if (first2) {
            first2 = false;
          } else {
            this.expect(types2.comma);
            if (this.afterTrailingComma(types2.braceR))
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
      parseCell(node, eof) {
        const lookahead2 = new CellParser2({}, this.input, this.start);
        let token = lookahead2.getToken();
        let body = null;
        let id = null;
        this.O_function = 0;
        this.O_async = false;
        this.O_generator = false;
        this.strict = true;
        this.enterScope(SCOPE_FUNCTION$1 | SCOPE_ASYNC$1 | SCOPE_GENERATOR$1);
        if (token.type === types2._import && lookahead2.getToken().type !== types2.parenL) {
          body = this.parseImport(this.startNode());
        } else if (token.type !== types2.eof && token.type !== types2.semi) {
          if (token.type === types2.name) {
            if (token.value === "viewof" || token.value === "mutable") {
              token = lookahead2.getToken();
              if (token.type !== types2.name) {
                lookahead2.unexpected();
              }
            }
            token = lookahead2.getToken();
            if (token.type === types2.eq) {
              id = this.parseMaybeKeywordExpression("viewof", "ViewExpression") || this.parseMaybeKeywordExpression("mutable", "MutableExpression") || this.parseIdent();
              token = lookahead2.getToken();
              this.expect(types2.eq);
            }
          }
          if (token.type === types2.braceL) {
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
          this.expect(types2.eof);
        if (id)
          this.checkLocal(id);
        node.id = id;
        node.async = this.O_async;
        node.generator = this.O_generator;
        node.body = body;
        this.exitScope();
        return this.finishNode(node, "Cell");
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
        this.raise(pos != null ? pos : this.start, this.type === types2.eof ? "Unexpected end of input" : "Unexpected token");
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
    function parseModule2(input2, { globals } = {}) {
      const program = ModuleParser2.parse(input2);
      for (const cell of program.cells) {
        parseReferences2(cell, input2, globals);
        parseFeatures2(cell, input2);
      }
      return program;
    }
    class ModuleParser2 extends CellParser2 {
      parseTopLevel(node) {
        if (!node.cells)
          node.cells = [];
        while (this.type !== types2.eof) {
          const cell = this.parseCell(this.startNode());
          cell.input = this.input;
          node.cells.push(cell);
        }
        this.next();
        return this.finishNode(node, "Program");
      }
    }
    function parseReferences2(cell, input2, globals = defaultGlobals) {
      if (cell.body && cell.body.type !== "ImportDeclaration") {
        try {
          cell.references = findReferences2(cell, globals);
        } catch (error) {
          if (error.node) {
            const loc = getLineInfo2(input2, error.node.start);
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
    function parseFeatures2(cell, input2) {
      if (cell.body && cell.body.type !== "ImportDeclaration") {
        try {
          cell.fileAttachments = findFeatures2(cell, "FileAttachment");
          cell.databaseClients = findFeatures2(cell, "DatabaseClient");
          cell.secrets = findFeatures2(cell, "Secret");
        } catch (error) {
          if (error.node) {
            const loc = getLineInfo2(input2, error.node.start);
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
    var index = /* @__PURE__ */ Object.freeze({ __proto__: null, parseCell, peekId, CellParser: CellParser2, parseModule: parseModule2, ModuleParser: ModuleParser2, walk });
    const extractPath = (path) => {
      let source = path;
      let m2;
      if (m2 = /\.js(\?|$)/i.exec(source))
        source = source.slice(0, m2.index);
      if (m2 = /^[0-9a-f]{16}$/i.test(source))
        source = `d/${source}`;
      if (m2 = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source))
        source = source.slice(m2[0].length);
      return source;
    };
    function setupImportCell(cell) {
      const specifiers = [];
      if (cell.body.specifiers)
        for (const specifier of cell.body.specifiers) {
          if (specifier.view) {
            specifiers.push({
              name: "viewof " + specifier.imported.name,
              alias: "viewof " + specifier.local.name
            });
          } else if (specifier.mutable) {
            specifiers.push({
              name: "mutable " + specifier.imported.name,
              alias: "mutable " + specifier.local.name
            });
          }
          specifiers.push({
            name: specifier.imported.name,
            alias: specifier.local.name
          });
        }
      const hasInjections = cell.body.injections !== void 0;
      const injections = [];
      if (hasInjections)
        for (const injection of cell.body.injections) {
          if (injection.view) {
            injections.push({
              name: "viewof " + injection.imported.name,
              alias: "viewof " + injection.local.name
            });
          } else if (injection.mutable) {
            injections.push({
              name: "mutable " + injection.imported.name,
              alias: "mutable " + injection.local.name
            });
          }
          injections.push({
            name: injection.imported.name,
            alias: injection.local.name
          });
        }
      const importString = `import {${specifiers.map((specifier) => `${specifier.name} as ${specifier.alias}`).join(", ")}} ${hasInjections ? `with {${injections.map((injection) => `${injection.name} as ${injection.alias}`).join(", ")}} ` : ``}from "${cell.body.source.value}"`;
      return { specifiers, hasInjections, injections, importString };
    }
    function setupRegularCell(cell) {
      let name = null;
      if (cell.id && cell.id.name)
        name = cell.id.name;
      else if (cell.id && cell.id.id && cell.id.id.name)
        name = cell.id.id.name;
      let bodyText = cell.input.substring(cell.body.start, cell.body.end);
      const cellReferences = (cell.references || []).map((ref22) => {
        if (ref22.type === "ViewExpression") {
          return "viewof " + ref22.id.name;
        } else if (ref22.type === "MutableExpression") {
          return "mutable " + ref22.id.name;
        } else
          return ref22.name;
      });
      let $count = 0;
      let indexShift = 0;
      const references2 = (cell.references || []).map((ref22) => {
        if (ref22.type === "ViewExpression") {
          const $string = "$" + $count;
          $count++;
          simple2(cell.body, {
            ViewExpression(node) {
              const start = node.start - cell.body.start;
              const end = node.end - cell.body.start;
              bodyText = bodyText.slice(0, start + indexShift) + $string + bodyText.slice(end + indexShift);
              indexShift += $string.length - (end - start);
            }
          }, walk);
          return $string;
        } else if (ref22.type === "MutableExpression") {
          const $string = "$" + $count;
          const $stringValue = $string + ".value";
          $count++;
          simple2(cell.body, {
            MutableExpression(node) {
              const start = node.start - cell.body.start;
              const end = node.end - cell.body.start;
              bodyText = bodyText.slice(0, start + indexShift) + $stringValue + bodyText.slice(end + indexShift);
              indexShift += $stringValue.length - (end - start);
            }
          }, walk);
          return $string;
        } else
          return ref22.name;
      });
      return {
        cellName: name,
        references: Array.from(new Set(references2)),
        bodyText,
        cellReferences: Array.from(new Set(cellReferences))
      };
    }
    function names(cell) {
      if (cell.body && cell.body.specifiers)
        return cell.body.specifiers.map((d2) => `${d2.view ? "viewof " : d2.mutable ? "mutable " : ""}${d2.local.name}`);
      if (cell.id && cell.id.type && cell.id) {
        if (cell.id.type === "ViewExpression")
          return [`viewof ${cell.id.id.name}`];
        if (cell.id.type === "MutableExpression")
          return [`mutable ${cell.id.id.name}`];
        if (cell.id.name)
          return [cell.id.name];
      }
      return [];
    }
    function references(cell) {
      if (cell.references)
        return cell.references.map((d2) => {
          if (d2.name)
            return d2.name;
          if (d2.type === "ViewExpression")
            return `viewof ${d2.id.name}`;
          if (d2.type === "MutableExpression")
            return `mutable ${d2.id.name}`;
          return null;
        });
      if (cell.body && cell.body.injections)
        return cell.body.injections.map((d2) => `${d2.view ? "viewof " : d2.mutable ? "mutable " : ""}${d2.imported.name}`);
      return [];
    }
    function getCellRefs(module2) {
      const cells = [];
      for (const cell of module2.cells) {
        const ns = names(cell);
        const refs = references(cell);
        if (!ns || !ns.length)
          continue;
        for (const name of ns) {
          cells.push([name, refs]);
          if (name.startsWith("viewof "))
            cells.push([name.substring("viewof ".length), [name]]);
        }
      }
      return new Map(cells);
    }
    function treeShakeModule2(module2, targets) {
      const cellRefs = getCellRefs(module2);
      const embed = new Set();
      const todo = targets.slice();
      while (todo.length) {
        const d2 = todo.pop();
        embed.add(d2);
        if (!cellRefs.has(d2))
          continue;
        const refs = cellRefs.get(d2);
        for (const ref22 of refs)
          if (!embed.has(ref22))
            todo.push(ref22);
      }
      return {
        cells: module2.cells.filter((cell) => names(cell).filter((name) => embed.has(name)).length)
      };
    }
    function ESMImports(moduleObject, resolveImportPath) {
      const importMap = new Map();
      let importSrc = "";
      let j2 = 0;
      for (const { body } of moduleObject.cells) {
        if (body.type !== "ImportDeclaration" || importMap.has(body.source.value))
          continue;
        const defineName = `define${++j2}`;
        const specifiers = body.specifiers.map((d2) => {
          const prefix = d2.view ? "viewof " : d2.mutable ? "mutable " : "";
          return `${prefix}${d2.imported.name}`;
        });
        const fromPath = resolveImportPath(body.source.value, specifiers);
        importMap.set(body.source.value, { defineName, fromPath });
        importSrc += `import ${defineName} from "${fromPath}";
`;
      }
      if (importSrc.length)
        importSrc += "\n";
      return { importSrc, importMap };
    }
    function ESMAttachments(moduleObject, resolveFileAttachments, UNSAFE_allowJavascriptFileAttachments = false) {
      let mapValue;
      if (UNSAFE_allowJavascriptFileAttachments) {
        const attachmentMapEntries = [];
        for (const cell of moduleObject.cells) {
          if (cell.fileAttachments.size === 0)
            continue;
          for (const file of cell.fileAttachments.keys())
            attachmentMapEntries.push([file, resolveFileAttachments(file)]);
        }
        if (attachmentMapEntries.length)
          mapValue = `[${attachmentMapEntries.map(([key, value]) => `[${JSON.stringify(key)}, ${value}]`).join(",")}]`;
      } else {
        const attachmentMapEntries = [];
        for (const cell of moduleObject.cells) {
          if (cell.fileAttachments.size === 0)
            continue;
          for (const file of cell.fileAttachments.keys())
            attachmentMapEntries.push([file, resolveFileAttachments(file)]);
        }
        if (attachmentMapEntries.length)
          mapValue = JSON.stringify(attachmentMapEntries);
      }
      if (!mapValue)
        return "";
      return `  const fileAttachments = new Map(${mapValue});
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));`;
    }
    function ESMVariables(moduleObject, importMap, params) {
      const {
        defineImportMarkdown,
        observeViewofValues,
        observeMutableValues
      } = params;
      let childJ = 0;
      return moduleObject.cells.map((cell) => {
        let src = "";
        if (cell.body.type === "ImportDeclaration") {
          const {
            specifiers,
            hasInjections,
            injections,
            importString
          } = setupImportCell(cell);
          if (defineImportMarkdown)
            src += `  main.variable(observer()).define(
    null,
    ["md"],
    md => md\`~~~javascript
${importString}
~~~\`
  );
`;
          const childName = `child${++childJ}`;
          src += `  const ${childName} = runtime.module(${importMap.get(cell.body.source.value).defineName})${hasInjections ? `.derive(${JSON.stringify(injections)}, main)` : ""};
${specifiers.map((specifier) => `  main.import("${specifier.name}", "${specifier.alias}", ${childName});`).join("\n")}`;
        } else {
          const {
            cellName,
            references: references2,
            bodyText,
            cellReferences
          } = setupRegularCell(cell);
          const cellNameString = cellName ? `"${cellName}"` : "";
          const referenceString = references2.join(",");
          let code = "";
          if (cell.body.type !== "BlockStatement")
            code = `{return(
${bodyText}
)}`;
          else
            code = "\n" + bodyText + "\n";
          const cellReferencesString = cellReferences.length ? JSON.stringify(cellReferences) + ", " : "";
          let cellFunction = "";
          if (cell.generator && cell.async)
            cellFunction = `async function*(${referenceString})${code}`;
          else if (cell.async)
            cellFunction = `async function(${referenceString})${code}`;
          else if (cell.generator)
            cellFunction = `function*(${referenceString})${code}`;
          else
            cellFunction = `function(${referenceString})${code}`;
          if (cell.id && cell.id.type === "ViewExpression") {
            const reference = `"viewof ${cellName}"`;
            src += `  main.variable(observer(${reference})).define(${reference}, ${cellReferencesString}${cellFunction});
  main.variable(${observeViewofValues ? `observer("${cellName}")` : `null`}).define("${cellName}", ["Generators", ${reference}], (G, _) => G.input(_));`;
          } else if (cell.id && cell.id.type === "MutableExpression") {
            const initialName = `"initial ${cellName}"`;
            const mutableName = `"mutable ${cellName}"`;
            src += `  main.define(${initialName}, ${cellReferencesString}${cellFunction});
  main.variable(observer(${mutableName})).define(${mutableName}, ["Mutable", ${initialName}], (M, _) => new M(_));
  main.variable(${observeMutableValues ? `observer("${cellName}")` : `null`}).define("${cellName}", [${mutableName}], _ => _.generator);`;
          } else {
            src += `  main.variable(observer(${cellNameString})).define(${cellName ? cellNameString + ", " : ""}${cellReferencesString}${cellFunction});`;
          }
        }
        return src;
      }).join("\n");
    }
    function createESModule(moduleObject, params = {}) {
      const {
        resolveImportPath,
        resolveFileAttachments,
        defineImportMarkdown,
        observeViewofValues,
        observeMutableValues,
        UNSAFE_allowJavascriptFileAttachments
      } = params;
      const { importSrc, importMap } = ESMImports(moduleObject, resolveImportPath);
      return `${importSrc}export default function define(runtime, observer) {
  const main = runtime.module();
${ESMAttachments(moduleObject, resolveFileAttachments, UNSAFE_allowJavascriptFileAttachments)}
${ESMVariables(moduleObject, importMap, {
        defineImportMarkdown,
        observeViewofValues,
        observeMutableValues
      }) || ""}
  return main;
}`;
    }
    function defaultResolveImportPath2(path) {
      const source = extractPath(path);
      return `https://api.observablehq.com/${source}.js?v=3`;
    }
    function defaultResolveFileAttachments(name) {
      return name;
    }
    class Compiler2 {
      constructor(params = {}) {
        const {
          resolveFileAttachments = defaultResolveFileAttachments,
          resolveImportPath = defaultResolveImportPath2,
          defineImportMarkdown = true,
          observeViewofValues = true,
          observeMutableValues = true,
          UNSAFE_allowJavascriptFileAttachments = false
        } = params;
        this.resolveFileAttachments = resolveFileAttachments;
        this.resolveImportPath = resolveImportPath;
        this.defineImportMarkdown = defineImportMarkdown;
        this.observeViewofValues = observeViewofValues;
        this.observeMutableValues = observeMutableValues;
        this.UNSAFE_allowJavascriptFileAttachments = UNSAFE_allowJavascriptFileAttachments;
      }
      module(input2, params = {}) {
        let m1 = typeof input2 === "string" ? parseModule2(input2) : input2;
        if (params.treeShake)
          m1 = treeShakeModule2(m1, params.treeShake);
        return createESModule(m1, {
          resolveImportPath: this.resolveImportPath,
          resolveFileAttachments: this.resolveFileAttachments,
          defineImportMarkdown: this.defineImportMarkdown,
          observeViewofValues: this.observeViewofValues,
          observeMutableValues: this.observeMutableValues,
          UNSAFE_allowJavascriptFileAttachments: this.UNSAFE_allowJavascriptFileAttachments
        });
      }
      notebook(obj) {
        const cells = obj.nodes.map(({ value }) => {
          const cell = parseCell(value);
          cell.input = value;
          return cell;
        });
        return createESModule({ cells }, {
          resolveImportPath: this.resolveImportPath,
          resolveFileAttachments: this.resolveFileAttachments,
          defineImportMarkdown: this.defineImportMarkdown,
          observeViewofValues: this.observeViewofValues,
          observeMutableValues: this.observeMutableValues
        });
      }
    }
    const AsyncFunction = Object.getPrototypeOf(async function() {
    }).constructor;
    const GeneratorFunction = Object.getPrototypeOf(function* () {
    }).constructor;
    const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () {
    }).constructor;
    function createRegularCellDefinition(cell) {
      const { cellName, references: references2, bodyText, cellReferences } = setupRegularCell(cell);
      let code;
      if (cell.body.type !== "BlockStatement") {
        if (cell.async)
          code = `return (async function(){ return (${bodyText});})()`;
        else
          code = `return (function(){ return (${bodyText});})()`;
      } else
        code = bodyText;
      let f2;
      if (cell.generator && cell.async)
        f2 = new AsyncGeneratorFunction(...references2, code);
      else if (cell.async)
        f2 = new AsyncFunction(...references2, code);
      else if (cell.generator)
        f2 = new GeneratorFunction(...references2, code);
      else
        f2 = new Function(...references2, code);
      return {
        cellName,
        cellFunction: f2,
        cellReferences
      };
    }
    function defaultResolveImportPath$1(path) {
      const source = extractPath(path);
      return import(`https://api.observablehq.com/${source}.js?v=3`).then((m2) => m2.default);
    }
    function defaultResolveFileAttachments$1(name) {
      return name;
    }
    class Interpreter2 {
      constructor(params = {}) {
        const {
          module: module2 = null,
          observer = null,
          resolveImportPath = defaultResolveImportPath$1,
          resolveFileAttachments = defaultResolveFileAttachments$1,
          defineImportMarkdown = true,
          observeViewofValues = true,
          observeMutableValues = true
        } = params;
        this.defaultModule = module2;
        this.defaultObserver = observer;
        this.resolveImportPath = resolveImportPath;
        this.resolveFileAttachments = resolveFileAttachments;
        this.defineImportMarkdown = defineImportMarkdown;
        this.observeViewofValues = observeViewofValues;
        this.observeMutableValues = observeMutableValues;
      }
      async module(input2, module2, observer) {
        module2 = module2 || this.defaultModule;
        observer = observer || this.defaultObserver;
        if (!module2)
          throw Error("No module provided.");
        if (!observer)
          throw Error("No observer provided.");
        const parsedModule = parseModule2(input2);
        const cellPromises = [];
        for (const cell of parsedModule.cells) {
          cell.input = input2;
          cellPromises.push(this.cell(cell, module2, observer));
        }
        return Promise.all(cellPromises);
      }
      async cell(input2, module2, observer) {
        module2 = module2 || this.defaultModule;
        observer = observer || this.defaultObserver;
        if (!module2)
          throw Error("No module provided.");
        if (!observer)
          throw Error("No observer provided.");
        let cell;
        if (typeof input2 === "string") {
          cell = parseCell(input2);
          cell.input = input2;
        } else {
          cell = input2;
        }
        if (cell.body.type === "ImportDeclaration") {
          const path = cell.body.source.value;
          const specs = cell.body.specifiers.map((d2) => {
            const prefix = d2.view ? "viewof " : d2.mutable ? "mutable " : "";
            return `${prefix}${d2.imported.name}`;
          });
          const fromModule = await this.resolveImportPath(path, specs);
          let mdVariable, vars;
          const {
            specifiers,
            hasInjections,
            injections,
            importString
          } = setupImportCell(cell);
          const other = module2._runtime.module(fromModule);
          if (this.defineImportMarkdown)
            mdVariable = module2.variable(observer()).define(null, ["md"], (md2) => md2`~~~javascript
  ${importString}
  ~~~`);
          if (hasInjections) {
            const child = other.derive(injections, module2);
            vars = specifiers.map(({ name, alias }) => module2.import(name, alias, child));
          } else {
            vars = specifiers.map(({ name, alias }) => module2.import(name, alias, other));
          }
          return mdVariable ? [mdVariable, ...vars] : vars;
        } else {
          const {
            cellName,
            cellFunction,
            cellReferences
          } = createRegularCellDefinition(cell);
          if (cell.id && cell.id.type === "ViewExpression") {
            const reference = `viewof ${cellName}`;
            return [
              module2.variable(observer(reference)).define(reference, cellReferences, cellFunction.bind(this)),
              module2.variable(this.observeViewofValues ? observer(cellName) : null).define(cellName, ["Generators", reference], (G2, _2) => G2.input(_2))
            ];
          } else if (cell.id && cell.id.type === "MutableExpression") {
            const initialName = `initial ${cellName}`;
            const mutableName = `mutable ${cellName}`;
            return [
              module2.variable(null).define(initialName, cellReferences, cellFunction),
              module2.variable(observer(mutableName)).define(mutableName, ["Mutable", initialName], (M2, _2) => new M2(_2)),
              module2.variable(this.observeMutableValues ? observer(cellName) : null).define(cellName, [mutableName], (_2) => _2.generator)
            ];
          } else {
            return [
              module2.variable(observer(cellName)).define(cellName, cellReferences, cellFunction.bind(this))
            ];
          }
        }
      }
    }
    exports2.Compiler = Compiler2;
    exports2.Interpreter = Interpreter2;
    exports2.parser = index;
    exports2.treeShakeModule = treeShakeModule2;
    Object.defineProperty(exports2, "__esModule", { value: true });
  });
});
var Compiler = dist.Compiler;
var Interpreter = dist.Interpreter;
var parser = dist.parser;
var treeShakeModule = dist.treeShakeModule;

// deno-cache:https://cdn.skypack.dev/-/isoformat@v0.2.1-D129mQndrQ7kSIrfUqky/dist=es2019,mode=imports/optimized/isoformat.js
function format(date, fallback) {
  if (!(date instanceof Date))
    date = new Date(+date);
  if (isNaN(date))
    return typeof fallback === "function" ? fallback(date) : fallback;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();
  return `${formatYear(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}${hours || minutes || seconds || milliseconds ? `T${pad(hours, 2)}:${pad(minutes, 2)}${seconds || milliseconds ? `:${pad(seconds, 2)}${milliseconds ? `.${pad(milliseconds, 3)}` : ``}` : ``}Z` : ``}`;
}
function formatYear(year) {
  return year < 0 ? `-${pad(-year, 6)}` : year > 9999 ? `+${pad(year, 6)}` : pad(year, 4);
}
function pad(value, width2) {
  return `${value}`.padStart(width2, "0");
}

// deno-cache:https://cdn.skypack.dev/-/@observablehq/inspector@v3.2.4-e5doxF889BMiDa5rqwqO/dist=es2019,mode=imports/optimized/@observablehq/inspector.js
function dispatch(node, type, detail) {
  detail = detail || {};
  var document2 = node.ownerDocument, event = document2.defaultView.CustomEvent;
  if (typeof event === "function") {
    event = new event(type, { detail });
  } else {
    event = document2.createEvent("Event");
    event.initEvent(type, false, false);
    event.detail = detail;
  }
  node.dispatchEvent(event);
}
function isarray(value) {
  return Array.isArray(value) || value instanceof Int8Array || value instanceof Int16Array || value instanceof Int32Array || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Uint16Array || value instanceof Uint32Array || value instanceof Float32Array || value instanceof Float64Array;
}
function isindex(key) {
  return key === (key | 0) + "";
}
function inspectName(name) {
  const n2 = document.createElement("span");
  n2.className = "observablehq--cellname";
  n2.textContent = `${name} = `;
  return n2;
}
var symbolToString = Symbol.prototype.toString;
function formatSymbol(symbol) {
  return symbolToString.call(symbol);
}
var { getOwnPropertySymbols, prototype: { hasOwnProperty } } = Object;
var { toStringTag } = Symbol;
var FORBIDDEN = {};
var symbolsof = getOwnPropertySymbols;
function isown(object, key) {
  return hasOwnProperty.call(object, key);
}
function tagof(object) {
  return object[toStringTag] || object.constructor && object.constructor.name || "Object";
}
function valueof(object, key) {
  try {
    const value = object[key];
    if (value)
      value.constructor;
    return value;
  } catch (ignore2) {
    return FORBIDDEN;
  }
}
var SYMBOLS = [
  { symbol: "@@__IMMUTABLE_INDEXED__@@", name: "Indexed", modifier: true },
  { symbol: "@@__IMMUTABLE_KEYED__@@", name: "Keyed", modifier: true },
  { symbol: "@@__IMMUTABLE_LIST__@@", name: "List", arrayish: true },
  { symbol: "@@__IMMUTABLE_MAP__@@", name: "Map" },
  {
    symbol: "@@__IMMUTABLE_ORDERED__@@",
    name: "Ordered",
    modifier: true,
    prefix: true
  },
  { symbol: "@@__IMMUTABLE_RECORD__@@", name: "Record" },
  {
    symbol: "@@__IMMUTABLE_SET__@@",
    name: "Set",
    arrayish: true,
    setish: true
  },
  { symbol: "@@__IMMUTABLE_STACK__@@", name: "Stack", arrayish: true }
];
function immutableName(obj) {
  try {
    let symbols = SYMBOLS.filter(({ symbol }) => obj[symbol] === true);
    if (!symbols.length)
      return;
    const name = symbols.find((s2) => !s2.modifier);
    const prefix = name.name === "Map" && symbols.find((s2) => s2.modifier && s2.prefix);
    const arrayish = symbols.some((s2) => s2.arrayish);
    const setish = symbols.some((s2) => s2.setish);
    return {
      name: `${prefix ? prefix.name : ""}${name.name}`,
      symbols,
      arrayish: arrayish && !setish,
      setish
    };
  } catch (e2) {
    return null;
  }
}
var { getPrototypeOf, getOwnPropertyDescriptors } = Object;
var objectPrototype = getPrototypeOf({});
function inspectExpanded(object, _2, name, proto) {
  let arrayish = isarray(object);
  let tag, fields, next, n2;
  if (object instanceof Map) {
    if (object instanceof object.constructor) {
      tag = `Map(${object.size})`;
      fields = iterateMap;
    } else {
      tag = "Map()";
      fields = iterateObject;
    }
  } else if (object instanceof Set) {
    if (object instanceof object.constructor) {
      tag = `Set(${object.size})`;
      fields = iterateSet;
    } else {
      tag = "Set()";
      fields = iterateObject;
    }
  } else if (arrayish) {
    tag = `${object.constructor.name}(${object.length})`;
    fields = iterateArray;
  } else if (n2 = immutableName(object)) {
    tag = `Immutable.${n2.name}${n2.name === "Record" ? "" : `(${object.size})`}`;
    arrayish = n2.arrayish;
    fields = n2.arrayish ? iterateImArray : n2.setish ? iterateImSet : iterateImObject;
  } else if (proto) {
    tag = tagof(object);
    fields = iterateProto;
  } else {
    tag = tagof(object);
    fields = iterateObject;
  }
  const span = document.createElement("span");
  span.className = "observablehq--expanded";
  if (name) {
    span.appendChild(inspectName(name));
  }
  const a2 = span.appendChild(document.createElement("a"));
  a2.innerHTML = `<svg width=8 height=8 class='observablehq--caret'>
    <path d='M4 7L0 1h8z' fill='currentColor' />
  </svg>`;
  a2.appendChild(document.createTextNode(`${tag}${arrayish ? " [" : " {"}`));
  a2.addEventListener("mouseup", function(event) {
    event.stopPropagation();
    replace(span, inspectCollapsed(object, null, name, proto));
  });
  fields = fields(object);
  for (let i2 = 0; !(next = fields.next()).done && i2 < 20; ++i2) {
    span.appendChild(next.value);
  }
  if (!next.done) {
    const a22 = span.appendChild(document.createElement("a"));
    a22.className = "observablehq--field";
    a22.style.display = "block";
    a22.appendChild(document.createTextNode(`  \u2026 more`));
    a22.addEventListener("mouseup", function(event) {
      event.stopPropagation();
      span.insertBefore(next.value, span.lastChild.previousSibling);
      for (let i2 = 0; !(next = fields.next()).done && i2 < 19; ++i2) {
        span.insertBefore(next.value, span.lastChild.previousSibling);
      }
      if (next.done)
        span.removeChild(span.lastChild.previousSibling);
      dispatch(span, "load");
    });
  }
  span.appendChild(document.createTextNode(arrayish ? "]" : "}"));
  return span;
}
function* iterateMap(map4) {
  for (const [key, value] of map4) {
    yield formatMapField(key, value);
  }
  yield* iterateObject(map4);
}
function* iterateSet(set) {
  for (const value of set) {
    yield formatSetField(value);
  }
  yield* iterateObject(set);
}
function* iterateImSet(set) {
  for (const value of set) {
    yield formatSetField(value);
  }
}
function* iterateArray(array) {
  for (let i2 = 0, n2 = array.length; i2 < n2; ++i2) {
    if (i2 in array) {
      yield formatField(i2, valueof(array, i2), "observablehq--index");
    }
  }
  for (const key in array) {
    if (!isindex(key) && isown(array, key)) {
      yield formatField(key, valueof(array, key), "observablehq--key");
    }
  }
  for (const symbol of symbolsof(array)) {
    yield formatField(formatSymbol(symbol), valueof(array, symbol), "observablehq--symbol");
  }
}
function* iterateImArray(array) {
  let i1 = 0;
  for (const n2 = array.size; i1 < n2; ++i1) {
    yield formatField(i1, array.get(i1), true);
  }
}
function* iterateProto(object) {
  for (const key in getOwnPropertyDescriptors(object)) {
    yield formatField(key, valueof(object, key), "observablehq--key");
  }
  for (const symbol of symbolsof(object)) {
    yield formatField(formatSymbol(symbol), valueof(object, symbol), "observablehq--symbol");
  }
  const proto = getPrototypeOf(object);
  if (proto && proto !== objectPrototype) {
    yield formatPrototype(proto);
  }
}
function* iterateObject(object) {
  for (const key in object) {
    if (isown(object, key)) {
      yield formatField(key, valueof(object, key), "observablehq--key");
    }
  }
  for (const symbol of symbolsof(object)) {
    yield formatField(formatSymbol(symbol), valueof(object, symbol), "observablehq--symbol");
  }
  const proto = getPrototypeOf(object);
  if (proto && proto !== objectPrototype) {
    yield formatPrototype(proto);
  }
}
function* iterateImObject(object) {
  for (const [key, value] of object) {
    yield formatField(key, value, "observablehq--key");
  }
}
function formatPrototype(value) {
  const item = document.createElement("div");
  const span = item.appendChild(document.createElement("span"));
  item.className = "observablehq--field";
  span.className = "observablehq--prototype-key";
  span.textContent = `  <prototype>`;
  item.appendChild(document.createTextNode(": "));
  item.appendChild(inspect(value, void 0, void 0, void 0, true));
  return item;
}
function formatField(key, value, className) {
  const item = document.createElement("div");
  const span = item.appendChild(document.createElement("span"));
  item.className = "observablehq--field";
  span.className = className;
  span.textContent = `  ${key}`;
  item.appendChild(document.createTextNode(": "));
  item.appendChild(inspect(value));
  return item;
}
function formatMapField(key, value) {
  const item = document.createElement("div");
  item.className = "observablehq--field";
  item.appendChild(document.createTextNode("  "));
  item.appendChild(inspect(key));
  item.appendChild(document.createTextNode(" => "));
  item.appendChild(inspect(value));
  return item;
}
function formatSetField(value) {
  const item = document.createElement("div");
  item.className = "observablehq--field";
  item.appendChild(document.createTextNode("  "));
  item.appendChild(inspect(value));
  return item;
}
function hasSelection(elem) {
  const sel = window.getSelection();
  return sel.type === "Range" && (sel.containsNode(elem, true) || sel.anchorNode.isSelfOrDescendant(elem) || sel.focusNode.isSelfOrDescendant(elem));
}
function inspectCollapsed(object, shallow, name, proto) {
  let arrayish = isarray(object);
  let tag, fields, next, n2;
  if (object instanceof Map) {
    if (object instanceof object.constructor) {
      tag = `Map(${object.size})`;
      fields = iterateMap$1;
    } else {
      tag = "Map()";
      fields = iterateObject$1;
    }
  } else if (object instanceof Set) {
    if (object instanceof object.constructor) {
      tag = `Set(${object.size})`;
      fields = iterateSet$1;
    } else {
      tag = "Set()";
      fields = iterateObject$1;
    }
  } else if (arrayish) {
    tag = `${object.constructor.name}(${object.length})`;
    fields = iterateArray$1;
  } else if (n2 = immutableName(object)) {
    tag = `Immutable.${n2.name}${n2.name === "Record" ? "" : `(${object.size})`}`;
    arrayish = n2.arrayish;
    fields = n2.arrayish ? iterateImArray$1 : n2.setish ? iterateImSet$1 : iterateImObject$1;
  } else {
    tag = tagof(object);
    fields = iterateObject$1;
  }
  if (shallow) {
    const span2 = document.createElement("span");
    span2.className = "observablehq--shallow";
    if (name) {
      span2.appendChild(inspectName(name));
    }
    span2.appendChild(document.createTextNode(tag));
    span2.addEventListener("mouseup", function(event) {
      if (hasSelection(span2))
        return;
      event.stopPropagation();
      replace(span2, inspectCollapsed(object));
    });
    return span2;
  }
  const span = document.createElement("span");
  span.className = "observablehq--collapsed";
  if (name) {
    span.appendChild(inspectName(name));
  }
  const a2 = span.appendChild(document.createElement("a"));
  a2.innerHTML = `<svg width=8 height=8 class='observablehq--caret'>
    <path d='M7 4L1 8V0z' fill='currentColor' />
  </svg>`;
  a2.appendChild(document.createTextNode(`${tag}${arrayish ? " [" : " {"}`));
  span.addEventListener("mouseup", function(event) {
    if (hasSelection(span))
      return;
    event.stopPropagation();
    replace(span, inspectExpanded(object, null, name, proto));
  }, true);
  fields = fields(object);
  for (let i2 = 0; !(next = fields.next()).done && i2 < 20; ++i2) {
    if (i2 > 0)
      span.appendChild(document.createTextNode(", "));
    span.appendChild(next.value);
  }
  if (!next.done)
    span.appendChild(document.createTextNode(", \u2026"));
  span.appendChild(document.createTextNode(arrayish ? "]" : "}"));
  return span;
}
function* iterateMap$1(map4) {
  for (const [key, value] of map4) {
    yield formatMapField$1(key, value);
  }
  yield* iterateObject$1(map4);
}
function* iterateSet$1(set) {
  for (const value of set) {
    yield inspect(value, true);
  }
  yield* iterateObject$1(set);
}
function* iterateImSet$1(set) {
  for (const value of set) {
    yield inspect(value, true);
  }
}
function* iterateImArray$1(array) {
  let i0 = -1, i1 = 0;
  for (const n2 = array.size; i1 < n2; ++i1) {
    if (i1 > i0 + 1)
      yield formatEmpty(i1 - i0 - 1);
    yield inspect(array.get(i1), true);
    i0 = i1;
  }
  if (i1 > i0 + 1)
    yield formatEmpty(i1 - i0 - 1);
}
function* iterateArray$1(array) {
  let i0 = -1, i1 = 0;
  for (const n2 = array.length; i1 < n2; ++i1) {
    if (i1 in array) {
      if (i1 > i0 + 1)
        yield formatEmpty(i1 - i0 - 1);
      yield inspect(valueof(array, i1), true);
      i0 = i1;
    }
  }
  if (i1 > i0 + 1)
    yield formatEmpty(i1 - i0 - 1);
  for (const key in array) {
    if (!isindex(key) && isown(array, key)) {
      yield formatField$1(key, valueof(array, key), "observablehq--key");
    }
  }
  for (const symbol of symbolsof(array)) {
    yield formatField$1(formatSymbol(symbol), valueof(array, symbol), "observablehq--symbol");
  }
}
function* iterateObject$1(object) {
  for (const key in object) {
    if (isown(object, key)) {
      yield formatField$1(key, valueof(object, key), "observablehq--key");
    }
  }
  for (const symbol of symbolsof(object)) {
    yield formatField$1(formatSymbol(symbol), valueof(object, symbol), "observablehq--symbol");
  }
}
function* iterateImObject$1(object) {
  for (const [key, value] of object) {
    yield formatField$1(key, value, "observablehq--key");
  }
}
function formatEmpty(e2) {
  const span = document.createElement("span");
  span.className = "observablehq--empty";
  span.textContent = e2 === 1 ? "empty" : `empty \xD7 ${e2}`;
  return span;
}
function formatField$1(key, value, className) {
  const fragment = document.createDocumentFragment();
  const span = fragment.appendChild(document.createElement("span"));
  span.className = className;
  span.textContent = key;
  fragment.appendChild(document.createTextNode(": "));
  fragment.appendChild(inspect(value, true));
  return fragment;
}
function formatMapField$1(key, value) {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(inspect(key, true));
  fragment.appendChild(document.createTextNode(" => "));
  fragment.appendChild(inspect(value, true));
  return fragment;
}
function formatDate(date) {
  return format(date, "Invalid Date");
}
var errorToString = Error.prototype.toString;
function formatError(value) {
  return value.stack || errorToString.call(value);
}
var regExpToString = RegExp.prototype.toString;
function formatRegExp(value) {
  return regExpToString.call(value);
}
var NEWLINE_LIMIT = 20;
function formatString(string, shallow, expanded, name) {
  if (shallow === false) {
    if (count(string, /["\n]/g) <= count(string, /`|\${/g)) {
      const span3 = document.createElement("span");
      if (name)
        span3.appendChild(inspectName(name));
      const textValue3 = span3.appendChild(document.createElement("span"));
      textValue3.className = "observablehq--string";
      textValue3.textContent = JSON.stringify(string);
      return span3;
    }
    const lines = string.split("\n");
    if (lines.length > NEWLINE_LIMIT && !expanded) {
      const div = document.createElement("div");
      if (name)
        div.appendChild(inspectName(name));
      const textValue3 = div.appendChild(document.createElement("span"));
      textValue3.className = "observablehq--string";
      textValue3.textContent = "`" + templatify(lines.slice(0, NEWLINE_LIMIT).join("\n"));
      const splitter = div.appendChild(document.createElement("span"));
      const truncatedCount = lines.length - NEWLINE_LIMIT;
      splitter.textContent = `Show ${truncatedCount} truncated line${truncatedCount > 1 ? "s" : ""}`;
      splitter.className = "observablehq--string-expand";
      splitter.addEventListener("mouseup", function(event) {
        event.stopPropagation();
        replace(div, inspect(string, shallow, true, name));
      });
      return div;
    }
    const span2 = document.createElement("span");
    if (name)
      span2.appendChild(inspectName(name));
    const textValue2 = span2.appendChild(document.createElement("span"));
    textValue2.className = `observablehq--string${expanded ? " observablehq--expanded" : ""}`;
    textValue2.textContent = "`" + templatify(string) + "`";
    return span2;
  }
  const span = document.createElement("span");
  if (name)
    span.appendChild(inspectName(name));
  const textValue = span.appendChild(document.createElement("span"));
  textValue.className = "observablehq--string";
  textValue.textContent = JSON.stringify(string.length > 100 ? `${string.slice(0, 50)}\u2026${string.slice(-49)}` : string);
  return span;
}
function templatify(string) {
  return string.replace(/[\\`\x00-\x09\x0b-\x19]|\${/g, templatifyChar);
}
function templatifyChar(char) {
  var code = char.charCodeAt(0);
  switch (code) {
    case 8:
      return "\\b";
    case 9:
      return "\\t";
    case 11:
      return "\\v";
    case 12:
      return "\\f";
    case 13:
      return "\\r";
  }
  return code < 16 ? "\\x0" + code.toString(16) : code < 32 ? "\\x" + code.toString(16) : "\\" + char;
}
function count(string, re2) {
  var n2 = 0;
  while (re2.exec(string))
    ++n2;
  return n2;
}
var toString = Function.prototype.toString;
var TYPE_ASYNC = { prefix: "async \u0192" };
var TYPE_ASYNC_GENERATOR = { prefix: "async \u0192*" };
var TYPE_CLASS = { prefix: "class" };
var TYPE_FUNCTION = { prefix: "\u0192" };
var TYPE_GENERATOR = { prefix: "\u0192*" };
function inspectFunction(f2, name) {
  var type, m2, t2 = toString.call(f2);
  switch (f2.constructor && f2.constructor.name) {
    case "AsyncFunction":
      type = TYPE_ASYNC;
      break;
    case "AsyncGeneratorFunction":
      type = TYPE_ASYNC_GENERATOR;
      break;
    case "GeneratorFunction":
      type = TYPE_GENERATOR;
      break;
    default:
      type = /^class\b/.test(t2) ? TYPE_CLASS : TYPE_FUNCTION;
      break;
  }
  if (type === TYPE_CLASS) {
    return formatFunction(type, "", name);
  }
  if (m2 = /^(?:async\s*)?(\w+)\s*=>/.exec(t2)) {
    return formatFunction(type, "(" + m2[1] + ")", name);
  }
  if (m2 = /^(?:async\s*)?\(\s*(\w+(?:\s*,\s*\w+)*)?\s*\)/.exec(t2)) {
    return formatFunction(type, m2[1] ? "(" + m2[1].replace(/\s*,\s*/g, ", ") + ")" : "()", name);
  }
  if (m2 = /^(?:async\s*)?function(?:\s*\*)?(?:\s*\w+)?\s*\(\s*(\w+(?:\s*,\s*\w+)*)?\s*\)/.exec(t2)) {
    return formatFunction(type, m2[1] ? "(" + m2[1].replace(/\s*,\s*/g, ", ") + ")" : "()", name);
  }
  return formatFunction(type, "(\u2026)", name);
}
function formatFunction(type, args, cellname) {
  var span = document.createElement("span");
  span.className = "observablehq--function";
  if (cellname) {
    span.appendChild(inspectName(cellname));
  }
  var spanType = span.appendChild(document.createElement("span"));
  spanType.className = "observablehq--keyword";
  spanType.textContent = type.prefix;
  span.appendChild(document.createTextNode(args));
  return span;
}
var { prototype: { toString: toString$1 } } = Object;
function inspect(value, shallow, expand, name, proto) {
  let type = typeof value;
  switch (type) {
    case "boolean":
    case "undefined": {
      value += "";
      break;
    }
    case "number": {
      value = value === 0 && 1 / value < 0 ? "-0" : value + "";
      break;
    }
    case "bigint": {
      value = value + "n";
      break;
    }
    case "symbol": {
      value = formatSymbol(value);
      break;
    }
    case "function": {
      return inspectFunction(value, name);
    }
    case "string": {
      return formatString(value, shallow, expand, name);
    }
    default: {
      if (value === null) {
        type = null, value = "null";
        break;
      }
      if (value instanceof Date) {
        type = "date", value = formatDate(value);
        break;
      }
      if (value === FORBIDDEN) {
        type = "forbidden", value = "[forbidden]";
        break;
      }
      switch (toString$1.call(value)) {
        case "[object RegExp]": {
          type = "regexp", value = formatRegExp(value);
          break;
        }
        case "[object Error]":
        case "[object DOMException]": {
          type = "error", value = formatError(value);
          break;
        }
        default:
          return (expand ? inspectExpanded : inspectCollapsed)(value, shallow, name, proto);
      }
      break;
    }
  }
  const span = document.createElement("span");
  if (name)
    span.appendChild(inspectName(name));
  const n2 = span.appendChild(document.createElement("span"));
  n2.className = `observablehq--${type}`;
  n2.textContent = value;
  return span;
}
function replace(spanOld, spanNew) {
  if (spanOld.classList.contains("observablehq--inspect"))
    spanNew.classList.add("observablehq--inspect");
  spanOld.parentNode.replaceChild(spanNew, spanOld);
  dispatch(spanNew, "load");
}
var LOCATION_MATCH = /\s+\(\d+:\d+\)$/m;
var Inspector = class {
  constructor(node) {
    if (!node)
      throw new Error("invalid node");
    this._node = node;
    node.classList.add("observablehq");
  }
  pending() {
    const { _node } = this;
    _node.classList.remove("observablehq--error");
    _node.classList.add("observablehq--running");
  }
  fulfilled(value, name) {
    const { _node } = this;
    if (!isnode(value) || value.parentNode && value.parentNode !== _node) {
      value = inspect(value, false, _node.firstChild && _node.firstChild.classList && _node.firstChild.classList.contains("observablehq--expanded"), name);
      value.classList.add("observablehq--inspect");
    }
    _node.classList.remove("observablehq--running", "observablehq--error");
    if (_node.firstChild !== value) {
      if (_node.firstChild) {
        while (_node.lastChild !== _node.firstChild)
          _node.removeChild(_node.lastChild);
        _node.replaceChild(value, _node.firstChild);
      } else {
        _node.appendChild(value);
      }
    }
    dispatch(_node, "update");
  }
  rejected(error, name) {
    const { _node } = this;
    _node.classList.remove("observablehq--running");
    _node.classList.add("observablehq--error");
    while (_node.lastChild)
      _node.removeChild(_node.lastChild);
    var div = document.createElement("div");
    div.className = "observablehq--inspect";
    if (name)
      div.appendChild(inspectName(name));
    div.appendChild(document.createTextNode((error + "").replace(LOCATION_MATCH, "")));
    _node.appendChild(div);
    dispatch(_node, "error", { error });
  }
};
Inspector.into = function(container) {
  if (typeof container === "string") {
    container = document.querySelector(container);
    if (container == null)
      throw new Error("container not found");
  }
  return function() {
    return new Inspector(container.appendChild(document.createElement("div")));
  };
};
function isnode(value) {
  return (value instanceof Element || value instanceof Text) && value instanceof value.constructor;
}

// deno-cache:https://cdn.skypack.dev/-/d3-dsv@v2.0.0-uUdcwldzPANNPyEGKCUn/dist=es2019,mode=imports/optimized/d3-dsv.js
var EOL = {};
var EOF = {};
var QUOTE = 34;
var NEWLINE = 10;
var RETURN = 13;
function objectConverter(columns) {
  return new Function("d", "return {" + columns.map(function(name, i2) {
    return JSON.stringify(name) + ": d[" + i2 + '] || ""';
  }).join(",") + "}");
}
function customConverter(columns, f2) {
  var object = objectConverter(columns);
  return function(row, i2) {
    return f2(object(row), i2, columns);
  };
}
function inferColumns(rows) {
  var columnSet = Object.create(null), columns = [];
  rows.forEach(function(row) {
    for (var column in row) {
      if (!(column in columnSet)) {
        columns.push(columnSet[column] = column);
      }
    }
  });
  return columns;
}
function pad2(value, width2) {
  var s2 = value + "", length2 = s2.length;
  return length2 < width2 ? new Array(width2 - length2 + 1).join(0) + s2 : s2;
}
function formatYear2(year) {
  return year < 0 ? "-" + pad2(-year, 6) : year > 9999 ? "+" + pad2(year, 6) : pad2(year, 4);
}
function formatDate2(date) {
  var hours = date.getUTCHours(), minutes = date.getUTCMinutes(), seconds = date.getUTCSeconds(), milliseconds = date.getUTCMilliseconds();
  return isNaN(date) ? "Invalid Date" : formatYear2(date.getUTCFullYear()) + "-" + pad2(date.getUTCMonth() + 1, 2) + "-" + pad2(date.getUTCDate(), 2) + (milliseconds ? "T" + pad2(hours, 2) + ":" + pad2(minutes, 2) + ":" + pad2(seconds, 2) + "." + pad2(milliseconds, 3) + "Z" : seconds ? "T" + pad2(hours, 2) + ":" + pad2(minutes, 2) + ":" + pad2(seconds, 2) + "Z" : minutes || hours ? "T" + pad2(hours, 2) + ":" + pad2(minutes, 2) + "Z" : "");
}
function dsv(delimiter) {
  var reFormat = new RegExp('["' + delimiter + "\n\r]"), DELIMITER = delimiter.charCodeAt(0);
  function parse3(text2, f2) {
    var convert, columns, rows = parseRows(text2, function(row, i2) {
      if (convert)
        return convert(row, i2 - 1);
      columns = row, convert = f2 ? customConverter(row, f2) : objectConverter(row);
    });
    rows.columns = columns || [];
    return rows;
  }
  function parseRows(text2, f2) {
    var rows = [], N2 = text2.length, I2 = 0, n2 = 0, t2, eof = N2 <= 0, eol = false;
    if (text2.charCodeAt(N2 - 1) === NEWLINE)
      --N2;
    if (text2.charCodeAt(N2 - 1) === RETURN)
      --N2;
    function token() {
      if (eof)
        return EOF;
      if (eol)
        return eol = false, EOL;
      var i2, j2 = I2, c2;
      if (text2.charCodeAt(j2) === QUOTE) {
        while (I2++ < N2 && text2.charCodeAt(I2) !== QUOTE || text2.charCodeAt(++I2) === QUOTE)
          ;
        if ((i2 = I2) >= N2)
          eof = true;
        else if ((c2 = text2.charCodeAt(I2++)) === NEWLINE)
          eol = true;
        else if (c2 === RETURN) {
          eol = true;
          if (text2.charCodeAt(I2) === NEWLINE)
            ++I2;
        }
        return text2.slice(j2 + 1, i2 - 1).replace(/""/g, '"');
      }
      while (I2 < N2) {
        if ((c2 = text2.charCodeAt(i2 = I2++)) === NEWLINE)
          eol = true;
        else if (c2 === RETURN) {
          eol = true;
          if (text2.charCodeAt(I2) === NEWLINE)
            ++I2;
        } else if (c2 !== DELIMITER)
          continue;
        return text2.slice(j2, i2);
      }
      return eof = true, text2.slice(j2, N2);
    }
    while ((t2 = token()) !== EOF) {
      var row = [];
      while (t2 !== EOL && t2 !== EOF)
        row.push(t2), t2 = token();
      if (f2 && (row = f2(row, n2++)) == null)
        continue;
      rows.push(row);
    }
    return rows;
  }
  function preformatBody(rows, columns) {
    return rows.map(function(row) {
      return columns.map(function(column) {
        return formatValue(row[column]);
      }).join(delimiter);
    });
  }
  function format2(rows, columns) {
    if (columns == null)
      columns = inferColumns(rows);
    return [columns.map(formatValue).join(delimiter)].concat(preformatBody(rows, columns)).join("\n");
  }
  function formatBody(rows, columns) {
    if (columns == null)
      columns = inferColumns(rows);
    return preformatBody(rows, columns).join("\n");
  }
  function formatRows(rows) {
    return rows.map(formatRow).join("\n");
  }
  function formatRow(row) {
    return row.map(formatValue).join(delimiter);
  }
  function formatValue(value) {
    return value == null ? "" : value instanceof Date ? formatDate2(value) : reFormat.test(value += "") ? '"' + value.replace(/"/g, '""') + '"' : value;
  }
  return {
    parse: parse3,
    parseRows,
    format: format2,
    formatBody,
    formatRows,
    formatRow,
    formatValue
  };
}
var csv = dsv(",");
var csvParse = csv.parse;
var csvParseRows = csv.parseRows;
var csvFormat = csv.format;
var csvFormatBody = csv.formatBody;
var csvFormatRows = csv.formatRows;
var csvFormatRow = csv.formatRow;
var csvFormatValue = csv.formatValue;
var tsv = dsv("	");
var tsvParse = tsv.parse;
var tsvParseRows = tsv.parseRows;
var tsvFormat = tsv.format;
var tsvFormatBody = tsv.formatBody;
var tsvFormatRows = tsv.formatRows;
var tsvFormatRow = tsv.formatRow;
var tsvFormatValue = tsv.formatValue;
function autoType(object) {
  for (var key in object) {
    var value = object[key].trim(), number, m2;
    if (!value)
      value = null;
    else if (value === "true")
      value = true;
    else if (value === "false")
      value = false;
    else if (value === "NaN")
      value = NaN;
    else if (!isNaN(number = +value))
      value = number;
    else if (m2 = value.match(/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/)) {
      if (fixtz && !!m2[4] && !m2[7])
        value = value.replace(/-/g, "/").replace(/T/, " ");
      value = new Date(value);
    } else
      continue;
    object[key] = value;
  }
  return object;
}
var fixtz = new Date("2019-01-01T00:00").getHours() || new Date("2019-07-01T00:00").getHours();

// deno-cache:https://cdn.skypack.dev/-/d3-require@v1.2.4-HOwOowIbLhzyxDCc5K9k/dist=es2019,mode=imports/optimized/d3-require.js
var metas = new Map();
var queue = [];
var map = queue.map;
var some = queue.some;
var hasOwnProperty2 = queue.hasOwnProperty;
var origin = "https://cdn.jsdelivr.net/npm/";
var identifierRe = /^((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(?:\/(.*))?$/;
var versionRe = /^\d+\.\d+\.\d+(-[\w-.+]+)?$/;
var extensionRe = /\.[^/]*$/;
var mains = ["unpkg", "jsdelivr", "browser", "main"];
var RequireError = class extends Error {
  constructor(message) {
    super(message);
  }
};
RequireError.prototype.name = RequireError.name;
function main(meta) {
  for (const key of mains) {
    const value = meta[key];
    if (typeof value === "string") {
      return extensionRe.test(value) ? value : `${value}.js`;
    }
  }
}
function parseIdentifier(identifier) {
  const match = identifierRe.exec(identifier);
  return match && {
    name: match[1],
    version: match[2],
    path: match[3]
  };
}
function resolveMeta(target) {
  const url2 = `${origin}${target.name}${target.version ? `@${target.version}` : ""}/package.json`;
  let meta = metas.get(url2);
  if (!meta)
    metas.set(url2, meta = fetch(url2).then((response) => {
      if (!response.ok)
        throw new RequireError("unable to load package.json");
      if (response.redirected && !metas.has(response.url))
        metas.set(response.url, meta);
      return response.json();
    }));
  return meta;
}
async function resolve(name, base2) {
  if (name.startsWith(origin))
    name = name.substring(origin.length);
  if (/^(\w+:)|\/\//i.test(name))
    return name;
  if (/^[.]{0,2}\//i.test(name))
    return new URL(name, base2 == null ? location : base2).href;
  if (!name.length || /^[\s._]/.test(name) || /\s$/.test(name))
    throw new RequireError("illegal name");
  const target = parseIdentifier(name);
  if (!target)
    return `${origin}${name}`;
  if (!target.version && base2 != null && base2.startsWith(origin)) {
    const meta2 = await resolveMeta(parseIdentifier(base2.substring(origin.length)));
    target.version = meta2.dependencies && meta2.dependencies[target.name] || meta2.peerDependencies && meta2.peerDependencies[target.name];
  }
  if (target.path && !extensionRe.test(target.path))
    target.path += ".js";
  if (target.path && target.version && versionRe.test(target.version))
    return `${origin}${target.name}@${target.version}/${target.path}`;
  const meta = await resolveMeta(target);
  return `${origin}${meta.name}@${meta.version}/${target.path || main(meta) || "index.js"}`;
}
var require2 = requireFrom(resolve);
function requireFrom(resolver) {
  const cache = new Map();
  const requireBase = requireRelative(null);
  function requireAbsolute(url2) {
    if (typeof url2 !== "string")
      return url2;
    let module = cache.get(url2);
    if (!module)
      cache.set(url2, module = new Promise((resolve22, reject) => {
        const script = document.createElement("script");
        script.onload = () => {
          try {
            resolve22(queue.pop()(requireRelative(url2)));
          } catch (error) {
            reject(new RequireError("invalid module"));
          }
          script.remove();
        };
        script.onerror = () => {
          reject(new RequireError("unable to load module"));
          script.remove();
        };
        script.async = true;
        script.src = url2;
        window.define = define;
        document.head.appendChild(script);
      }));
    return module;
  }
  function requireRelative(base2) {
    return (name) => Promise.resolve(resolver(name, base2)).then(requireAbsolute);
  }
  function requireAlias(aliases) {
    return requireFrom((name, base2) => {
      if (name in aliases) {
        name = aliases[name], base2 = null;
        if (typeof name !== "string")
          return name;
      }
      return resolver(name, base2);
    });
  }
  function require22(name) {
    return arguments.length > 1 ? Promise.all(map.call(arguments, requireBase)).then(merge) : requireBase(name);
  }
  require22.alias = requireAlias;
  require22.resolve = resolver;
  return require22;
}
function merge(modules) {
  const o2 = {};
  for (const m2 of modules) {
    for (const k2 in m2) {
      if (hasOwnProperty2.call(m2, k2)) {
        if (m2[k2] == null)
          Object.defineProperty(o2, k2, { get: getter(m2, k2) });
        else
          o2[k2] = m2[k2];
      }
    }
  }
  return o2;
}
function getter(object, name) {
  return () => object[name];
}
function isbuiltin(name) {
  name = name + "";
  return name === "exports" || name === "module";
}
function define(name, dependencies, factory) {
  const n2 = arguments.length;
  if (n2 < 2)
    factory = name, dependencies = [];
  else if (n2 < 3)
    factory = dependencies, dependencies = typeof name === "string" ? [] : name;
  queue.push(some.call(dependencies, isbuiltin) ? (require22) => {
    const exports = {};
    const module = { exports };
    return Promise.all(map.call(dependencies, (name2) => {
      name2 = name2 + "";
      return name2 === "exports" ? exports : name2 === "module" ? module : require22(name2);
    })).then((dependencies2) => {
      factory.apply(null, dependencies2);
      return module.exports;
    });
  } : (require22) => {
    return Promise.all(map.call(dependencies, require22)).then((dependencies2) => {
      return typeof factory === "function" ? factory.apply(null, dependencies2) : factory;
    });
  });
}
define.amd = {};

// deno-cache:https://cdn.skypack.dev/-/@observablehq/stdlib@v3.15.3-zDit5zaAL9yeThpfUzaE/dist=es2019,mode=imports/optimized/@observablehq/stdlib.js
function dependency(name, version2, main2) {
  return {
    resolve(path = main2) {
      return `https://cdn.jsdelivr.net/npm/${name}@${version2}/${path}`;
    }
  };
}
var d3 = dependency("d3", "7.2.1", "dist/d3.min.js");
var inputs = dependency("@observablehq/inputs", "0.10.4", "dist/inputs.min.js");
var plot = dependency("@observablehq/plot", "0.3.2", "dist/plot.umd.min.js");
var graphviz = dependency("@observablehq/graphviz", "0.2.1", "dist/graphviz.min.js");
var highlight = dependency("@observablehq/highlight.js", "2.0.0", "highlight.min.js");
var katex = dependency("@observablehq/katex", "0.11.1", "dist/katex.min.js");
var lodash = dependency("lodash", "4.17.21", "lodash.min.js");
var htl = dependency("htl", "0.3.1", "dist/htl.min.js");
var jszip = dependency("jszip", "3.7.1", "dist/jszip.min.js");
var marked = dependency("marked", "0.3.12", "marked.min.js");
var sql = dependency("sql.js", "1.6.2", "dist/sql-wasm.js");
var vega = dependency("vega", "5.21.0", "build/vega.min.js");
var vegalite = dependency("vega-lite", "5.2.0", "build/vega-lite.min.js");
var vegaliteApi = dependency("vega-lite-api", "5.0.0", "build/vega-lite-api.min.js");
var arrow = dependency("apache-arrow", "4.0.1", "Arrow.es2015.min.js");
var arquero = dependency("arquero", "4.8.7", "dist/arquero.min.js");
var topojson = dependency("topojson-client", "3.1.0", "dist/topojson-client.min.js");
var exceljs = dependency("exceljs", "4.3.0", "dist/exceljs.min.js");
async function sqlite(require22) {
  const init = await require22(sql.resolve());
  return init({ locateFile: (file) => sql.resolve(`dist/${file}`) });
}
var SQLiteDatabaseClient = class {
  constructor(db) {
    Object.defineProperties(this, {
      _db: { value: db }
    });
  }
  static async open(source) {
    const [SQL, buffer2] = await Promise.all([sqlite(require2), Promise.resolve(source).then(load)]);
    return new SQLiteDatabaseClient(new SQL.Database(buffer2));
  }
  async query(query, params) {
    return await exec(this._db, query, params);
  }
  async queryRow(query, params) {
    return (await this.query(query, params))[0] || null;
  }
  async explain(query, params) {
    const rows = await this.query(`EXPLAIN QUERY PLAN ${query}`, params);
    return element("pre", { className: "observablehq--inspect" }, [
      text(rows.map((row) => row.detail).join("\n"))
    ]);
  }
  async describe(object) {
    const rows = await (object === void 0 ? this.query(`SELECT name FROM sqlite_master WHERE type = 'table'`) : this.query(`SELECT * FROM pragma_table_info(?)`, [object]));
    if (!rows.length)
      throw new Error("Not found");
    const { columns } = rows;
    return element("table", { value: rows }, [
      element("thead", [element("tr", columns.map((c2) => element("th", [text(c2)])))]),
      element("tbody", rows.map((r2) => element("tr", columns.map((c2) => element("td", [text(r2[c2])])))))
    ]);
  }
  async sql(strings, ...args) {
    return this.query(strings.join("?"), args);
  }
};
Object.defineProperty(SQLiteDatabaseClient.prototype, "dialect", {
  value: "sqlite"
});
function load(source) {
  return typeof source === "string" ? fetch(source).then(load) : source instanceof Response || source instanceof Blob ? source.arrayBuffer().then(load) : source instanceof ArrayBuffer ? new Uint8Array(source) : source;
}
async function exec(db, query, params) {
  const [result] = await db.exec(query, params);
  if (!result)
    return [];
  const { columns, values } = result;
  const rows = values.map((row) => Object.fromEntries(row.map((value, i2) => [columns[i2], value])));
  rows.columns = columns;
  return rows;
}
function element(name, props, children) {
  if (arguments.length === 2)
    children = props, props = void 0;
  const element2 = document.createElement(name);
  if (props !== void 0)
    for (const p2 in props)
      element2[p2] = props[p2];
  if (children !== void 0)
    for (const c2 of children)
      element2.appendChild(c2);
  return element2;
}
function text(value) {
  return document.createTextNode(value);
}
var Workbook = class {
  constructor(workbook) {
    Object.defineProperties(this, {
      _: { value: workbook },
      sheetNames: {
        value: workbook.worksheets.map((s2) => s2.name),
        enumerable: true
      }
    });
  }
  sheet(name, options) {
    const sname = typeof name === "number" ? this.sheetNames[name] : this.sheetNames.includes(name += "") ? name : null;
    if (sname == null)
      throw new Error(`Sheet not found: ${name}`);
    const sheet = this._.getWorksheet(sname);
    return extract(sheet, options);
  }
};
function extract(sheet, { range: range2, headers } = {}) {
  let [[c0, r0], [c1, r1]] = parseRange(range2, sheet);
  const headerRow = headers ? sheet._rows[r0++] : null;
  let names = new Set(["#"]);
  for (let n2 = c0; n2 <= c1; n2++) {
    const value = headerRow ? valueOf(headerRow.findCell(n2 + 1)) : null;
    let name = value && value + "" || toColumn(n2);
    while (names.has(name))
      name += "_";
    names.add(name);
  }
  names = new Array(c0).concat(Array.from(names));
  const output = new Array(r1 - r0 + 1);
  for (let r2 = r0; r2 <= r1; r2++) {
    const row = output[r2 - r0] = Object.create(null, { "#": { value: r2 + 1 } });
    const _row = sheet.getRow(r2 + 1);
    if (_row.hasValues)
      for (let c2 = c0; c2 <= c1; c2++) {
        const value = valueOf(_row.findCell(c2 + 1));
        if (value != null)
          row[names[c2 + 1]] = value;
      }
  }
  output.columns = names.filter(() => true);
  return output;
}
function valueOf(cell) {
  if (!cell)
    return;
  const { value } = cell;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (value.formula || value.sharedFormula) {
      return value.result && value.result.error ? NaN : value.result;
    }
    if (value.richText) {
      return richText(value);
    }
    if (value.text) {
      let { text: text2 } = value;
      if (text2.richText)
        text2 = richText(text2);
      return value.hyperlink && value.hyperlink !== text2 ? `${value.hyperlink} ${text2}` : text2;
    }
    return value;
  }
  return value;
}
function richText(value) {
  return value.richText.map((d2) => d2.text).join("");
}
function parseRange(specifier = ":", { columnCount, rowCount }) {
  specifier += "";
  if (!specifier.match(/^[A-Z]*\d*:[A-Z]*\d*$/))
    throw new Error("Malformed range specifier");
  const [[c0 = 0, r0 = 0], [c1 = columnCount - 1, r1 = rowCount - 1]] = specifier.split(":").map(fromCellReference);
  return [
    [c0, r0],
    [c1, r1]
  ];
}
function toColumn(c2) {
  let sc = "";
  c2++;
  do {
    sc = String.fromCharCode(64 + (c2 % 26 || 26)) + sc;
  } while (c2 = Math.floor((c2 - 1) / 26));
  return sc;
}
function fromCellReference(s2) {
  const [, sc, sr] = s2.match(/^([A-Z]*)(\d*)$/);
  let c2 = 0;
  if (sc)
    for (let i2 = 0; i2 < sc.length; i2++)
      c2 += Math.pow(26, sc.length - i2 - 1) * (sc.charCodeAt(i2) - 64);
  return [c2 ? c2 - 1 : void 0, sr ? +sr - 1 : void 0];
}
async function remote_fetch(file) {
  const response = await fetch(await file.url());
  if (!response.ok)
    throw new Error(`Unable to load file: ${file.name}`);
  return response;
}
async function dsv2(file, delimiter, { array = false, typed = false } = {}) {
  const text2 = await file.text();
  return (delimiter === "	" ? array ? tsvParseRows : tsvParse : array ? csvParseRows : csvParse)(text2, typed && autoType);
}
var AbstractFile = class {
  constructor(name) {
    Object.defineProperty(this, "name", { value: name, enumerable: true });
  }
  async blob() {
    return (await remote_fetch(this)).blob();
  }
  async arrayBuffer() {
    return (await remote_fetch(this)).arrayBuffer();
  }
  async text() {
    return (await remote_fetch(this)).text();
  }
  async json() {
    return (await remote_fetch(this)).json();
  }
  async stream() {
    return (await remote_fetch(this)).body;
  }
  async csv(options) {
    return dsv2(this, ",", options);
  }
  async tsv(options) {
    return dsv2(this, "	", options);
  }
  async image(props) {
    const url2 = await this.url();
    return new Promise((resolve22, reject) => {
      const i2 = new Image();
      if (new URL(url2, document.baseURI).origin !== new URL(location).origin) {
        i2.crossOrigin = "anonymous";
      }
      Object.assign(i2, props);
      i2.onload = () => resolve22(i2);
      i2.onerror = () => reject(new Error(`Unable to load file: ${this.name}`));
      i2.src = url2;
    });
  }
  async arrow() {
    const [Arrow, response] = await Promise.all([require2(arrow.resolve()), remote_fetch(this)]);
    return Arrow.Table.from(response);
  }
  async sqlite() {
    return SQLiteDatabaseClient.open(remote_fetch(this));
  }
  async zip() {
    const [JSZip, buffer2] = await Promise.all([require2(jszip.resolve()), this.arrayBuffer()]);
    return new ZipArchive(await JSZip.loadAsync(buffer2));
  }
  async xml(mimeType = "application/xml") {
    return new DOMParser().parseFromString(await this.text(), mimeType);
  }
  async html() {
    return this.xml("text/html");
  }
  async xlsx() {
    const [ExcelJS, buffer2] = await Promise.all([require2(exceljs.resolve()), this.arrayBuffer()]);
    return new Workbook(await new ExcelJS.Workbook().xlsx.load(buffer2));
  }
};
var FileAttachment = class extends AbstractFile {
  constructor(url2, name) {
    super(name);
    Object.defineProperty(this, "_url", { value: url2 });
  }
  async url() {
    return await this._url + "";
  }
};
function NoFileAttachments(name) {
  throw new Error(`File not found: ${name}`);
}
function FileAttachments(resolve22) {
  return Object.assign((name) => {
    const url2 = resolve22(name += "");
    if (url2 == null)
      throw new Error(`File not found: ${name}`);
    return new FileAttachment(url2, name);
  }, { prototype: FileAttachment.prototype });
}
var ZipArchive = class {
  constructor(archive) {
    Object.defineProperty(this, "_", { value: archive });
    this.filenames = Object.keys(archive.files).filter((name) => !archive.files[name].dir);
  }
  file(path) {
    const object = this._.file(path += "");
    if (!object || object.dir)
      throw new Error(`file not found: ${path}`);
    return new ZipArchiveEntry(object);
  }
};
var ZipArchiveEntry = class extends AbstractFile {
  constructor(object) {
    super(object.name);
    Object.defineProperty(this, "_", { value: object });
    Object.defineProperty(this, "_url", { writable: true });
  }
  async url() {
    return this._url || (this._url = this.blob().then(URL.createObjectURL));
  }
  async blob() {
    return this._.async("blob");
  }
  async arrayBuffer() {
    return this._.async("arraybuffer");
  }
  async text() {
    return this._.async("text");
  }
  async json() {
    return JSON.parse(await this.text());
  }
};
function canvas(width2, height) {
  var canvas2 = document.createElement("canvas");
  canvas2.width = width2;
  canvas2.height = height;
  return canvas2;
}
function context2d(width2, height, dpi) {
  if (dpi == null)
    dpi = devicePixelRatio;
  var canvas2 = document.createElement("canvas");
  canvas2.width = width2 * dpi;
  canvas2.height = height * dpi;
  canvas2.style.width = width2 + "px";
  var context = canvas2.getContext("2d");
  context.scale(dpi, dpi);
  return context;
}
function download(value, name = "untitled", label = "Save") {
  const a2 = document.createElement("a");
  const b2 = a2.appendChild(document.createElement("button"));
  b2.textContent = label;
  a2.download = name;
  async function reset2() {
    await new Promise(requestAnimationFrame);
    URL.revokeObjectURL(a2.href);
    a2.removeAttribute("href");
    b2.textContent = label;
    b2.disabled = false;
  }
  a2.onclick = async (event) => {
    b2.disabled = true;
    if (a2.href)
      return reset2();
    b2.textContent = "Saving\u2026";
    try {
      const object = await (typeof value === "function" ? value() : value);
      b2.textContent = "Download";
      a2.href = URL.createObjectURL(object);
    } catch (ignore2) {
      b2.textContent = label;
    }
    if (event.eventPhase)
      return reset2();
    b2.disabled = false;
  };
  return a2;
}
var namespaces = {
  math: "http://www.w3.org/1998/Math/MathML",
  svg: "http://www.w3.org/2000/svg",
  xhtml: "http://www.w3.org/1999/xhtml",
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function element$1(name, attributes) {
  var prefix = name += "", i2 = prefix.indexOf(":"), value;
  if (i2 >= 0 && (prefix = name.slice(0, i2)) !== "xmlns")
    name = name.slice(i2 + 1);
  var element2 = namespaces.hasOwnProperty(prefix) ? document.createElementNS(namespaces[prefix], name) : document.createElement(name);
  if (attributes)
    for (var key in attributes) {
      prefix = key, i2 = prefix.indexOf(":"), value = attributes[key];
      if (i2 >= 0 && (prefix = key.slice(0, i2)) !== "xmlns")
        key = key.slice(i2 + 1);
      if (namespaces.hasOwnProperty(prefix))
        element2.setAttributeNS(namespaces[prefix], key, value);
      else
        element2.setAttribute(key, value);
    }
  return element2;
}
function input(type) {
  var input2 = document.createElement("input");
  if (type != null)
    input2.type = type;
  return input2;
}
function range(min, max, step) {
  if (arguments.length === 1)
    max = min, min = null;
  var input2 = document.createElement("input");
  input2.min = min = min == null ? 0 : +min;
  input2.max = max = max == null ? 1 : +max;
  input2.step = step == null ? "any" : step = +step;
  input2.type = "range";
  return input2;
}
function select(values) {
  var select22 = document.createElement("select");
  Array.prototype.forEach.call(values, function(value) {
    var option = document.createElement("option");
    option.value = option.textContent = value;
    select22.appendChild(option);
  });
  return select22;
}
function svg(width2, height) {
  var svg22 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg22.setAttribute("viewBox", [0, 0, width2, height]);
  svg22.setAttribute("width", width2);
  svg22.setAttribute("height", height);
  return svg22;
}
function text$1(value) {
  return document.createTextNode(value);
}
var count2 = 0;
function uid(name) {
  return new Id("O-" + (name == null ? "" : name + "-") + ++count2);
}
function Id(id) {
  this.id = id;
  this.href = new URL(`#${id}`, location) + "";
}
Id.prototype.toString = function() {
  return "url(" + this.href + ")";
};
var DOM = {
  canvas,
  context2d,
  download,
  element: element$1,
  input,
  range,
  select,
  svg,
  text: text$1,
  uid
};
function buffer(file) {
  return new Promise(function(resolve22, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      resolve22(reader.result);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
function text$2(file) {
  return new Promise(function(resolve22, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      resolve22(reader.result);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
function url(file) {
  return new Promise(function(resolve22, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      resolve22(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
var Files = {
  buffer,
  text: text$2,
  url
};
function that() {
  return this;
}
function disposable(value, dispose) {
  let done = false;
  if (typeof dispose !== "function") {
    throw new Error("dispose is not a function");
  }
  return {
    [Symbol.iterator]: that,
    next: () => done ? { done: true } : (done = true, { done: false, value }),
    return: () => (done = true, dispose(value), { done: true }),
    throw: () => ({ done: done = true })
  };
}
function* filter(iterator, test) {
  var result, index = -1;
  while (!(result = iterator.next()).done) {
    if (test(result.value, ++index)) {
      yield result.value;
    }
  }
}
function observe(initialize) {
  let stale = false;
  let value;
  let resolve22;
  const dispose = initialize(change);
  if (dispose != null && typeof dispose !== "function") {
    throw new Error(typeof dispose.then === "function" ? "async initializers are not supported" : "initializer returned something, but not a dispose function");
  }
  function change(x2) {
    if (resolve22)
      resolve22(x2), resolve22 = null;
    else
      stale = true;
    return value = x2;
  }
  function next() {
    return { done: false, value: stale ? (stale = false, Promise.resolve(value)) : new Promise((_2) => resolve22 = _2) };
  }
  return {
    [Symbol.iterator]: that,
    throw: () => ({ done: true }),
    return: () => (dispose != null && dispose(), { done: true }),
    next
  };
}
function input$1(input2) {
  return observe(function(change) {
    var event = eventof(input2), value = valueof2(input2);
    function inputted() {
      change(valueof2(input2));
    }
    input2.addEventListener(event, inputted);
    if (value !== void 0)
      change(value);
    return function() {
      input2.removeEventListener(event, inputted);
    };
  });
}
function valueof2(input2) {
  switch (input2.type) {
    case "range":
    case "number":
      return input2.valueAsNumber;
    case "date":
      return input2.valueAsDate;
    case "checkbox":
      return input2.checked;
    case "file":
      return input2.multiple ? input2.files : input2.files[0];
    case "select-multiple":
      return Array.from(input2.selectedOptions, (o2) => o2.value);
    default:
      return input2.value;
  }
}
function eventof(input2) {
  switch (input2.type) {
    case "button":
    case "submit":
    case "checkbox":
      return "click";
    case "file":
      return "change";
    default:
      return "input";
  }
}
function* map2(iterator, transform) {
  var result, index = -1;
  while (!(result = iterator.next()).done) {
    yield transform(result.value, ++index);
  }
}
function queue2(initialize) {
  let resolve22;
  const queue22 = [];
  const dispose = initialize(push);
  if (dispose != null && typeof dispose !== "function") {
    throw new Error(typeof dispose.then === "function" ? "async initializers are not supported" : "initializer returned something, but not a dispose function");
  }
  function push(x2) {
    queue22.push(x2);
    if (resolve22)
      resolve22(queue22.shift()), resolve22 = null;
    return x2;
  }
  function next() {
    return { done: false, value: queue22.length ? Promise.resolve(queue22.shift()) : new Promise((_2) => resolve22 = _2) };
  }
  return {
    [Symbol.iterator]: that,
    throw: () => ({ done: true }),
    return: () => (dispose != null && dispose(), { done: true }),
    next
  };
}
function* range$1(start, stop, step) {
  start = +start;
  stop = +stop;
  step = (n2 = arguments.length) < 2 ? (stop = start, start = 0, 1) : n2 < 3 ? 1 : +step;
  var i2 = -1, n2 = Math.max(0, Math.ceil((stop - start) / step)) | 0;
  while (++i2 < n2) {
    yield start + i2 * step;
  }
}
function valueAt(iterator, i2) {
  if (!isFinite(i2 = +i2) || i2 < 0 || i2 !== i2 | 0)
    return;
  var result, index = -1;
  while (!(result = iterator.next()).done) {
    if (++index === i2) {
      return result.value;
    }
  }
}
function worker(source) {
  const url2 = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker2 = new Worker(url2);
  return disposable(worker2, () => {
    worker2.terminate();
    URL.revokeObjectURL(url2);
  });
}
var Generators = {
  disposable,
  filter,
  input: input$1,
  map: map2,
  observe,
  queue: queue2,
  range: range$1,
  valueAt,
  worker
};
function template(render, wrapper) {
  return function(strings) {
    var string = strings[0], parts = [], part, root = null, node, nodes, walker, i2, n2, j2, m2, k2 = -1;
    for (i2 = 1, n2 = arguments.length; i2 < n2; ++i2) {
      part = arguments[i2];
      if (part instanceof Node) {
        parts[++k2] = part;
        string += "<!--o:" + k2 + "-->";
      } else if (Array.isArray(part)) {
        for (j2 = 0, m2 = part.length; j2 < m2; ++j2) {
          node = part[j2];
          if (node instanceof Node) {
            if (root === null) {
              parts[++k2] = root = document.createDocumentFragment();
              string += "<!--o:" + k2 + "-->";
            }
            root.appendChild(node);
          } else {
            root = null;
            string += node;
          }
        }
        root = null;
      } else {
        string += part;
      }
      string += strings[i2];
    }
    root = render(string);
    if (++k2 > 0) {
      nodes = new Array(k2);
      walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null, false);
      while (walker.nextNode()) {
        node = walker.currentNode;
        if (/^o:/.test(node.nodeValue)) {
          nodes[+node.nodeValue.slice(2)] = node;
        }
      }
      for (i2 = 0; i2 < k2; ++i2) {
        if (node = nodes[i2]) {
          node.parentNode.replaceChild(parts[i2], node);
        }
      }
    }
    return root.childNodes.length === 1 ? root.removeChild(root.firstChild) : root.nodeType === 11 ? ((node = wrapper()).appendChild(root), node) : root;
  };
}
var html = template(function(string) {
  var template2 = document.createElement("template");
  template2.innerHTML = string.trim();
  return document.importNode(template2.content, true);
}, function() {
  return document.createElement("span");
});
function md(require22) {
  return require22(marked.resolve()).then(function(marked2) {
    return template(function(string) {
      var root = document.createElement("div");
      root.innerHTML = marked2(string, { langPrefix: "" }).trim();
      var code = root.querySelectorAll("pre code[class]");
      if (code.length > 0) {
        require22(highlight.resolve()).then(function(hl) {
          code.forEach(function(block) {
            function done() {
              hl.highlightBlock(block);
              block.parentNode.classList.add("observablehq--md-pre");
            }
            if (hl.getLanguage(block.className)) {
              done();
            } else {
              require22(highlight.resolve("async-languages/index.js")).then((index) => {
                if (index.has(block.className)) {
                  return require22(highlight.resolve("async-languages/" + index.get(block.className))).then((language) => {
                    hl.registerLanguage(block.className, language);
                  });
                }
              }).then(done, done);
            }
          });
        });
      }
      return root;
    }, function() {
      return document.createElement("div");
    });
  });
}
function Mutable(value) {
  let change;
  Object.defineProperties(this, {
    generator: { value: observe((_2) => void (change = _2)) },
    value: { get: () => value, set: (x2) => change(value = x2) }
  });
  if (value !== void 0)
    change(value);
}
function* now() {
  while (true) {
    yield Date.now();
  }
}
function delay(duration, value) {
  return new Promise(function(resolve22) {
    setTimeout(function() {
      resolve22(value);
    }, duration);
  });
}
var timeouts = new Map();
function timeout(now2, time) {
  var t2 = new Promise(function(resolve22) {
    timeouts.delete(time);
    var delay2 = time - now2;
    if (!(delay2 > 0))
      throw new Error("invalid time");
    if (delay2 > 2147483647)
      throw new Error("too long to wait");
    setTimeout(resolve22, delay2);
  });
  timeouts.set(time, t2);
  return t2;
}
function when(time, value) {
  var now2;
  return (now2 = timeouts.get(time = +time)) ? now2.then(() => value) : (now2 = Date.now()) >= time ? Promise.resolve(value) : timeout(now2, time).then(() => value);
}
function tick(duration, value) {
  return when(Math.ceil((Date.now() + 1) / duration) * duration, value);
}
var Promises = {
  delay,
  tick,
  when
};
function resolve2(name, base2) {
  if (/^(\w+:)|\/\//i.test(name))
    return name;
  if (/^[.]{0,2}\//i.test(name))
    return new URL(name, base2 == null ? location : base2).href;
  if (!name.length || /^[\s._]/.test(name) || /\s$/.test(name))
    throw new Error("illegal name");
  return "https://unpkg.com/" + name;
}
function requirer(resolve22) {
  return resolve22 == null ? require2 : requireFrom(resolve22);
}
var svg$1 = template(function(string) {
  var root = document.createElementNS("http://www.w3.org/2000/svg", "g");
  root.innerHTML = string.trim();
  return root;
}, function() {
  return document.createElementNS("http://www.w3.org/2000/svg", "g");
});
var raw = String.raw;
function style(href) {
  return new Promise(function(resolve22, reject) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onerror = reject;
    link.onload = resolve22;
    document.head.appendChild(link);
  });
}
function tex(require22) {
  return Promise.all([
    require22(katex.resolve()),
    style(katex.resolve("dist/katex.min.css"))
  ]).then(function(values) {
    var katex2 = values[0], tex2 = renderer();
    function renderer(options) {
      return function() {
        var root = document.createElement("div");
        katex2.render(raw.apply(String, arguments), root, options);
        return root.removeChild(root.firstChild);
      };
    }
    tex2.options = renderer;
    tex2.block = renderer({ displayMode: true });
    return tex2;
  });
}
async function vl(require22) {
  const [v2, vl2, api] = await Promise.all([vega, vegalite, vegaliteApi].map((d2) => require22(d2.resolve())));
  return api.register(v2, vl2);
}
function width() {
  return observe(function(change) {
    var width2 = change(document.body.clientWidth);
    function resized() {
      var w2 = document.body.clientWidth;
      if (w2 !== width2)
        change(width2 = w2);
    }
    window.addEventListener("resize", resized);
    return function() {
      window.removeEventListener("resize", resized);
    };
  });
}
var library = Object.assign(function Library(resolver) {
  const require22 = requirer(resolver);
  Object.defineProperties(this, properties({
    FileAttachment: () => NoFileAttachments,
    Arrow: () => require22(arrow.resolve()),
    Inputs: () => require22(inputs.resolve()).then((Inputs) => ({ ...Inputs, file: Inputs.fileOf(AbstractFile) })),
    Mutable: () => Mutable,
    Plot: () => require22(plot.resolve()),
    SQLite: () => sqlite(require22),
    SQLiteDatabaseClient: () => SQLiteDatabaseClient,
    _: () => require22(lodash.resolve()),
    aq: () => require22.alias({ "apache-arrow": arrow.resolve() })(arquero.resolve()),
    d3: () => require22(d3.resolve()),
    dot: () => require22(graphviz.resolve()),
    htl: () => require22(htl.resolve()),
    html: () => html,
    md: () => md(require22),
    now,
    require: () => require22,
    resolve: () => resolve2,
    svg: () => svg$1,
    tex: () => tex(require22),
    topojson: () => require22(topojson.resolve()),
    vl: () => vl(require22),
    width,
    DOM,
    Files,
    Generators,
    Promises
  }));
}, { resolve: require2.resolve });
function properties(values) {
  return Object.fromEntries(Object.entries(values).map(property));
}
function property([key, value]) {
  return [key, { value, writable: true, enumerable: true }];
}

// deno-cache:https://cdn.skypack.dev/-/@observablehq/runtime@v4.18.3-dxOXVgl2kZf5plPZUO4K/dist=es2019,mode=imports/optimized/@observablehq/runtime.js
function RuntimeError(message, input2) {
  this.message = message + "";
  this.input = input2;
}
RuntimeError.prototype = Object.create(Error.prototype);
RuntimeError.prototype.name = "RuntimeError";
RuntimeError.prototype.constructor = RuntimeError;
function generatorish(value) {
  return value && typeof value.next === "function" && typeof value.return === "function";
}
function load2(notebook, library2, observer) {
  if (typeof library2 == "function")
    observer = library2, library2 = null;
  if (typeof observer !== "function")
    throw new Error("invalid observer");
  if (library2 == null)
    library2 = new library();
  const { modules, id } = notebook;
  const map22 = new Map();
  const runtime = new Runtime(library2);
  const main2 = runtime_module2(id);
  function runtime_module2(id2) {
    let module = map22.get(id2);
    if (!module)
      map22.set(id2, module = runtime.module());
    return module;
  }
  for (const m2 of modules) {
    const module = runtime_module2(m2.id);
    let i2 = 0;
    for (const v2 of m2.variables) {
      if (v2.from)
        module.import(v2.remote, v2.name, runtime_module2(v2.from));
      else if (module === main2)
        module.variable(observer(v2, i2, m2.variables)).define(v2.name, v2.inputs, v2.value);
      else
        module.define(v2.name, v2.inputs, v2.value);
      ++i2;
    }
  }
  return runtime;
}
var prototype = Array.prototype;
var map3 = prototype.map;
var forEach = prototype.forEach;
function constant(x2) {
  return function() {
    return x2;
  };
}
function identity(x2) {
  return x2;
}
function rethrow(e2) {
  return function() {
    throw e2;
  };
}
function noop() {
}
var TYPE_NORMAL = 1;
var TYPE_IMPLICIT = 2;
var TYPE_DUPLICATE = 3;
var no_observer = {};
function Variable(type, module, observer) {
  if (!observer)
    observer = no_observer;
  Object.defineProperties(this, {
    _observer: { value: observer, writable: true },
    _definition: { value: variable_undefined, writable: true },
    _duplicate: { value: void 0, writable: true },
    _duplicates: { value: void 0, writable: true },
    _indegree: { value: NaN, writable: true },
    _inputs: { value: [], writable: true },
    _invalidate: { value: noop, writable: true },
    _module: { value: module },
    _name: { value: null, writable: true },
    _outputs: { value: new Set(), writable: true },
    _promise: { value: Promise.resolve(void 0), writable: true },
    _reachable: { value: observer !== no_observer, writable: true },
    _rejector: { value: variable_rejector(this) },
    _type: { value: type },
    _value: { value: void 0, writable: true },
    _version: { value: 0, writable: true }
  });
}
Object.defineProperties(Variable.prototype, {
  _pending: { value: variable_pending, writable: true, configurable: true },
  _fulfilled: { value: variable_fulfilled, writable: true, configurable: true },
  _rejected: { value: variable_rejected, writable: true, configurable: true },
  define: { value: variable_define, writable: true, configurable: true },
  delete: { value: variable_delete, writable: true, configurable: true },
  import: { value: variable_import, writable: true, configurable: true }
});
function variable_attach(variable) {
  variable._module._runtime._dirty.add(variable);
  variable._outputs.add(this);
}
function variable_detach(variable) {
  variable._module._runtime._dirty.add(variable);
  variable._outputs.delete(this);
}
function variable_undefined() {
  throw variable_undefined;
}
function variable_rejector(variable) {
  return function(error) {
    if (error === variable_undefined)
      throw new RuntimeError(variable._name + " is not defined", variable._name);
    if (error instanceof Error && error.message)
      throw new RuntimeError(error.message, variable._name);
    throw new RuntimeError(variable._name + " could not be resolved", variable._name);
  };
}
function variable_duplicate(name) {
  return function() {
    throw new RuntimeError(name + " is defined more than once");
  };
}
function variable_define(name, inputs2, definition) {
  switch (arguments.length) {
    case 1: {
      definition = name, name = inputs2 = null;
      break;
    }
    case 2: {
      definition = inputs2;
      if (typeof name === "string")
        inputs2 = null;
      else
        inputs2 = name, name = null;
      break;
    }
  }
  return variable_defineImpl.call(this, name == null ? null : name + "", inputs2 == null ? [] : map3.call(inputs2, this._module._resolve, this._module), typeof definition === "function" ? definition : constant(definition));
}
function variable_defineImpl(name, inputs2, definition) {
  var scope = this._module._scope, runtime = this._module._runtime;
  this._inputs.forEach(variable_detach, this);
  inputs2.forEach(variable_attach, this);
  this._inputs = inputs2;
  this._definition = definition;
  this._value = void 0;
  if (definition === noop)
    runtime._variables.delete(this);
  else
    runtime._variables.add(this);
  if (name !== this._name || scope.get(name) !== this) {
    var error, found;
    if (this._name) {
      if (this._outputs.size) {
        scope.delete(this._name);
        found = this._module._resolve(this._name);
        found._outputs = this._outputs, this._outputs = new Set();
        found._outputs.forEach(function(output) {
          output._inputs[output._inputs.indexOf(this)] = found;
        }, this);
        found._outputs.forEach(runtime._updates.add, runtime._updates);
        runtime._dirty.add(found).add(this);
        scope.set(this._name, found);
      } else if ((found = scope.get(this._name)) === this) {
        scope.delete(this._name);
      } else if (found._type === TYPE_DUPLICATE) {
        found._duplicates.delete(this);
        this._duplicate = void 0;
        if (found._duplicates.size === 1) {
          found = found._duplicates.keys().next().value;
          error = scope.get(this._name);
          found._outputs = error._outputs, error._outputs = new Set();
          found._outputs.forEach(function(output) {
            output._inputs[output._inputs.indexOf(error)] = found;
          });
          found._definition = found._duplicate, found._duplicate = void 0;
          runtime._dirty.add(error).add(found);
          runtime._updates.add(found);
          scope.set(this._name, found);
        }
      } else {
        throw new Error();
      }
    }
    if (this._outputs.size)
      throw new Error();
    if (name) {
      if (found = scope.get(name)) {
        if (found._type === TYPE_DUPLICATE) {
          this._definition = variable_duplicate(name), this._duplicate = definition;
          found._duplicates.add(this);
        } else if (found._type === TYPE_IMPLICIT) {
          this._outputs = found._outputs, found._outputs = new Set();
          this._outputs.forEach(function(output) {
            output._inputs[output._inputs.indexOf(found)] = this;
          }, this);
          runtime._dirty.add(found).add(this);
          scope.set(name, this);
        } else {
          found._duplicate = found._definition, this._duplicate = definition;
          error = new Variable(TYPE_DUPLICATE, this._module);
          error._name = name;
          error._definition = this._definition = found._definition = variable_duplicate(name);
          error._outputs = found._outputs, found._outputs = new Set();
          error._outputs.forEach(function(output) {
            output._inputs[output._inputs.indexOf(found)] = error;
          });
          error._duplicates = new Set([this, found]);
          runtime._dirty.add(found).add(error);
          runtime._updates.add(found).add(error);
          scope.set(name, error);
        }
      } else {
        scope.set(name, this);
      }
    }
    this._name = name;
  }
  runtime._updates.add(this);
  runtime._compute();
  return this;
}
function variable_import(remote, name, module) {
  if (arguments.length < 3)
    module = name, name = remote;
  return variable_defineImpl.call(this, name + "", [module._resolve(remote + "")], identity);
}
function variable_delete() {
  return variable_defineImpl.call(this, null, [], noop);
}
function variable_pending() {
  if (this._observer.pending)
    this._observer.pending();
}
function variable_fulfilled(value) {
  if (this._observer.fulfilled)
    this._observer.fulfilled(value, this._name);
}
function variable_rejected(error) {
  if (this._observer.rejected)
    this._observer.rejected(error, this._name);
}
function Module(runtime, builtins = []) {
  Object.defineProperties(this, {
    _runtime: { value: runtime },
    _scope: { value: new Map() },
    _builtins: { value: new Map([
      ["invalidation", variable_invalidation],
      ["visibility", variable_visibility],
      ...builtins
    ]) },
    _source: { value: null, writable: true }
  });
}
Object.defineProperties(Module.prototype, {
  _copy: { value: module_copy, writable: true, configurable: true },
  _resolve: { value: module_resolve, writable: true, configurable: true },
  redefine: { value: module_redefine, writable: true, configurable: true },
  define: { value: module_define, writable: true, configurable: true },
  derive: { value: module_derive, writable: true, configurable: true },
  import: { value: module_import, writable: true, configurable: true },
  value: { value: module_value, writable: true, configurable: true },
  variable: { value: module_variable, writable: true, configurable: true },
  builtin: { value: module_builtin, writable: true, configurable: true }
});
function module_redefine(name) {
  var v2 = this._scope.get(name);
  if (!v2)
    throw new RuntimeError(name + " is not defined");
  if (v2._type === TYPE_DUPLICATE)
    throw new RuntimeError(name + " is defined more than once");
  return v2.define.apply(v2, arguments);
}
function module_define() {
  var v2 = new Variable(TYPE_NORMAL, this);
  return v2.define.apply(v2, arguments);
}
function module_import() {
  var v2 = new Variable(TYPE_NORMAL, this);
  return v2.import.apply(v2, arguments);
}
function module_variable(observer) {
  return new Variable(TYPE_NORMAL, this, observer);
}
async function module_value(name) {
  var v2 = this._scope.get(name);
  if (!v2)
    throw new RuntimeError(name + " is not defined");
  if (v2._observer === no_observer) {
    v2._observer = true;
    this._runtime._dirty.add(v2);
  }
  await this._runtime._compute();
  return v2._promise;
}
function module_derive(injects, injectModule) {
  var copy = new Module(this._runtime, this._builtins);
  copy._source = this;
  forEach.call(injects, function(inject) {
    if (typeof inject !== "object")
      inject = { name: inject + "" };
    if (inject.alias == null)
      inject.alias = inject.name;
    copy.import(inject.name, inject.alias, injectModule);
  });
  Promise.resolve().then(() => {
    const modules = new Set([this]);
    for (const module of modules) {
      for (const variable of module._scope.values()) {
        if (variable._definition === identity) {
          const module2 = variable._inputs[0]._module;
          const source = module2._source || module2;
          if (source === this) {
            console.warn("circular module definition; ignoring");
            return;
          }
          modules.add(source);
        }
      }
    }
    this._copy(copy, new Map());
  });
  return copy;
}
function module_copy(copy, map22) {
  copy._source = this;
  map22.set(this, copy);
  for (const [name, source] of this._scope) {
    var target = copy._scope.get(name);
    if (target && target._type === TYPE_NORMAL)
      continue;
    if (source._definition === identity) {
      var sourceInput = source._inputs[0], sourceModule = sourceInput._module;
      copy.import(sourceInput._name, name, map22.get(sourceModule) || (sourceModule._source ? sourceModule._copy(new Module(copy._runtime, copy._builtins), map22) : sourceModule));
    } else {
      copy.define(name, source._inputs.map(variable_name), source._definition);
    }
  }
  return copy;
}
function module_resolve(name) {
  var variable = this._scope.get(name), value;
  if (!variable) {
    variable = new Variable(TYPE_IMPLICIT, this);
    if (this._builtins.has(name)) {
      variable.define(name, constant(this._builtins.get(name)));
    } else if (this._runtime._builtin._scope.has(name)) {
      variable.import(name, this._runtime._builtin);
    } else {
      try {
        value = this._runtime._global(name);
      } catch (error) {
        return variable.define(name, rethrow(error));
      }
      if (value === void 0) {
        this._scope.set(variable._name = name, variable);
      } else {
        variable.define(name, constant(value));
      }
    }
  }
  return variable;
}
function module_builtin(name, value) {
  this._builtins.set(name, value);
}
function variable_name(variable) {
  return variable._name;
}
var frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : setImmediate;
var variable_invalidation = {};
var variable_visibility = {};
function Runtime(builtins = new library(), global2 = window_global) {
  var builtin = this.module();
  Object.defineProperties(this, {
    _dirty: { value: new Set() },
    _updates: { value: new Set() },
    _precomputes: { value: [], writable: true },
    _computing: { value: null, writable: true },
    _init: { value: null, writable: true },
    _modules: { value: new Map() },
    _variables: { value: new Set() },
    _disposed: { value: false, writable: true },
    _builtin: { value: builtin },
    _global: { value: global2 }
  });
  if (builtins)
    for (var name in builtins) {
      new Variable(TYPE_IMPLICIT, builtin).define(name, [], builtins[name]);
    }
}
Object.defineProperties(Runtime, {
  load: { value: load2, writable: true, configurable: true }
});
Object.defineProperties(Runtime.prototype, {
  _precompute: { value: runtime_precompute, writable: true, configurable: true },
  _compute: { value: runtime_compute, writable: true, configurable: true },
  _computeSoon: { value: runtime_computeSoon, writable: true, configurable: true },
  _computeNow: { value: runtime_computeNow, writable: true, configurable: true },
  dispose: { value: runtime_dispose, writable: true, configurable: true },
  module: { value: runtime_module, writable: true, configurable: true },
  fileAttachments: { value: FileAttachments, writable: true, configurable: true }
});
function runtime_dispose() {
  this._computing = Promise.resolve();
  this._disposed = true;
  this._variables.forEach((v2) => {
    v2._invalidate();
    v2._version = NaN;
  });
}
function runtime_module(define2, observer = noop) {
  let module;
  if (define2 === void 0) {
    if (module = this._init) {
      this._init = null;
      return module;
    }
    return new Module(this);
  }
  module = this._modules.get(define2);
  if (module)
    return module;
  this._init = module = new Module(this);
  this._modules.set(define2, module);
  try {
    define2(this, observer);
  } finally {
    this._init = null;
  }
  return module;
}
function runtime_precompute(callback) {
  this._precomputes.push(callback);
  this._compute();
}
function runtime_compute() {
  return this._computing || (this._computing = this._computeSoon());
}
function runtime_computeSoon() {
  return new Promise(frame).then(() => this._disposed ? void 0 : this._computeNow());
}
async function runtime_computeNow() {
  var queue3 = [], variables, variable, precomputes = this._precomputes;
  if (precomputes.length) {
    this._precomputes = [];
    for (const callback of precomputes)
      callback();
    await runtime_defer(3);
  }
  variables = new Set(this._dirty);
  variables.forEach(function(variable2) {
    variable2._inputs.forEach(variables.add, variables);
    const reachable = variable_reachable(variable2);
    if (reachable > variable2._reachable) {
      this._updates.add(variable2);
    } else if (reachable < variable2._reachable) {
      variable2._invalidate();
    }
    variable2._reachable = reachable;
  }, this);
  variables = new Set(this._updates);
  variables.forEach(function(variable2) {
    if (variable2._reachable) {
      variable2._indegree = 0;
      variable2._outputs.forEach(variables.add, variables);
    } else {
      variable2._indegree = NaN;
      variables.delete(variable2);
    }
  });
  this._computing = null;
  this._updates.clear();
  this._dirty.clear();
  variables.forEach(function(variable2) {
    variable2._outputs.forEach(variable_increment);
  });
  do {
    variables.forEach(function(variable2) {
      if (variable2._indegree === 0) {
        queue3.push(variable2);
      }
    });
    while (variable = queue3.pop()) {
      variable_compute(variable);
      variable._outputs.forEach(postqueue);
      variables.delete(variable);
    }
    variables.forEach(function(variable2) {
      if (variable_circular(variable2)) {
        variable_error(variable2, new RuntimeError("circular definition"));
        variable2._outputs.forEach(variable_decrement);
        variables.delete(variable2);
      }
    });
  } while (variables.size);
  function postqueue(variable2) {
    if (--variable2._indegree === 0) {
      queue3.push(variable2);
    }
  }
}
function runtime_defer(depth = 0) {
  let p2 = Promise.resolve();
  for (let i2 = 0; i2 < depth; ++i2)
    p2 = p2.then(() => {
    });
  return p2;
}
function variable_circular(variable) {
  const inputs2 = new Set(variable._inputs);
  for (const i2 of inputs2) {
    if (i2 === variable)
      return true;
    i2._inputs.forEach(inputs2.add, inputs2);
  }
  return false;
}
function variable_increment(variable) {
  ++variable._indegree;
}
function variable_decrement(variable) {
  --variable._indegree;
}
function variable_value(variable) {
  return variable._promise.catch(variable._rejector);
}
function variable_invalidator(variable) {
  return new Promise(function(resolve3) {
    variable._invalidate = resolve3;
  });
}
function variable_intersector(invalidation, variable) {
  let node = typeof IntersectionObserver === "function" && variable._observer && variable._observer._node;
  let visible = !node, resolve3 = noop, reject = noop, promise, observer;
  if (node) {
    observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting) && (promise = null, resolve3()));
    observer.observe(node);
    invalidation.then(() => (observer.disconnect(), observer = null, reject()));
  }
  return function(value) {
    if (visible)
      return Promise.resolve(value);
    if (!observer)
      return Promise.reject();
    if (!promise)
      promise = new Promise((y2, n2) => (resolve3 = y2, reject = n2));
    return promise.then(() => value);
  };
}
function variable_compute(variable) {
  variable._invalidate();
  variable._invalidate = noop;
  variable._pending();
  const value0 = variable._value;
  const version2 = ++variable._version;
  let invalidation = null;
  const promise = variable._promise = (variable._inputs.length ? Promise.all(variable._inputs.map(variable_value)).then(define2) : new Promise((resolve3) => resolve3(variable._definition.call(value0)))).then(generate);
  function define2(inputs2) {
    if (variable._version !== version2)
      return;
    for (var i2 = 0, n2 = inputs2.length; i2 < n2; ++i2) {
      switch (inputs2[i2]) {
        case variable_invalidation: {
          inputs2[i2] = invalidation = variable_invalidator(variable);
          break;
        }
        case variable_visibility: {
          if (!invalidation)
            invalidation = variable_invalidator(variable);
          inputs2[i2] = variable_intersector(invalidation, variable);
          break;
        }
      }
    }
    return variable._definition.apply(value0, inputs2);
  }
  function generate(value) {
    if (generatorish(value)) {
      if (variable._version !== version2)
        return void value.return();
      (invalidation || variable_invalidator(variable)).then(variable_return(value));
      return variable_generate(variable, version2, value);
    }
    return value;
  }
  promise.then((value) => {
    if (variable._version !== version2)
      return;
    variable._value = value;
    variable._fulfilled(value);
  }, (error) => {
    if (variable._version !== version2)
      return;
    variable._value = void 0;
    variable._rejected(error);
  });
}
function variable_generate(variable, version2, generator) {
  const runtime = variable._module._runtime;
  function compute(onfulfilled) {
    return new Promise((resolve3) => resolve3(generator.next())).then(({ done, value }) => {
      return done ? void 0 : Promise.resolve(value).then(onfulfilled);
    });
  }
  function recompute() {
    const promise = compute((value) => {
      if (variable._version !== version2)
        return;
      postcompute(value, promise).then(() => runtime._precompute(recompute));
      variable._fulfilled(value);
      return value;
    });
    promise.catch((error) => {
      if (variable._version !== version2)
        return;
      postcompute(void 0, promise);
      variable._rejected(error);
    });
  }
  function postcompute(value, promise) {
    variable._value = value;
    variable._promise = promise;
    variable._outputs.forEach(runtime._updates.add, runtime._updates);
    return runtime._compute();
  }
  return compute((value) => {
    if (variable._version !== version2)
      return;
    runtime._precompute(recompute);
    return value;
  });
}
function variable_error(variable, error) {
  variable._invalidate();
  variable._invalidate = noop;
  variable._pending();
  ++variable._version;
  variable._indegree = NaN;
  (variable._promise = Promise.reject(error)).catch(noop);
  variable._value = void 0;
  variable._rejected(error);
}
function variable_return(generator) {
  return function() {
    generator.return();
  };
}
function variable_reachable(variable) {
  if (variable._observer !== no_observer)
    return true;
  var outputs = new Set(variable._outputs);
  for (const output of outputs) {
    if (output._observer !== no_observer)
      return true;
    output._outputs.forEach(outputs.add, outputs);
  }
  return false;
}
function window_global(name) {
  return window[name];
}

// ../src/resources/formats/html/ojs/stdlib.js
var e = {};
var t = {};
function n(e2) {
  return new Function("d", "return {" + e2.map(function(e3, t2) {
    return JSON.stringify(e3) + ": d[" + t2 + '] || ""';
  }).join(",") + "}");
}
function r(e2) {
  var t2 = Object.create(null), n2 = [];
  return e2.forEach(function(e3) {
    for (var r2 in e3)
      r2 in t2 || n2.push(t2[r2] = r2);
  }), n2;
}
function o(e2, t2) {
  var n2 = e2 + "", r2 = n2.length;
  return r2 < t2 ? new Array(t2 - r2 + 1).join(0) + n2 : n2;
}
function i(e2) {
  var t2, n2 = e2.getUTCHours(), r2 = e2.getUTCMinutes(), i2 = e2.getUTCSeconds(), a2 = e2.getUTCMilliseconds();
  return isNaN(e2) ? "Invalid Date" : ((t2 = e2.getUTCFullYear()) < 0 ? "-" + o(-t2, 6) : t2 > 9999 ? "+" + o(t2, 6) : o(t2, 4)) + "-" + o(e2.getUTCMonth() + 1, 2) + "-" + o(e2.getUTCDate(), 2) + (a2 ? "T" + o(n2, 2) + ":" + o(r2, 2) + ":" + o(i2, 2) + "." + o(a2, 3) + "Z" : i2 ? "T" + o(n2, 2) + ":" + o(r2, 2) + ":" + o(i2, 2) + "Z" : r2 || n2 ? "T" + o(n2, 2) + ":" + o(r2, 2) + "Z" : "");
}
function a(o2) {
  var a2 = new RegExp('["' + o2 + "\n\r]"), s2 = o2.charCodeAt(0);
  function u2(n2, r2) {
    var o3, i2 = [], a3 = n2.length, u3 = 0, l3 = 0, c3 = a3 <= 0, f3 = false;
    function d2() {
      if (c3)
        return t;
      if (f3)
        return f3 = false, e;
      var r3, o4, i3 = u3;
      if (n2.charCodeAt(i3) === 34) {
        for (; u3++ < a3 && n2.charCodeAt(u3) !== 34 || n2.charCodeAt(++u3) === 34; )
          ;
        return (r3 = u3) >= a3 ? c3 = true : (o4 = n2.charCodeAt(u3++)) === 10 ? f3 = true : o4 === 13 && (f3 = true, n2.charCodeAt(u3) === 10 && ++u3), n2.slice(i3 + 1, r3 - 1).replace(/""/g, '"');
      }
      for (; u3 < a3; ) {
        if ((o4 = n2.charCodeAt(r3 = u3++)) === 10)
          f3 = true;
        else if (o4 === 13)
          f3 = true, n2.charCodeAt(u3) === 10 && ++u3;
        else if (o4 !== s2)
          continue;
        return n2.slice(i3, r3);
      }
      return c3 = true, n2.slice(i3, a3);
    }
    for (n2.charCodeAt(a3 - 1) === 10 && --a3, n2.charCodeAt(a3 - 1) === 13 && --a3; (o3 = d2()) !== t; ) {
      for (var h2 = []; o3 !== e && o3 !== t; )
        h2.push(o3), o3 = d2();
      r2 && (h2 = r2(h2, l3++)) == null || i2.push(h2);
    }
    return i2;
  }
  function l2(e2, t2) {
    return e2.map(function(e3) {
      return t2.map(function(t3) {
        return f2(e3[t3]);
      }).join(o2);
    });
  }
  function c2(e2) {
    return e2.map(f2).join(o2);
  }
  function f2(e2) {
    return e2 == null ? "" : e2 instanceof Date ? i(e2) : a2.test(e2 += "") ? '"' + e2.replace(/"/g, '""') + '"' : e2;
  }
  return { parse: function(e2, t2) {
    var r2, o3, i2 = u2(e2, function(e3, i3) {
      if (r2)
        return r2(e3, i3 - 1);
      o3 = e3, r2 = t2 ? function(e4, t3) {
        var r3 = n(e4);
        return function(n2, o4) {
          return t3(r3(n2), o4, e4);
        };
      }(e3, t2) : n(e3);
    });
    return i2.columns = o3 || [], i2;
  }, parseRows: u2, format: function(e2, t2) {
    return t2 == null && (t2 = r(e2)), [t2.map(f2).join(o2)].concat(l2(e2, t2)).join("\n");
  }, formatBody: function(e2, t2) {
    return t2 == null && (t2 = r(e2)), l2(e2, t2).join("\n");
  }, formatRows: function(e2) {
    return e2.map(c2).join("\n");
  }, formatRow: c2, formatValue: f2 };
}
var s = a(",");
var u = s.parse;
var l = s.parseRows;
var c = a("	");
var f = c.parse;
var d = c.parseRows;
function h(e2) {
  for (var t2 in e2) {
    var n2, r2, o2 = e2[t2].trim();
    if (o2)
      if (o2 === "true")
        o2 = true;
      else if (o2 === "false")
        o2 = false;
      else if (o2 === "NaN")
        o2 = NaN;
      else if (isNaN(n2 = +o2)) {
        if (!(r2 = o2.match(/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/)))
          continue;
        m && r2[4] && !r2[7] && (o2 = o2.replace(/-/g, "/").replace(/T/, " ")), o2 = new Date(o2);
      } else
        o2 = n2;
    else
      o2 = null;
    e2[t2] = o2;
  }
  return e2;
}
var m = new Date("2019-01-01T00:00").getHours() || new Date("2019-07-01T00:00").getHours();
var p = new Map();
var w = [];
var v = w.map;
var y = w.some;
var g = w.hasOwnProperty;
var b = "https://cdn.jsdelivr.net/npm/";
var x = /^((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(?:\/(.*))?$/;
var j = /^\d+\.\d+\.\d+(-[\w-.+]+)?$/;
var E = /\.[^/]*$/;
var P = ["unpkg", "jsdelivr", "browser", "main"];
var RequireError2 = class extends Error {
  constructor(e2) {
    super(e2);
  }
};
function C(e2) {
  const t2 = x.exec(e2);
  return t2 && { name: t2[1], version: t2[2], path: t2[3] };
}
function A(e2) {
  const t2 = `${b}${e2.name}${e2.version ? `@${e2.version}` : ""}/package.json`;
  let n2 = p.get(t2);
  return n2 || p.set(t2, n2 = fetch(t2).then((e3) => {
    if (!e3.ok)
      throw new RequireError2("unable to load package.json");
    return e3.redirected && !p.has(e3.url) && p.set(e3.url, n2), e3.json();
  })), n2;
}
RequireError2.prototype.name = RequireError2.name;
var N = L(async function(e2, t2) {
  if (e2.startsWith(b) && (e2 = e2.substring(b.length)), /^(\w+:)|\/\//i.test(e2))
    return e2;
  if (/^[.]{0,2}\//i.test(e2))
    return new URL(e2, t2 == null ? location : t2).href;
  if (!e2.length || /^[\s._]/.test(e2) || /\s$/.test(e2))
    throw new RequireError2("illegal name");
  const n2 = C(e2);
  if (!n2)
    return `${b}${e2}`;
  if (!n2.version && t2 != null && t2.startsWith(b)) {
    const e3 = await A(C(t2.substring(b.length)));
    n2.version = e3.dependencies && e3.dependencies[n2.name] || e3.peerDependencies && e3.peerDependencies[n2.name];
  }
  if (n2.path && !E.test(n2.path) && (n2.path += ".js"), n2.path && n2.version && j.test(n2.version))
    return `${b}${n2.name}@${n2.version}/${n2.path}`;
  const r2 = await A(n2);
  return `${b}${r2.name}@${r2.version}/${n2.path || function(e3) {
    for (const t3 of P) {
      const n3 = e3[t3];
      if (typeof n3 == "string")
        return E.test(n3) ? n3 : `${n3}.js`;
    }
  }(r2) || "index.js"}`;
});
function L(e2) {
  const t2 = new Map(), n2 = a2(null);
  let r2, o2 = 0;
  function i2(e3) {
    if (typeof e3 != "string")
      return e3;
    let n3 = t2.get(e3);
    return n3 || t2.set(e3, n3 = new Promise((t3, n4) => {
      const i3 = document.createElement("script");
      i3.onload = () => {
        try {
          t3(w.pop()(a2(e3)));
        } catch (e4) {
          n4(new RequireError2("invalid module"));
        }
        i3.remove(), o2--, o2 === 0 && (window.define = r2);
      }, i3.onerror = () => {
        n4(new RequireError2("unable to load module")), i3.remove(), o2--, o2 === 0 && (window.define = r2);
      }, i3.async = true, i3.src = e3, o2 === 0 && (r2 = window.define, window.define = k), o2++, document.head.appendChild(i3);
    })), n3;
  }
  function a2(t3) {
    return (n3) => Promise.resolve(e2(n3, t3)).then(i2);
  }
  function s2(e3) {
    return arguments.length > 1 ? Promise.all(v.call(arguments, n2)).then(O) : n2(e3);
  }
  return s2.alias = function(t3) {
    return L((n3, r3) => n3 in t3 && (r3 = null, typeof (n3 = t3[n3]) != "string") ? n3 : e2(n3, r3));
  }, s2.resolve = e2, s2;
}
function O(e2) {
  const t2 = {};
  for (const n2 of e2)
    for (const e3 in n2)
      g.call(n2, e3) && (n2[e3] == null ? Object.defineProperty(t2, e3, { get: R(n2, e3) }) : t2[e3] = n2[e3]);
  return t2;
}
function R(e2, t2) {
  return () => e2[t2];
}
function $2(e2) {
  return (e2 += "") === "exports" || e2 === "module";
}
function k(e2, t2, n2) {
  const r2 = arguments.length;
  r2 < 2 ? (n2 = e2, t2 = []) : r2 < 3 && (n2 = t2, t2 = typeof e2 == "string" ? [] : e2), w.push(y.call(t2, $2) ? (e3) => {
    const r3 = {}, o2 = { exports: r3 };
    return Promise.all(v.call(t2, (t3) => (t3 += "") === "exports" ? r3 : t3 === "module" ? o2 : e3(t3))).then((e4) => (n2.apply(null, e4), o2.exports));
  } : (e3) => Promise.all(v.call(t2, e3)).then((e4) => typeof n2 == "function" ? n2.apply(null, e4) : n2));
}
function T(e2, t2, n2) {
  return { resolve: (r2 = n2) => `https://cdn.jsdelivr.net/npm/${e2}@${t2}/${r2}` };
}
k.amd = {};
var U = T("d3", "7.0.1", "dist/d3.min.js");
var q = T("@observablehq/inputs", "0.9.1", "dist/inputs.min.js");
var M = T("@observablehq/plot", "0.2.0", "dist/plot.umd.min.js");
var S = T("@observablehq/graphviz", "0.2.1", "dist/graphviz.min.js");
var _ = T("@observablehq/highlight.js", "2.0.0", "highlight.min.js");
var D = T("@observablehq/katex", "0.11.1", "dist/katex.min.js");
var F = T("lodash", "4.17.21", "lodash.min.js");
var B = T("htl", "0.3.0", "dist/htl.min.js");
var z = T("jszip", "3.7.1", "dist/jszip.min.js");
var H = T("marked", "0.3.12", "marked.min.js");
var W = T("sql.js", "1.6.1", "dist/sql-wasm.js");
var I = T("vega", "5.20.2", "build/vega.min.js");
var Z = T("vega-lite", "5.1.0", "build/vega-lite.min.js");
var Q = T("vega-lite-api", "5.0.0", "build/vega-lite-api.min.js");
var V = T("apache-arrow", "4.0.1", "Arrow.es2015.min.js");
var J = T("arquero", "4.8.4", "dist/arquero.min.js");
var X = T("topojson-client", "3.1.0", "dist/topojson-client.min.js");
function Y(e2) {
  const t2 = {};
  for (const [n2, r2] of e2)
    t2[n2] = r2;
  return t2;
}
async function G(e2) {
  return (await e2(W.resolve()))({ locateFile: (e3) => W.resolve(`dist/${e3}`) });
}
var SQLiteDatabaseClient2 = class {
  constructor(e2) {
    Object.defineProperties(this, { _db: { value: e2 } });
  }
  static async open(e2) {
    const [t2, n2] = await Promise.all([G(N), Promise.resolve(e2).then(K)]);
    return new SQLiteDatabaseClient2(new t2.Database(n2));
  }
  async query(e2, t2) {
    return await async function(e3, t3, n2) {
      const [r2] = await e3.exec(t3, n2);
      if (!r2)
        return [];
      const { columns: o2, values: i2 } = r2, a2 = i2.map((e4) => Y(e4.map((e5, t4) => [o2[t4], e5])));
      return a2.columns = o2, a2;
    }(this._db, e2, t2);
  }
  async queryRow(e2, t2) {
    return (await this.query(e2, t2))[0] || null;
  }
  async explain(e2, t2) {
    return ee("pre", { className: "observablehq--inspect" }, [te((await this.query(`EXPLAIN QUERY PLAN ${e2}`, t2)).map((e3) => e3.detail).join("\n"))]);
  }
  async describe(e2) {
    const t2 = await (e2 === void 0 ? this.query("SELECT name FROM sqlite_master WHERE type = 'table'") : this.query("SELECT * FROM pragma_table_info(?)", [e2]));
    if (!t2.length)
      throw new Error("Not found");
    const { columns: n2 } = t2;
    return ee("table", { value: t2 }, [ee("thead", [ee("tr", n2.map((e3) => ee("th", [te(e3)])))]), ee("tbody", t2.map((e3) => ee("tr", n2.map((t3) => ee("td", [te(e3[t3])])))))]);
  }
};
function K(e2) {
  return typeof e2 == "string" ? fetch(e2).then(K) : e2 instanceof Response || e2 instanceof Blob ? e2.arrayBuffer().then(K) : e2 instanceof ArrayBuffer ? new Uint8Array(e2) : e2;
}
function ee(e2, t2, n2) {
  arguments.length === 2 && (n2 = t2, t2 = void 0);
  const r2 = document.createElement(e2);
  if (t2 !== void 0)
    for (const e3 in t2)
      r2[e3] = t2[e3];
  if (n2 !== void 0)
    for (const e3 of n2)
      r2.appendChild(e3);
  return r2;
}
function te(e2) {
  return document.createTextNode(e2);
}
async function ne(e2) {
  const t2 = await fetch(await e2.url());
  if (!t2.ok)
    throw new Error(`Unable to load file: ${e2.name}`);
  return t2;
}
async function re(e2, t2, { array: n2 = false, typed: r2 = false } = {}) {
  const o2 = await e2.text();
  return (t2 === "	" ? n2 ? d : f : n2 ? l : u)(o2, r2 && h);
}
var oe = class {
  constructor(e2) {
    Object.defineProperty(this, "name", { value: e2, enumerable: true });
  }
  async blob() {
    return (await ne(this)).blob();
  }
  async arrayBuffer() {
    return (await ne(this)).arrayBuffer();
  }
  async text() {
    return (await ne(this)).text();
  }
  async json() {
    return (await ne(this)).json();
  }
  async stream() {
    return (await ne(this)).body;
  }
  async csv(e2) {
    return re(this, ",", e2);
  }
  async tsv(e2) {
    return re(this, "	", e2);
  }
  async image() {
    const e2 = await this.url();
    return new Promise((t2, n2) => {
      const r2 = new Image();
      new URL(e2, document.baseURI).origin !== new URL(location).origin && (r2.crossOrigin = "anonymous"), r2.onload = () => t2(r2), r2.onerror = () => n2(new Error(`Unable to load file: ${this.name}`)), r2.src = e2;
    });
  }
  async arrow() {
    const [e2, t2] = await Promise.all([N(V.resolve()), ne(this)]);
    return e2.Table.from(t2);
  }
  async sqlite() {
    return SQLiteDatabaseClient2.open(ne(this));
  }
  async zip() {
    const [e2, t2] = await Promise.all([N(z.resolve()), this.arrayBuffer()]);
    return new ZipArchive2(await e2.loadAsync(t2));
  }
  async xml(e2 = "application/xml") {
    return new DOMParser().parseFromString(await this.text(), e2);
  }
  async html() {
    return this.xml("text/html");
  }
};
var FileAttachment2 = class extends oe {
  constructor(e2, t2) {
    super(t2), Object.defineProperty(this, "_url", { value: e2 });
  }
  async url() {
    return await this._url + "";
  }
};
function ie(e2) {
  throw new Error(`File not found: ${e2}`);
}
function ae(e2) {
  return Object.assign((t2) => {
    const n2 = e2(t2 += "");
    if (n2 == null)
      throw new Error(`File not found: ${t2}`);
    return new FileAttachment2(n2, t2);
  }, { prototype: FileAttachment2.prototype });
}
var ZipArchive2 = class {
  constructor(e2) {
    Object.defineProperty(this, "_", { value: e2 }), this.filenames = Object.keys(e2.files).filter((t2) => !e2.files[t2].dir);
  }
  file(e2) {
    const t2 = this._.file(e2 += "");
    if (!t2 || t2.dir)
      throw new Error(`file not found: ${e2}`);
    return new ZipArchiveEntry2(t2);
  }
};
var ZipArchiveEntry2 = class extends oe {
  constructor(e2) {
    super(e2.name), Object.defineProperty(this, "_", { value: e2 }), Object.defineProperty(this, "_url", { writable: true });
  }
  async url() {
    return this._url || (this._url = this.blob().then(URL.createObjectURL));
  }
  async blob() {
    return this._.async("blob");
  }
  async arrayBuffer() {
    return this._.async("arraybuffer");
  }
  async text() {
    return this._.async("text");
  }
  async json() {
    return JSON.parse(await this.text());
  }
};
var se = { math: "http://www.w3.org/1998/Math/MathML", svg: "http://www.w3.org/2000/svg", xhtml: "http://www.w3.org/1999/xhtml", xlink: "http://www.w3.org/1999/xlink", xml: "http://www.w3.org/XML/1998/namespace", xmlns: "http://www.w3.org/2000/xmlns/" };
var ue = 0;
function le(e2) {
  this.id = e2, this.href = new URL(`#${e2}`, location) + "";
}
le.prototype.toString = function() {
  return "url(" + this.href + ")";
};
var ce = { canvas: function(e2, t2) {
  var n2 = document.createElement("canvas");
  return n2.width = e2, n2.height = t2, n2;
}, context2d: function(e2, t2, n2) {
  n2 == null && (n2 = devicePixelRatio);
  var r2 = document.createElement("canvas");
  r2.width = e2 * n2, r2.height = t2 * n2, r2.style.width = e2 + "px";
  var o2 = r2.getContext("2d");
  return o2.scale(n2, n2), o2;
}, download: function(e2, t2 = "untitled", n2 = "Save") {
  const r2 = document.createElement("a"), o2 = r2.appendChild(document.createElement("button"));
  async function i2() {
    await new Promise(requestAnimationFrame), URL.revokeObjectURL(r2.href), r2.removeAttribute("href"), o2.textContent = n2, o2.disabled = false;
  }
  return o2.textContent = n2, r2.download = t2, r2.onclick = async (t3) => {
    if (o2.disabled = true, r2.href)
      return i2();
    o2.textContent = "Saving\u2026";
    try {
      const t4 = await (typeof e2 == "function" ? e2() : e2);
      o2.textContent = "Download", r2.href = URL.createObjectURL(t4);
    } catch (e3) {
      o2.textContent = n2;
    }
    if (t3.eventPhase)
      return i2();
    o2.disabled = false;
  }, r2;
}, element: function(e2, t2) {
  var n2, r2 = e2 += "", o2 = r2.indexOf(":");
  o2 >= 0 && (r2 = e2.slice(0, o2)) !== "xmlns" && (e2 = e2.slice(o2 + 1));
  var i2 = se.hasOwnProperty(r2) ? document.createElementNS(se[r2], e2) : document.createElement(e2);
  if (t2)
    for (var a2 in t2)
      o2 = (r2 = a2).indexOf(":"), n2 = t2[a2], o2 >= 0 && (r2 = a2.slice(0, o2)) !== "xmlns" && (a2 = a2.slice(o2 + 1)), se.hasOwnProperty(r2) ? i2.setAttributeNS(se[r2], a2, n2) : i2.setAttribute(a2, n2);
  return i2;
}, input: function(e2) {
  var t2 = document.createElement("input");
  return e2 != null && (t2.type = e2), t2;
}, range: function(e2, t2, n2) {
  arguments.length === 1 && (t2 = e2, e2 = null);
  var r2 = document.createElement("input");
  return r2.min = e2 = e2 == null ? 0 : +e2, r2.max = t2 = t2 == null ? 1 : +t2, r2.step = n2 == null ? "any" : n2 = +n2, r2.type = "range", r2;
}, select: function(e2) {
  var t2 = document.createElement("select");
  return Array.prototype.forEach.call(e2, function(e3) {
    var n2 = document.createElement("option");
    n2.value = n2.textContent = e3, t2.appendChild(n2);
  }), t2;
}, svg: function(e2, t2) {
  var n2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return n2.setAttribute("viewBox", [0, 0, e2, t2]), n2.setAttribute("width", e2), n2.setAttribute("height", t2), n2;
}, text: function(e2) {
  return document.createTextNode(e2);
}, uid: function(e2) {
  return new le("O-" + (e2 == null ? "" : e2 + "-") + ++ue);
} };
var fe = { buffer: function(e2) {
  return new Promise(function(t2, n2) {
    var r2 = new FileReader();
    r2.onload = function() {
      t2(r2.result);
    }, r2.onerror = n2, r2.readAsArrayBuffer(e2);
  });
}, text: function(e2) {
  return new Promise(function(t2, n2) {
    var r2 = new FileReader();
    r2.onload = function() {
      t2(r2.result);
    }, r2.onerror = n2, r2.readAsText(e2);
  });
}, url: function(e2) {
  return new Promise(function(t2, n2) {
    var r2 = new FileReader();
    r2.onload = function() {
      t2(r2.result);
    }, r2.onerror = n2, r2.readAsDataURL(e2);
  });
} };
function de() {
  return this;
}
function he(e2, t2) {
  let n2 = false;
  if (typeof t2 != "function")
    throw new Error("dispose is not a function");
  return { [Symbol.iterator]: de, next: () => n2 ? { done: true } : (n2 = true, { done: false, value: e2 }), return: () => (n2 = true, t2(e2), { done: true }), throw: () => ({ done: n2 = true }) };
}
function me(e2) {
  let t2, n2, r2 = false;
  const o2 = e2(function(e3) {
    n2 ? (n2(e3), n2 = null) : r2 = true;
    return t2 = e3;
  });
  if (o2 != null && typeof o2 != "function")
    throw new Error(typeof o2.then == "function" ? "async initializers are not supported" : "initializer returned something, but not a dispose function");
  return { [Symbol.iterator]: de, throw: () => ({ done: true }), return: () => (o2 != null && o2(), { done: true }), next: function() {
    return { done: false, value: r2 ? (r2 = false, Promise.resolve(t2)) : new Promise((e3) => n2 = e3) };
  } };
}
function pe(e2) {
  switch (e2.type) {
    case "range":
    case "number":
      return e2.valueAsNumber;
    case "date":
      return e2.valueAsDate;
    case "checkbox":
      return e2.checked;
    case "file":
      return e2.multiple ? e2.files : e2.files[0];
    case "select-multiple":
      return Array.from(e2.selectedOptions, (e3) => e3.value);
    default:
      return e2.value;
  }
}
var we = { disposable: he, filter: function* (e2, t2) {
  for (var n2, r2 = -1; !(n2 = e2.next()).done; )
    t2(n2.value, ++r2) && (yield n2.value);
}, input: function(e2) {
  return me(function(t2) {
    var n2 = function(e3) {
      switch (e3.type) {
        case "button":
        case "submit":
        case "checkbox":
          return "click";
        case "file":
          return "change";
        default:
          return "input";
      }
    }(e2), r2 = pe(e2);
    function o2() {
      t2(pe(e2));
    }
    return e2.addEventListener(n2, o2), r2 !== void 0 && t2(r2), function() {
      e2.removeEventListener(n2, o2);
    };
  });
}, map: function* (e2, t2) {
  for (var n2, r2 = -1; !(n2 = e2.next()).done; )
    yield t2(n2.value, ++r2);
}, observe: me, queue: function(e2) {
  let t2;
  const n2 = [], r2 = e2(function(e3) {
    n2.push(e3), t2 && (t2(n2.shift()), t2 = null);
    return e3;
  });
  if (r2 != null && typeof r2 != "function")
    throw new Error(typeof r2.then == "function" ? "async initializers are not supported" : "initializer returned something, but not a dispose function");
  return { [Symbol.iterator]: de, throw: () => ({ done: true }), return: () => (r2 != null && r2(), { done: true }), next: function() {
    return { done: false, value: n2.length ? Promise.resolve(n2.shift()) : new Promise((e3) => t2 = e3) };
  } };
}, range: function* (e2, t2, n2) {
  e2 = +e2, t2 = +t2, n2 = (o2 = arguments.length) < 2 ? (t2 = e2, e2 = 0, 1) : o2 < 3 ? 1 : +n2;
  for (var r2 = -1, o2 = 0 | Math.max(0, Math.ceil((t2 - e2) / n2)); ++r2 < o2; )
    yield e2 + r2 * n2;
}, valueAt: function(e2, t2) {
  if (!(!isFinite(t2 = +t2) || t2 < 0 || t2 != t2 | 0)) {
    for (var n2, r2 = -1; !(n2 = e2.next()).done; )
      if (++r2 === t2)
        return n2.value;
  }
}, worker: function(e2) {
  const t2 = URL.createObjectURL(new Blob([e2], { type: "text/javascript" })), n2 = new Worker(t2);
  return he(n2, () => {
    n2.terminate(), URL.revokeObjectURL(t2);
  });
} };
function ve(e2, t2) {
  return function(n2) {
    var r2, o2, i2, a2, s2, u2, l2, c2, f2 = n2[0], d2 = [], h2 = null, m2 = -1;
    for (s2 = 1, u2 = arguments.length; s2 < u2; ++s2) {
      if ((r2 = arguments[s2]) instanceof Node)
        d2[++m2] = r2, f2 += "<!--o:" + m2 + "-->";
      else if (Array.isArray(r2)) {
        for (l2 = 0, c2 = r2.length; l2 < c2; ++l2)
          (o2 = r2[l2]) instanceof Node ? (h2 === null && (d2[++m2] = h2 = document.createDocumentFragment(), f2 += "<!--o:" + m2 + "-->"), h2.appendChild(o2)) : (h2 = null, f2 += o2);
        h2 = null;
      } else
        f2 += r2;
      f2 += n2[s2];
    }
    if (h2 = e2(f2), ++m2 > 0) {
      for (i2 = new Array(m2), a2 = document.createTreeWalker(h2, NodeFilter.SHOW_COMMENT, null, false); a2.nextNode(); )
        o2 = a2.currentNode, /^o:/.test(o2.nodeValue) && (i2[+o2.nodeValue.slice(2)] = o2);
      for (s2 = 0; s2 < m2; ++s2)
        (o2 = i2[s2]) && o2.parentNode.replaceChild(d2[s2], o2);
    }
    return h2.childNodes.length === 1 ? h2.removeChild(h2.firstChild) : h2.nodeType === 11 ? ((o2 = t2()).appendChild(h2), o2) : h2;
  };
}
var ye = ve(function(e2) {
  var t2 = document.createElement("template");
  return t2.innerHTML = e2.trim(), document.importNode(t2.content, true);
}, function() {
  return document.createElement("span");
});
function ge(e2) {
  let t2;
  Object.defineProperties(this, { generator: { value: me((e3) => {
    t2 = e3;
  }) }, value: { get: () => e2, set: (n2) => t2(e2 = n2) } }), e2 !== void 0 && t2(e2);
}
function* be() {
  for (; ; )
    yield Date.now();
}
var xe = new Map();
function je(e2, t2) {
  var n2;
  return (n2 = xe.get(e2 = +e2)) ? n2.then(() => t2) : (n2 = Date.now()) >= e2 ? Promise.resolve(t2) : function(e3, t3) {
    var n3 = new Promise(function(n4) {
      xe.delete(t3);
      var r2 = t3 - e3;
      if (!(r2 > 0))
        throw new Error("invalid time");
      if (r2 > 2147483647)
        throw new Error("too long to wait");
      setTimeout(n4, r2);
    });
    return xe.set(t3, n3), n3;
  }(n2, e2).then(() => t2);
}
var Ee = { delay: function(e2, t2) {
  return new Promise(function(n2) {
    setTimeout(function() {
      n2(t2);
    }, e2);
  });
}, tick: function(e2, t2) {
  return je(Math.ceil((Date.now() + 1) / e2) * e2, t2);
}, when: je };
function Pe(e2, t2) {
  if (/^(\w+:)|\/\//i.test(e2))
    return e2;
  if (/^[.]{0,2}\//i.test(e2))
    return new URL(e2, t2 == null ? location : t2).href;
  if (!e2.length || /^[\s._]/.test(e2) || /\s$/.test(e2))
    throw new Error("illegal name");
  return "https://unpkg.com/" + e2;
}
function Ce(e2) {
  return e2 == null ? N : L(e2);
}
var Ae = ve(function(e2) {
  var t2 = document.createElementNS("http://www.w3.org/2000/svg", "g");
  return t2.innerHTML = e2.trim(), t2;
}, function() {
  return document.createElementNS("http://www.w3.org/2000/svg", "g");
});
var Ne = String.raw;
function Le() {
  return me(function(e2) {
    var t2 = e2(document.body.clientWidth);
    function n2() {
      var n3 = document.body.clientWidth;
      n3 !== t2 && e2(t2 = n3);
    }
    return window.addEventListener("resize", n2), function() {
      window.removeEventListener("resize", n2);
    };
  });
}
var Oe = Object.assign(function(e2) {
  const t2 = Ce(e2);
  var n2;
  Object.defineProperties(this, (n2 = { FileAttachment: () => ie, Arrow: () => t2(V.resolve()), Inputs: () => t2(q.resolve()), Mutable: () => ge, Plot: () => t2(M.resolve()), SQLite: () => G(t2), SQLiteDatabaseClient: () => SQLiteDatabaseClient2, _: () => t2(F.resolve()), aq: () => t2.alias({ "apache-arrow": V.resolve() })(J.resolve()), d3: () => t2(U.resolve()), dot: () => t2(S.resolve()), htl: () => t2(B.resolve()), html: () => ye, md: () => function(e3) {
    return e3(H.resolve()).then(function(t3) {
      return ve(function(n3) {
        var r2 = document.createElement("div");
        r2.innerHTML = t3(n3, { langPrefix: "" }).trim();
        var o2 = r2.querySelectorAll("pre code[class]");
        return o2.length > 0 && e3(_.resolve()).then(function(t4) {
          o2.forEach(function(n4) {
            function r3() {
              t4.highlightBlock(n4), n4.parentNode.classList.add("observablehq--md-pre");
            }
            t4.getLanguage(n4.className) ? r3() : e3(_.resolve("async-languages/index.js")).then((r4) => {
              if (r4.has(n4.className))
                return e3(_.resolve("async-languages/" + r4.get(n4.className))).then((e4) => {
                  t4.registerLanguage(n4.className, e4);
                });
            }).then(r3, r3);
          });
        }), r2;
      }, function() {
        return document.createElement("div");
      });
    });
  }(t2), now: be, require: () => t2, resolve: () => Pe, svg: () => Ae, tex: () => function(e3) {
    return Promise.all([e3(D.resolve()), (t3 = D.resolve("dist/katex.min.css"), new Promise(function(e4, n3) {
      var r2 = document.createElement("link");
      r2.rel = "stylesheet", r2.href = t3, r2.onerror = n3, r2.onload = e4, document.head.appendChild(r2);
    }))]).then(function(e4) {
      var t4 = e4[0], n3 = r2();
      function r2(e5) {
        return function() {
          var n4 = document.createElement("div");
          return t4.render(Ne.apply(String, arguments), n4, e5), n4.removeChild(n4.firstChild);
        };
      }
      return n3.options = r2, n3.block = r2({ displayMode: true }), n3;
    });
    var t3;
  }(t2), topojson: () => t2(X.resolve()), vl: () => async function(e3) {
    const [t3, n3, r2] = await Promise.all([I, Z, Q].map((t4) => e3(t4.resolve())));
    return r2.register(t3, n3);
  }(t2), width: Le, DOM: ce, Files: fe, Generators: we, Promises: Ee }, Y(Object.entries(n2).map(Re))));
}, { resolve: N.resolve });
function Re([e2, t2]) {
  return [e2, { value: t2, writable: true, enumerable: true }];
}

// ../src/resources/formats/html/ojs/pandoc-code-decorator.js
var PandocCodeDecorator = class {
  constructor(node) {
    this._node = node;
    this._spans = [];
    this.normalizeCodeRange();
    this.initializeEntryPoints();
  }
  normalizeCodeRange() {
    const n2 = this._node;
    const lines = n2.querySelectorAll("code > span");
    for (const line of lines) {
      Array.from(line.childNodes).filter((n22) => n22.nodeType === n22.TEXT_NODE).forEach((n22) => {
        const newSpan = document.createElement("span");
        newSpan.textContent = n22.wholeText;
        n22.replaceWith(newSpan);
      });
    }
  }
  initializeEntryPoints() {
    const lines = this._node.querySelectorAll("code > span");
    let result = [];
    let offset2 = this._node.parentElement.dataset.sourceOffset && -Number(this._node.parentElement.dataset.sourceOffset) || 0;
    for (const line of lines) {
      let lineNumber = Number(line.id.split("-").pop());
      let column = 1;
      Array.from(line.childNodes).filter((n2) => n2.nodeType === n2.ELEMENT_NODE && n2.nodeName === "SPAN").forEach((n2) => {
        result.push({
          offset: offset2,
          line: lineNumber,
          column,
          node: n2
        });
        offset2 += n2.textContent.length;
        column += n2.textContent.length;
      });
      offset2 += 1;
    }
    this._elementEntryPoints = result;
  }
  locateEntry(offset2) {
    let candidate;
    if (offset2 === Infinity)
      return void 0;
    for (let i2 = 0; i2 < this._elementEntryPoints.length; ++i2) {
      const entry = this._elementEntryPoints[i2];
      if (entry.offset > offset2) {
        return { entry: candidate, index: i2 - 1 };
      }
      candidate = entry;
    }
    if (offset2 < candidate.offset + candidate.node.textContent.length) {
      return { entry: candidate, index: this._elementEntryPoints.length - 1 };
    } else {
      return void 0;
    }
  }
  offsetToLineColumn(offset2) {
    let entry = this.locateEntry(offset2);
    if (entry === void 0) {
      const entries = this._elementEntryPoints;
      const last = entries[entries.length - 1];
      return {
        line: last.line,
        column: last.column + Math.min(last.node.textContent.length, offset2 - last.offset)
      };
    }
    return {
      line: entry.entry.line,
      column: entry.entry.column + offset2 - entry.entry.offset
    };
  }
  *spanSelection(start, end) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === void 0) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = endEntry && endEntry.index || this._elementEntryPoints.length;
    for (let i2 = startIndex; i2 < endIndex; ++i2) {
      yield this._elementEntryPoints[i2];
    }
  }
  decorateSpan(start, end, classes) {
    for (const entryPoint of this.spanSelection(start, end)) {
      for (const cssClass of classes) {
        entryPoint.node.classList.add(cssClass);
      }
    }
  }
  clearSpan(start, end, classes) {
    for (const entryPoint of this.spanSelection(start, end)) {
      for (const cssClass of classes) {
        entryPoint.node.classList.remove(cssClass);
      }
    }
  }
  ensureExactSpan(start, end) {
    const splitEntry = (entry, offset2) => {
      const newSpan = document.createElement("span");
      for (const cssClass of entry.node.classList) {
        newSpan.classList.add(cssClass);
      }
      const beforeText = entry.node.textContent.slice(0, offset2 - entry.offset);
      const afterText = entry.node.textContent.slice(offset2 - entry.offset);
      entry.node.textContent = beforeText;
      newSpan.textContent = afterText;
      entry.node.after(newSpan);
      this._elementEntryPoints.push({
        column: entry.column + offset2 - entry.offset,
        line: entry.line,
        node: newSpan,
        offset: offset2
      });
      this._elementEntryPoints.sort((a2, b2) => a2.offset - b2.offset);
    };
    const startEntry = this.locateEntry(start);
    if (startEntry !== void 0 && startEntry.entry.offset != start) {
      splitEntry(startEntry.entry, start);
    }
    const endEntry = this.locateEntry(end);
    if (endEntry !== void 0 && endEntry.entry.offset !== end) {
      splitEntry(endEntry.entry, end);
    }
  }
  clearSpan(start, end, classes) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === void 0) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = endEntry && endEntry.index || this._elementEntryPoints.length;
    for (let i2 = startIndex; i2 < endIndex; ++i2) {
      for (const cssClass of classes) {
        this._elementEntryPoints[i2].node.classList.remove(cssClass);
      }
    }
  }
};

// deno-cache:https://cdn.skypack.dev/-/htl@v0.3.1-79Z5lT9l5xiqiWhiPMee/dist=es2019,mode=imports/optimized/htl.js
function renderHtml(string) {
  const template2 = document.createElement("template");
  template2.innerHTML = string;
  return document.importNode(template2.content, true);
}
function renderSvg(string) {
  const g2 = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g2.innerHTML = string;
  return g2;
}
var html2 = Object.assign(hypertext(renderHtml, (fragment) => {
  if (fragment.firstChild === null)
    return null;
  if (fragment.firstChild === fragment.lastChild)
    return fragment.removeChild(fragment.firstChild);
  const span = document.createElement("span");
  span.appendChild(fragment);
  return span;
}), { fragment: hypertext(renderHtml, (fragment) => fragment) });
var svg2 = Object.assign(hypertext(renderSvg, (g2) => {
  if (g2.firstChild === null)
    return null;
  if (g2.firstChild === g2.lastChild)
    return g2.removeChild(g2.firstChild);
  return g2;
}), { fragment: hypertext(renderSvg, (g2) => {
  const fragment = document.createDocumentFragment();
  while (g2.firstChild)
    fragment.appendChild(g2.firstChild);
  return fragment;
}) });
var CODE_TAB = 9;
var CODE_LF = 10;
var CODE_FF = 12;
var CODE_CR = 13;
var CODE_SPACE = 32;
var CODE_UPPER_A = 65;
var CODE_UPPER_Z = 90;
var CODE_LOWER_A = 97;
var CODE_LOWER_Z = 122;
var CODE_LT = 60;
var CODE_GT = 62;
var CODE_SLASH = 47;
var CODE_DASH = 45;
var CODE_BANG = 33;
var CODE_EQ = 61;
var CODE_DQUOTE = 34;
var CODE_SQUOTE = 39;
var CODE_QUESTION = 63;
var STATE_DATA = 1;
var STATE_TAG_OPEN = 2;
var STATE_END_TAG_OPEN = 3;
var STATE_TAG_NAME = 4;
var STATE_BOGUS_COMMENT = 5;
var STATE_BEFORE_ATTRIBUTE_NAME = 6;
var STATE_AFTER_ATTRIBUTE_NAME = 7;
var STATE_ATTRIBUTE_NAME = 8;
var STATE_BEFORE_ATTRIBUTE_VALUE = 9;
var STATE_ATTRIBUTE_VALUE_DOUBLE_QUOTED = 10;
var STATE_ATTRIBUTE_VALUE_SINGLE_QUOTED = 11;
var STATE_ATTRIBUTE_VALUE_UNQUOTED = 12;
var STATE_AFTER_ATTRIBUTE_VALUE_QUOTED = 13;
var STATE_SELF_CLOSING_START_TAG = 14;
var STATE_COMMENT_START = 15;
var STATE_COMMENT_START_DASH = 16;
var STATE_COMMENT = 17;
var STATE_COMMENT_LESS_THAN_SIGN = 18;
var STATE_COMMENT_LESS_THAN_SIGN_BANG = 19;
var STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH = 20;
var STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH = 21;
var STATE_COMMENT_END_DASH = 22;
var STATE_COMMENT_END = 23;
var STATE_COMMENT_END_BANG = 24;
var STATE_MARKUP_DECLARATION_OPEN = 25;
var STATE_RAWTEXT = 26;
var STATE_RAWTEXT_LESS_THAN_SIGN = 27;
var STATE_RAWTEXT_END_TAG_OPEN = 28;
var STATE_RAWTEXT_END_TAG_NAME = 29;
var SHOW_COMMENT = 128;
var SHOW_ELEMENT = 1;
var TYPE_COMMENT = 8;
var TYPE_ELEMENT = 1;
var NS_SVG = "http://www.w3.org/2000/svg";
var NS_XLINK = "http://www.w3.org/1999/xlink";
var NS_XML = "http://www.w3.org/XML/1998/namespace";
var NS_XMLNS = "http://www.w3.org/2000/xmlns/";
var svgAdjustAttributes = new Map([
  "attributeName",
  "attributeType",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "clipPathUnits",
  "diffuseConstant",
  "edgeMode",
  "filterUnits",
  "glyphRef",
  "gradientTransform",
  "gradientUnits",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "markerUnits",
  "markerWidth",
  "maskContentUnits",
  "maskUnits",
  "numOctaves",
  "pathLength",
  "patternContentUnits",
  "patternTransform",
  "patternUnits",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "preserveAspectRatio",
  "primitiveUnits",
  "refX",
  "refY",
  "repeatCount",
  "repeatDur",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewBox",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan"
].map((name) => [name.toLowerCase(), name]));
var svgForeignAttributes = new Map([
  ["xlink:actuate", NS_XLINK],
  ["xlink:arcrole", NS_XLINK],
  ["xlink:href", NS_XLINK],
  ["xlink:role", NS_XLINK],
  ["xlink:show", NS_XLINK],
  ["xlink:title", NS_XLINK],
  ["xlink:type", NS_XLINK],
  ["xml:lang", NS_XML],
  ["xml:space", NS_XML],
  ["xmlns", NS_XMLNS],
  ["xmlns:xlink", NS_XMLNS]
]);
function hypertext(render, postprocess) {
  return function({ raw: strings }) {
    let state = STATE_DATA;
    let string = "";
    let tagNameStart;
    let tagName;
    let attributeNameStart;
    let attributeNameEnd;
    let nodeFilter = 0;
    for (let j2 = 0, m2 = arguments.length; j2 < m2; ++j2) {
      const input2 = strings[j2];
      if (j2 > 0) {
        const value = arguments[j2];
        switch (state) {
          case STATE_RAWTEXT: {
            if (value != null) {
              const text2 = `${value}`;
              if (isEscapableRawText(tagName)) {
                string += text2.replace(/[<]/g, entity);
              } else if (new RegExp(`</${tagName}[\\s>/]`, "i").test(string.slice(-tagName.length - 2) + text2)) {
                throw new Error("unsafe raw text");
              } else {
                string += text2;
              }
            }
            break;
          }
          case STATE_DATA: {
            if (value == null)
              ;
            else if (value instanceof Node || typeof value !== "string" && value[Symbol.iterator] || /(?:^|>)$/.test(strings[j2 - 1]) && /^(?:<|$)/.test(input2)) {
              string += "<!--::" + j2 + "-->";
              nodeFilter |= SHOW_COMMENT;
            } else {
              string += `${value}`.replace(/[<&]/g, entity);
            }
            break;
          }
          case STATE_BEFORE_ATTRIBUTE_VALUE: {
            state = STATE_ATTRIBUTE_VALUE_UNQUOTED;
            let text2;
            if (/^[\s>]/.test(input2)) {
              if (value == null || value === false) {
                string = string.slice(0, attributeNameStart - strings[j2 - 1].length);
                break;
              }
              if (value === true || (text2 = `${value}`) === "") {
                string += "''";
                break;
              }
              const name = strings[j2 - 1].slice(attributeNameStart, attributeNameEnd);
              if (name === "style" && isObjectLiteral(value) || typeof value === "function") {
                string += "::" + j2;
                nodeFilter |= SHOW_ELEMENT;
                break;
              }
            }
            if (text2 === void 0)
              text2 = `${value}`;
            if (text2 === "")
              throw new Error("unsafe unquoted empty string");
            string += text2.replace(/^['"]|[\s>&]/g, entity);
            break;
          }
          case STATE_ATTRIBUTE_VALUE_UNQUOTED: {
            string += `${value}`.replace(/[\s>&]/g, entity);
            break;
          }
          case STATE_ATTRIBUTE_VALUE_SINGLE_QUOTED: {
            string += `${value}`.replace(/['&]/g, entity);
            break;
          }
          case STATE_ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
            string += `${value}`.replace(/["&]/g, entity);
            break;
          }
          case STATE_BEFORE_ATTRIBUTE_NAME: {
            if (isObjectLiteral(value)) {
              string += "::" + j2 + "=''";
              nodeFilter |= SHOW_ELEMENT;
              break;
            }
            throw new Error("invalid binding");
          }
          case STATE_COMMENT:
            break;
          default:
            throw new Error("invalid binding");
        }
      }
      for (let i2 = 0, n2 = input2.length; i2 < n2; ++i2) {
        const code = input2.charCodeAt(i2);
        switch (state) {
          case STATE_DATA: {
            if (code === CODE_LT) {
              state = STATE_TAG_OPEN;
            }
            break;
          }
          case STATE_TAG_OPEN: {
            if (code === CODE_BANG) {
              state = STATE_MARKUP_DECLARATION_OPEN;
            } else if (code === CODE_SLASH) {
              state = STATE_END_TAG_OPEN;
            } else if (isAsciiAlphaCode(code)) {
              tagNameStart = i2, tagName = void 0;
              state = STATE_TAG_NAME, --i2;
            } else if (code === CODE_QUESTION) {
              state = STATE_BOGUS_COMMENT, --i2;
            } else {
              state = STATE_DATA, --i2;
            }
            break;
          }
          case STATE_END_TAG_OPEN: {
            if (isAsciiAlphaCode(code)) {
              state = STATE_TAG_NAME, --i2;
            } else if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_BOGUS_COMMENT, --i2;
            }
            break;
          }
          case STATE_TAG_NAME: {
            if (isSpaceCode(code)) {
              state = STATE_BEFORE_ATTRIBUTE_NAME;
              tagName = lower(input2, tagNameStart, i2);
            } else if (code === CODE_SLASH) {
              state = STATE_SELF_CLOSING_START_TAG;
            } else if (code === CODE_GT) {
              tagName = lower(input2, tagNameStart, i2);
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            }
            break;
          }
          case STATE_BEFORE_ATTRIBUTE_NAME: {
            if (isSpaceCode(code))
              ;
            else if (code === CODE_SLASH || code === CODE_GT) {
              state = STATE_AFTER_ATTRIBUTE_NAME, --i2;
            } else if (code === CODE_EQ) {
              state = STATE_ATTRIBUTE_NAME;
              attributeNameStart = i2 + 1, attributeNameEnd = void 0;
            } else {
              state = STATE_ATTRIBUTE_NAME, --i2;
              attributeNameStart = i2 + 1, attributeNameEnd = void 0;
            }
            break;
          }
          case STATE_ATTRIBUTE_NAME: {
            if (isSpaceCode(code) || code === CODE_SLASH || code === CODE_GT) {
              state = STATE_AFTER_ATTRIBUTE_NAME, --i2;
              attributeNameEnd = i2;
            } else if (code === CODE_EQ) {
              state = STATE_BEFORE_ATTRIBUTE_VALUE;
              attributeNameEnd = i2;
            }
            break;
          }
          case STATE_AFTER_ATTRIBUTE_NAME: {
            if (isSpaceCode(code))
              ;
            else if (code === CODE_SLASH) {
              state = STATE_SELF_CLOSING_START_TAG;
            } else if (code === CODE_EQ) {
              state = STATE_BEFORE_ATTRIBUTE_VALUE;
            } else if (code === CODE_GT) {
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            } else {
              state = STATE_ATTRIBUTE_NAME, --i2;
              attributeNameStart = i2 + 1, attributeNameEnd = void 0;
            }
            break;
          }
          case STATE_BEFORE_ATTRIBUTE_VALUE: {
            if (isSpaceCode(code))
              ;
            else if (code === CODE_DQUOTE) {
              state = STATE_ATTRIBUTE_VALUE_DOUBLE_QUOTED;
            } else if (code === CODE_SQUOTE) {
              state = STATE_ATTRIBUTE_VALUE_SINGLE_QUOTED;
            } else if (code === CODE_GT) {
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            } else {
              state = STATE_ATTRIBUTE_VALUE_UNQUOTED, --i2;
            }
            break;
          }
          case STATE_ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
            if (code === CODE_DQUOTE) {
              state = STATE_AFTER_ATTRIBUTE_VALUE_QUOTED;
            }
            break;
          }
          case STATE_ATTRIBUTE_VALUE_SINGLE_QUOTED: {
            if (code === CODE_SQUOTE) {
              state = STATE_AFTER_ATTRIBUTE_VALUE_QUOTED;
            }
            break;
          }
          case STATE_ATTRIBUTE_VALUE_UNQUOTED: {
            if (isSpaceCode(code)) {
              state = STATE_BEFORE_ATTRIBUTE_NAME;
            } else if (code === CODE_GT) {
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            }
            break;
          }
          case STATE_AFTER_ATTRIBUTE_VALUE_QUOTED: {
            if (isSpaceCode(code)) {
              state = STATE_BEFORE_ATTRIBUTE_NAME;
            } else if (code === CODE_SLASH) {
              state = STATE_SELF_CLOSING_START_TAG;
            } else if (code === CODE_GT) {
              state = isRawText(tagName) ? STATE_RAWTEXT : STATE_DATA;
            } else {
              state = STATE_BEFORE_ATTRIBUTE_NAME, --i2;
            }
            break;
          }
          case STATE_SELF_CLOSING_START_TAG: {
            if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_BEFORE_ATTRIBUTE_NAME, --i2;
            }
            break;
          }
          case STATE_BOGUS_COMMENT: {
            if (code === CODE_GT) {
              state = STATE_DATA;
            }
            break;
          }
          case STATE_COMMENT_START: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_START_DASH;
            } else if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_COMMENT, --i2;
            }
            break;
          }
          case STATE_COMMENT_START_DASH: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_END;
            } else if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_COMMENT, --i2;
            }
            break;
          }
          case STATE_COMMENT: {
            if (code === CODE_LT) {
              state = STATE_COMMENT_LESS_THAN_SIGN;
            } else if (code === CODE_DASH) {
              state = STATE_COMMENT_END_DASH;
            }
            break;
          }
          case STATE_COMMENT_LESS_THAN_SIGN: {
            if (code === CODE_BANG) {
              state = STATE_COMMENT_LESS_THAN_SIGN_BANG;
            } else if (code !== CODE_LT) {
              state = STATE_COMMENT, --i2;
            }
            break;
          }
          case STATE_COMMENT_LESS_THAN_SIGN_BANG: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH;
            } else {
              state = STATE_COMMENT, --i2;
            }
            break;
          }
          case STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
            } else {
              state = STATE_COMMENT_END, --i2;
            }
            break;
          }
          case STATE_COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH: {
            state = STATE_COMMENT_END, --i2;
            break;
          }
          case STATE_COMMENT_END_DASH: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_END;
            } else {
              state = STATE_COMMENT, --i2;
            }
            break;
          }
          case STATE_COMMENT_END: {
            if (code === CODE_GT) {
              state = STATE_DATA;
            } else if (code === CODE_BANG) {
              state = STATE_COMMENT_END_BANG;
            } else if (code !== CODE_DASH) {
              state = STATE_COMMENT, --i2;
            }
            break;
          }
          case STATE_COMMENT_END_BANG: {
            if (code === CODE_DASH) {
              state = STATE_COMMENT_END_DASH;
            } else if (code === CODE_GT) {
              state = STATE_DATA;
            } else {
              state = STATE_COMMENT, --i2;
            }
            break;
          }
          case STATE_MARKUP_DECLARATION_OPEN: {
            if (code === CODE_DASH && input2.charCodeAt(i2 + 1) === CODE_DASH) {
              state = STATE_COMMENT_START, ++i2;
            } else {
              state = STATE_BOGUS_COMMENT, --i2;
            }
            break;
          }
          case STATE_RAWTEXT: {
            if (code === CODE_LT) {
              state = STATE_RAWTEXT_LESS_THAN_SIGN;
            }
            break;
          }
          case STATE_RAWTEXT_LESS_THAN_SIGN: {
            if (code === CODE_SLASH) {
              state = STATE_RAWTEXT_END_TAG_OPEN;
            } else {
              state = STATE_RAWTEXT, --i2;
            }
            break;
          }
          case STATE_RAWTEXT_END_TAG_OPEN: {
            if (isAsciiAlphaCode(code)) {
              tagNameStart = i2;
              state = STATE_RAWTEXT_END_TAG_NAME, --i2;
            } else {
              state = STATE_RAWTEXT, --i2;
            }
            break;
          }
          case STATE_RAWTEXT_END_TAG_NAME: {
            if (isSpaceCode(code) && tagName === lower(input2, tagNameStart, i2)) {
              state = STATE_BEFORE_ATTRIBUTE_NAME;
            } else if (code === CODE_SLASH && tagName === lower(input2, tagNameStart, i2)) {
              state = STATE_SELF_CLOSING_START_TAG;
            } else if (code === CODE_GT && tagName === lower(input2, tagNameStart, i2)) {
              state = STATE_DATA;
            } else if (!isAsciiAlphaCode(code)) {
              state = STATE_RAWTEXT, --i2;
            }
            break;
          }
          default: {
            state = void 0;
            break;
          }
        }
      }
      string += input2;
    }
    const root = render(string);
    const walker = document.createTreeWalker(root, nodeFilter, null, false);
    const removeNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      switch (node.nodeType) {
        case TYPE_ELEMENT: {
          const attributes = node.attributes;
          for (let i2 = 0, n2 = attributes.length; i2 < n2; ++i2) {
            const { name, value: currentValue } = attributes[i2];
            if (/^::/.test(name)) {
              const value = arguments[+name.slice(2)];
              removeAttribute(node, name), --i2, --n2;
              for (const key in value) {
                const subvalue = value[key];
                if (subvalue == null || subvalue === false)
                  ;
                else if (typeof subvalue === "function") {
                  node[key] = subvalue;
                } else if (key === "style" && isObjectLiteral(subvalue)) {
                  setStyles(node[key], subvalue);
                } else {
                  setAttribute(node, key, subvalue === true ? "" : subvalue);
                }
              }
            } else if (/^::/.test(currentValue)) {
              const value = arguments[+currentValue.slice(2)];
              removeAttribute(node, name), --i2, --n2;
              if (typeof value === "function") {
                node[name] = value;
              } else {
                setStyles(node[name], value);
              }
            }
          }
          break;
        }
        case TYPE_COMMENT: {
          if (/^::/.test(node.data)) {
            const parent = node.parentNode;
            const value = arguments[+node.data.slice(2)];
            if (value instanceof Node) {
              parent.insertBefore(value, node);
            } else if (typeof value !== "string" && value[Symbol.iterator]) {
              if (value instanceof NodeList || value instanceof HTMLCollection) {
                for (let i2 = value.length - 1, r2 = node; i2 >= 0; --i2) {
                  r2 = parent.insertBefore(value[i2], r2);
                }
              } else {
                for (const subvalue of value) {
                  if (subvalue == null)
                    continue;
                  parent.insertBefore(subvalue instanceof Node ? subvalue : document.createTextNode(subvalue), node);
                }
              }
            } else {
              parent.insertBefore(document.createTextNode(value), node);
            }
            removeNodes.push(node);
          }
          break;
        }
      }
    }
    for (const node of removeNodes) {
      node.parentNode.removeChild(node);
    }
    return postprocess(root);
  };
}
function entity(character) {
  return `&#${character.charCodeAt(0).toString()};`;
}
function isAsciiAlphaCode(code) {
  return CODE_UPPER_A <= code && code <= CODE_UPPER_Z || CODE_LOWER_A <= code && code <= CODE_LOWER_Z;
}
function isSpaceCode(code) {
  return code === CODE_TAB || code === CODE_LF || code === CODE_FF || code === CODE_SPACE || code === CODE_CR;
}
function isObjectLiteral(value) {
  return value && value.toString === Object.prototype.toString;
}
function isRawText(tagName) {
  return tagName === "script" || tagName === "style" || isEscapableRawText(tagName);
}
function isEscapableRawText(tagName) {
  return tagName === "textarea" || tagName === "title";
}
function lower(input2, start, end) {
  return input2.slice(start, end).toLowerCase();
}
function setAttribute(node, name, value) {
  if (node.namespaceURI === NS_SVG) {
    name = name.toLowerCase();
    name = svgAdjustAttributes.get(name) || name;
    if (svgForeignAttributes.has(name)) {
      node.setAttributeNS(svgForeignAttributes.get(name), name, value);
      return;
    }
  }
  node.setAttribute(name, value);
}
function removeAttribute(node, name) {
  if (node.namespaceURI === NS_SVG) {
    name = name.toLowerCase();
    name = svgAdjustAttributes.get(name) || name;
    if (svgForeignAttributes.has(name)) {
      node.removeAttributeNS(svgForeignAttributes.get(name), name);
      return;
    }
  }
  node.removeAttribute(name);
}
function setStyles(style2, values) {
  for (const name in values) {
    const value = values[name];
    if (name.startsWith("--"))
      style2.setProperty(name, value);
    else
      style2[name] = value;
  }
}

// deno-cache:https://cdn.skypack.dev/-/@observablehq/inputs@v0.10.4-Z9MLFWujLvXiK5t3eCH2/dist=es2019,mode=imports/optimized/@observablehq/inputs.js
function length(x2) {
  return x2 == null ? null : typeof x2 === "number" ? `${x2}px` : `${x2}`;
}
function maybeWidth(width2) {
  return { "--input-width": length(width2) };
}
var bubbles = { bubbles: true };
function preventDefault(event) {
  event.preventDefault();
}
function dispatchInput({ currentTarget }) {
  (currentTarget.form || currentTarget).dispatchEvent(new Event("input", bubbles));
}
function identity2(x2) {
  return x2;
}
var nextId = 0;
function newId() {
  return `__ns__-${++nextId}`;
}
function maybeLabel(label, input2) {
  if (!label)
    return;
  label = html2`<label>${label}`;
  if (input2 !== void 0)
    label.htmlFor = input2.id = newId();
  return label;
}
function button(content = "\u2261", {
  label = "",
  value,
  reduce,
  disabled,
  required = false,
  width: width2
} = {}) {
  const solitary = typeof content === "string" || content instanceof Node;
  if (solitary) {
    if (!required && value === void 0)
      value = 0;
    if (reduce === void 0)
      reduce = (value2 = 0) => value2 + 1;
    disabled = new Set(disabled ? [content] : []);
    content = [[content, reduce]];
  } else {
    if (!required && value === void 0)
      value = null;
    disabled = new Set(disabled === true ? Array.from(content, ([content2]) => content2) : disabled || void 0);
  }
  const form2 = html2`<form class=__ns__ onsubmit=${preventDefault}>`;
  const style2 = { width: length(width2) };
  const buttons = Array.from(content, ([content2, reduce2 = identity2]) => {
    if (typeof reduce2 !== "function")
      throw new TypeError("reduce is not a function");
    return html2`<button disabled=${disabled.has(content2)} style=${style2} onclick=${(event) => {
      form2.value = reduce2(form2.value);
      dispatchInput(event);
    }}>${content2}`;
  });
  if (label = maybeLabel(label, solitary ? buttons[0] : void 0))
    form2.append(label);
  form2.append(...buttons);
  form2.value = value;
  return form2;
}
function arrayify(array) {
  return Array.isArray(array) ? array : Array.from(array);
}
function stringify(x2) {
  return x2 == null ? "" : `${x2}`;
}
var formatLocaleAuto = localize((locale) => {
  const formatNumber2 = formatLocaleNumber(locale);
  return (value) => value == null ? "" : typeof value === "number" ? formatNumber2(value) : value instanceof Date ? formatDate3(value) : `${value}`;
});
var formatLocaleNumber = localize((locale) => {
  return (value) => value === 0 ? "0" : value.toLocaleString(locale);
});
var formatAuto = formatLocaleAuto();
var formatNumber = formatLocaleNumber();
function formatDate3(date2) {
  return format(date2, "Invalid Date");
}
function localize(f2) {
  let key = localize, value;
  return (locale = "en") => locale === key ? value : value = f2(key = locale);
}
function ascending(a2, b2) {
  return defined(b2) - defined(a2) || (a2 < b2 ? -1 : a2 > b2 ? 1 : a2 >= b2 ? 0 : NaN);
}
function descending(b2, a2) {
  return defined(a2) - defined(b2) || (a2 < b2 ? -1 : a2 > b2 ? 1 : a2 >= b2 ? 0 : NaN);
}
function defined(d2) {
  return d2 != null && !Number.isNaN(d2);
}
var first = ([x2]) => x2;
var second = ([, x2]) => x2;
function createChooser({ multiple: fixedMultiple, render, selectedIndexes, select: select22 }) {
  return function chooser(data2, {
    locale,
    keyof = data2 instanceof Map ? first : identity2,
    valueof: valueof3 = data2 instanceof Map ? second : identity2,
    format: format2 = data2 instanceof Map ? first : formatLocaleAuto(locale),
    multiple,
    key,
    value,
    disabled = false,
    sort,
    unique,
    ...options
  } = {}) {
    if (typeof keyof !== "function")
      throw new TypeError("keyof is not a function");
    if (typeof valueof3 !== "function")
      throw new TypeError("valueof is not a function");
    if (typeof format2 !== "function")
      throw new TypeError("format is not a function");
    if (fixedMultiple !== void 0)
      multiple = fixedMultiple;
    sort = maybeSort(sort);
    let size = +multiple;
    if (value === void 0)
      value = key !== void 0 && data2 instanceof Map ? size > 0 ? Array.from(key, (k2) => data2.get(k2)) : data2.get(key) : void 0;
    unique = !!unique;
    data2 = arrayify(data2);
    let keys = data2.map((d2, i2) => [keyof(d2, i2, data2), i2]);
    if (sort !== void 0)
      keys.sort(([a2], [b2]) => sort(a2, b2));
    if (unique)
      keys = [...new Map(keys.map((o2) => [intern(o2[0]), o2])).values()];
    const index = keys.map(second);
    if (multiple === true)
      size = Math.max(1, Math.min(10, index.length));
    else if (size > 0)
      multiple = true;
    else
      multiple = false, size = void 0;
    const [form2, input2] = render(data2, index, maybeSelection(data2, index, value, multiple, valueof3), maybeDisabled(data2, index, disabled, valueof3), {
      ...options,
      format: format2,
      multiple,
      size
    });
    form2.onchange = dispatchInput;
    form2.oninput = oninput;
    form2.onsubmit = preventDefault;
    function oninput(event) {
      if (event && event.isTrusted)
        form2.onchange = null;
      if (multiple) {
        value = selectedIndexes(input2).map((i2) => valueof3(data2[i2], i2, data2));
      } else {
        const i2 = selectedIndex(input2);
        value = i2 < 0 ? null : valueof3(data2[i2], i2, data2);
      }
    }
    oninput();
    return Object.defineProperty(form2, "value", {
      get() {
        return value;
      },
      set(v2) {
        if (multiple) {
          const selection = new Set(v2);
          for (const e2 of input2) {
            const i2 = +e2.value;
            select22(e2, selection.has(valueof3(data2[i2], i2, data2)));
          }
        } else {
          input2.value = index.find((i2) => v2 === valueof3(data2[i2], i2, data2));
        }
        oninput();
      }
    });
  };
}
function maybeSelection(data2, index, value, multiple, valueof3) {
  const values = new Set(value === void 0 ? [] : multiple ? arrayify(value) : [value]);
  if (!values.size)
    return () => false;
  const selection = new Set();
  for (const i2 of index) {
    if (values.has(valueof3(data2[i2], i2, data2))) {
      selection.add(i2);
    }
  }
  return (i2) => selection.has(i2);
}
function maybeDisabled(data2, index, value, valueof3) {
  if (typeof value === "boolean")
    return value;
  const values = new Set(arrayify(value));
  const disabled = new Set();
  for (const i2 of index) {
    if (values.has(valueof3(data2[i2], i2, data2))) {
      disabled.add(i2);
    }
  }
  return (i2) => disabled.has(i2);
}
function maybeSort(sort) {
  if (sort === void 0 || sort === false)
    return;
  if (sort === true || sort === "ascending")
    return ascending;
  if (sort === "descending")
    return descending;
  if (typeof sort === "function")
    return sort;
  throw new TypeError("sort is not a function");
}
function selectedIndex(input2) {
  return input2.value ? +input2.value : -1;
}
function intern(value) {
  return value !== null && typeof value === "object" ? value.valueOf() : value;
}
function createCheckbox(multiple, type2) {
  return createChooser({
    multiple,
    render(data2, index, selected, disabled, { format: format2, label }) {
      const form2 = html2`<form class="__ns__ __ns__-checkbox">
      ${maybeLabel(label)}<div>
        ${index.map((i2) => html2`<label><input type=${type2} disabled=${typeof disabled === "function" ? disabled(i2) : disabled} name=input value=${i2} checked=${selected(i2)}>${format2(data2[i2], i2, data2)}`)}
      </div>
    </form>`;
      return [form2, inputof(form2.elements.input, multiple)];
    },
    selectedIndexes(input2) {
      return Array.from(input2).filter((i2) => i2.checked).map((i2) => +i2.value);
    },
    select(input2, selected) {
      input2.checked = selected;
    }
  });
}
var radio = createCheckbox(false, "radio");
var checkbox = createCheckbox(true, "checkbox");
function inputof(input2, multiple) {
  return input2 === void 0 ? new OptionZero(multiple ? [] : null) : typeof input2.length === "undefined" ? new (multiple ? MultipleOptionOne : OptionOne)(input2) : input2;
}
var OptionZero = class {
  constructor(value) {
    this._value = value;
  }
  get value() {
    return this._value;
  }
  set value(v2) {
  }
  *[Symbol.iterator]() {
  }
};
var OptionOne = class {
  constructor(input2) {
    this._input = input2;
  }
  get value() {
    const { _input } = this;
    return _input.checked ? _input.value : "";
  }
  set value(v2) {
    const { _input } = this;
    if (_input.checked)
      return;
    _input.checked = stringify(v2) === _input.value;
  }
  *[Symbol.iterator]() {
    yield this._input;
  }
};
var MultipleOptionOne = class {
  constructor(input2) {
    this._input = input2;
    this._value = input2.checked ? [input2.value] : [];
  }
  get value() {
    return this._value;
  }
  set value(v2) {
    const { _input } = this;
    if (_input.checked)
      return;
    _input.checked = stringify(v2) === _input.value;
    this._value = _input.checked ? [_input.value] : [];
  }
  *[Symbol.iterator]() {
    yield this._input;
  }
};
var formatResults = localize((locale) => {
  const formatNumber2 = formatLocaleNumber(locale);
  return (length2) => `${formatNumber2(length2)} result${length2 === 1 ? "" : "s"}`;
});
var select2 = createChooser({
  render(data2, index, selected, disabled, { format: format2, multiple, size, label, width: width2 }) {
    const select22 = html2`<select class=__ns__-input disabled=${disabled === true} multiple=${multiple} size=${size} name=input>
      ${index.map((i2) => html2`<option value=${i2} disabled=${typeof disabled === "function" ? disabled(i2) : false} selected=${selected(i2)}>${stringify(format2(data2[i2], i2, data2))}`)}
    </select>`;
    const form2 = html2`<form class=__ns__ style=${maybeWidth(width2)}>${maybeLabel(label, select22)}${select22}`;
    return [form2, select22];
  },
  selectedIndexes(input2) {
    return Array.from(input2.selectedOptions, (i2) => +i2.value);
  },
  select(input2, selected) {
    input2.selected = selected;
  }
});

// ../src/resources/formats/html/ojs/quarto-inspector.js
var QuartoInspector = class extends Inspector {
  constructor(node, cellAst) {
    super(node);
    this._cellAst = cellAst;
  }
  rejected(error) {
    return super.rejected(error);
  }
};

// ../src/resources/formats/html/ojs/quarto-observable-shiny.js
var shinyInputVars = new Set();
var shinyInitialValue = {};
function extendObservableStdlib(lib) {
  class NamedVariableOutputBinding extends Shiny.OutputBinding {
    constructor(name, change) {
      super();
      this._name = name;
      this._change = change;
    }
    find(scope) {
      return $(scope).find("#" + this._name);
    }
    getId(el) {
      return el.id;
    }
    renderValue(_el, data2) {
      this._change(data2);
    }
    onValueError(el, err) {
      const group = `Shiny error in ${el.id}`;
      console.groupCollapsed(`%c${group}`, "color:red");
      console.log(`${err.message}`);
      console.log(`call: ${err.call}`);
      console.groupEnd(group);
    }
  }
  $(document).on("shiny:connected", function(_event) {
    Object.entries(shinyInitialValue).map(([k2, v2]) => {
      window.Shiny.setInputValue(k2, v2);
    });
    shinyInitialValue = {};
  });
  lib.shinyInput = function() {
    return (name) => {
      shinyInputVars.add(name);
      window._ojs.ojsConnector.mainModule.value(name).then((val) => {
        if (window.Shiny && window.Shiny.setInputValue) {
          window.Shiny.setInputValue(name, val);
        } else {
          shinyInitialValue[name] = val;
        }
      });
    };
  };
  lib.shinyOutput = function() {
    return function(name) {
      const dummySpan = document.createElement("div");
      dummySpan.id = name;
      dummySpan.classList.add("ojs-variable-writer");
      window._ojs.shinyElementRoot.appendChild(dummySpan);
      return lib.Generators.observe((change) => {
        Shiny.outputBindings.register(new NamedVariableOutputBinding(name, change));
      });
    };
  };
}
var ShinyInspector = class extends QuartoInspector {
  constructor(node) {
    super(node);
  }
  fulfilled(value, name) {
    if (shinyInputVars.has(name) && window.Shiny) {
      if (window.Shiny.setInputValue === void 0) {
        shinyInitialValue[name] = value;
      } else {
        window.Shiny.setInputValue(name, value);
      }
    }
    return super.fulfilled(value, name);
  }
};
var { Generators: Generators2 } = new Oe();
var OjsButtonInput = class {
  find(_scope) {
    return document.querySelectorAll(".ojs-inputs-button");
  }
  init(el, change) {
    const btn = button(el.textContent);
    el.innerHTML = "";
    el.appendChild(btn);
    const obs = Generators2.input(el.firstChild);
    (async function() {
      await obs.next().value;
      for (const x2 of obs) {
        change(await x2);
      }
    })();
    return {
      onSetValue: (_value) => {
      },
      dispose: () => {
        obs.return();
      }
    };
  }
};
function initOjsShinyRuntime() {
  const valueSym = Symbol("value");
  const callbackSym = Symbol("callback");
  const instanceSym = Symbol("instance");
  class BindingAdapter extends Shiny.InputBinding {
    constructor(x2) {
      super();
      this.x = x2;
    }
    find(scope) {
      const matches = this.x.find(scope);
      return $(matches);
    }
    getId(el) {
      if (this.x.getId) {
        return this.x.getId(el);
      } else {
        return super.getId(el);
      }
    }
    initialize(el) {
      const changeHandler = (value) => {
        el[valueSym] = value;
        el[callbackSym]();
      };
      const instance = this.x.init(el, changeHandler);
      el[instanceSym] = instance;
    }
    getValue(el) {
      return el[valueSym];
    }
    setValue(el, value) {
      el[valueSym] = value;
      el[instanceSym].onSetValue(value);
    }
    subscribe(el, callback) {
      el[callbackSym] = callback;
    }
    unsubscribe(el) {
      el[instanceSym].dispose();
    }
  }
  class InspectorOutputBinding extends Shiny.OutputBinding {
    find(scope) {
      return $(scope).find(".observablehq-inspector");
    }
    getId(el) {
      return el.id;
    }
    renderValue(el, data2) {
      new Inspector(el).fulfilled(data2);
    }
  }
  if (window.Shiny === void 0) {
    console.warn("Shiny runtime not found; Shiny features won't work.");
    return false;
  }
  Shiny.inputBindings.register(new BindingAdapter(new OjsButtonInput()));
  Shiny.outputBindings.register(new InspectorOutputBinding());
  Shiny.addCustomMessageHandler("ojs-export", ({ name }) => {
    window._ojs.ojsConnector.mainModule.redefine(name, window._ojs.ojsConnector.library.shinyOutput()(name));
    Shiny.bindAll(document.body);
  });
  return true;
}

// deno-cache:https://cdn.skypack.dev/-/acorn@v7.4.1-aIeX4aKa0RO2JeS9dtPa/dist=es2019,mode=imports/optimized/acorn.js
var reservedWords = {
  3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
  5: "class enum extends super const export import",
  6: "enum",
  strict: "implements interface let package private protected public static yield",
  strictBind: "eval arguments"
};
var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";
var keywords = {
  5: ecma5AndLessKeywords,
  "5module": ecma5AndLessKeywords + " export import",
  6: ecma5AndLessKeywords + " const class extends export import super"
};
var keywordRelationalOperator = /^in(stanceof)?$/;
var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08C7\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7BF\uA7C2-\uA7CA\uA7F5-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
var nonASCIIidentifierChars = "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECD\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF\u1AC0\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F";
var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 349, 41, 7, 1, 79, 28, 11, 0, 9, 21, 107, 20, 28, 22, 13, 52, 76, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 85, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 230, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 35, 56, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 190, 0, 80, 921, 103, 110, 18, 195, 2749, 1070, 4050, 582, 8634, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 689, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 43, 8, 8952, 286, 50, 2, 18, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 2357, 44, 11, 6, 17, 0, 370, 43, 1301, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42717, 35, 4148, 12, 221, 3, 5761, 15, 7472, 3104, 541, 1507, 4938];
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 370, 1, 154, 10, 176, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 161, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 19306, 9, 135, 4, 60, 6, 26, 9, 1014, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 262, 6, 10, 9, 419, 13, 1495, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];
function isInAstralSet(code, set) {
  var pos = 65536;
  for (var i2 = 0; i2 < set.length; i2 += 2) {
    pos += set[i2];
    if (pos > code) {
      return false;
    }
    pos += set[i2 + 1];
    if (pos >= code) {
      return true;
    }
  }
}
function isIdentifierStart(code, astral) {
  if (code < 65) {
    return code === 36;
  }
  if (code < 91) {
    return true;
  }
  if (code < 97) {
    return code === 95;
  }
  if (code < 123) {
    return true;
  }
  if (code <= 65535) {
    return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
  }
  if (astral === false) {
    return false;
  }
  return isInAstralSet(code, astralIdentifierStartCodes);
}
function isIdentifierChar(code, astral) {
  if (code < 48) {
    return code === 36;
  }
  if (code < 58) {
    return true;
  }
  if (code < 65) {
    return false;
  }
  if (code < 91) {
    return true;
  }
  if (code < 97) {
    return code === 95;
  }
  if (code < 123) {
    return true;
  }
  if (code <= 65535) {
    return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
  }
  if (astral === false) {
    return false;
  }
  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
}
var TokenType = function TokenType2(label, conf) {
  if (conf === void 0)
    conf = {};
  this.label = label;
  this.keyword = conf.keyword;
  this.beforeExpr = !!conf.beforeExpr;
  this.startsExpr = !!conf.startsExpr;
  this.isLoop = !!conf.isLoop;
  this.isAssign = !!conf.isAssign;
  this.prefix = !!conf.prefix;
  this.postfix = !!conf.postfix;
  this.binop = conf.binop || null;
  this.updateContext = null;
};
function binop(name, prec) {
  return new TokenType(name, { beforeExpr: true, binop: prec });
}
var beforeExpr = { beforeExpr: true };
var startsExpr = { startsExpr: true };
var keywords$1 = {};
function kw(name, options) {
  if (options === void 0)
    options = {};
  options.keyword = name;
  return keywords$1[name] = new TokenType(name, options);
}
var types = {
  num: new TokenType("num", startsExpr),
  regexp: new TokenType("regexp", startsExpr),
  string: new TokenType("string", startsExpr),
  name: new TokenType("name", startsExpr),
  eof: new TokenType("eof"),
  bracketL: new TokenType("[", { beforeExpr: true, startsExpr: true }),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{", { beforeExpr: true, startsExpr: true }),
  braceR: new TokenType("}"),
  parenL: new TokenType("(", { beforeExpr: true, startsExpr: true }),
  parenR: new TokenType(")"),
  comma: new TokenType(",", beforeExpr),
  semi: new TokenType(";", beforeExpr),
  colon: new TokenType(":", beforeExpr),
  dot: new TokenType("."),
  question: new TokenType("?", beforeExpr),
  questionDot: new TokenType("?."),
  arrow: new TokenType("=>", beforeExpr),
  template: new TokenType("template"),
  invalidTemplate: new TokenType("invalidTemplate"),
  ellipsis: new TokenType("...", beforeExpr),
  backQuote: new TokenType("`", startsExpr),
  dollarBraceL: new TokenType("${", { beforeExpr: true, startsExpr: true }),
  eq: new TokenType("=", { beforeExpr: true, isAssign: true }),
  assign: new TokenType("_=", { beforeExpr: true, isAssign: true }),
  incDec: new TokenType("++/--", { prefix: true, postfix: true, startsExpr: true }),
  prefix: new TokenType("!/~", { beforeExpr: true, prefix: true, startsExpr: true }),
  logicalOR: binop("||", 1),
  logicalAND: binop("&&", 2),
  bitwiseOR: binop("|", 3),
  bitwiseXOR: binop("^", 4),
  bitwiseAND: binop("&", 5),
  equality: binop("==/!=/===/!==", 6),
  relational: binop("</>/<=/>=", 7),
  bitShift: binop("<</>>/>>>", 8),
  plusMin: new TokenType("+/-", { beforeExpr: true, binop: 9, prefix: true, startsExpr: true }),
  modulo: binop("%", 10),
  star: binop("*", 10),
  slash: binop("/", 10),
  starstar: new TokenType("**", { beforeExpr: true }),
  coalesce: binop("??", 1),
  _break: kw("break"),
  _case: kw("case", beforeExpr),
  _catch: kw("catch"),
  _continue: kw("continue"),
  _debugger: kw("debugger"),
  _default: kw("default", beforeExpr),
  _do: kw("do", { isLoop: true, beforeExpr: true }),
  _else: kw("else", beforeExpr),
  _finally: kw("finally"),
  _for: kw("for", { isLoop: true }),
  _function: kw("function", startsExpr),
  _if: kw("if"),
  _return: kw("return", beforeExpr),
  _switch: kw("switch"),
  _throw: kw("throw", beforeExpr),
  _try: kw("try"),
  _var: kw("var"),
  _const: kw("const"),
  _while: kw("while", { isLoop: true }),
  _with: kw("with"),
  _new: kw("new", { beforeExpr: true, startsExpr: true }),
  _this: kw("this", startsExpr),
  _super: kw("super", startsExpr),
  _class: kw("class", startsExpr),
  _extends: kw("extends", beforeExpr),
  _export: kw("export"),
  _import: kw("import", startsExpr),
  _null: kw("null", startsExpr),
  _true: kw("true", startsExpr),
  _false: kw("false", startsExpr),
  _in: kw("in", { beforeExpr: true, binop: 7 }),
  _instanceof: kw("instanceof", { beforeExpr: true, binop: 7 }),
  _typeof: kw("typeof", { beforeExpr: true, prefix: true, startsExpr: true }),
  _void: kw("void", { beforeExpr: true, prefix: true, startsExpr: true }),
  _delete: kw("delete", { beforeExpr: true, prefix: true, startsExpr: true })
};
var lineBreak = /\r\n?|\n|\u2028|\u2029/;
var lineBreakG = new RegExp(lineBreak.source, "g");
function isNewLine(code, ecma2019String) {
  return code === 10 || code === 13 || !ecma2019String && (code === 8232 || code === 8233);
}
var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
var ref = Object.prototype;
var hasOwnProperty3 = ref.hasOwnProperty;
var toString2 = ref.toString;
function has(obj, propName) {
  return hasOwnProperty3.call(obj, propName);
}
var isArray = Array.isArray || function(obj) {
  return toString2.call(obj) === "[object Array]";
};
function wordsRegexp(words) {
  return new RegExp("^(?:" + words.replace(/ /g, "|") + ")$");
}
var Position = function Position2(line, col) {
  this.line = line;
  this.column = col;
};
Position.prototype.offset = function offset(n2) {
  return new Position(this.line, this.column + n2);
};
var SourceLocation = function SourceLocation2(p2, start, end) {
  this.start = start;
  this.end = end;
  if (p2.sourceFile !== null) {
    this.source = p2.sourceFile;
  }
};
function getLineInfo(input2, offset2) {
  for (var line = 1, cur = 0; ; ) {
    lineBreakG.lastIndex = cur;
    var match = lineBreakG.exec(input2);
    if (match && match.index < offset2) {
      ++line;
      cur = match.index + match[0].length;
    } else {
      return new Position(line, offset2 - cur);
    }
  }
}
var defaultOptions = {
  ecmaVersion: 10,
  sourceType: "script",
  onInsertedSemicolon: null,
  onTrailingComma: null,
  allowReserved: null,
  allowReturnOutsideFunction: false,
  allowImportExportEverywhere: false,
  allowAwaitOutsideFunction: false,
  allowHashBang: false,
  locations: false,
  onToken: null,
  onComment: null,
  ranges: false,
  program: null,
  sourceFile: null,
  directSourceFile: null,
  preserveParens: false
};
function getOptions(opts) {
  var options = {};
  for (var opt in defaultOptions) {
    options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt];
  }
  if (options.ecmaVersion >= 2015) {
    options.ecmaVersion -= 2009;
  }
  if (options.allowReserved == null) {
    options.allowReserved = options.ecmaVersion < 5;
  }
  if (isArray(options.onToken)) {
    var tokens = options.onToken;
    options.onToken = function(token) {
      return tokens.push(token);
    };
  }
  if (isArray(options.onComment)) {
    options.onComment = pushComment(options, options.onComment);
  }
  return options;
}
function pushComment(options, array) {
  return function(block, text2, start, end, startLoc, endLoc) {
    var comment = {
      type: block ? "Block" : "Line",
      value: text2,
      start,
      end
    };
    if (options.locations) {
      comment.loc = new SourceLocation(this, startLoc, endLoc);
    }
    if (options.ranges) {
      comment.range = [start, end];
    }
    array.push(comment);
  };
}
var SCOPE_TOP = 1;
var SCOPE_FUNCTION = 2;
var SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION;
var SCOPE_ASYNC = 4;
var SCOPE_GENERATOR = 8;
var SCOPE_ARROW = 16;
var SCOPE_SIMPLE_CATCH = 32;
var SCOPE_SUPER = 64;
var SCOPE_DIRECT_SUPER = 128;
function functionFlags(async, generator) {
  return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0);
}
var BIND_NONE = 0;
var BIND_VAR = 1;
var BIND_LEXICAL = 2;
var BIND_FUNCTION = 3;
var BIND_SIMPLE_CATCH = 4;
var BIND_OUTSIDE = 5;
var Parser = function Parser2(options, input2, startPos) {
  this.options = options = getOptions(options);
  this.sourceFile = options.sourceFile;
  this.keywords = wordsRegexp(keywords[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
  var reserved = "";
  if (options.allowReserved !== true) {
    for (var v2 = options.ecmaVersion; ; v2--) {
      if (reserved = reservedWords[v2]) {
        break;
      }
    }
    if (options.sourceType === "module") {
      reserved += " await";
    }
  }
  this.reservedWords = wordsRegexp(reserved);
  var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
  this.reservedWordsStrict = wordsRegexp(reservedStrict);
  this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
  this.input = String(input2);
  this.containsEsc = false;
  if (startPos) {
    this.pos = startPos;
    this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
  } else {
    this.pos = this.lineStart = 0;
    this.curLine = 1;
  }
  this.type = types.eof;
  this.value = null;
  this.start = this.end = this.pos;
  this.startLoc = this.endLoc = this.curPosition();
  this.lastTokEndLoc = this.lastTokStartLoc = null;
  this.lastTokStart = this.lastTokEnd = this.pos;
  this.context = this.initialContext();
  this.exprAllowed = true;
  this.inModule = options.sourceType === "module";
  this.strict = this.inModule || this.strictDirective(this.pos);
  this.potentialArrowAt = -1;
  this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
  this.labels = [];
  this.undefinedExports = {};
  if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!") {
    this.skipLineComment(2);
  }
  this.scopeStack = [];
  this.enterScope(SCOPE_TOP);
  this.regexpState = null;
};
var prototypeAccessors = { inFunction: { configurable: true }, inGenerator: { configurable: true }, inAsync: { configurable: true }, allowSuper: { configurable: true }, allowDirectSuper: { configurable: true }, treatFunctionsAsVar: { configurable: true } };
Parser.prototype.parse = function parse2() {
  var node = this.options.program || this.startNode();
  this.nextToken();
  return this.parseTopLevel(node);
};
prototypeAccessors.inFunction.get = function() {
  return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0;
};
prototypeAccessors.inGenerator.get = function() {
  return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0;
};
prototypeAccessors.inAsync.get = function() {
  return (this.currentVarScope().flags & SCOPE_ASYNC) > 0;
};
prototypeAccessors.allowSuper.get = function() {
  return (this.currentThisScope().flags & SCOPE_SUPER) > 0;
};
prototypeAccessors.allowDirectSuper.get = function() {
  return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0;
};
prototypeAccessors.treatFunctionsAsVar.get = function() {
  return this.treatFunctionsAsVarInScope(this.currentScope());
};
Parser.prototype.inNonArrowFunction = function inNonArrowFunction() {
  return (this.currentThisScope().flags & SCOPE_FUNCTION) > 0;
};
Parser.extend = function extend() {
  var plugins = [], len = arguments.length;
  while (len--)
    plugins[len] = arguments[len];
  var cls = this;
  for (var i2 = 0; i2 < plugins.length; i2++) {
    cls = plugins[i2](cls);
  }
  return cls;
};
Parser.parse = function parse22(input2, options) {
  return new this(options, input2).parse();
};
Parser.parseExpressionAt = function parseExpressionAt(input2, pos, options) {
  var parser2 = new this(options, input2, pos);
  parser2.nextToken();
  return parser2.parseExpression();
};
Parser.tokenizer = function tokenizer(input2, options) {
  return new this(options, input2);
};
Object.defineProperties(Parser.prototype, prototypeAccessors);
var pp = Parser.prototype;
var literal = /^(?:'((?:\\.|[^'\\])*?)'|"((?:\\.|[^"\\])*?)")/;
pp.strictDirective = function(start) {
  for (; ; ) {
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    var match = literal.exec(this.input.slice(start));
    if (!match) {
      return false;
    }
    if ((match[1] || match[2]) === "use strict") {
      skipWhiteSpace.lastIndex = start + match[0].length;
      var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
      var next = this.input.charAt(end);
      return next === ";" || next === "}" || lineBreak.test(spaceAfter[0]) && !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "=");
    }
    start += match[0].length;
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    if (this.input[start] === ";") {
      start++;
    }
  }
};
pp.eat = function(type) {
  if (this.type === type) {
    this.next();
    return true;
  } else {
    return false;
  }
};
pp.isContextual = function(name) {
  return this.type === types.name && this.value === name && !this.containsEsc;
};
pp.eatContextual = function(name) {
  if (!this.isContextual(name)) {
    return false;
  }
  this.next();
  return true;
};
pp.expectContextual = function(name) {
  if (!this.eatContextual(name)) {
    this.unexpected();
  }
};
pp.canInsertSemicolon = function() {
  return this.type === types.eof || this.type === types.braceR || lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
};
pp.insertSemicolon = function() {
  if (this.canInsertSemicolon()) {
    if (this.options.onInsertedSemicolon) {
      this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
    }
    return true;
  }
};
pp.semicolon = function() {
  if (!this.eat(types.semi) && !this.insertSemicolon()) {
    this.unexpected();
  }
};
pp.afterTrailingComma = function(tokType, notNext) {
  if (this.type === tokType) {
    if (this.options.onTrailingComma) {
      this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
    }
    if (!notNext) {
      this.next();
    }
    return true;
  }
};
pp.expect = function(type) {
  this.eat(type) || this.unexpected();
};
pp.unexpected = function(pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token");
};
function DestructuringErrors() {
  this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
}
pp.checkPatternErrors = function(refDestructuringErrors, isAssign) {
  if (!refDestructuringErrors) {
    return;
  }
  if (refDestructuringErrors.trailingComma > -1) {
    this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element");
  }
  var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
  if (parens > -1) {
    this.raiseRecoverable(parens, "Parenthesized pattern");
  }
};
pp.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
  if (!refDestructuringErrors) {
    return false;
  }
  var shorthandAssign = refDestructuringErrors.shorthandAssign;
  var doubleProto = refDestructuringErrors.doubleProto;
  if (!andThrow) {
    return shorthandAssign >= 0 || doubleProto >= 0;
  }
  if (shorthandAssign >= 0) {
    this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns");
  }
  if (doubleProto >= 0) {
    this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property");
  }
};
pp.checkYieldAwaitInDefaultParams = function() {
  if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos)) {
    this.raise(this.yieldPos, "Yield expression cannot be a default value");
  }
  if (this.awaitPos) {
    this.raise(this.awaitPos, "Await expression cannot be a default value");
  }
};
pp.isSimpleAssignTarget = function(expr) {
  if (expr.type === "ParenthesizedExpression") {
    return this.isSimpleAssignTarget(expr.expression);
  }
  return expr.type === "Identifier" || expr.type === "MemberExpression";
};
var pp$1 = Parser.prototype;
pp$1.parseTopLevel = function(node) {
  var exports = {};
  if (!node.body) {
    node.body = [];
  }
  while (this.type !== types.eof) {
    var stmt = this.parseStatement(null, true, exports);
    node.body.push(stmt);
  }
  if (this.inModule) {
    for (var i2 = 0, list = Object.keys(this.undefinedExports); i2 < list.length; i2 += 1) {
      var name = list[i2];
      this.raiseRecoverable(this.undefinedExports[name].start, "Export '" + name + "' is not defined");
    }
  }
  this.adaptDirectivePrologue(node.body);
  this.next();
  node.sourceType = this.options.sourceType;
  return this.finishNode(node, "Program");
};
var loopLabel = { kind: "loop" };
var switchLabel = { kind: "switch" };
pp$1.isLet = function(context) {
  if (this.options.ecmaVersion < 6 || !this.isContextual("let")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
  if (nextCh === 91) {
    return true;
  }
  if (context) {
    return false;
  }
  if (nextCh === 123) {
    return true;
  }
  if (isIdentifierStart(nextCh, true)) {
    var pos = next + 1;
    while (isIdentifierChar(this.input.charCodeAt(pos), true)) {
      ++pos;
    }
    var ident = this.input.slice(next, pos);
    if (!keywordRelationalOperator.test(ident)) {
      return true;
    }
  }
  return false;
};
pp$1.isAsyncFunction = function() {
  if (this.options.ecmaVersion < 8 || !this.isContextual("async")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length;
  return !lineBreak.test(this.input.slice(this.pos, next)) && this.input.slice(next, next + 8) === "function" && (next + 8 === this.input.length || !isIdentifierChar(this.input.charAt(next + 8)));
};
pp$1.parseStatement = function(context, topLevel, exports) {
  var starttype = this.type, node = this.startNode(), kind;
  if (this.isLet(context)) {
    starttype = types._var;
    kind = "let";
  }
  switch (starttype) {
    case types._break:
    case types._continue:
      return this.parseBreakContinueStatement(node, starttype.keyword);
    case types._debugger:
      return this.parseDebuggerStatement(node);
    case types._do:
      return this.parseDoStatement(node);
    case types._for:
      return this.parseForStatement(node);
    case types._function:
      if (context && (this.strict || context !== "if" && context !== "label") && this.options.ecmaVersion >= 6) {
        this.unexpected();
      }
      return this.parseFunctionStatement(node, false, !context);
    case types._class:
      if (context) {
        this.unexpected();
      }
      return this.parseClass(node, true);
    case types._if:
      return this.parseIfStatement(node);
    case types._return:
      return this.parseReturnStatement(node);
    case types._switch:
      return this.parseSwitchStatement(node);
    case types._throw:
      return this.parseThrowStatement(node);
    case types._try:
      return this.parseTryStatement(node);
    case types._const:
    case types._var:
      kind = kind || this.value;
      if (context && kind !== "var") {
        this.unexpected();
      }
      return this.parseVarStatement(node, kind);
    case types._while:
      return this.parseWhileStatement(node);
    case types._with:
      return this.parseWithStatement(node);
    case types.braceL:
      return this.parseBlock(true, node);
    case types.semi:
      return this.parseEmptyStatement(node);
    case types._export:
    case types._import:
      if (this.options.ecmaVersion > 10 && starttype === types._import) {
        skipWhiteSpace.lastIndex = this.pos;
        var skip = skipWhiteSpace.exec(this.input);
        var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
        if (nextCh === 40 || nextCh === 46) {
          return this.parseExpressionStatement(node, this.parseExpression());
        }
      }
      if (!this.options.allowImportExportEverywhere) {
        if (!topLevel) {
          this.raise(this.start, "'import' and 'export' may only appear at the top level");
        }
        if (!this.inModule) {
          this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
        }
      }
      return starttype === types._import ? this.parseImport(node) : this.parseExport(node, exports);
    default:
      if (this.isAsyncFunction()) {
        if (context) {
          this.unexpected();
        }
        this.next();
        return this.parseFunctionStatement(node, true, !context);
      }
      var maybeName = this.value, expr = this.parseExpression();
      if (starttype === types.name && expr.type === "Identifier" && this.eat(types.colon)) {
        return this.parseLabeledStatement(node, maybeName, expr, context);
      } else {
        return this.parseExpressionStatement(node, expr);
      }
  }
};
pp$1.parseBreakContinueStatement = function(node, keyword) {
  var isBreak = keyword === "break";
  this.next();
  if (this.eat(types.semi) || this.insertSemicolon()) {
    node.label = null;
  } else if (this.type !== types.name) {
    this.unexpected();
  } else {
    node.label = this.parseIdent();
    this.semicolon();
  }
  var i2 = 0;
  for (; i2 < this.labels.length; ++i2) {
    var lab = this.labels[i2];
    if (node.label == null || lab.name === node.label.name) {
      if (lab.kind != null && (isBreak || lab.kind === "loop")) {
        break;
      }
      if (node.label && isBreak) {
        break;
      }
    }
  }
  if (i2 === this.labels.length) {
    this.raise(node.start, "Unsyntactic " + keyword);
  }
  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
};
pp$1.parseDebuggerStatement = function(node) {
  this.next();
  this.semicolon();
  return this.finishNode(node, "DebuggerStatement");
};
pp$1.parseDoStatement = function(node) {
  this.next();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("do");
  this.labels.pop();
  this.expect(types._while);
  node.test = this.parseParenExpression();
  if (this.options.ecmaVersion >= 6) {
    this.eat(types.semi);
  } else {
    this.semicolon();
  }
  return this.finishNode(node, "DoWhileStatement");
};
pp$1.parseForStatement = function(node) {
  this.next();
  var awaitAt = this.options.ecmaVersion >= 9 && (this.inAsync || !this.inFunction && this.options.allowAwaitOutsideFunction) && this.eatContextual("await") ? this.lastTokStart : -1;
  this.labels.push(loopLabel);
  this.enterScope(0);
  this.expect(types.parenL);
  if (this.type === types.semi) {
    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }
    return this.parseFor(node, null);
  }
  var isLet = this.isLet();
  if (this.type === types._var || this.type === types._const || isLet) {
    var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
    this.next();
    this.parseVar(init$1, true, kind);
    this.finishNode(init$1, "VariableDeclaration");
    if ((this.type === types._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && init$1.declarations.length === 1) {
      if (this.options.ecmaVersion >= 9) {
        if (this.type === types._in) {
          if (awaitAt > -1) {
            this.unexpected(awaitAt);
          }
        } else {
          node.await = awaitAt > -1;
        }
      }
      return this.parseForIn(node, init$1);
    }
    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }
    return this.parseFor(node, init$1);
  }
  var refDestructuringErrors = new DestructuringErrors();
  var init = this.parseExpression(true, refDestructuringErrors);
  if (this.type === types._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) {
    if (this.options.ecmaVersion >= 9) {
      if (this.type === types._in) {
        if (awaitAt > -1) {
          this.unexpected(awaitAt);
        }
      } else {
        node.await = awaitAt > -1;
      }
    }
    this.toAssignable(init, false, refDestructuringErrors);
    this.checkLVal(init);
    return this.parseForIn(node, init);
  } else {
    this.checkExpressionErrors(refDestructuringErrors, true);
  }
  if (awaitAt > -1) {
    this.unexpected(awaitAt);
  }
  return this.parseFor(node, init);
};
pp$1.parseFunctionStatement = function(node, isAsync, declarationPosition) {
  this.next();
  return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync);
};
pp$1.parseIfStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  node.consequent = this.parseStatement("if");
  node.alternate = this.eat(types._else) ? this.parseStatement("if") : null;
  return this.finishNode(node, "IfStatement");
};
pp$1.parseReturnStatement = function(node) {
  if (!this.inFunction && !this.options.allowReturnOutsideFunction) {
    this.raise(this.start, "'return' outside of function");
  }
  this.next();
  if (this.eat(types.semi) || this.insertSemicolon()) {
    node.argument = null;
  } else {
    node.argument = this.parseExpression();
    this.semicolon();
  }
  return this.finishNode(node, "ReturnStatement");
};
pp$1.parseSwitchStatement = function(node) {
  this.next();
  node.discriminant = this.parseParenExpression();
  node.cases = [];
  this.expect(types.braceL);
  this.labels.push(switchLabel);
  this.enterScope(0);
  var cur;
  for (var sawDefault = false; this.type !== types.braceR; ) {
    if (this.type === types._case || this.type === types._default) {
      var isCase = this.type === types._case;
      if (cur) {
        this.finishNode(cur, "SwitchCase");
      }
      node.cases.push(cur = this.startNode());
      cur.consequent = [];
      this.next();
      if (isCase) {
        cur.test = this.parseExpression();
      } else {
        if (sawDefault) {
          this.raiseRecoverable(this.lastTokStart, "Multiple default clauses");
        }
        sawDefault = true;
        cur.test = null;
      }
      this.expect(types.colon);
    } else {
      if (!cur) {
        this.unexpected();
      }
      cur.consequent.push(this.parseStatement(null));
    }
  }
  this.exitScope();
  if (cur) {
    this.finishNode(cur, "SwitchCase");
  }
  this.next();
  this.labels.pop();
  return this.finishNode(node, "SwitchStatement");
};
pp$1.parseThrowStatement = function(node) {
  this.next();
  if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) {
    this.raise(this.lastTokEnd, "Illegal newline after throw");
  }
  node.argument = this.parseExpression();
  this.semicolon();
  return this.finishNode(node, "ThrowStatement");
};
var empty = [];
pp$1.parseTryStatement = function(node) {
  this.next();
  node.block = this.parseBlock();
  node.handler = null;
  if (this.type === types._catch) {
    var clause = this.startNode();
    this.next();
    if (this.eat(types.parenL)) {
      clause.param = this.parseBindingAtom();
      var simple2 = clause.param.type === "Identifier";
      this.enterScope(simple2 ? SCOPE_SIMPLE_CATCH : 0);
      this.checkLVal(clause.param, simple2 ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
      this.expect(types.parenR);
    } else {
      if (this.options.ecmaVersion < 10) {
        this.unexpected();
      }
      clause.param = null;
      this.enterScope(0);
    }
    clause.body = this.parseBlock(false);
    this.exitScope();
    node.handler = this.finishNode(clause, "CatchClause");
  }
  node.finalizer = this.eat(types._finally) ? this.parseBlock() : null;
  if (!node.handler && !node.finalizer) {
    this.raise(node.start, "Missing catch or finally clause");
  }
  return this.finishNode(node, "TryStatement");
};
pp$1.parseVarStatement = function(node, kind) {
  this.next();
  this.parseVar(node, false, kind);
  this.semicolon();
  return this.finishNode(node, "VariableDeclaration");
};
pp$1.parseWhileStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("while");
  this.labels.pop();
  return this.finishNode(node, "WhileStatement");
};
pp$1.parseWithStatement = function(node) {
  if (this.strict) {
    this.raise(this.start, "'with' in strict mode");
  }
  this.next();
  node.object = this.parseParenExpression();
  node.body = this.parseStatement("with");
  return this.finishNode(node, "WithStatement");
};
pp$1.parseEmptyStatement = function(node) {
  this.next();
  return this.finishNode(node, "EmptyStatement");
};
pp$1.parseLabeledStatement = function(node, maybeName, expr, context) {
  for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1) {
    var label = list[i$1];
    if (label.name === maybeName) {
      this.raise(expr.start, "Label '" + maybeName + "' is already declared");
    }
  }
  var kind = this.type.isLoop ? "loop" : this.type === types._switch ? "switch" : null;
  for (var i2 = this.labels.length - 1; i2 >= 0; i2--) {
    var label$1 = this.labels[i2];
    if (label$1.statementStart === node.start) {
      label$1.statementStart = this.start;
      label$1.kind = kind;
    } else {
      break;
    }
  }
  this.labels.push({ name: maybeName, kind, statementStart: this.start });
  node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
  this.labels.pop();
  node.label = expr;
  return this.finishNode(node, "LabeledStatement");
};
pp$1.parseExpressionStatement = function(node, expr) {
  node.expression = expr;
  this.semicolon();
  return this.finishNode(node, "ExpressionStatement");
};
pp$1.parseBlock = function(createNewLexicalScope, node, exitStrict) {
  if (createNewLexicalScope === void 0)
    createNewLexicalScope = true;
  if (node === void 0)
    node = this.startNode();
  node.body = [];
  this.expect(types.braceL);
  if (createNewLexicalScope) {
    this.enterScope(0);
  }
  while (this.type !== types.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  if (exitStrict) {
    this.strict = false;
  }
  this.next();
  if (createNewLexicalScope) {
    this.exitScope();
  }
  return this.finishNode(node, "BlockStatement");
};
pp$1.parseFor = function(node, init) {
  node.init = init;
  this.expect(types.semi);
  node.test = this.type === types.semi ? null : this.parseExpression();
  this.expect(types.semi);
  node.update = this.type === types.parenR ? null : this.parseExpression();
  this.expect(types.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, "ForStatement");
};
pp$1.parseForIn = function(node, init) {
  var isForIn = this.type === types._in;
  this.next();
  if (init.type === "VariableDeclaration" && init.declarations[0].init != null && (!isForIn || this.options.ecmaVersion < 8 || this.strict || init.kind !== "var" || init.declarations[0].id.type !== "Identifier")) {
    this.raise(init.start, (isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer");
  } else if (init.type === "AssignmentPattern") {
    this.raise(init.start, "Invalid left-hand side in for-loop");
  }
  node.left = init;
  node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
  this.expect(types.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement");
};
pp$1.parseVar = function(node, isFor, kind) {
  node.declarations = [];
  node.kind = kind;
  for (; ; ) {
    var decl = this.startNode();
    this.parseVarId(decl, kind);
    if (this.eat(types.eq)) {
      decl.init = this.parseMaybeAssign(isFor);
    } else if (kind === "const" && !(this.type === types._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
      this.unexpected();
    } else if (decl.id.type !== "Identifier" && !(isFor && (this.type === types._in || this.isContextual("of")))) {
      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
    } else {
      decl.init = null;
    }
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
    if (!this.eat(types.comma)) {
      break;
    }
  }
  return node;
};
pp$1.parseVarId = function(decl, kind) {
  decl.id = this.parseBindingAtom();
  this.checkLVal(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
};
var FUNC_STATEMENT = 1;
var FUNC_HANGING_STATEMENT = 2;
var FUNC_NULLABLE_ID = 4;
pp$1.parseFunction = function(node, statement, allowExpressionBody, isAsync) {
  this.initFunction(node);
  if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
    if (this.type === types.star && statement & FUNC_HANGING_STATEMENT) {
      this.unexpected();
    }
    node.generator = this.eat(types.star);
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  if (statement & FUNC_STATEMENT) {
    node.id = statement & FUNC_NULLABLE_ID && this.type !== types.name ? null : this.parseIdent();
    if (node.id && !(statement & FUNC_HANGING_STATEMENT)) {
      this.checkLVal(node.id, this.strict || node.generator || node.async ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION);
    }
  }
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(node.async, node.generator));
  if (!(statement & FUNC_STATEMENT)) {
    node.id = this.type === types.name ? this.parseIdent() : null;
  }
  this.parseFunctionParams(node);
  this.parseFunctionBody(node, allowExpressionBody, false);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, statement & FUNC_STATEMENT ? "FunctionDeclaration" : "FunctionExpression");
};
pp$1.parseFunctionParams = function(node) {
  this.expect(types.parenL);
  node.params = this.parseBindingList(types.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
};
pp$1.parseClass = function(node, isStatement) {
  this.next();
  var oldStrict = this.strict;
  this.strict = true;
  this.parseClassId(node, isStatement);
  this.parseClassSuper(node);
  var classBody = this.startNode();
  var hadConstructor = false;
  classBody.body = [];
  this.expect(types.braceL);
  while (this.type !== types.braceR) {
    var element2 = this.parseClassElement(node.superClass !== null);
    if (element2) {
      classBody.body.push(element2);
      if (element2.type === "MethodDefinition" && element2.kind === "constructor") {
        if (hadConstructor) {
          this.raise(element2.start, "Duplicate constructor in the same class");
        }
        hadConstructor = true;
      }
    }
  }
  this.strict = oldStrict;
  this.next();
  node.body = this.finishNode(classBody, "ClassBody");
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
};
pp$1.parseClassElement = function(constructorAllowsSuper) {
  var this$1 = this;
  if (this.eat(types.semi)) {
    return null;
  }
  var method = this.startNode();
  var tryContextual = function(k2, noLineBreak) {
    if (noLineBreak === void 0)
      noLineBreak = false;
    var start = this$1.start, startLoc = this$1.startLoc;
    if (!this$1.eatContextual(k2)) {
      return false;
    }
    if (this$1.type !== types.parenL && (!noLineBreak || !this$1.canInsertSemicolon())) {
      return true;
    }
    if (method.key) {
      this$1.unexpected();
    }
    method.computed = false;
    method.key = this$1.startNodeAt(start, startLoc);
    method.key.name = k2;
    this$1.finishNode(method.key, "Identifier");
    return false;
  };
  method.kind = "method";
  method.static = tryContextual("static");
  var isGenerator = this.eat(types.star);
  var isAsync = false;
  if (!isGenerator) {
    if (this.options.ecmaVersion >= 8 && tryContextual("async", true)) {
      isAsync = true;
      isGenerator = this.options.ecmaVersion >= 9 && this.eat(types.star);
    } else if (tryContextual("get")) {
      method.kind = "get";
    } else if (tryContextual("set")) {
      method.kind = "set";
    }
  }
  if (!method.key) {
    this.parsePropertyName(method);
  }
  var key = method.key;
  var allowsDirectSuper = false;
  if (!method.computed && !method.static && (key.type === "Identifier" && key.name === "constructor" || key.type === "Literal" && key.value === "constructor")) {
    if (method.kind !== "method") {
      this.raise(key.start, "Constructor can't have get/set modifier");
    }
    if (isGenerator) {
      this.raise(key.start, "Constructor can't be a generator");
    }
    if (isAsync) {
      this.raise(key.start, "Constructor can't be an async method");
    }
    method.kind = "constructor";
    allowsDirectSuper = constructorAllowsSuper;
  } else if (method.static && key.type === "Identifier" && key.name === "prototype") {
    this.raise(key.start, "Classes may not have a static property named prototype");
  }
  this.parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper);
  if (method.kind === "get" && method.value.params.length !== 0) {
    this.raiseRecoverable(method.value.start, "getter should have no params");
  }
  if (method.kind === "set" && method.value.params.length !== 1) {
    this.raiseRecoverable(method.value.start, "setter should have exactly one param");
  }
  if (method.kind === "set" && method.value.params[0].type === "RestElement") {
    this.raiseRecoverable(method.value.params[0].start, "Setter cannot use rest params");
  }
  return method;
};
pp$1.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
  method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
  return this.finishNode(method, "MethodDefinition");
};
pp$1.parseClassId = function(node, isStatement) {
  if (this.type === types.name) {
    node.id = this.parseIdent();
    if (isStatement) {
      this.checkLVal(node.id, BIND_LEXICAL, false);
    }
  } else {
    if (isStatement === true) {
      this.unexpected();
    }
    node.id = null;
  }
};
pp$1.parseClassSuper = function(node) {
  node.superClass = this.eat(types._extends) ? this.parseExprSubscripts() : null;
};
pp$1.parseExport = function(node, exports) {
  this.next();
  if (this.eat(types.star)) {
    if (this.options.ecmaVersion >= 11) {
      if (this.eatContextual("as")) {
        node.exported = this.parseIdent(true);
        this.checkExport(exports, node.exported.name, this.lastTokStart);
      } else {
        node.exported = null;
      }
    }
    this.expectContextual("from");
    if (this.type !== types.string) {
      this.unexpected();
    }
    node.source = this.parseExprAtom();
    this.semicolon();
    return this.finishNode(node, "ExportAllDeclaration");
  }
  if (this.eat(types._default)) {
    this.checkExport(exports, "default", this.lastTokStart);
    var isAsync;
    if (this.type === types._function || (isAsync = this.isAsyncFunction())) {
      var fNode = this.startNode();
      this.next();
      if (isAsync) {
        this.next();
      }
      node.declaration = this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
    } else if (this.type === types._class) {
      var cNode = this.startNode();
      node.declaration = this.parseClass(cNode, "nullableID");
    } else {
      node.declaration = this.parseMaybeAssign();
      this.semicolon();
    }
    return this.finishNode(node, "ExportDefaultDeclaration");
  }
  if (this.shouldParseExportStatement()) {
    node.declaration = this.parseStatement(null);
    if (node.declaration.type === "VariableDeclaration") {
      this.checkVariableExport(exports, node.declaration.declarations);
    } else {
      this.checkExport(exports, node.declaration.id.name, node.declaration.id.start);
    }
    node.specifiers = [];
    node.source = null;
  } else {
    node.declaration = null;
    node.specifiers = this.parseExportSpecifiers(exports);
    if (this.eatContextual("from")) {
      if (this.type !== types.string) {
        this.unexpected();
      }
      node.source = this.parseExprAtom();
    } else {
      for (var i2 = 0, list = node.specifiers; i2 < list.length; i2 += 1) {
        var spec = list[i2];
        this.checkUnreserved(spec.local);
        this.checkLocalExport(spec.local);
      }
      node.source = null;
    }
    this.semicolon();
  }
  return this.finishNode(node, "ExportNamedDeclaration");
};
pp$1.checkExport = function(exports, name, pos) {
  if (!exports) {
    return;
  }
  if (has(exports, name)) {
    this.raiseRecoverable(pos, "Duplicate export '" + name + "'");
  }
  exports[name] = true;
};
pp$1.checkPatternExport = function(exports, pat) {
  var type = pat.type;
  if (type === "Identifier") {
    this.checkExport(exports, pat.name, pat.start);
  } else if (type === "ObjectPattern") {
    for (var i2 = 0, list = pat.properties; i2 < list.length; i2 += 1) {
      var prop = list[i2];
      this.checkPatternExport(exports, prop);
    }
  } else if (type === "ArrayPattern") {
    for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
      var elt = list$1[i$1];
      if (elt) {
        this.checkPatternExport(exports, elt);
      }
    }
  } else if (type === "Property") {
    this.checkPatternExport(exports, pat.value);
  } else if (type === "AssignmentPattern") {
    this.checkPatternExport(exports, pat.left);
  } else if (type === "RestElement") {
    this.checkPatternExport(exports, pat.argument);
  } else if (type === "ParenthesizedExpression") {
    this.checkPatternExport(exports, pat.expression);
  }
};
pp$1.checkVariableExport = function(exports, decls) {
  if (!exports) {
    return;
  }
  for (var i2 = 0, list = decls; i2 < list.length; i2 += 1) {
    var decl = list[i2];
    this.checkPatternExport(exports, decl.id);
  }
};
pp$1.shouldParseExportStatement = function() {
  return this.type.keyword === "var" || this.type.keyword === "const" || this.type.keyword === "class" || this.type.keyword === "function" || this.isLet() || this.isAsyncFunction();
};
pp$1.parseExportSpecifiers = function(exports) {
  var nodes = [], first2 = true;
  this.expect(types.braceL);
  while (!this.eat(types.braceR)) {
    if (!first2) {
      this.expect(types.comma);
      if (this.afterTrailingComma(types.braceR)) {
        break;
      }
    } else {
      first2 = false;
    }
    var node = this.startNode();
    node.local = this.parseIdent(true);
    node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
    this.checkExport(exports, node.exported.name, node.exported.start);
    nodes.push(this.finishNode(node, "ExportSpecifier"));
  }
  return nodes;
};
pp$1.parseImport = function(node) {
  this.next();
  if (this.type === types.string) {
    node.specifiers = empty;
    node.source = this.parseExprAtom();
  } else {
    node.specifiers = this.parseImportSpecifiers();
    this.expectContextual("from");
    node.source = this.type === types.string ? this.parseExprAtom() : this.unexpected();
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration");
};
pp$1.parseImportSpecifiers = function() {
  var nodes = [], first2 = true;
  if (this.type === types.name) {
    var node = this.startNode();
    node.local = this.parseIdent();
    this.checkLVal(node.local, BIND_LEXICAL);
    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
    if (!this.eat(types.comma)) {
      return nodes;
    }
  }
  if (this.type === types.star) {
    var node$1 = this.startNode();
    this.next();
    this.expectContextual("as");
    node$1.local = this.parseIdent();
    this.checkLVal(node$1.local, BIND_LEXICAL);
    nodes.push(this.finishNode(node$1, "ImportNamespaceSpecifier"));
    return nodes;
  }
  this.expect(types.braceL);
  while (!this.eat(types.braceR)) {
    if (!first2) {
      this.expect(types.comma);
      if (this.afterTrailingComma(types.braceR)) {
        break;
      }
    } else {
      first2 = false;
    }
    var node$2 = this.startNode();
    node$2.imported = this.parseIdent(true);
    if (this.eatContextual("as")) {
      node$2.local = this.parseIdent();
    } else {
      this.checkUnreserved(node$2.imported);
      node$2.local = node$2.imported;
    }
    this.checkLVal(node$2.local, BIND_LEXICAL);
    nodes.push(this.finishNode(node$2, "ImportSpecifier"));
  }
  return nodes;
};
pp$1.adaptDirectivePrologue = function(statements) {
  for (var i2 = 0; i2 < statements.length && this.isDirectiveCandidate(statements[i2]); ++i2) {
    statements[i2].directive = statements[i2].expression.raw.slice(1, -1);
  }
};
pp$1.isDirectiveCandidate = function(statement) {
  return statement.type === "ExpressionStatement" && statement.expression.type === "Literal" && typeof statement.expression.value === "string" && (this.input[statement.start] === '"' || this.input[statement.start] === "'");
};
var pp$2 = Parser.prototype;
pp$2.toAssignable = function(node, isBinding, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 6 && node) {
    switch (node.type) {
      case "Identifier":
        if (this.inAsync && node.name === "await") {
          this.raise(node.start, "Cannot use 'await' as identifier inside an async function");
        }
        break;
      case "ObjectPattern":
      case "ArrayPattern":
      case "RestElement":
        break;
      case "ObjectExpression":
        node.type = "ObjectPattern";
        if (refDestructuringErrors) {
          this.checkPatternErrors(refDestructuringErrors, true);
        }
        for (var i2 = 0, list = node.properties; i2 < list.length; i2 += 1) {
          var prop = list[i2];
          this.toAssignable(prop, isBinding);
          if (prop.type === "RestElement" && (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")) {
            this.raise(prop.argument.start, "Unexpected token");
          }
        }
        break;
      case "Property":
        if (node.kind !== "init") {
          this.raise(node.key.start, "Object pattern can't contain getter or setter");
        }
        this.toAssignable(node.value, isBinding);
        break;
      case "ArrayExpression":
        node.type = "ArrayPattern";
        if (refDestructuringErrors) {
          this.checkPatternErrors(refDestructuringErrors, true);
        }
        this.toAssignableList(node.elements, isBinding);
        break;
      case "SpreadElement":
        node.type = "RestElement";
        this.toAssignable(node.argument, isBinding);
        if (node.argument.type === "AssignmentPattern") {
          this.raise(node.argument.start, "Rest elements cannot have a default value");
        }
        break;
      case "AssignmentExpression":
        if (node.operator !== "=") {
          this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
        }
        node.type = "AssignmentPattern";
        delete node.operator;
        this.toAssignable(node.left, isBinding);
      case "AssignmentPattern":
        break;
      case "ParenthesizedExpression":
        this.toAssignable(node.expression, isBinding, refDestructuringErrors);
        break;
      case "ChainExpression":
        this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
        break;
      case "MemberExpression":
        if (!isBinding) {
          break;
        }
      default:
        this.raise(node.start, "Assigning to rvalue");
    }
  } else if (refDestructuringErrors) {
    this.checkPatternErrors(refDestructuringErrors, true);
  }
  return node;
};
pp$2.toAssignableList = function(exprList, isBinding) {
  var end = exprList.length;
  for (var i2 = 0; i2 < end; i2++) {
    var elt = exprList[i2];
    if (elt) {
      this.toAssignable(elt, isBinding);
    }
  }
  if (end) {
    var last = exprList[end - 1];
    if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier") {
      this.unexpected(last.argument.start);
    }
  }
  return exprList;
};
pp$2.parseSpread = function(refDestructuringErrors) {
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
  return this.finishNode(node, "SpreadElement");
};
pp$2.parseRestBinding = function() {
  var node = this.startNode();
  this.next();
  if (this.options.ecmaVersion === 6 && this.type !== types.name) {
    this.unexpected();
  }
  node.argument = this.parseBindingAtom();
  return this.finishNode(node, "RestElement");
};
pp$2.parseBindingAtom = function() {
  if (this.options.ecmaVersion >= 6) {
    switch (this.type) {
      case types.bracketL:
        var node = this.startNode();
        this.next();
        node.elements = this.parseBindingList(types.bracketR, true, true);
        return this.finishNode(node, "ArrayPattern");
      case types.braceL:
        return this.parseObj(true);
    }
  }
  return this.parseIdent();
};
pp$2.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
  var elts = [], first2 = true;
  while (!this.eat(close)) {
    if (first2) {
      first2 = false;
    } else {
      this.expect(types.comma);
    }
    if (allowEmpty && this.type === types.comma) {
      elts.push(null);
    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
      break;
    } else if (this.type === types.ellipsis) {
      var rest = this.parseRestBinding();
      this.parseBindingListItem(rest);
      elts.push(rest);
      if (this.type === types.comma) {
        this.raise(this.start, "Comma is not permitted after the rest element");
      }
      this.expect(close);
      break;
    } else {
      var elem = this.parseMaybeDefault(this.start, this.startLoc);
      this.parseBindingListItem(elem);
      elts.push(elem);
    }
  }
  return elts;
};
pp$2.parseBindingListItem = function(param) {
  return param;
};
pp$2.parseMaybeDefault = function(startPos, startLoc, left) {
  left = left || this.parseBindingAtom();
  if (this.options.ecmaVersion < 6 || !this.eat(types.eq)) {
    return left;
  }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.right = this.parseMaybeAssign();
  return this.finishNode(node, "AssignmentPattern");
};
pp$2.checkLVal = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0)
    bindingType = BIND_NONE;
  switch (expr.type) {
    case "Identifier":
      if (bindingType === BIND_LEXICAL && expr.name === "let") {
        this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name");
      }
      if (this.strict && this.reservedWordsStrictBind.test(expr.name)) {
        this.raiseRecoverable(expr.start, (bindingType ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
      }
      if (checkClashes) {
        if (has(checkClashes, expr.name)) {
          this.raiseRecoverable(expr.start, "Argument name clash");
        }
        checkClashes[expr.name] = true;
      }
      if (bindingType !== BIND_NONE && bindingType !== BIND_OUTSIDE) {
        this.declareName(expr.name, bindingType, expr.start);
      }
      break;
    case "ChainExpression":
      this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
      break;
    case "MemberExpression":
      if (bindingType) {
        this.raiseRecoverable(expr.start, "Binding member expression");
      }
      break;
    case "ObjectPattern":
      for (var i2 = 0, list = expr.properties; i2 < list.length; i2 += 1) {
        var prop = list[i2];
        this.checkLVal(prop, bindingType, checkClashes);
      }
      break;
    case "Property":
      this.checkLVal(expr.value, bindingType, checkClashes);
      break;
    case "ArrayPattern":
      for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
        var elem = list$1[i$1];
        if (elem) {
          this.checkLVal(elem, bindingType, checkClashes);
        }
      }
      break;
    case "AssignmentPattern":
      this.checkLVal(expr.left, bindingType, checkClashes);
      break;
    case "RestElement":
      this.checkLVal(expr.argument, bindingType, checkClashes);
      break;
    case "ParenthesizedExpression":
      this.checkLVal(expr.expression, bindingType, checkClashes);
      break;
    default:
      this.raise(expr.start, (bindingType ? "Binding" : "Assigning to") + " rvalue");
  }
};
var pp$3 = Parser.prototype;
pp$3.checkPropClash = function(prop, propHash, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement") {
    return;
  }
  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand)) {
    return;
  }
  var key = prop.key;
  var name;
  switch (key.type) {
    case "Identifier":
      name = key.name;
      break;
    case "Literal":
      name = String(key.value);
      break;
    default:
      return;
  }
  var kind = prop.kind;
  if (this.options.ecmaVersion >= 6) {
    if (name === "__proto__" && kind === "init") {
      if (propHash.proto) {
        if (refDestructuringErrors) {
          if (refDestructuringErrors.doubleProto < 0) {
            refDestructuringErrors.doubleProto = key.start;
          }
        } else {
          this.raiseRecoverable(key.start, "Redefinition of __proto__ property");
        }
      }
      propHash.proto = true;
    }
    return;
  }
  name = "$" + name;
  var other = propHash[name];
  if (other) {
    var redefinition;
    if (kind === "init") {
      redefinition = this.strict && other.init || other.get || other.set;
    } else {
      redefinition = other.init || other[kind];
    }
    if (redefinition) {
      this.raiseRecoverable(key.start, "Redefinition of property");
    }
  } else {
    other = propHash[name] = {
      init: false,
      get: false,
      set: false
    };
  }
  other[kind] = true;
};
pp$3.parseExpression = function(noIn, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseMaybeAssign(noIn, refDestructuringErrors);
  if (this.type === types.comma) {
    var node = this.startNodeAt(startPos, startLoc);
    node.expressions = [expr];
    while (this.eat(types.comma)) {
      node.expressions.push(this.parseMaybeAssign(noIn, refDestructuringErrors));
    }
    return this.finishNode(node, "SequenceExpression");
  }
  return expr;
};
pp$3.parseMaybeAssign = function(noIn, refDestructuringErrors, afterLeftParse) {
  if (this.isContextual("yield")) {
    if (this.inGenerator) {
      return this.parseYield(noIn);
    } else {
      this.exprAllowed = false;
    }
  }
  var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1;
  if (refDestructuringErrors) {
    oldParenAssign = refDestructuringErrors.parenthesizedAssign;
    oldTrailingComma = refDestructuringErrors.trailingComma;
    refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
  } else {
    refDestructuringErrors = new DestructuringErrors();
    ownDestructuringErrors = true;
  }
  var startPos = this.start, startLoc = this.startLoc;
  if (this.type === types.parenL || this.type === types.name) {
    this.potentialArrowAt = this.start;
  }
  var left = this.parseMaybeConditional(noIn, refDestructuringErrors);
  if (afterLeftParse) {
    left = afterLeftParse.call(this, left, startPos, startLoc);
  }
  if (this.type.isAssign) {
    var node = this.startNodeAt(startPos, startLoc);
    node.operator = this.value;
    node.left = this.type === types.eq ? this.toAssignable(left, false, refDestructuringErrors) : left;
    if (!ownDestructuringErrors) {
      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
    }
    if (refDestructuringErrors.shorthandAssign >= node.left.start) {
      refDestructuringErrors.shorthandAssign = -1;
    }
    this.checkLVal(left);
    this.next();
    node.right = this.parseMaybeAssign(noIn);
    return this.finishNode(node, "AssignmentExpression");
  } else {
    if (ownDestructuringErrors) {
      this.checkExpressionErrors(refDestructuringErrors, true);
    }
  }
  if (oldParenAssign > -1) {
    refDestructuringErrors.parenthesizedAssign = oldParenAssign;
  }
  if (oldTrailingComma > -1) {
    refDestructuringErrors.trailingComma = oldTrailingComma;
  }
  return left;
};
pp$3.parseMaybeConditional = function(noIn, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprOps(noIn, refDestructuringErrors);
  if (this.checkExpressionErrors(refDestructuringErrors)) {
    return expr;
  }
  if (this.eat(types.question)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    this.expect(types.colon);
    node.alternate = this.parseMaybeAssign(noIn);
    return this.finishNode(node, "ConditionalExpression");
  }
  return expr;
};
pp$3.parseExprOps = function(noIn, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseMaybeUnary(refDestructuringErrors, false);
  if (this.checkExpressionErrors(refDestructuringErrors)) {
    return expr;
  }
  return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, noIn);
};
pp$3.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, noIn) {
  var prec = this.type.binop;
  if (prec != null && (!noIn || this.type !== types._in)) {
    if (prec > minPrec) {
      var logical = this.type === types.logicalOR || this.type === types.logicalAND;
      var coalesce = this.type === types.coalesce;
      if (coalesce) {
        prec = types.logicalAND.binop;
      }
      var op = this.value;
      this.next();
      var startPos = this.start, startLoc = this.startLoc;
      var right = this.parseExprOp(this.parseMaybeUnary(null, false), startPos, startLoc, prec, noIn);
      var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);
      if (logical && this.type === types.coalesce || coalesce && (this.type === types.logicalOR || this.type === types.logicalAND)) {
        this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
      }
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
    }
  }
  return left;
};
pp$3.buildBinary = function(startPos, startLoc, left, right, op, logical) {
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.operator = op;
  node.right = right;
  return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression");
};
pp$3.parseMaybeUnary = function(refDestructuringErrors, sawUnary) {
  var startPos = this.start, startLoc = this.startLoc, expr;
  if (this.isContextual("await") && (this.inAsync || !this.inFunction && this.options.allowAwaitOutsideFunction)) {
    expr = this.parseAwait();
    sawUnary = true;
  } else if (this.type.prefix) {
    var node = this.startNode(), update = this.type === types.incDec;
    node.operator = this.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary(null, true);
    this.checkExpressionErrors(refDestructuringErrors, true);
    if (update) {
      this.checkLVal(node.argument);
    } else if (this.strict && node.operator === "delete" && node.argument.type === "Identifier") {
      this.raiseRecoverable(node.start, "Deleting local variable in strict mode");
    } else {
      sawUnary = true;
    }
    expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  } else {
    expr = this.parseExprSubscripts(refDestructuringErrors);
    if (this.checkExpressionErrors(refDestructuringErrors)) {
      return expr;
    }
    while (this.type.postfix && !this.canInsertSemicolon()) {
      var node$1 = this.startNodeAt(startPos, startLoc);
      node$1.operator = this.value;
      node$1.prefix = false;
      node$1.argument = expr;
      this.checkLVal(expr);
      this.next();
      expr = this.finishNode(node$1, "UpdateExpression");
    }
  }
  if (!sawUnary && this.eat(types.starstar)) {
    return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false), "**", false);
  } else {
    return expr;
  }
};
pp$3.parseExprSubscripts = function(refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprAtom(refDestructuringErrors);
  if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")") {
    return expr;
  }
  var result = this.parseSubscripts(expr, startPos, startLoc);
  if (refDestructuringErrors && result.type === "MemberExpression") {
    if (refDestructuringErrors.parenthesizedAssign >= result.start) {
      refDestructuringErrors.parenthesizedAssign = -1;
    }
    if (refDestructuringErrors.parenthesizedBind >= result.start) {
      refDestructuringErrors.parenthesizedBind = -1;
    }
  }
  return result;
};
pp$3.parseSubscripts = function(base2, startPos, startLoc, noCalls) {
  var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base2.type === "Identifier" && base2.name === "async" && this.lastTokEnd === base2.end && !this.canInsertSemicolon() && base2.end - base2.start === 5 && this.potentialArrowAt === base2.start;
  var optionalChained = false;
  while (true) {
    var element2 = this.parseSubscript(base2, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained);
    if (element2.optional) {
      optionalChained = true;
    }
    if (element2 === base2 || element2.type === "ArrowFunctionExpression") {
      if (optionalChained) {
        var chainNode = this.startNodeAt(startPos, startLoc);
        chainNode.expression = element2;
        element2 = this.finishNode(chainNode, "ChainExpression");
      }
      return element2;
    }
    base2 = element2;
  }
};
pp$3.parseSubscript = function(base2, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained) {
  var optionalSupported = this.options.ecmaVersion >= 11;
  var optional = optionalSupported && this.eat(types.questionDot);
  if (noCalls && optional) {
    this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions");
  }
  var computed = this.eat(types.bracketL);
  if (computed || optional && this.type !== types.parenL && this.type !== types.backQuote || this.eat(types.dot)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.object = base2;
    node.property = computed ? this.parseExpression() : this.parseIdent(this.options.allowReserved !== "never");
    node.computed = !!computed;
    if (computed) {
      this.expect(types.bracketR);
    }
    if (optionalSupported) {
      node.optional = optional;
    }
    base2 = this.finishNode(node, "MemberExpression");
  } else if (!noCalls && this.eat(types.parenL)) {
    var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    var exprList = this.parseExprList(types.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
    if (maybeAsyncArrow && !optional && !this.canInsertSemicolon() && this.eat(types.arrow)) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      if (this.awaitIdentPos > 0) {
        this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function");
      }
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      this.awaitIdentPos = oldAwaitIdentPos;
      return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true);
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
    var node$1 = this.startNodeAt(startPos, startLoc);
    node$1.callee = base2;
    node$1.arguments = exprList;
    if (optionalSupported) {
      node$1.optional = optional;
    }
    base2 = this.finishNode(node$1, "CallExpression");
  } else if (this.type === types.backQuote) {
    if (optional || optionalChained) {
      this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
    }
    var node$2 = this.startNodeAt(startPos, startLoc);
    node$2.tag = base2;
    node$2.quasi = this.parseTemplate({ isTagged: true });
    base2 = this.finishNode(node$2, "TaggedTemplateExpression");
  }
  return base2;
};
pp$3.parseExprAtom = function(refDestructuringErrors) {
  if (this.type === types.slash) {
    this.readRegexp();
  }
  var node, canBeArrow = this.potentialArrowAt === this.start;
  switch (this.type) {
    case types._super:
      if (!this.allowSuper) {
        this.raise(this.start, "'super' keyword outside a method");
      }
      node = this.startNode();
      this.next();
      if (this.type === types.parenL && !this.allowDirectSuper) {
        this.raise(node.start, "super() call outside constructor of a subclass");
      }
      if (this.type !== types.dot && this.type !== types.bracketL && this.type !== types.parenL) {
        this.unexpected();
      }
      return this.finishNode(node, "Super");
    case types._this:
      node = this.startNode();
      this.next();
      return this.finishNode(node, "ThisExpression");
    case types.name:
      var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
      var id = this.parseIdent(false);
      if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(types._function)) {
        return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true);
      }
      if (canBeArrow && !this.canInsertSemicolon()) {
        if (this.eat(types.arrow)) {
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false);
        }
        if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === types.name && !containsEsc) {
          id = this.parseIdent(false);
          if (this.canInsertSemicolon() || !this.eat(types.arrow)) {
            this.unexpected();
          }
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true);
        }
      }
      return id;
    case types.regexp:
      var value = this.value;
      node = this.parseLiteral(value.value);
      node.regex = { pattern: value.pattern, flags: value.flags };
      return node;
    case types.num:
    case types.string:
      return this.parseLiteral(this.value);
    case types._null:
    case types._true:
    case types._false:
      node = this.startNode();
      node.value = this.type === types._null ? null : this.type === types._true;
      node.raw = this.type.keyword;
      this.next();
      return this.finishNode(node, "Literal");
    case types.parenL:
      var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow);
      if (refDestructuringErrors) {
        if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr)) {
          refDestructuringErrors.parenthesizedAssign = start;
        }
        if (refDestructuringErrors.parenthesizedBind < 0) {
          refDestructuringErrors.parenthesizedBind = start;
        }
      }
      return expr;
    case types.bracketL:
      node = this.startNode();
      this.next();
      node.elements = this.parseExprList(types.bracketR, true, true, refDestructuringErrors);
      return this.finishNode(node, "ArrayExpression");
    case types.braceL:
      return this.parseObj(false, refDestructuringErrors);
    case types._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, 0);
    case types._class:
      return this.parseClass(this.startNode(), false);
    case types._new:
      return this.parseNew();
    case types.backQuote:
      return this.parseTemplate();
    case types._import:
      if (this.options.ecmaVersion >= 11) {
        return this.parseExprImport();
      } else {
        return this.unexpected();
      }
    default:
      this.unexpected();
  }
};
pp$3.parseExprImport = function() {
  var node = this.startNode();
  if (this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword import");
  }
  var meta = this.parseIdent(true);
  switch (this.type) {
    case types.parenL:
      return this.parseDynamicImport(node);
    case types.dot:
      node.meta = meta;
      return this.parseImportMeta(node);
    default:
      this.unexpected();
  }
};
pp$3.parseDynamicImport = function(node) {
  this.next();
  node.source = this.parseMaybeAssign();
  if (!this.eat(types.parenR)) {
    var errorPos = this.start;
    if (this.eat(types.comma) && this.eat(types.parenR)) {
      this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
    } else {
      this.unexpected(errorPos);
    }
  }
  return this.finishNode(node, "ImportExpression");
};
pp$3.parseImportMeta = function(node) {
  this.next();
  var containsEsc = this.containsEsc;
  node.property = this.parseIdent(true);
  if (node.property.name !== "meta") {
    this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'");
  }
  if (containsEsc) {
    this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters");
  }
  if (this.options.sourceType !== "module") {
    this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module");
  }
  return this.finishNode(node, "MetaProperty");
};
pp$3.parseLiteral = function(value) {
  var node = this.startNode();
  node.value = value;
  node.raw = this.input.slice(this.start, this.end);
  if (node.raw.charCodeAt(node.raw.length - 1) === 110) {
    node.bigint = node.raw.slice(0, -1).replace(/_/g, "");
  }
  this.next();
  return this.finishNode(node, "Literal");
};
pp$3.parseParenExpression = function() {
  this.expect(types.parenL);
  var val = this.parseExpression();
  this.expect(types.parenR);
  return val;
};
pp$3.parseParenAndDistinguishExpression = function(canBeArrow) {
  var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
  if (this.options.ecmaVersion >= 6) {
    this.next();
    var innerStartPos = this.start, innerStartLoc = this.startLoc;
    var exprList = [], first2 = true, lastIsComma = false;
    var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
    this.yieldPos = 0;
    this.awaitPos = 0;
    while (this.type !== types.parenR) {
      first2 ? first2 = false : this.expect(types.comma);
      if (allowTrailingComma && this.afterTrailingComma(types.parenR, true)) {
        lastIsComma = true;
        break;
      } else if (this.type === types.ellipsis) {
        spreadStart = this.start;
        exprList.push(this.parseParenItem(this.parseRestBinding()));
        if (this.type === types.comma) {
          this.raise(this.start, "Comma is not permitted after the rest element");
        }
        break;
      } else {
        exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
      }
    }
    var innerEndPos = this.start, innerEndLoc = this.startLoc;
    this.expect(types.parenR);
    if (canBeArrow && !this.canInsertSemicolon() && this.eat(types.arrow)) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      return this.parseParenArrowList(startPos, startLoc, exprList);
    }
    if (!exprList.length || lastIsComma) {
      this.unexpected(this.lastTokStart);
    }
    if (spreadStart) {
      this.unexpected(spreadStart);
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }
  } else {
    val = this.parseParenExpression();
  }
  if (this.options.preserveParens) {
    var par = this.startNodeAt(startPos, startLoc);
    par.expression = val;
    return this.finishNode(par, "ParenthesizedExpression");
  } else {
    return val;
  }
};
pp$3.parseParenItem = function(item) {
  return item;
};
pp$3.parseParenArrowList = function(startPos, startLoc, exprList) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList);
};
var empty$1 = [];
pp$3.parseNew = function() {
  if (this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword new");
  }
  var node = this.startNode();
  var meta = this.parseIdent(true);
  if (this.options.ecmaVersion >= 6 && this.eat(types.dot)) {
    node.meta = meta;
    var containsEsc = this.containsEsc;
    node.property = this.parseIdent(true);
    if (node.property.name !== "target") {
      this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'");
    }
    if (containsEsc) {
      this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters");
    }
    if (!this.inNonArrowFunction()) {
      this.raiseRecoverable(node.start, "'new.target' can only be used in functions");
    }
    return this.finishNode(node, "MetaProperty");
  }
  var startPos = this.start, startLoc = this.startLoc, isImport = this.type === types._import;
  node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
  if (isImport && node.callee.type === "ImportExpression") {
    this.raise(startPos, "Cannot use new with import()");
  }
  if (this.eat(types.parenL)) {
    node.arguments = this.parseExprList(types.parenR, this.options.ecmaVersion >= 8, false);
  } else {
    node.arguments = empty$1;
  }
  return this.finishNode(node, "NewExpression");
};
pp$3.parseTemplateElement = function(ref2) {
  var isTagged = ref2.isTagged;
  var elem = this.startNode();
  if (this.type === types.invalidTemplate) {
    if (!isTagged) {
      this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
    }
    elem.value = {
      raw: this.value,
      cooked: null
    };
  } else {
    elem.value = {
      raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
      cooked: this.value
    };
  }
  this.next();
  elem.tail = this.type === types.backQuote;
  return this.finishNode(elem, "TemplateElement");
};
pp$3.parseTemplate = function(ref2) {
  if (ref2 === void 0)
    ref2 = {};
  var isTagged = ref2.isTagged;
  if (isTagged === void 0)
    isTagged = false;
  var node = this.startNode();
  this.next();
  node.expressions = [];
  var curElt = this.parseTemplateElement({ isTagged });
  node.quasis = [curElt];
  while (!curElt.tail) {
    if (this.type === types.eof) {
      this.raise(this.pos, "Unterminated template literal");
    }
    this.expect(types.dollarBraceL);
    node.expressions.push(this.parseExpression());
    this.expect(types.braceR);
    node.quasis.push(curElt = this.parseTemplateElement({ isTagged }));
  }
  this.next();
  return this.finishNode(node, "TemplateLiteral");
};
pp$3.isAsyncProp = function(prop) {
  return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" && (this.type === types.name || this.type === types.num || this.type === types.string || this.type === types.bracketL || this.type.keyword || this.options.ecmaVersion >= 9 && this.type === types.star) && !lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
};
pp$3.parseObj = function(isPattern, refDestructuringErrors) {
  var node = this.startNode(), first2 = true, propHash = {};
  node.properties = [];
  this.next();
  while (!this.eat(types.braceR)) {
    if (!first2) {
      this.expect(types.comma);
      if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types.braceR)) {
        break;
      }
    } else {
      first2 = false;
    }
    var prop = this.parseProperty(isPattern, refDestructuringErrors);
    if (!isPattern) {
      this.checkPropClash(prop, propHash, refDestructuringErrors);
    }
    node.properties.push(prop);
  }
  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
};
pp$3.parseProperty = function(isPattern, refDestructuringErrors) {
  var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
  if (this.options.ecmaVersion >= 9 && this.eat(types.ellipsis)) {
    if (isPattern) {
      prop.argument = this.parseIdent(false);
      if (this.type === types.comma) {
        this.raise(this.start, "Comma is not permitted after the rest element");
      }
      return this.finishNode(prop, "RestElement");
    }
    if (this.type === types.parenL && refDestructuringErrors) {
      if (refDestructuringErrors.parenthesizedAssign < 0) {
        refDestructuringErrors.parenthesizedAssign = this.start;
      }
      if (refDestructuringErrors.parenthesizedBind < 0) {
        refDestructuringErrors.parenthesizedBind = this.start;
      }
    }
    prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    if (this.type === types.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
      refDestructuringErrors.trailingComma = this.start;
    }
    return this.finishNode(prop, "SpreadElement");
  }
  if (this.options.ecmaVersion >= 6) {
    prop.method = false;
    prop.shorthand = false;
    if (isPattern || refDestructuringErrors) {
      startPos = this.start;
      startLoc = this.startLoc;
    }
    if (!isPattern) {
      isGenerator = this.eat(types.star);
    }
  }
  var containsEsc = this.containsEsc;
  this.parsePropertyName(prop);
  if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
    isAsync = true;
    isGenerator = this.options.ecmaVersion >= 9 && this.eat(types.star);
    this.parsePropertyName(prop, refDestructuringErrors);
  } else {
    isAsync = false;
  }
  this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
  return this.finishNode(prop, "Property");
};
pp$3.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
  if ((isGenerator || isAsync) && this.type === types.colon) {
    this.unexpected();
  }
  if (this.eat(types.colon)) {
    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
    prop.kind = "init";
  } else if (this.options.ecmaVersion >= 6 && this.type === types.parenL) {
    if (isPattern) {
      this.unexpected();
    }
    prop.kind = "init";
    prop.method = true;
    prop.value = this.parseMethod(isGenerator, isAsync);
  } else if (!isPattern && !containsEsc && this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type !== types.comma && this.type !== types.braceR && this.type !== types.eq)) {
    if (isGenerator || isAsync) {
      this.unexpected();
    }
    prop.kind = prop.key.name;
    this.parsePropertyName(prop);
    prop.value = this.parseMethod(false);
    var paramCount = prop.kind === "get" ? 0 : 1;
    if (prop.value.params.length !== paramCount) {
      var start = prop.value.start;
      if (prop.kind === "get") {
        this.raiseRecoverable(start, "getter should have no params");
      } else {
        this.raiseRecoverable(start, "setter should have exactly one param");
      }
    } else {
      if (prop.kind === "set" && prop.value.params[0].type === "RestElement") {
        this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params");
      }
    }
  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
    if (isGenerator || isAsync) {
      this.unexpected();
    }
    this.checkUnreserved(prop.key);
    if (prop.key.name === "await" && !this.awaitIdentPos) {
      this.awaitIdentPos = startPos;
    }
    prop.kind = "init";
    if (isPattern) {
      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
    } else if (this.type === types.eq && refDestructuringErrors) {
      if (refDestructuringErrors.shorthandAssign < 0) {
        refDestructuringErrors.shorthandAssign = this.start;
      }
      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
    } else {
      prop.value = prop.key;
    }
    prop.shorthand = true;
  } else {
    this.unexpected();
  }
};
pp$3.parsePropertyName = function(prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(types.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(types.bracketR);
      return prop.key;
    } else {
      prop.computed = false;
    }
  }
  return prop.key = this.type === types.num || this.type === types.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
};
pp$3.initFunction = function(node) {
  node.id = null;
  if (this.options.ecmaVersion >= 6) {
    node.generator = node.expression = false;
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = false;
  }
};
pp$3.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
  var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.initFunction(node);
  if (this.options.ecmaVersion >= 6) {
    node.generator = isGenerator;
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));
  this.expect(types.parenL);
  node.params = this.parseBindingList(types.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
  this.parseFunctionBody(node, false, true);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "FunctionExpression");
};
pp$3.parseArrowExpression = function(node, params, isAsync) {
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
  this.initFunction(node);
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  node.params = this.toAssignableList(params, true);
  this.parseFunctionBody(node, true, false);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "ArrowFunctionExpression");
};
pp$3.parseFunctionBody = function(node, isArrowFunction, isMethod) {
  var isExpression = isArrowFunction && this.type !== types.braceL;
  var oldStrict = this.strict, useStrict = false;
  if (isExpression) {
    node.body = this.parseMaybeAssign();
    node.expression = true;
    this.checkParams(node, false);
  } else {
    var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
    if (!oldStrict || nonSimple) {
      useStrict = this.strictDirective(this.end);
      if (useStrict && nonSimple) {
        this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list");
      }
    }
    var oldLabels = this.labels;
    this.labels = [];
    if (useStrict) {
      this.strict = true;
    }
    this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
    if (this.strict && node.id) {
      this.checkLVal(node.id, BIND_OUTSIDE);
    }
    node.body = this.parseBlock(false, void 0, useStrict && !oldStrict);
    node.expression = false;
    this.adaptDirectivePrologue(node.body.body);
    this.labels = oldLabels;
  }
  this.exitScope();
};
pp$3.isSimpleParamList = function(params) {
  for (var i2 = 0, list = params; i2 < list.length; i2 += 1) {
    var param = list[i2];
    if (param.type !== "Identifier") {
      return false;
    }
  }
  return true;
};
pp$3.checkParams = function(node, allowDuplicates) {
  var nameHash = {};
  for (var i2 = 0, list = node.params; i2 < list.length; i2 += 1) {
    var param = list[i2];
    this.checkLVal(param, BIND_VAR, allowDuplicates ? null : nameHash);
  }
};
pp$3.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
  var elts = [], first2 = true;
  while (!this.eat(close)) {
    if (!first2) {
      this.expect(types.comma);
      if (allowTrailingComma && this.afterTrailingComma(close)) {
        break;
      }
    } else {
      first2 = false;
    }
    var elt = void 0;
    if (allowEmpty && this.type === types.comma) {
      elt = null;
    } else if (this.type === types.ellipsis) {
      elt = this.parseSpread(refDestructuringErrors);
      if (refDestructuringErrors && this.type === types.comma && refDestructuringErrors.trailingComma < 0) {
        refDestructuringErrors.trailingComma = this.start;
      }
    } else {
      elt = this.parseMaybeAssign(false, refDestructuringErrors);
    }
    elts.push(elt);
  }
  return elts;
};
pp$3.checkUnreserved = function(ref2) {
  var start = ref2.start;
  var end = ref2.end;
  var name = ref2.name;
  if (this.inGenerator && name === "yield") {
    this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator");
  }
  if (this.inAsync && name === "await") {
    this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function");
  }
  if (this.keywords.test(name)) {
    this.raise(start, "Unexpected keyword '" + name + "'");
  }
  if (this.options.ecmaVersion < 6 && this.input.slice(start, end).indexOf("\\") !== -1) {
    return;
  }
  var re2 = this.strict ? this.reservedWordsStrict : this.reservedWords;
  if (re2.test(name)) {
    if (!this.inAsync && name === "await") {
      this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function");
    }
    this.raiseRecoverable(start, "The keyword '" + name + "' is reserved");
  }
};
pp$3.parseIdent = function(liberal, isBinding) {
  var node = this.startNode();
  if (this.type === types.name) {
    node.name = this.value;
  } else if (this.type.keyword) {
    node.name = this.type.keyword;
    if ((node.name === "class" || node.name === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
      this.context.pop();
    }
  } else {
    this.unexpected();
  }
  this.next(!!liberal);
  this.finishNode(node, "Identifier");
  if (!liberal) {
    this.checkUnreserved(node);
    if (node.name === "await" && !this.awaitIdentPos) {
      this.awaitIdentPos = node.start;
    }
  }
  return node;
};
pp$3.parseYield = function(noIn) {
  if (!this.yieldPos) {
    this.yieldPos = this.start;
  }
  var node = this.startNode();
  this.next();
  if (this.type === types.semi || this.canInsertSemicolon() || this.type !== types.star && !this.type.startsExpr) {
    node.delegate = false;
    node.argument = null;
  } else {
    node.delegate = this.eat(types.star);
    node.argument = this.parseMaybeAssign(noIn);
  }
  return this.finishNode(node, "YieldExpression");
};
pp$3.parseAwait = function() {
  if (!this.awaitPos) {
    this.awaitPos = this.start;
  }
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeUnary(null, false);
  return this.finishNode(node, "AwaitExpression");
};
var pp$4 = Parser.prototype;
pp$4.raise = function(pos, message) {
  var loc = getLineInfo(this.input, pos);
  message += " (" + loc.line + ":" + loc.column + ")";
  var err = new SyntaxError(message);
  err.pos = pos;
  err.loc = loc;
  err.raisedAt = this.pos;
  throw err;
};
pp$4.raiseRecoverable = pp$4.raise;
pp$4.curPosition = function() {
  if (this.options.locations) {
    return new Position(this.curLine, this.pos - this.lineStart);
  }
};
var pp$5 = Parser.prototype;
var Scope = function Scope2(flags) {
  this.flags = flags;
  this.var = [];
  this.lexical = [];
  this.functions = [];
};
pp$5.enterScope = function(flags) {
  this.scopeStack.push(new Scope(flags));
};
pp$5.exitScope = function() {
  this.scopeStack.pop();
};
pp$5.treatFunctionsAsVarInScope = function(scope) {
  return scope.flags & SCOPE_FUNCTION || !this.inModule && scope.flags & SCOPE_TOP;
};
pp$5.declareName = function(name, bindingType, pos) {
  var redeclared = false;
  if (bindingType === BIND_LEXICAL) {
    var scope = this.currentScope();
    redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
    scope.lexical.push(name);
    if (this.inModule && scope.flags & SCOPE_TOP) {
      delete this.undefinedExports[name];
    }
  } else if (bindingType === BIND_SIMPLE_CATCH) {
    var scope$1 = this.currentScope();
    scope$1.lexical.push(name);
  } else if (bindingType === BIND_FUNCTION) {
    var scope$2 = this.currentScope();
    if (this.treatFunctionsAsVar) {
      redeclared = scope$2.lexical.indexOf(name) > -1;
    } else {
      redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1;
    }
    scope$2.functions.push(name);
  } else {
    for (var i2 = this.scopeStack.length - 1; i2 >= 0; --i2) {
      var scope$3 = this.scopeStack[i2];
      if (scope$3.lexical.indexOf(name) > -1 && !(scope$3.flags & SCOPE_SIMPLE_CATCH && scope$3.lexical[0] === name) || !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
        redeclared = true;
        break;
      }
      scope$3.var.push(name);
      if (this.inModule && scope$3.flags & SCOPE_TOP) {
        delete this.undefinedExports[name];
      }
      if (scope$3.flags & SCOPE_VAR) {
        break;
      }
    }
  }
  if (redeclared) {
    this.raiseRecoverable(pos, "Identifier '" + name + "' has already been declared");
  }
};
pp$5.checkLocalExport = function(id) {
  if (this.scopeStack[0].lexical.indexOf(id.name) === -1 && this.scopeStack[0].var.indexOf(id.name) === -1) {
    this.undefinedExports[id.name] = id;
  }
};
pp$5.currentScope = function() {
  return this.scopeStack[this.scopeStack.length - 1];
};
pp$5.currentVarScope = function() {
  for (var i2 = this.scopeStack.length - 1; ; i2--) {
    var scope = this.scopeStack[i2];
    if (scope.flags & SCOPE_VAR) {
      return scope;
    }
  }
};
pp$5.currentThisScope = function() {
  for (var i2 = this.scopeStack.length - 1; ; i2--) {
    var scope = this.scopeStack[i2];
    if (scope.flags & SCOPE_VAR && !(scope.flags & SCOPE_ARROW)) {
      return scope;
    }
  }
};
var Node2 = function Node22(parser2, pos, loc) {
  this.type = "";
  this.start = pos;
  this.end = 0;
  if (parser2.options.locations) {
    this.loc = new SourceLocation(parser2, loc);
  }
  if (parser2.options.directSourceFile) {
    this.sourceFile = parser2.options.directSourceFile;
  }
  if (parser2.options.ranges) {
    this.range = [pos, 0];
  }
};
var pp$6 = Parser.prototype;
pp$6.startNode = function() {
  return new Node2(this, this.start, this.startLoc);
};
pp$6.startNodeAt = function(pos, loc) {
  return new Node2(this, pos, loc);
};
function finishNodeAt(node, type, pos, loc) {
  node.type = type;
  node.end = pos;
  if (this.options.locations) {
    node.loc.end = loc;
  }
  if (this.options.ranges) {
    node.range[1] = pos;
  }
  return node;
}
pp$6.finishNode = function(node, type) {
  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
};
pp$6.finishNodeAt = function(node, type, pos, loc) {
  return finishNodeAt.call(this, node, type, pos, loc);
};
var TokContext = function TokContext2(token, isExpr, preserveSpace, override, generator) {
  this.token = token;
  this.isExpr = !!isExpr;
  this.preserveSpace = !!preserveSpace;
  this.override = override;
  this.generator = !!generator;
};
var types$1 = {
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  b_tmpl: new TokContext("${", false),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  q_tmpl: new TokContext("`", true, true, function(p2) {
    return p2.tryReadTemplateToken();
  }),
  f_stat: new TokContext("function", false),
  f_expr: new TokContext("function", true),
  f_expr_gen: new TokContext("function", true, false, null, true),
  f_gen: new TokContext("function", false, false, null, true)
};
var pp$7 = Parser.prototype;
pp$7.initialContext = function() {
  return [types$1.b_stat];
};
pp$7.braceIsBlock = function(prevType) {
  var parent = this.curContext();
  if (parent === types$1.f_expr || parent === types$1.f_stat) {
    return true;
  }
  if (prevType === types.colon && (parent === types$1.b_stat || parent === types$1.b_expr)) {
    return !parent.isExpr;
  }
  if (prevType === types._return || prevType === types.name && this.exprAllowed) {
    return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
  }
  if (prevType === types._else || prevType === types.semi || prevType === types.eof || prevType === types.parenR || prevType === types.arrow) {
    return true;
  }
  if (prevType === types.braceL) {
    return parent === types$1.b_stat;
  }
  if (prevType === types._var || prevType === types._const || prevType === types.name) {
    return false;
  }
  return !this.exprAllowed;
};
pp$7.inGeneratorContext = function() {
  for (var i2 = this.context.length - 1; i2 >= 1; i2--) {
    var context = this.context[i2];
    if (context.token === "function") {
      return context.generator;
    }
  }
  return false;
};
pp$7.updateContext = function(prevType) {
  var update, type = this.type;
  if (type.keyword && prevType === types.dot) {
    this.exprAllowed = false;
  } else if (update = type.updateContext) {
    update.call(this, prevType);
  } else {
    this.exprAllowed = type.beforeExpr;
  }
};
types.parenR.updateContext = types.braceR.updateContext = function() {
  if (this.context.length === 1) {
    this.exprAllowed = true;
    return;
  }
  var out = this.context.pop();
  if (out === types$1.b_stat && this.curContext().token === "function") {
    out = this.context.pop();
  }
  this.exprAllowed = !out.isExpr;
};
types.braceL.updateContext = function(prevType) {
  this.context.push(this.braceIsBlock(prevType) ? types$1.b_stat : types$1.b_expr);
  this.exprAllowed = true;
};
types.dollarBraceL.updateContext = function() {
  this.context.push(types$1.b_tmpl);
  this.exprAllowed = true;
};
types.parenL.updateContext = function(prevType) {
  var statementParens = prevType === types._if || prevType === types._for || prevType === types._with || prevType === types._while;
  this.context.push(statementParens ? types$1.p_stat : types$1.p_expr);
  this.exprAllowed = true;
};
types.incDec.updateContext = function() {
};
types._function.updateContext = types._class.updateContext = function(prevType) {
  if (prevType.beforeExpr && prevType !== types.semi && prevType !== types._else && !(prevType === types._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) && !((prevType === types.colon || prevType === types.braceL) && this.curContext() === types$1.b_stat)) {
    this.context.push(types$1.f_expr);
  } else {
    this.context.push(types$1.f_stat);
  }
  this.exprAllowed = false;
};
types.backQuote.updateContext = function() {
  if (this.curContext() === types$1.q_tmpl) {
    this.context.pop();
  } else {
    this.context.push(types$1.q_tmpl);
  }
  this.exprAllowed = false;
};
types.star.updateContext = function(prevType) {
  if (prevType === types._function) {
    var index = this.context.length - 1;
    if (this.context[index] === types$1.f_expr) {
      this.context[index] = types$1.f_expr_gen;
    } else {
      this.context[index] = types$1.f_gen;
    }
  }
  this.exprAllowed = true;
};
types.name.updateContext = function(prevType) {
  var allowed = false;
  if (this.options.ecmaVersion >= 6 && prevType !== types.dot) {
    if (this.value === "of" && !this.exprAllowed || this.value === "yield" && this.inGeneratorContext()) {
      allowed = true;
    }
  }
  this.exprAllowed = allowed;
};
var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
var ecma11BinaryProperties = ecma10BinaryProperties;
var unicodeBinaryProperties = {
  9: ecma9BinaryProperties,
  10: ecma10BinaryProperties,
  11: ecma11BinaryProperties
};
var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";
var ecma9ScriptValues = "Adlam Adlm Ahom Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
var unicodeScriptValues = {
  9: ecma9ScriptValues,
  10: ecma10ScriptValues,
  11: ecma11ScriptValues
};
var data = {};
function buildUnicodeData(ecmaVersion) {
  var d2 = data[ecmaVersion] = {
    binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion] + " " + unicodeGeneralCategoryValues),
    nonBinary: {
      General_Category: wordsRegexp(unicodeGeneralCategoryValues),
      Script: wordsRegexp(unicodeScriptValues[ecmaVersion])
    }
  };
  d2.nonBinary.Script_Extensions = d2.nonBinary.Script;
  d2.nonBinary.gc = d2.nonBinary.General_Category;
  d2.nonBinary.sc = d2.nonBinary.Script;
  d2.nonBinary.scx = d2.nonBinary.Script_Extensions;
}
buildUnicodeData(9);
buildUnicodeData(10);
buildUnicodeData(11);
var pp$8 = Parser.prototype;
var RegExpValidationState = function RegExpValidationState2(parser2) {
  this.parser = parser2;
  this.validFlags = "gim" + (parser2.options.ecmaVersion >= 6 ? "uy" : "") + (parser2.options.ecmaVersion >= 9 ? "s" : "");
  this.unicodeProperties = data[parser2.options.ecmaVersion >= 11 ? 11 : parser2.options.ecmaVersion];
  this.source = "";
  this.flags = "";
  this.start = 0;
  this.switchU = false;
  this.switchN = false;
  this.pos = 0;
  this.lastIntValue = 0;
  this.lastStringValue = "";
  this.lastAssertionIsQuantifiable = false;
  this.numCapturingParens = 0;
  this.maxBackReference = 0;
  this.groupNames = [];
  this.backReferenceNames = [];
};
RegExpValidationState.prototype.reset = function reset(start, pattern, flags) {
  var unicode = flags.indexOf("u") !== -1;
  this.start = start | 0;
  this.source = pattern + "";
  this.flags = flags;
  this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
  this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
};
RegExpValidationState.prototype.raise = function raise(message) {
  this.parser.raiseRecoverable(this.start, "Invalid regular expression: /" + this.source + "/: " + message);
};
RegExpValidationState.prototype.at = function at(i2, forceU) {
  if (forceU === void 0)
    forceU = false;
  var s2 = this.source;
  var l2 = s2.length;
  if (i2 >= l2) {
    return -1;
  }
  var c2 = s2.charCodeAt(i2);
  if (!(forceU || this.switchU) || c2 <= 55295 || c2 >= 57344 || i2 + 1 >= l2) {
    return c2;
  }
  var next = s2.charCodeAt(i2 + 1);
  return next >= 56320 && next <= 57343 ? (c2 << 10) + next - 56613888 : c2;
};
RegExpValidationState.prototype.nextIndex = function nextIndex(i2, forceU) {
  if (forceU === void 0)
    forceU = false;
  var s2 = this.source;
  var l2 = s2.length;
  if (i2 >= l2) {
    return l2;
  }
  var c2 = s2.charCodeAt(i2), next;
  if (!(forceU || this.switchU) || c2 <= 55295 || c2 >= 57344 || i2 + 1 >= l2 || (next = s2.charCodeAt(i2 + 1)) < 56320 || next > 57343) {
    return i2 + 1;
  }
  return i2 + 2;
};
RegExpValidationState.prototype.current = function current(forceU) {
  if (forceU === void 0)
    forceU = false;
  return this.at(this.pos, forceU);
};
RegExpValidationState.prototype.lookahead = function lookahead(forceU) {
  if (forceU === void 0)
    forceU = false;
  return this.at(this.nextIndex(this.pos, forceU), forceU);
};
RegExpValidationState.prototype.advance = function advance(forceU) {
  if (forceU === void 0)
    forceU = false;
  this.pos = this.nextIndex(this.pos, forceU);
};
RegExpValidationState.prototype.eat = function eat(ch, forceU) {
  if (forceU === void 0)
    forceU = false;
  if (this.current(forceU) === ch) {
    this.advance(forceU);
    return true;
  }
  return false;
};
function codePointToString(ch) {
  if (ch <= 65535) {
    return String.fromCharCode(ch);
  }
  ch -= 65536;
  return String.fromCharCode((ch >> 10) + 55296, (ch & 1023) + 56320);
}
pp$8.validateRegExpFlags = function(state) {
  var validFlags = state.validFlags;
  var flags = state.flags;
  for (var i2 = 0; i2 < flags.length; i2++) {
    var flag = flags.charAt(i2);
    if (validFlags.indexOf(flag) === -1) {
      this.raise(state.start, "Invalid regular expression flag");
    }
    if (flags.indexOf(flag, i2 + 1) > -1) {
      this.raise(state.start, "Duplicate regular expression flag");
    }
  }
};
pp$8.validateRegExpPattern = function(state) {
  this.regexp_pattern(state);
  if (!state.switchN && this.options.ecmaVersion >= 9 && state.groupNames.length > 0) {
    state.switchN = true;
    this.regexp_pattern(state);
  }
};
pp$8.regexp_pattern = function(state) {
  state.pos = 0;
  state.lastIntValue = 0;
  state.lastStringValue = "";
  state.lastAssertionIsQuantifiable = false;
  state.numCapturingParens = 0;
  state.maxBackReference = 0;
  state.groupNames.length = 0;
  state.backReferenceNames.length = 0;
  this.regexp_disjunction(state);
  if (state.pos !== state.source.length) {
    if (state.eat(41)) {
      state.raise("Unmatched ')'");
    }
    if (state.eat(93) || state.eat(125)) {
      state.raise("Lone quantifier brackets");
    }
  }
  if (state.maxBackReference > state.numCapturingParens) {
    state.raise("Invalid escape");
  }
  for (var i2 = 0, list = state.backReferenceNames; i2 < list.length; i2 += 1) {
    var name = list[i2];
    if (state.groupNames.indexOf(name) === -1) {
      state.raise("Invalid named capture referenced");
    }
  }
};
pp$8.regexp_disjunction = function(state) {
  this.regexp_alternative(state);
  while (state.eat(124)) {
    this.regexp_alternative(state);
  }
  if (this.regexp_eatQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  if (state.eat(123)) {
    state.raise("Lone quantifier brackets");
  }
};
pp$8.regexp_alternative = function(state) {
  while (state.pos < state.source.length && this.regexp_eatTerm(state)) {
  }
};
pp$8.regexp_eatTerm = function(state) {
  if (this.regexp_eatAssertion(state)) {
    if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
      if (state.switchU) {
        state.raise("Invalid quantifier");
      }
    }
    return true;
  }
  if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
    this.regexp_eatQuantifier(state);
    return true;
  }
  return false;
};
pp$8.regexp_eatAssertion = function(state) {
  var start = state.pos;
  state.lastAssertionIsQuantifiable = false;
  if (state.eat(94) || state.eat(36)) {
    return true;
  }
  if (state.eat(92)) {
    if (state.eat(66) || state.eat(98)) {
      return true;
    }
    state.pos = start;
  }
  if (state.eat(40) && state.eat(63)) {
    var lookbehind = false;
    if (this.options.ecmaVersion >= 9) {
      lookbehind = state.eat(60);
    }
    if (state.eat(61) || state.eat(33)) {
      this.regexp_disjunction(state);
      if (!state.eat(41)) {
        state.raise("Unterminated group");
      }
      state.lastAssertionIsQuantifiable = !lookbehind;
      return true;
    }
  }
  state.pos = start;
  return false;
};
pp$8.regexp_eatQuantifier = function(state, noError) {
  if (noError === void 0)
    noError = false;
  if (this.regexp_eatQuantifierPrefix(state, noError)) {
    state.eat(63);
    return true;
  }
  return false;
};
pp$8.regexp_eatQuantifierPrefix = function(state, noError) {
  return state.eat(42) || state.eat(43) || state.eat(63) || this.regexp_eatBracedQuantifier(state, noError);
};
pp$8.regexp_eatBracedQuantifier = function(state, noError) {
  var start = state.pos;
  if (state.eat(123)) {
    var min = 0, max = -1;
    if (this.regexp_eatDecimalDigits(state)) {
      min = state.lastIntValue;
      if (state.eat(44) && this.regexp_eatDecimalDigits(state)) {
        max = state.lastIntValue;
      }
      if (state.eat(125)) {
        if (max !== -1 && max < min && !noError) {
          state.raise("numbers out of order in {} quantifier");
        }
        return true;
      }
    }
    if (state.switchU && !noError) {
      state.raise("Incomplete quantifier");
    }
    state.pos = start;
  }
  return false;
};
pp$8.regexp_eatAtom = function(state) {
  return this.regexp_eatPatternCharacters(state) || state.eat(46) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state);
};
pp$8.regexp_eatReverseSolidusAtomEscape = function(state) {
  var start = state.pos;
  if (state.eat(92)) {
    if (this.regexp_eatAtomEscape(state)) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$8.regexp_eatUncapturingGroup = function(state) {
  var start = state.pos;
  if (state.eat(40)) {
    if (state.eat(63) && state.eat(58)) {
      this.regexp_disjunction(state);
      if (state.eat(41)) {
        return true;
      }
      state.raise("Unterminated group");
    }
    state.pos = start;
  }
  return false;
};
pp$8.regexp_eatCapturingGroup = function(state) {
  if (state.eat(40)) {
    if (this.options.ecmaVersion >= 9) {
      this.regexp_groupSpecifier(state);
    } else if (state.current() === 63) {
      state.raise("Invalid group");
    }
    this.regexp_disjunction(state);
    if (state.eat(41)) {
      state.numCapturingParens += 1;
      return true;
    }
    state.raise("Unterminated group");
  }
  return false;
};
pp$8.regexp_eatExtendedAtom = function(state) {
  return state.eat(46) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state) || this.regexp_eatInvalidBracedQuantifier(state) || this.regexp_eatExtendedPatternCharacter(state);
};
pp$8.regexp_eatInvalidBracedQuantifier = function(state) {
  if (this.regexp_eatBracedQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  return false;
};
pp$8.regexp_eatSyntaxCharacter = function(state) {
  var ch = state.current();
  if (isSyntaxCharacter(ch)) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
function isSyntaxCharacter(ch) {
  return ch === 36 || ch >= 40 && ch <= 43 || ch === 46 || ch === 63 || ch >= 91 && ch <= 94 || ch >= 123 && ch <= 125;
}
pp$8.regexp_eatPatternCharacters = function(state) {
  var start = state.pos;
  var ch = 0;
  while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {
    state.advance();
  }
  return state.pos !== start;
};
pp$8.regexp_eatExtendedPatternCharacter = function(state) {
  var ch = state.current();
  if (ch !== -1 && ch !== 36 && !(ch >= 40 && ch <= 43) && ch !== 46 && ch !== 63 && ch !== 91 && ch !== 94 && ch !== 124) {
    state.advance();
    return true;
  }
  return false;
};
pp$8.regexp_groupSpecifier = function(state) {
  if (state.eat(63)) {
    if (this.regexp_eatGroupName(state)) {
      if (state.groupNames.indexOf(state.lastStringValue) !== -1) {
        state.raise("Duplicate capture group name");
      }
      state.groupNames.push(state.lastStringValue);
      return;
    }
    state.raise("Invalid group");
  }
};
pp$8.regexp_eatGroupName = function(state) {
  state.lastStringValue = "";
  if (state.eat(60)) {
    if (this.regexp_eatRegExpIdentifierName(state) && state.eat(62)) {
      return true;
    }
    state.raise("Invalid capture group name");
  }
  return false;
};
pp$8.regexp_eatRegExpIdentifierName = function(state) {
  state.lastStringValue = "";
  if (this.regexp_eatRegExpIdentifierStart(state)) {
    state.lastStringValue += codePointToString(state.lastIntValue);
    while (this.regexp_eatRegExpIdentifierPart(state)) {
      state.lastStringValue += codePointToString(state.lastIntValue);
    }
    return true;
  }
  return false;
};
pp$8.regexp_eatRegExpIdentifierStart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch = state.current(forceU);
  state.advance(forceU);
  if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch = state.lastIntValue;
  }
  if (isRegExpIdentifierStart(ch)) {
    state.lastIntValue = ch;
    return true;
  }
  state.pos = start;
  return false;
};
function isRegExpIdentifierStart(ch) {
  return isIdentifierStart(ch, true) || ch === 36 || ch === 95;
}
pp$8.regexp_eatRegExpIdentifierPart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch = state.current(forceU);
  state.advance(forceU);
  if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch = state.lastIntValue;
  }
  if (isRegExpIdentifierPart(ch)) {
    state.lastIntValue = ch;
    return true;
  }
  state.pos = start;
  return false;
};
function isRegExpIdentifierPart(ch) {
  return isIdentifierChar(ch, true) || ch === 36 || ch === 95 || ch === 8204 || ch === 8205;
}
pp$8.regexp_eatAtomEscape = function(state) {
  if (this.regexp_eatBackReference(state) || this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state) || state.switchN && this.regexp_eatKGroupName(state)) {
    return true;
  }
  if (state.switchU) {
    if (state.current() === 99) {
      state.raise("Invalid unicode escape");
    }
    state.raise("Invalid escape");
  }
  return false;
};
pp$8.regexp_eatBackReference = function(state) {
  var start = state.pos;
  if (this.regexp_eatDecimalEscape(state)) {
    var n2 = state.lastIntValue;
    if (state.switchU) {
      if (n2 > state.maxBackReference) {
        state.maxBackReference = n2;
      }
      return true;
    }
    if (n2 <= state.numCapturingParens) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$8.regexp_eatKGroupName = function(state) {
  if (state.eat(107)) {
    if (this.regexp_eatGroupName(state)) {
      state.backReferenceNames.push(state.lastStringValue);
      return true;
    }
    state.raise("Invalid named reference");
  }
  return false;
};
pp$8.regexp_eatCharacterEscape = function(state) {
  return this.regexp_eatControlEscape(state) || this.regexp_eatCControlLetter(state) || this.regexp_eatZero(state) || this.regexp_eatHexEscapeSequence(state) || this.regexp_eatRegExpUnicodeEscapeSequence(state, false) || !state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state) || this.regexp_eatIdentityEscape(state);
};
pp$8.regexp_eatCControlLetter = function(state) {
  var start = state.pos;
  if (state.eat(99)) {
    if (this.regexp_eatControlLetter(state)) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$8.regexp_eatZero = function(state) {
  if (state.current() === 48 && !isDecimalDigit(state.lookahead())) {
    state.lastIntValue = 0;
    state.advance();
    return true;
  }
  return false;
};
pp$8.regexp_eatControlEscape = function(state) {
  var ch = state.current();
  if (ch === 116) {
    state.lastIntValue = 9;
    state.advance();
    return true;
  }
  if (ch === 110) {
    state.lastIntValue = 10;
    state.advance();
    return true;
  }
  if (ch === 118) {
    state.lastIntValue = 11;
    state.advance();
    return true;
  }
  if (ch === 102) {
    state.lastIntValue = 12;
    state.advance();
    return true;
  }
  if (ch === 114) {
    state.lastIntValue = 13;
    state.advance();
    return true;
  }
  return false;
};
pp$8.regexp_eatControlLetter = function(state) {
  var ch = state.current();
  if (isControlLetter(ch)) {
    state.lastIntValue = ch % 32;
    state.advance();
    return true;
  }
  return false;
};
function isControlLetter(ch) {
  return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122;
}
pp$8.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
  if (forceU === void 0)
    forceU = false;
  var start = state.pos;
  var switchU = forceU || state.switchU;
  if (state.eat(117)) {
    if (this.regexp_eatFixedHexDigits(state, 4)) {
      var lead = state.lastIntValue;
      if (switchU && lead >= 55296 && lead <= 56319) {
        var leadSurrogateEnd = state.pos;
        if (state.eat(92) && state.eat(117) && this.regexp_eatFixedHexDigits(state, 4)) {
          var trail = state.lastIntValue;
          if (trail >= 56320 && trail <= 57343) {
            state.lastIntValue = (lead - 55296) * 1024 + (trail - 56320) + 65536;
            return true;
          }
        }
        state.pos = leadSurrogateEnd;
        state.lastIntValue = lead;
      }
      return true;
    }
    if (switchU && state.eat(123) && this.regexp_eatHexDigits(state) && state.eat(125) && isValidUnicode(state.lastIntValue)) {
      return true;
    }
    if (switchU) {
      state.raise("Invalid unicode escape");
    }
    state.pos = start;
  }
  return false;
};
function isValidUnicode(ch) {
  return ch >= 0 && ch <= 1114111;
}
pp$8.regexp_eatIdentityEscape = function(state) {
  if (state.switchU) {
    if (this.regexp_eatSyntaxCharacter(state)) {
      return true;
    }
    if (state.eat(47)) {
      state.lastIntValue = 47;
      return true;
    }
    return false;
  }
  var ch = state.current();
  if (ch !== 99 && (!state.switchN || ch !== 107)) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
pp$8.regexp_eatDecimalEscape = function(state) {
  state.lastIntValue = 0;
  var ch = state.current();
  if (ch >= 49 && ch <= 57) {
    do {
      state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
      state.advance();
    } while ((ch = state.current()) >= 48 && ch <= 57);
    return true;
  }
  return false;
};
pp$8.regexp_eatCharacterClassEscape = function(state) {
  var ch = state.current();
  if (isCharacterClassEscape(ch)) {
    state.lastIntValue = -1;
    state.advance();
    return true;
  }
  if (state.switchU && this.options.ecmaVersion >= 9 && (ch === 80 || ch === 112)) {
    state.lastIntValue = -1;
    state.advance();
    if (state.eat(123) && this.regexp_eatUnicodePropertyValueExpression(state) && state.eat(125)) {
      return true;
    }
    state.raise("Invalid property name");
  }
  return false;
};
function isCharacterClassEscape(ch) {
  return ch === 100 || ch === 68 || ch === 115 || ch === 83 || ch === 119 || ch === 87;
}
pp$8.regexp_eatUnicodePropertyValueExpression = function(state) {
  var start = state.pos;
  if (this.regexp_eatUnicodePropertyName(state) && state.eat(61)) {
    var name = state.lastStringValue;
    if (this.regexp_eatUnicodePropertyValue(state)) {
      var value = state.lastStringValue;
      this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
      return true;
    }
  }
  state.pos = start;
  if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
    var nameOrValue = state.lastStringValue;
    this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
    return true;
  }
  return false;
};
pp$8.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
  if (!has(state.unicodeProperties.nonBinary, name)) {
    state.raise("Invalid property name");
  }
  if (!state.unicodeProperties.nonBinary[name].test(value)) {
    state.raise("Invalid property value");
  }
};
pp$8.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
  if (!state.unicodeProperties.binary.test(nameOrValue)) {
    state.raise("Invalid property name");
  }
};
pp$8.regexp_eatUnicodePropertyName = function(state) {
  var ch = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyNameCharacter(ch = state.current())) {
    state.lastStringValue += codePointToString(ch);
    state.advance();
  }
  return state.lastStringValue !== "";
};
function isUnicodePropertyNameCharacter(ch) {
  return isControlLetter(ch) || ch === 95;
}
pp$8.regexp_eatUnicodePropertyValue = function(state) {
  var ch = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyValueCharacter(ch = state.current())) {
    state.lastStringValue += codePointToString(ch);
    state.advance();
  }
  return state.lastStringValue !== "";
};
function isUnicodePropertyValueCharacter(ch) {
  return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch);
}
pp$8.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
  return this.regexp_eatUnicodePropertyValue(state);
};
pp$8.regexp_eatCharacterClass = function(state) {
  if (state.eat(91)) {
    state.eat(94);
    this.regexp_classRanges(state);
    if (state.eat(93)) {
      return true;
    }
    state.raise("Unterminated character class");
  }
  return false;
};
pp$8.regexp_classRanges = function(state) {
  while (this.regexp_eatClassAtom(state)) {
    var left = state.lastIntValue;
    if (state.eat(45) && this.regexp_eatClassAtom(state)) {
      var right = state.lastIntValue;
      if (state.switchU && (left === -1 || right === -1)) {
        state.raise("Invalid character class");
      }
      if (left !== -1 && right !== -1 && left > right) {
        state.raise("Range out of order in character class");
      }
    }
  }
};
pp$8.regexp_eatClassAtom = function(state) {
  var start = state.pos;
  if (state.eat(92)) {
    if (this.regexp_eatClassEscape(state)) {
      return true;
    }
    if (state.switchU) {
      var ch$1 = state.current();
      if (ch$1 === 99 || isOctalDigit(ch$1)) {
        state.raise("Invalid class escape");
      }
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  var ch = state.current();
  if (ch !== 93) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
pp$8.regexp_eatClassEscape = function(state) {
  var start = state.pos;
  if (state.eat(98)) {
    state.lastIntValue = 8;
    return true;
  }
  if (state.switchU && state.eat(45)) {
    state.lastIntValue = 45;
    return true;
  }
  if (!state.switchU && state.eat(99)) {
    if (this.regexp_eatClassControlLetter(state)) {
      return true;
    }
    state.pos = start;
  }
  return this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state);
};
pp$8.regexp_eatClassControlLetter = function(state) {
  var ch = state.current();
  if (isDecimalDigit(ch) || ch === 95) {
    state.lastIntValue = ch % 32;
    state.advance();
    return true;
  }
  return false;
};
pp$8.regexp_eatHexEscapeSequence = function(state) {
  var start = state.pos;
  if (state.eat(120)) {
    if (this.regexp_eatFixedHexDigits(state, 2)) {
      return true;
    }
    if (state.switchU) {
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  return false;
};
pp$8.regexp_eatDecimalDigits = function(state) {
  var start = state.pos;
  var ch = 0;
  state.lastIntValue = 0;
  while (isDecimalDigit(ch = state.current())) {
    state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
    state.advance();
  }
  return state.pos !== start;
};
function isDecimalDigit(ch) {
  return ch >= 48 && ch <= 57;
}
pp$8.regexp_eatHexDigits = function(state) {
  var start = state.pos;
  var ch = 0;
  state.lastIntValue = 0;
  while (isHexDigit(ch = state.current())) {
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    state.advance();
  }
  return state.pos !== start;
};
function isHexDigit(ch) {
  return ch >= 48 && ch <= 57 || ch >= 65 && ch <= 70 || ch >= 97 && ch <= 102;
}
function hexToInt(ch) {
  if (ch >= 65 && ch <= 70) {
    return 10 + (ch - 65);
  }
  if (ch >= 97 && ch <= 102) {
    return 10 + (ch - 97);
  }
  return ch - 48;
}
pp$8.regexp_eatLegacyOctalEscapeSequence = function(state) {
  if (this.regexp_eatOctalDigit(state)) {
    var n1 = state.lastIntValue;
    if (this.regexp_eatOctalDigit(state)) {
      var n2 = state.lastIntValue;
      if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
        state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
      } else {
        state.lastIntValue = n1 * 8 + n2;
      }
    } else {
      state.lastIntValue = n1;
    }
    return true;
  }
  return false;
};
pp$8.regexp_eatOctalDigit = function(state) {
  var ch = state.current();
  if (isOctalDigit(ch)) {
    state.lastIntValue = ch - 48;
    state.advance();
    return true;
  }
  state.lastIntValue = 0;
  return false;
};
function isOctalDigit(ch) {
  return ch >= 48 && ch <= 55;
}
pp$8.regexp_eatFixedHexDigits = function(state, length2) {
  var start = state.pos;
  state.lastIntValue = 0;
  for (var i2 = 0; i2 < length2; ++i2) {
    var ch = state.current();
    if (!isHexDigit(ch)) {
      state.pos = start;
      return false;
    }
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    state.advance();
  }
  return true;
};
var Token = function Token2(p2) {
  this.type = p2.type;
  this.value = p2.value;
  this.start = p2.start;
  this.end = p2.end;
  if (p2.options.locations) {
    this.loc = new SourceLocation(p2, p2.startLoc, p2.endLoc);
  }
  if (p2.options.ranges) {
    this.range = [p2.start, p2.end];
  }
};
var pp$9 = Parser.prototype;
pp$9.next = function(ignoreEscapeSequenceInKeyword) {
  if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword);
  }
  if (this.options.onToken) {
    this.options.onToken(new Token(this));
  }
  this.lastTokEnd = this.end;
  this.lastTokStart = this.start;
  this.lastTokEndLoc = this.endLoc;
  this.lastTokStartLoc = this.startLoc;
  this.nextToken();
};
pp$9.getToken = function() {
  this.next();
  return new Token(this);
};
if (typeof Symbol !== "undefined") {
  pp$9[Symbol.iterator] = function() {
    var this$1 = this;
    return {
      next: function() {
        var token = this$1.getToken();
        return {
          done: token.type === types.eof,
          value: token
        };
      }
    };
  };
}
pp$9.curContext = function() {
  return this.context[this.context.length - 1];
};
pp$9.nextToken = function() {
  var curContext = this.curContext();
  if (!curContext || !curContext.preserveSpace) {
    this.skipSpace();
  }
  this.start = this.pos;
  if (this.options.locations) {
    this.startLoc = this.curPosition();
  }
  if (this.pos >= this.input.length) {
    return this.finishToken(types.eof);
  }
  if (curContext.override) {
    return curContext.override(this);
  } else {
    this.readToken(this.fullCharCodeAtPos());
  }
};
pp$9.readToken = function(code) {
  if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92) {
    return this.readWord();
  }
  return this.getTokenFromCode(code);
};
pp$9.fullCharCodeAtPos = function() {
  var code = this.input.charCodeAt(this.pos);
  if (code <= 55295 || code >= 57344) {
    return code;
  }
  var next = this.input.charCodeAt(this.pos + 1);
  return (code << 10) + next - 56613888;
};
pp$9.skipBlockComment = function() {
  var startLoc = this.options.onComment && this.curPosition();
  var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
  if (end === -1) {
    this.raise(this.pos - 2, "Unterminated comment");
  }
  this.pos = end + 2;
  if (this.options.locations) {
    lineBreakG.lastIndex = start;
    var match;
    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
      ++this.curLine;
      this.lineStart = match.index + match[0].length;
    }
  }
  if (this.options.onComment) {
    this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.curPosition());
  }
};
pp$9.skipLineComment = function(startSkip) {
  var start = this.pos;
  var startLoc = this.options.onComment && this.curPosition();
  var ch = this.input.charCodeAt(this.pos += startSkip);
  while (this.pos < this.input.length && !isNewLine(ch)) {
    ch = this.input.charCodeAt(++this.pos);
  }
  if (this.options.onComment) {
    this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos, startLoc, this.curPosition());
  }
};
pp$9.skipSpace = function() {
  loop:
    while (this.pos < this.input.length) {
      var ch = this.input.charCodeAt(this.pos);
      switch (ch) {
        case 32:
        case 160:
          ++this.pos;
          break;
        case 13:
          if (this.input.charCodeAt(this.pos + 1) === 10) {
            ++this.pos;
          }
        case 10:
        case 8232:
        case 8233:
          ++this.pos;
          if (this.options.locations) {
            ++this.curLine;
            this.lineStart = this.pos;
          }
          break;
        case 47:
          switch (this.input.charCodeAt(this.pos + 1)) {
            case 42:
              this.skipBlockComment();
              break;
            case 47:
              this.skipLineComment(2);
              break;
            default:
              break loop;
          }
          break;
        default:
          if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
            ++this.pos;
          } else {
            break loop;
          }
      }
    }
};
pp$9.finishToken = function(type, val) {
  this.end = this.pos;
  if (this.options.locations) {
    this.endLoc = this.curPosition();
  }
  var prevType = this.type;
  this.type = type;
  this.value = val;
  this.updateContext(prevType);
};
pp$9.readToken_dot = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next >= 48 && next <= 57) {
    return this.readNumber(true);
  }
  var next2 = this.input.charCodeAt(this.pos + 2);
  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
    this.pos += 3;
    return this.finishToken(types.ellipsis);
  } else {
    ++this.pos;
    return this.finishToken(types.dot);
  }
};
pp$9.readToken_slash = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (this.exprAllowed) {
    ++this.pos;
    return this.readRegexp();
  }
  if (next === 61) {
    return this.finishOp(types.assign, 2);
  }
  return this.finishOp(types.slash, 1);
};
pp$9.readToken_mult_modulo_exp = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  var tokentype = code === 42 ? types.star : types.modulo;
  if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
    ++size;
    tokentype = types.starstar;
    next = this.input.charCodeAt(this.pos + 2);
  }
  if (next === 61) {
    return this.finishOp(types.assign, size + 1);
  }
  return this.finishOp(tokentype, size);
};
pp$9.readToken_pipe_amp = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (this.options.ecmaVersion >= 12) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 === 61) {
        return this.finishOp(types.assign, 3);
      }
    }
    return this.finishOp(code === 124 ? types.logicalOR : types.logicalAND, 2);
  }
  if (next === 61) {
    return this.finishOp(types.assign, 2);
  }
  return this.finishOp(code === 124 ? types.bitwiseOR : types.bitwiseAND, 1);
};
pp$9.readToken_caret = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) {
    return this.finishOp(types.assign, 2);
  }
  return this.finishOp(types.bitwiseXOR, 1);
};
pp$9.readToken_plus_min = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 && (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
      this.skipLineComment(3);
      this.skipSpace();
      return this.nextToken();
    }
    return this.finishOp(types.incDec, 2);
  }
  if (next === 61) {
    return this.finishOp(types.assign, 2);
  }
  return this.finishOp(types.plusMin, 1);
};
pp$9.readToken_lt_gt = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  if (next === code) {
    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
    if (this.input.charCodeAt(this.pos + size) === 61) {
      return this.finishOp(types.assign, size + 1);
    }
    return this.finishOp(types.bitShift, size);
  }
  if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 && this.input.charCodeAt(this.pos + 3) === 45) {
    this.skipLineComment(4);
    this.skipSpace();
    return this.nextToken();
  }
  if (next === 61) {
    size = 2;
  }
  return this.finishOp(types.relational, size);
};
pp$9.readToken_eq_excl = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) {
    return this.finishOp(types.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
  }
  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
    this.pos += 2;
    return this.finishToken(types.arrow);
  }
  return this.finishOp(code === 61 ? types.eq : types.prefix, 1);
};
pp$9.readToken_question = function() {
  var ecmaVersion = this.options.ecmaVersion;
  if (ecmaVersion >= 11) {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 46) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 < 48 || next2 > 57) {
        return this.finishOp(types.questionDot, 2);
      }
    }
    if (next === 63) {
      if (ecmaVersion >= 12) {
        var next2$1 = this.input.charCodeAt(this.pos + 2);
        if (next2$1 === 61) {
          return this.finishOp(types.assign, 3);
        }
      }
      return this.finishOp(types.coalesce, 2);
    }
  }
  return this.finishOp(types.question, 1);
};
pp$9.getTokenFromCode = function(code) {
  switch (code) {
    case 46:
      return this.readToken_dot();
    case 40:
      ++this.pos;
      return this.finishToken(types.parenL);
    case 41:
      ++this.pos;
      return this.finishToken(types.parenR);
    case 59:
      ++this.pos;
      return this.finishToken(types.semi);
    case 44:
      ++this.pos;
      return this.finishToken(types.comma);
    case 91:
      ++this.pos;
      return this.finishToken(types.bracketL);
    case 93:
      ++this.pos;
      return this.finishToken(types.bracketR);
    case 123:
      ++this.pos;
      return this.finishToken(types.braceL);
    case 125:
      ++this.pos;
      return this.finishToken(types.braceR);
    case 58:
      ++this.pos;
      return this.finishToken(types.colon);
    case 96:
      if (this.options.ecmaVersion < 6) {
        break;
      }
      ++this.pos;
      return this.finishToken(types.backQuote);
    case 48:
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 120 || next === 88) {
        return this.readRadixNumber(16);
      }
      if (this.options.ecmaVersion >= 6) {
        if (next === 111 || next === 79) {
          return this.readRadixNumber(8);
        }
        if (next === 98 || next === 66) {
          return this.readRadixNumber(2);
        }
      }
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57:
      return this.readNumber(false);
    case 34:
    case 39:
      return this.readString(code);
    case 47:
      return this.readToken_slash();
    case 37:
    case 42:
      return this.readToken_mult_modulo_exp(code);
    case 124:
    case 38:
      return this.readToken_pipe_amp(code);
    case 94:
      return this.readToken_caret();
    case 43:
    case 45:
      return this.readToken_plus_min(code);
    case 60:
    case 62:
      return this.readToken_lt_gt(code);
    case 61:
    case 33:
      return this.readToken_eq_excl(code);
    case 63:
      return this.readToken_question();
    case 126:
      return this.finishOp(types.prefix, 1);
  }
  this.raise(this.pos, "Unexpected character '" + codePointToString$1(code) + "'");
};
pp$9.finishOp = function(type, size) {
  var str = this.input.slice(this.pos, this.pos + size);
  this.pos += size;
  return this.finishToken(type, str);
};
pp$9.readRegexp = function() {
  var escaped, inClass, start = this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(start, "Unterminated regular expression");
    }
    var ch = this.input.charAt(this.pos);
    if (lineBreak.test(ch)) {
      this.raise(start, "Unterminated regular expression");
    }
    if (!escaped) {
      if (ch === "[") {
        inClass = true;
      } else if (ch === "]" && inClass) {
        inClass = false;
      } else if (ch === "/" && !inClass) {
        break;
      }
      escaped = ch === "\\";
    } else {
      escaped = false;
    }
    ++this.pos;
  }
  var pattern = this.input.slice(start, this.pos);
  ++this.pos;
  var flagsStart = this.pos;
  var flags = this.readWord1();
  if (this.containsEsc) {
    this.unexpected(flagsStart);
  }
  var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
  state.reset(start, pattern, flags);
  this.validateRegExpFlags(state);
  this.validateRegExpPattern(state);
  var value = null;
  try {
    value = new RegExp(pattern, flags);
  } catch (e2) {
  }
  return this.finishToken(types.regexp, { pattern, flags, value });
};
pp$9.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
  var allowSeparators = this.options.ecmaVersion >= 12 && len === void 0;
  var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;
  var start = this.pos, total = 0, lastCode = 0;
  for (var i2 = 0, e2 = len == null ? Infinity : len; i2 < e2; ++i2, ++this.pos) {
    var code = this.input.charCodeAt(this.pos), val = void 0;
    if (allowSeparators && code === 95) {
      if (isLegacyOctalNumericLiteral) {
        this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals");
      }
      if (lastCode === 95) {
        this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore");
      }
      if (i2 === 0) {
        this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits");
      }
      lastCode = code;
      continue;
    }
    if (code >= 97) {
      val = code - 97 + 10;
    } else if (code >= 65) {
      val = code - 65 + 10;
    } else if (code >= 48 && code <= 57) {
      val = code - 48;
    } else {
      val = Infinity;
    }
    if (val >= radix) {
      break;
    }
    lastCode = code;
    total = total * radix + val;
  }
  if (allowSeparators && lastCode === 95) {
    this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits");
  }
  if (this.pos === start || len != null && this.pos - start !== len) {
    return null;
  }
  return total;
};
function stringToNumber(str, isLegacyOctalNumericLiteral) {
  if (isLegacyOctalNumericLiteral) {
    return parseInt(str, 8);
  }
  return parseFloat(str.replace(/_/g, ""));
}
function stringToBigInt(str) {
  if (typeof BigInt !== "function") {
    return null;
  }
  return BigInt(str.replace(/_/g, ""));
}
pp$9.readRadixNumber = function(radix) {
  var start = this.pos;
  this.pos += 2;
  var val = this.readInt(radix);
  if (val == null) {
    this.raise(this.start + 2, "Expected number in radix " + radix);
  }
  if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
    val = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
  } else if (isIdentifierStart(this.fullCharCodeAtPos())) {
    this.raise(this.pos, "Identifier directly after number");
  }
  return this.finishToken(types.num, val);
};
pp$9.readNumber = function(startsWithDot) {
  var start = this.pos;
  if (!startsWithDot && this.readInt(10, void 0, true) === null) {
    this.raise(start, "Invalid number");
  }
  var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
  if (octal && this.strict) {
    this.raise(start, "Invalid number");
  }
  var next = this.input.charCodeAt(this.pos);
  if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
    var val$1 = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
    if (isIdentifierStart(this.fullCharCodeAtPos())) {
      this.raise(this.pos, "Identifier directly after number");
    }
    return this.finishToken(types.num, val$1);
  }
  if (octal && /[89]/.test(this.input.slice(start, this.pos))) {
    octal = false;
  }
  if (next === 46 && !octal) {
    ++this.pos;
    this.readInt(10);
    next = this.input.charCodeAt(this.pos);
  }
  if ((next === 69 || next === 101) && !octal) {
    next = this.input.charCodeAt(++this.pos);
    if (next === 43 || next === 45) {
      ++this.pos;
    }
    if (this.readInt(10) === null) {
      this.raise(start, "Invalid number");
    }
  }
  if (isIdentifierStart(this.fullCharCodeAtPos())) {
    this.raise(this.pos, "Identifier directly after number");
  }
  var val = stringToNumber(this.input.slice(start, this.pos), octal);
  return this.finishToken(types.num, val);
};
pp$9.readCodePoint = function() {
  var ch = this.input.charCodeAt(this.pos), code;
  if (ch === 123) {
    if (this.options.ecmaVersion < 6) {
      this.unexpected();
    }
    var codePos = ++this.pos;
    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
    ++this.pos;
    if (code > 1114111) {
      this.invalidStringToken(codePos, "Code point out of bounds");
    }
  } else {
    code = this.readHexChar(4);
  }
  return code;
};
function codePointToString$1(code) {
  if (code <= 65535) {
    return String.fromCharCode(code);
  }
  code -= 65536;
  return String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
}
pp$9.readString = function(quote) {
  var out = "", chunkStart = ++this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(this.start, "Unterminated string constant");
    }
    var ch = this.input.charCodeAt(this.pos);
    if (ch === quote) {
      break;
    }
    if (ch === 92) {
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar(false);
      chunkStart = this.pos;
    } else {
      if (isNewLine(ch, this.options.ecmaVersion >= 10)) {
        this.raise(this.start, "Unterminated string constant");
      }
      ++this.pos;
    }
  }
  out += this.input.slice(chunkStart, this.pos++);
  return this.finishToken(types.string, out);
};
var INVALID_TEMPLATE_ESCAPE_ERROR = {};
pp$9.tryReadTemplateToken = function() {
  this.inTemplateElement = true;
  try {
    this.readTmplToken();
  } catch (err) {
    if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {
      this.readInvalidTemplateToken();
    } else {
      throw err;
    }
  }
  this.inTemplateElement = false;
};
pp$9.invalidStringToken = function(position, message) {
  if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
    throw INVALID_TEMPLATE_ESCAPE_ERROR;
  } else {
    this.raise(position, message);
  }
};
pp$9.readTmplToken = function() {
  var out = "", chunkStart = this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(this.start, "Unterminated template");
    }
    var ch = this.input.charCodeAt(this.pos);
    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
      if (this.pos === this.start && (this.type === types.template || this.type === types.invalidTemplate)) {
        if (ch === 36) {
          this.pos += 2;
          return this.finishToken(types.dollarBraceL);
        } else {
          ++this.pos;
          return this.finishToken(types.backQuote);
        }
      }
      out += this.input.slice(chunkStart, this.pos);
      return this.finishToken(types.template, out);
    }
    if (ch === 92) {
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar(true);
      chunkStart = this.pos;
    } else if (isNewLine(ch)) {
      out += this.input.slice(chunkStart, this.pos);
      ++this.pos;
      switch (ch) {
        case 13:
          if (this.input.charCodeAt(this.pos) === 10) {
            ++this.pos;
          }
        case 10:
          out += "\n";
          break;
        default:
          out += String.fromCharCode(ch);
          break;
      }
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
      chunkStart = this.pos;
    } else {
      ++this.pos;
    }
  }
};
pp$9.readInvalidTemplateToken = function() {
  for (; this.pos < this.input.length; this.pos++) {
    switch (this.input[this.pos]) {
      case "\\":
        ++this.pos;
        break;
      case "$":
        if (this.input[this.pos + 1] !== "{") {
          break;
        }
      case "`":
        return this.finishToken(types.invalidTemplate, this.input.slice(this.start, this.pos));
    }
  }
  this.raise(this.start, "Unterminated template");
};
pp$9.readEscapedChar = function(inTemplate) {
  var ch = this.input.charCodeAt(++this.pos);
  ++this.pos;
  switch (ch) {
    case 110:
      return "\n";
    case 114:
      return "\r";
    case 120:
      return String.fromCharCode(this.readHexChar(2));
    case 117:
      return codePointToString$1(this.readCodePoint());
    case 116:
      return "	";
    case 98:
      return "\b";
    case 118:
      return "\v";
    case 102:
      return "\f";
    case 13:
      if (this.input.charCodeAt(this.pos) === 10) {
        ++this.pos;
      }
    case 10:
      if (this.options.locations) {
        this.lineStart = this.pos;
        ++this.curLine;
      }
      return "";
    case 56:
    case 57:
      if (inTemplate) {
        var codePos = this.pos - 1;
        this.invalidStringToken(codePos, "Invalid escape sequence in template string");
        return null;
      }
    default:
      if (ch >= 48 && ch <= 55) {
        var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
        var octal = parseInt(octalStr, 8);
        if (octal > 255) {
          octalStr = octalStr.slice(0, -1);
          octal = parseInt(octalStr, 8);
        }
        this.pos += octalStr.length - 1;
        ch = this.input.charCodeAt(this.pos);
        if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
          this.invalidStringToken(this.pos - 1 - octalStr.length, inTemplate ? "Octal literal in template string" : "Octal literal in strict mode");
        }
        return String.fromCharCode(octal);
      }
      if (isNewLine(ch)) {
        return "";
      }
      return String.fromCharCode(ch);
  }
};
pp$9.readHexChar = function(len) {
  var codePos = this.pos;
  var n2 = this.readInt(16, len);
  if (n2 === null) {
    this.invalidStringToken(codePos, "Bad character escape sequence");
  }
  return n2;
};
pp$9.readWord1 = function() {
  this.containsEsc = false;
  var word = "", first2 = true, chunkStart = this.pos;
  var astral = this.options.ecmaVersion >= 6;
  while (this.pos < this.input.length) {
    var ch = this.fullCharCodeAtPos();
    if (isIdentifierChar(ch, astral)) {
      this.pos += ch <= 65535 ? 1 : 2;
    } else if (ch === 92) {
      this.containsEsc = true;
      word += this.input.slice(chunkStart, this.pos);
      var escStart = this.pos;
      if (this.input.charCodeAt(++this.pos) !== 117) {
        this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX");
      }
      ++this.pos;
      var esc = this.readCodePoint();
      if (!(first2 ? isIdentifierStart : isIdentifierChar)(esc, astral)) {
        this.invalidStringToken(escStart, "Invalid Unicode escape");
      }
      word += codePointToString$1(esc);
      chunkStart = this.pos;
    } else {
      break;
    }
    first2 = false;
  }
  return word + this.input.slice(chunkStart, this.pos);
};
pp$9.readWord = function() {
  var word = this.readWord1();
  var type = types.name;
  if (this.keywords.test(word)) {
    type = keywords$1[word];
  }
  return this.finishToken(type, word);
};
var version = "7.4.1";
Parser.acorn = {
  Parser,
  version,
  defaultOptions,
  Position,
  SourceLocation,
  getLineInfo,
  Node: Node2,
  TokenType,
  tokTypes: types,
  keywordTypes: keywords$1,
  TokContext,
  tokContexts: types$1,
  isIdentifierChar,
  isIdentifierStart,
  Token,
  isNewLine,
  lineBreak,
  lineBreakG,
  nonASCIIwhitespace
};

// deno-cache:https://cdn.skypack.dev/-/acorn-walk@v7.2.0-HE7wS37ePcNncqJvsD8k/dist=es2019,mode=imports/optimized/acorn-walk.js
function simple(node, visitors, baseVisitor, state, override) {
  if (!baseVisitor) {
    baseVisitor = base;
  }
  (function c2(node2, st, override2) {
    var type = override2 || node2.type, found = visitors[type];
    baseVisitor[type](node2, st, c2);
    if (found) {
      found(node2, st);
    }
  })(node, state, override);
}
function ancestor(node, visitors, baseVisitor, state, override) {
  var ancestors = [];
  if (!baseVisitor) {
    baseVisitor = base;
  }
  (function c2(node2, st, override2) {
    var type = override2 || node2.type, found = visitors[type];
    var isNew = node2 !== ancestors[ancestors.length - 1];
    if (isNew) {
      ancestors.push(node2);
    }
    baseVisitor[type](node2, st, c2);
    if (found) {
      found(node2, st || ancestors, ancestors);
    }
    if (isNew) {
      ancestors.pop();
    }
  })(node, state, override);
}
var create = Object.create || function(proto) {
  function Ctor() {
  }
  Ctor.prototype = proto;
  return new Ctor();
};
function make(funcs, baseVisitor) {
  var visitor = create(baseVisitor || base);
  for (var type in funcs) {
    visitor[type] = funcs[type];
  }
  return visitor;
}
function skipThrough(node, st, c2) {
  c2(node, st);
}
function ignore(_node, _st, _c) {
}
var base = {};
base.Program = base.BlockStatement = function(node, st, c2) {
  for (var i2 = 0, list = node.body; i2 < list.length; i2 += 1) {
    var stmt = list[i2];
    c2(stmt, st, "Statement");
  }
};
base.Statement = skipThrough;
base.EmptyStatement = ignore;
base.ExpressionStatement = base.ParenthesizedExpression = base.ChainExpression = function(node, st, c2) {
  return c2(node.expression, st, "Expression");
};
base.IfStatement = function(node, st, c2) {
  c2(node.test, st, "Expression");
  c2(node.consequent, st, "Statement");
  if (node.alternate) {
    c2(node.alternate, st, "Statement");
  }
};
base.LabeledStatement = function(node, st, c2) {
  return c2(node.body, st, "Statement");
};
base.BreakStatement = base.ContinueStatement = ignore;
base.WithStatement = function(node, st, c2) {
  c2(node.object, st, "Expression");
  c2(node.body, st, "Statement");
};
base.SwitchStatement = function(node, st, c2) {
  c2(node.discriminant, st, "Expression");
  for (var i$1 = 0, list$1 = node.cases; i$1 < list$1.length; i$1 += 1) {
    var cs = list$1[i$1];
    if (cs.test) {
      c2(cs.test, st, "Expression");
    }
    for (var i2 = 0, list = cs.consequent; i2 < list.length; i2 += 1) {
      var cons = list[i2];
      c2(cons, st, "Statement");
    }
  }
};
base.SwitchCase = function(node, st, c2) {
  if (node.test) {
    c2(node.test, st, "Expression");
  }
  for (var i2 = 0, list = node.consequent; i2 < list.length; i2 += 1) {
    var cons = list[i2];
    c2(cons, st, "Statement");
  }
};
base.ReturnStatement = base.YieldExpression = base.AwaitExpression = function(node, st, c2) {
  if (node.argument) {
    c2(node.argument, st, "Expression");
  }
};
base.ThrowStatement = base.SpreadElement = function(node, st, c2) {
  return c2(node.argument, st, "Expression");
};
base.TryStatement = function(node, st, c2) {
  c2(node.block, st, "Statement");
  if (node.handler) {
    c2(node.handler, st);
  }
  if (node.finalizer) {
    c2(node.finalizer, st, "Statement");
  }
};
base.CatchClause = function(node, st, c2) {
  if (node.param) {
    c2(node.param, st, "Pattern");
  }
  c2(node.body, st, "Statement");
};
base.WhileStatement = base.DoWhileStatement = function(node, st, c2) {
  c2(node.test, st, "Expression");
  c2(node.body, st, "Statement");
};
base.ForStatement = function(node, st, c2) {
  if (node.init) {
    c2(node.init, st, "ForInit");
  }
  if (node.test) {
    c2(node.test, st, "Expression");
  }
  if (node.update) {
    c2(node.update, st, "Expression");
  }
  c2(node.body, st, "Statement");
};
base.ForInStatement = base.ForOfStatement = function(node, st, c2) {
  c2(node.left, st, "ForInit");
  c2(node.right, st, "Expression");
  c2(node.body, st, "Statement");
};
base.ForInit = function(node, st, c2) {
  if (node.type === "VariableDeclaration") {
    c2(node, st);
  } else {
    c2(node, st, "Expression");
  }
};
base.DebuggerStatement = ignore;
base.FunctionDeclaration = function(node, st, c2) {
  return c2(node, st, "Function");
};
base.VariableDeclaration = function(node, st, c2) {
  for (var i2 = 0, list = node.declarations; i2 < list.length; i2 += 1) {
    var decl = list[i2];
    c2(decl, st);
  }
};
base.VariableDeclarator = function(node, st, c2) {
  c2(node.id, st, "Pattern");
  if (node.init) {
    c2(node.init, st, "Expression");
  }
};
base.Function = function(node, st, c2) {
  if (node.id) {
    c2(node.id, st, "Pattern");
  }
  for (var i2 = 0, list = node.params; i2 < list.length; i2 += 1) {
    var param = list[i2];
    c2(param, st, "Pattern");
  }
  c2(node.body, st, node.expression ? "Expression" : "Statement");
};
base.Pattern = function(node, st, c2) {
  if (node.type === "Identifier") {
    c2(node, st, "VariablePattern");
  } else if (node.type === "MemberExpression") {
    c2(node, st, "MemberPattern");
  } else {
    c2(node, st);
  }
};
base.VariablePattern = ignore;
base.MemberPattern = skipThrough;
base.RestElement = function(node, st, c2) {
  return c2(node.argument, st, "Pattern");
};
base.ArrayPattern = function(node, st, c2) {
  for (var i2 = 0, list = node.elements; i2 < list.length; i2 += 1) {
    var elt = list[i2];
    if (elt) {
      c2(elt, st, "Pattern");
    }
  }
};
base.ObjectPattern = function(node, st, c2) {
  for (var i2 = 0, list = node.properties; i2 < list.length; i2 += 1) {
    var prop = list[i2];
    if (prop.type === "Property") {
      if (prop.computed) {
        c2(prop.key, st, "Expression");
      }
      c2(prop.value, st, "Pattern");
    } else if (prop.type === "RestElement") {
      c2(prop.argument, st, "Pattern");
    }
  }
};
base.Expression = skipThrough;
base.ThisExpression = base.Super = base.MetaProperty = ignore;
base.ArrayExpression = function(node, st, c2) {
  for (var i2 = 0, list = node.elements; i2 < list.length; i2 += 1) {
    var elt = list[i2];
    if (elt) {
      c2(elt, st, "Expression");
    }
  }
};
base.ObjectExpression = function(node, st, c2) {
  for (var i2 = 0, list = node.properties; i2 < list.length; i2 += 1) {
    var prop = list[i2];
    c2(prop, st);
  }
};
base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
base.SequenceExpression = function(node, st, c2) {
  for (var i2 = 0, list = node.expressions; i2 < list.length; i2 += 1) {
    var expr = list[i2];
    c2(expr, st, "Expression");
  }
};
base.TemplateLiteral = function(node, st, c2) {
  for (var i2 = 0, list = node.quasis; i2 < list.length; i2 += 1) {
    var quasi = list[i2];
    c2(quasi, st);
  }
  for (var i$1 = 0, list$1 = node.expressions; i$1 < list$1.length; i$1 += 1) {
    var expr = list$1[i$1];
    c2(expr, st, "Expression");
  }
};
base.TemplateElement = ignore;
base.UnaryExpression = base.UpdateExpression = function(node, st, c2) {
  c2(node.argument, st, "Expression");
};
base.BinaryExpression = base.LogicalExpression = function(node, st, c2) {
  c2(node.left, st, "Expression");
  c2(node.right, st, "Expression");
};
base.AssignmentExpression = base.AssignmentPattern = function(node, st, c2) {
  c2(node.left, st, "Pattern");
  c2(node.right, st, "Expression");
};
base.ConditionalExpression = function(node, st, c2) {
  c2(node.test, st, "Expression");
  c2(node.consequent, st, "Expression");
  c2(node.alternate, st, "Expression");
};
base.NewExpression = base.CallExpression = function(node, st, c2) {
  c2(node.callee, st, "Expression");
  if (node.arguments) {
    for (var i2 = 0, list = node.arguments; i2 < list.length; i2 += 1) {
      var arg = list[i2];
      c2(arg, st, "Expression");
    }
  }
};
base.MemberExpression = function(node, st, c2) {
  c2(node.object, st, "Expression");
  if (node.computed) {
    c2(node.property, st, "Expression");
  }
};
base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function(node, st, c2) {
  if (node.declaration) {
    c2(node.declaration, st, node.type === "ExportNamedDeclaration" || node.declaration.id ? "Statement" : "Expression");
  }
  if (node.source) {
    c2(node.source, st, "Expression");
  }
};
base.ExportAllDeclaration = function(node, st, c2) {
  if (node.exported) {
    c2(node.exported, st);
  }
  c2(node.source, st, "Expression");
};
base.ImportDeclaration = function(node, st, c2) {
  for (var i2 = 0, list = node.specifiers; i2 < list.length; i2 += 1) {
    var spec = list[i2];
    c2(spec, st);
  }
  c2(node.source, st, "Expression");
};
base.ImportExpression = function(node, st, c2) {
  c2(node.source, st, "Expression");
};
base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.Literal = ignore;
base.TaggedTemplateExpression = function(node, st, c2) {
  c2(node.tag, st, "Expression");
  c2(node.quasi, st, "Expression");
};
base.ClassDeclaration = base.ClassExpression = function(node, st, c2) {
  return c2(node, st, "Class");
};
base.Class = function(node, st, c2) {
  if (node.id) {
    c2(node.id, st, "Pattern");
  }
  if (node.superClass) {
    c2(node.superClass, st, "Expression");
  }
  c2(node.body, st);
};
base.ClassBody = function(node, st, c2) {
  for (var i2 = 0, list = node.body; i2 < list.length; i2 += 1) {
    var elt = list[i2];
    c2(elt, st);
  }
};
base.MethodDefinition = base.Property = function(node, st, c2) {
  if (node.computed) {
    c2(node.key, st, "Expression");
  }
  c2(node.value, st, "Expression");
};

// ../src/resources/formats/html/ojs/observablehq-parser.js
var globals_default = new Set([
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
var walk_default = make({
  Import() {
  },
  ViewExpression(node, st, c2) {
    c2(node.id, st, "Identifier");
  },
  MutableExpression(node, st, c2) {
    c2(node.id, st, "Identifier");
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
  const ast = { type: "Program", body: [cell.body] };
  const locals = new Map();
  const globalSet = new Set(globals);
  const references = [];
  function hasLocal(node, name) {
    const l2 = locals.get(node);
    return l2 ? l2.has(name) : false;
  }
  function declareLocal(node, id) {
    const l2 = locals.get(node);
    if (l2)
      l2.add(id.name);
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
      for (let i2 = parents.length - 1; i2 >= 0 && parent === null; --i2) {
        if (node.kind === "var" ? isScope(parents[i2]) : isBlockScope(parents[i2])) {
          parent = parents[i2];
        }
      }
      node.declarations.forEach((declaration) => declarePattern(declaration.id, parent));
    },
    FunctionDeclaration: (node, parents) => {
      let parent = null;
      for (let i2 = parents.length - 2; i2 >= 0 && parent === null; --i2) {
        if (isScope(parents[i2])) {
          parent = parents[i2];
        }
      }
      declareLocal(parent, node.id);
      declareFunction(node);
    },
    Function: declareFunction,
    ClassDeclaration: (node, parents) => {
      let parent = null;
      for (let i2 = parents.length - 2; i2 >= 0 && parent === null; i2--) {
        if (isScope(parents[i2])) {
          parent = parents[i2];
        }
      }
      declareLocal(parent, node.id);
    },
    Class: declareClass,
    CatchClause: declareCatchClause,
    ImportDefaultSpecifier: declareModuleSpecifier,
    ImportSpecifier: declareModuleSpecifier,
    ImportNamespaceSpecifier: declareModuleSpecifier
  }, walk_default);
  function identifier(node, parents) {
    let name = node.name;
    if (name === "undefined")
      return;
    for (let i2 = parents.length - 2; i2 >= 0; --i2) {
      if (name === "arguments") {
        if (declaresArguments(parents[i2])) {
          return;
        }
      }
      if (hasLocal(parents[i2], name)) {
        return;
      }
      if (parents[i2].type === "ViewExpression") {
        node = parents[i2];
        name = `viewof ${node.id.name}`;
      }
      if (parents[i2].type === "MutableExpression") {
        node = parents[i2];
        name = `mutable ${node.id.name}`;
      }
    }
    if (!globalSet.has(name)) {
      if (name === "arguments") {
        throw Object.assign(new SyntaxError(`arguments is not allowed`), { node });
      }
      references.push(node);
    }
  }
  ancestor(ast, {
    VariablePattern: identifier,
    Identifier: identifier
  }, walk_default);
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
        throw Object.assign(new SyntaxError(`Assignment to constant variable ${node.name}`), { node });
      }
      case "ArrayPattern": {
        for (const element2 of node.elements) {
          checkConst(element2, parents);
        }
        return;
      }
      case "ObjectPattern": {
        for (const property2 of node.properties) {
          checkConst(property2, parents);
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
  }, walk_default);
  return references;
}
function findFeatures(cell, featureName) {
  const ast = { type: "Program", body: [cell.body] };
  const features = new Map();
  const { references } = cell;
  simple(ast, {
    CallExpression: (node) => {
      const { callee, arguments: args } = node;
      if (callee.type !== "Identifier" || callee.name !== featureName || references.indexOf(callee) < 0)
        return;
      if (args.length !== 1 || !(args[0].type === "Literal" && /^['"]/.test(args[0].raw) || args[0].type === "TemplateLiteral" && args[0].expressions.length === 0)) {
        throw Object.assign(new SyntaxError(`${featureName} requires a single literal string argument`), { node });
      }
      const [arg] = args;
      const name = arg.type === "Literal" ? arg.value : arg.quasis[0].value.cooked;
      const location2 = { start: arg.start, end: arg.end };
      if (features.has(name))
        features.get(name).push(location2);
      else
        features.set(name, [location2]);
    }
  }, walk_default);
  return features;
}
var SCOPE_FUNCTION2 = 2;
var SCOPE_ASYNC2 = 4;
var SCOPE_GENERATOR2 = 8;
var STATE_START = Symbol("start");
var STATE_MODIFIER = Symbol("modifier");
var STATE_FUNCTION = Symbol("function");
var STATE_NAME = Symbol("name");
var CellParser = class extends Parser {
  constructor(options, ...args) {
    super(Object.assign({ ecmaVersion: 12 }, options), ...args);
  }
  enterScope(flags) {
    if (flags & SCOPE_FUNCTION2)
      ++this.O_function;
    return super.enterScope(flags);
  }
  exitScope() {
    if (this.currentScope().flags & SCOPE_FUNCTION2)
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
    if (this.type === types._with) {
      this.next();
      node.injections = this.parseImportSpecifiers();
    }
    this.expectContextual("from");
    node.source = this.type === types.string ? this.parseExprAtom() : this.unexpected();
    return this.finishNode(node, "ImportDeclaration");
  }
  parseImportSpecifiers() {
    const nodes = [];
    const identifiers = new Set();
    let first2 = true;
    this.expect(types.braceL);
    while (!this.eat(types.braceR)) {
      if (first2) {
        first2 = false;
      } else {
        this.expect(types.comma);
        if (this.afterTrailingComma(types.braceR))
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
    this.enterScope(SCOPE_FUNCTION2 | SCOPE_ASYNC2 | SCOPE_GENERATOR2);
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
    const lookahead2 = new CellParser({}, this.input, this.start);
    let token = lookahead2.getToken();
    let body = null;
    let id = null;
    this.startCell();
    if (token.type === types._import && lookahead2.getToken().type !== types.parenL) {
      body = this.parseImport(this.startNode());
    } else if (token.type !== types.eof && token.type !== types.semi) {
      if (token.type === types.name) {
        if (token.value === "viewof" || token.value === "mutable") {
          token = lookahead2.getToken();
          if (token.type !== types.name) {
            lookahead2.unexpected();
          }
        }
        token = lookahead2.getToken();
        if (token.type === types.eq) {
          id = this.parseMaybeKeywordExpression("viewof", "ViewExpression") || this.parseMaybeKeywordExpression("mutable", "MutableExpression") || this.parseIdent();
          token = lookahead2.getToken();
          this.expect(types.eq);
        }
      }
      if (token.type === types.braceL) {
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
      this.expect(types.eof);
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
    if (globals_default.has(node.name) || node.name === "arguments") {
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
    this.raise(pos != null ? pos : this.start, this.type === types.eof ? "Unexpected end of input" : "Unexpected token");
  }
  parseMaybeKeywordExpression(keyword, type) {
    if (this.isContextual(keyword)) {
      const node = this.startNode();
      this.next();
      node.id = this.parseIdent();
      return this.finishNode(node, type);
    }
  }
};
var o_tmpl = new TokContext("`", true, true, (parser2) => readTemplateToken.call(parser2));
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
            if (this.pos === this.start && this.type === types.invalidTemplate) {
              this.pos += 2;
              return this.finishToken(types.dollarBraceL);
            }
            break out;
          }
          break;
        }
      }
    }
  return this.finishToken(types.invalidTemplate, this.input.slice(this.start, this.pos));
}
function parseModule(input2, { globals } = {}) {
  const program = ModuleParser.parse(input2);
  for (const cell of program.cells) {
    parseReferences(cell, input2, globals);
    parseFeatures(cell, input2, globals);
  }
  return program;
}
var ModuleParser = class extends CellParser {
  parseTopLevel(node) {
    if (!node.cells)
      node.cells = [];
    while (this.type !== types.eof) {
      const cell = this.parseCell(this.startNode());
      cell.input = this.input;
      node.cells.push(cell);
    }
    this.next();
    return this.finishNode(node, "Program");
  }
};
function parseReferences(cell, input2, globals = globals_default) {
  if (!cell.body) {
    cell.references = [];
  } else if (cell.body.type === "ImportDeclaration") {
    cell.references = cell.body.injections ? cell.body.injections.map((i2) => i2.imported) : [];
  } else {
    try {
      cell.references = findReferences(cell, globals);
    } catch (error) {
      if (error.node) {
        const loc = getLineInfo(input2, error.node.start);
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
function parseFeatures(cell, input2) {
  if (cell.body && cell.body.type !== "ImportDeclaration") {
    try {
      cell.fileAttachments = findFeatures(cell, "FileAttachment");
      cell.databaseClients = findFeatures(cell, "DatabaseClient");
      cell.secrets = findFeatures(cell, "Secret");
    } catch (error) {
      if (error.node) {
        const loc = getLineInfo(input2, error.node.start);
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

// ../src/resources/formats/html/ojs/ojs-connector.js
var EmptyInspector = class {
  pending() {
  }
  fulfilled(_value, _name) {
  }
  rejected(_error, _name) {
  }
};
function es6ImportAsObservableModule(m2) {
  return function(runtime, observer) {
    const main2 = runtime.module();
    Object.keys(m2).forEach((key) => {
      const v2 = m2[key];
      main2.variable(observer(key)).define(key, [], () => v2);
    });
    return main2;
  };
}
async function defaultResolveImportPath(path) {
  const extractPath = (path2) => {
    let source2 = path2;
    let m3;
    if (m3 = /\.js(\?|$)/i.exec(source2)) {
      source2 = source2.slice(0, m3.index);
    }
    if (m3 = /^[0-9a-f]{16}$/i.test(source2)) {
      source2 = `d/${source2}`;
    }
    if (m3 = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source2)) {
      source2 = source2.slice(m3[0].length);
    }
    return source2;
  };
  const source = extractPath(path);
  const metadataURL = `https://api.observablehq.com/document/${source}`;
  const moduleURL = `https://api.observablehq.com/${source}.js?v=3`;
  const m2 = await import(moduleURL);
  return m2.default;
}
function importPathResolver(paths, localResolverMap) {
  function importRootPath(path) {
    const { runtimeToRoot } = paths;
    if (!runtimeToRoot) {
      return path;
    } else {
      return `${runtimeToRoot}/${path}`;
    }
  }
  function importRelativePath(path) {
    const { runtimeToDoc } = paths;
    if (!runtimeToDoc) {
      return path;
    } else {
      return `${runtimeToDoc}/${path}`;
    }
  }
  function fetchRootPath(path) {
    const { docToRoot } = paths;
    if (!docToRoot) {
      return path;
    } else {
      return `${docToRoot}/${path}`;
    }
  }
  function fetchRelativePath(path) {
    return path;
  }
  return async (path) => {
    const isLocalModule = path.startsWith("/") || path.startsWith(".");
    const isImportFromObservableWebsite = path.match(/^https:\/\/(api\.|beta\.|)observablehq\.com\//i);
    if (!isLocalModule || isImportFromObservableWebsite) {
      return defaultResolveImportPath(path);
    }
    let importPath, fetchPath;
    let moduleType;
    if (window._ojs.selfContained) {
      const resolved = localResolverMap.get(path);
      if (resolved === void 0) {
        throw new Error(`missing local file ${path} in self-contained mode`);
      }
      importPath = resolved;
      fetchPath = resolved;
      const mimeType = resolved.match(/data:(.*);base64/)[1];
      switch (mimeType) {
        case "application/javascript":
          moduleType = "js";
          break;
        case "application/ojs-javascript":
          moduleType = "ojs";
          break;
        default:
          throw new Error(`unrecognized MIME type ${mimeType}`);
      }
    } else {
      const resourceURL = new URL(path, window.location);
      moduleType = resourceURL.pathname.match(/\.(ojs|js|qmd)$/)[1];
      if (path.startsWith("/")) {
        importPath = importRootPath(path);
        fetchPath = fetchRootPath(path);
      } else {
        importPath = importRelativePath(path);
        fetchPath = fetchRelativePath(path);
      }
    }
    if (moduleType === "js") {
      try {
        const m2 = await import(importPath);
        return es6ImportAsObservableModule(m2);
      } catch (e2) {
        console.error(e2);
        throw e2;
      }
    } else if (moduleType === "ojs") {
      return importOjsFromURL(fetchPath);
    } else if (moduleType === "qmd") {
      const htmlPath = `${fetchPath.slice(0, -4)}.html`;
      const response = await fetch(htmlPath);
      const text2 = await response.text();
      return createOjsModuleFromHTMLSrc(text2);
    } else {
      throw new Error(`internal error, unrecognized module type ${moduleType}`);
    }
  };
}
function createOjsModuleFromHTMLSrc(text2) {
  const parser2 = new DOMParser();
  const doc = parser2.parseFromString(text2, "text/html");
  const staticDefns = [];
  for (const el of doc.querySelectorAll('script[type="ojs-define"]')) {
    staticDefns.push(el.text);
  }
  const ojsSource = [];
  for (const content of doc.querySelectorAll('script[type="ojs-module-contents"]')) {
    for (const cell of JSON.parse(content.text).contents) {
      ojsSource.push(cell.source);
    }
  }
  return createOjsModuleFromSrc(ojsSource.join("\n"), staticDefns);
}
function createOjsModuleFromSrc(src, staticDefns = []) {
  return (runtime, _observer) => {
    const newModule = runtime.module();
    const interpreter = window._ojs.ojsConnector.interpreter;
    const _cells = interpreter.module(src, newModule, (_name) => new EmptyInspector());
    for (const defn of staticDefns) {
      for (const { name, value } of JSON.parse(defn).contents) {
        window._ojs.ojsConnector.define(name, newModule)(value);
      }
    }
    return newModule;
  };
}
async function importOjsFromURL(path) {
  const r2 = await fetch(path);
  const src = await r2.text();
  return createOjsModuleFromSrc(src);
}
var OJSConnector = class {
  constructor({ paths, inspectorClass, library: library2, allowPendingGlobals = false }) {
    this.library = library2 || new Oe();
    this.localResolverMap = new Map();
    this.pendingGlobals = {};
    this.allowPendingGlobals = allowPendingGlobals;
    this.runtime = new Runtime(this.library, (name) => this.global(name));
    this.mainModule = this.runtime.module();
    this.interpreter = new Interpreter({
      module: this.mainModule,
      resolveImportPath: importPathResolver(paths, this.localResolverMap)
    });
    this.inspectorClass = inspectorClass || Inspector;
    this.mainModuleHasImports = false;
    this.mainModuleOutstandingImportCount = 0;
    this.chunkPromises = [];
  }
  global(name) {
    if (typeof window[name] !== "undefined") {
      return window[name];
    }
    if (!this.allowPendingGlobals) {
      return void 0;
    }
    if (!this.pendingGlobals.hasOwnProperty(name)) {
      const info = {};
      info.promise = new Promise((resolve3, reject) => {
        info.resolve = resolve3;
        info.reject = reject;
      });
      this.pendingGlobals[name] = info;
    }
    return this.pendingGlobals[name].promise;
  }
  killPendingGlobals() {
    this.allowPendingGlobals = false;
    for (const [name, { reject }] of Object.entries(this.pendingGlobals)) {
      reject(new RuntimeError(`${name} is not defined`));
    }
  }
  setLocalResolver(map4) {
    for (const [key, value] of Object.entries(map4)) {
      this.localResolverMap.set(key, value);
    }
  }
  define(name, module = void 0) {
    if (!module) {
      module = this.mainModule;
    }
    let change;
    const obs = this.library.Generators.observe((change_) => {
      change = change_;
    });
    module.variable().define(name, obs);
    return change;
  }
  watch(name, k2, module = void 0) {
    if (!module) {
      module = this.mainModule;
    }
    module.variable({
      fulfilled: (x2) => k2(x2, name)
    }).define([name], (val) => val);
  }
  async value(val, module = void 0) {
    if (!module) {
      module = this.mainModule;
    }
    const result = await module.value(val);
    return result;
  }
  finishInterpreting() {
    return Promise.all(this.chunkPromises);
  }
  interpretWithRunner(src, runner) {
    try {
      const parse3 = parseModule(src);
      const chunkPromise = Promise.all(parse3.cells.map(runner));
      this.chunkPromises.push(chunkPromise);
      return chunkPromise;
    } catch (error) {
      return Promise.reject(error);
    }
  }
  waitOnImports(cell, promise) {
    if (cell.body.type !== "ImportDeclaration") {
      return promise;
    } else {
      this.mainModuleHasImports = true;
      this.mainModuleOutstandingImportCount++;
      return promise.then((result) => {
        this.mainModuleOutstandingImportCount--;
        if (this.mainModuleOutstandingImportCount === 0) {
          this.clearImportModuleWait();
        }
        return result;
      });
    }
  }
  interpretQuiet(src) {
    const runCell = (cell) => {
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(cellSrc, void 0, (_name) => new EmptyInspector());
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }
};

// ../src/resources/formats/html/ojs/quarto-ojs.js
var makeDevhostErrorClickHandler = (line, column) => {
  return function() {
    if (!window.quartoDevhost) {
      return false;
    }
    window.quartoDevhost.openInputFile(line, column, true);
    return false;
  };
};
if (Object.fromEntries === void 0) {
  Object.fromEntries = function(obj) {
    const result = {};
    for (const [key, value] of obj) {
      result[key] = value;
    }
    return result;
  };
}
function calloutBlock(opts) {
  const {
    type,
    heading,
    message,
    onclick
  } = opts;
  const outerBlock = document.createElement("div");
  outerBlock.classList.add(`callout-${type}`, "callout", "callout-style-default", "callout-captioned");
  const header = document.createElement("div");
  header.classList.add("callout-header", "d-flex", "align-content-center");
  const iconContainer = document.createElement("div");
  iconContainer.classList.add("callout-icon-container");
  const icon = document.createElement("i");
  icon.classList.add("callout-icon");
  iconContainer.appendChild(icon);
  header.appendChild(iconContainer);
  const headingDiv = document.createElement("div");
  headingDiv.classList.add("callout-caption-container", "flex-fill");
  if (typeof heading === "string") {
    headingDiv.innerText = heading;
  } else {
    headingDiv.appendChild(heading);
  }
  header.appendChild(headingDiv);
  outerBlock.appendChild(header);
  const container = document.createElement("div");
  container.classList.add("callout-body-container", "callout-body");
  if (typeof message === "string") {
    const p2 = document.createElement("p");
    p2.innerText = message;
    container.appendChild(p2);
  } else {
    container.append(message);
  }
  outerBlock.appendChild(container);
  if (onclick) {
    outerBlock.onclick = onclick;
    outerBlock.style.cursor = "pointer";
  }
  return outerBlock;
}
var kQuartoModuleWaitClass = "ojs-in-a-box-waiting-for-module-import";
var QuartoOJSConnector = class extends OJSConnector {
  constructor(opts) {
    super(opts);
  }
  clearImportModuleWait() {
    const array = Array.from(document.querySelectorAll(`.${kQuartoModuleWaitClass}`));
    for (const node of array) {
      node.classList.remove(kQuartoModuleWaitClass);
    }
  }
  finishInterpreting() {
    return super.finishInterpreting().then(() => {
      if (this.mainModuleHasImports) {
        this.clearImportModuleWait();
      }
    });
  }
  locatePreDiv(cellDiv, ojsDiv) {
    let preDiv;
    for (const candidate of cellDiv.querySelectorAll("pre.sourceCode")) {
      if (candidate.compareDocumentPosition(ojsDiv) & ojsDiv.DOCUMENT_POSITION_FOLLOWING) {
        preDiv = candidate;
      } else {
        break;
      }
    }
    return preDiv;
  }
  findCellOutputDisplay(ojsDiv) {
    while (ojsDiv && !ojsDiv.classList.contains("cell-output-display")) {
      ojsDiv = ojsDiv.parentElement;
    }
    if (!ojsDiv) {
      throw new Error("Internal error: couldn't find output display div");
    }
    return ojsDiv;
  }
  setPreDivClasses(preDiv, hasErrors) {
    if (!hasErrors) {
      preDiv.classList.remove("numberSource");
      if (preDiv._hidden === true) {
        preDiv.parentElement.classList.add("hidden");
      }
    } else {
      preDiv.classList.add("numberSource");
      if (preDiv.parentElement.classList.contains("hidden")) {
        preDiv._hidden = true;
        preDiv.parentElement.classList.remove("hidden");
      }
    }
  }
  clearErrorPinpoints(cellDiv, ojsDiv) {
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    if (preDiv === void 0) {
      return;
    }
    this.setPreDivClasses(preDiv, false);
    let startingOffset = 0;
    if (preDiv.parentElement.dataset.sourceOffset) {
      startingOffset = -Number(preDiv.parentElement.dataset.sourceOffset);
    }
    for (const entryPoint of preDiv._decorator.spanSelection(startingOffset, Infinity)) {
      const { node } = entryPoint;
      node.classList.remove("quarto-ojs-error-pinpoint");
      node.onclick = null;
    }
  }
  decorateOjsDivWithErrorPinpoint(ojsDiv, start, end, line, column) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    if (cellOutputDisplay._errorSpans === void 0) {
      cellOutputDisplay._errorSpans = [];
    }
    cellOutputDisplay._errorSpans.push({
      start,
      end,
      line,
      column
    });
  }
  decorateSource(cellDiv, ojsDiv) {
    this.clearErrorPinpoints(cellDiv, ojsDiv);
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    if (preDiv === void 0) {
      return;
    }
    let div = preDiv.parentElement.nextElementSibling;
    let foundErrors = false;
    while (div !== null && div.classList.contains("cell-output-display")) {
      for (const errorSpan of div._errorSpans || []) {
        for (const entryPoint of preDiv._decorator.spanSelection(errorSpan.start, errorSpan.end)) {
          const { node } = entryPoint;
          node.classList.add("quarto-ojs-error-pinpoint");
          node.onclick = makeDevhostErrorClickHandler(errorSpan.line, errorSpan.column);
        }
        foundErrors = true;
      }
      div = div.nextElementSibling;
    }
    this.setPreDivClasses(preDiv, foundErrors);
  }
  clearError(ojsDiv) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    cellOutputDisplay._errorSpans = [];
  }
  signalError(cellDiv, ojsDiv, ojsAst) {
    const buildCallout = (ojsDiv2) => {
      let onclick;
      const inspectChild = ojsDiv2.querySelector(".observablehq--inspect");
      let [heading, message] = inspectChild.textContent.split(": ");
      if (heading === "RuntimeError") {
        heading = "OJS Runtime Error";
        if (message.match(/^(.+) is not defined$/)) {
          const [varName, ...rest] = message.split(" ");
          const p2 = document.createElement("p");
          const tt = document.createElement("tt");
          tt.innerText = varName;
          p2.appendChild(tt);
          p2.appendChild(document.createTextNode(" " + rest.join(" ")));
          message = p2;
          const preDiv = this.locatePreDiv(cellDiv, ojsDiv2);
          if (preDiv !== void 0) {
            preDiv.classList.add("numberSource");
            const missingRef = ojsAst.references.find((n2) => n2.name === varName);
            if (missingRef !== void 0) {
              const { line, column } = preDiv._decorator.offsetToLineColumn(missingRef.start);
              const headingSpan = document.createElement("span");
              const headingTextEl = document.createTextNode(`${heading} (line ${line}, column ${column}) `);
              headingSpan.appendChild(headingTextEl);
              if (window.quartoDevhost) {
                const clicker = document.createElement("a");
                clicker.href = "#";
                clicker.innerText = "(source)";
                onclick = makeDevhostErrorClickHandler(line, column);
                headingSpan.appendChild(clicker);
              }
              heading = headingSpan;
              this.decorateOjsDivWithErrorPinpoint(ojsDiv2, missingRef.start, missingRef.end, line, column);
            }
          }
        } else if (message.match(/^(.+) could not be resolved$/) || message.match(/^(.+) is defined more than once$/)) {
          const [varName, ...rest] = message.split(" ");
          const p2 = document.createElement("p");
          const tt = document.createElement("tt");
          tt.innerText = varName;
          p2.appendChild(tt);
          p2.appendChild(document.createTextNode(" " + rest.join(" ")));
          message = p2;
        } else if (message === "circular definition") {
          const p2 = document.createElement("p");
          p2.appendChild(document.createTextNode("circular definition"));
          message = p2;
        } else {
          throw new Error(`Internal error, could not parse OJS error message "${message}"`);
        }
      } else {
        heading = "OJS Error";
        const p2 = document.createElement("p");
        p2.appendChild(document.createTextNode(inspectChild.textContent));
        message = p2;
      }
      const callout = calloutBlock({
        type: "important",
        heading,
        message,
        onclick
      });
      ojsDiv2.appendChild(callout);
    };
    buildCallout(ojsDiv);
  }
  interpret(src, elementGetter, elementCreator) {
    const that2 = this;
    const observer = (targetElement, ojsAst) => {
      return (name) => {
        const element2 = typeof elementCreator === "function" ? elementCreator() : elementCreator;
        targetElement.appendChild(element2);
        if (ojsAst.id && ojsAst.id.type === "ViewExpression" && !name.startsWith("viewof ")) {
          element2.classList.add("quarto-ojs-hide");
        }
        let cellDiv = targetElement;
        let cellOutputDisplay;
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
          if (cellDiv && cellDiv.classList.contains("cell-output-display")) {
            cellOutputDisplay = cellDiv;
          }
        }
        const forceShowDeclarations = !(cellDiv && cellDiv.dataset.output !== "all");
        const config = { childList: true };
        const callback = function(mutationsList) {
          for (const mutation of mutationsList) {
            const ojsDiv = mutation.target;
            if (!forceShowDeclarations) {
              Array.from(mutation.target.childNodes).filter((n2) => {
                return n2.classList.contains("observablehq--inspect") && !n2.parentNode.classList.contains("observablehq--error") && n2.parentNode.parentNode.dataset.nodetype !== "expression";
              }).forEach((n2) => n2.classList.add("quarto-ojs-hide"));
              Array.from(mutation.target.childNodes).filter((n2) => {
                return n2.classList.contains("observablehq--inspect") && !n2.parentNode.classList.contains("observablehq--error") && n2.parentNode.parentNode.dataset.nodetype === "expression";
              }).forEach((n2) => n2.classList.remove("quarto-ojs-hide"));
            }
            if (ojsDiv.classList.contains("observablehq--error")) {
              ojsDiv.querySelector(".observablehq--inspect").style.display = "none";
              if (ojsDiv.querySelectorAll(".callout-important").length === 0) {
                that2.signalError(cellDiv, ojsDiv, ojsAst);
              }
            } else {
              that2.clearError(ojsDiv);
              if (ojsDiv.parentNode.dataset.nodetype !== "expression" && !forceShowDeclarations && Array.from(ojsDiv.childNodes).every((n2) => n2.classList.contains("observablehq--inspect"))) {
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }
            that2.decorateSource(cellDiv, ojsDiv);
            for (const added of mutation.addedNodes) {
              const result = added.querySelectorAll("code.javascript");
              if (result.length !== 1) {
                continue;
              }
              if (result[0].textContent.trim().startsWith("import")) {
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }
          }
          if (cellOutputDisplay) {
            const children = Array.from(cellOutputDisplay.querySelectorAll("div.observablehq"));
            if (children.every((n2) => {
              return n2.classList.contains("quarto-ojs-hide");
            })) {
              cellOutputDisplay.classList.add("quarto-ojs-hide");
            } else {
              cellOutputDisplay.classList.remove("quarto-ojs-hide");
            }
          }
        };
        new MutationObserver(callback).observe(element2, config);
        element2.classList.add(kQuartoModuleWaitClass);
        return new this.inspectorClass(element2, ojsAst);
      };
    };
    const runCell = (cell) => {
      const targetElement = typeof elementGetter === "function" ? elementGetter() : elementGetter;
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(cellSrc, void 0, observer(targetElement, cell));
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }
};
function createRuntime() {
  const quartoOjsGlobal = window._ojs;
  const isShiny = window.Shiny !== void 0;
  if (isShiny) {
    quartoOjsGlobal.hasShiny = true;
    initOjsShinyRuntime();
    const span = document.createElement("span");
    window._ojs.shinyElementRoot = span;
    document.body.appendChild(span);
  }
  const lib = new Oe();
  if (isShiny) {
    extendObservableStdlib(lib);
  }
  function transpose(df) {
    const keys = Object.keys(df);
    return df[keys[0]].map((v2, i2) => Object.fromEntries(keys.map((key) => [key, df[key][i2] || void 0]))).filter((v2) => Object.values(v2).every((e2) => e2 !== void 0));
  }
  lib.transpose = () => transpose;
  const mainEl = document.querySelector("main");
  function width2() {
    return lib.Generators.observe(function(change) {
      var width3 = change(mainEl.clientWidth);
      function resized() {
        var w2 = mainEl.clientWidth;
        if (w2 !== width3)
          change(width3 = w2);
      }
      window.addEventListener("resize", resized);
      return function() {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.width = width2;
  Array.from(document.querySelectorAll("span.co")).filter((n2) => n2.textContent === "//| echo: fenced").forEach((n2) => {
    const lineSpan = n2.parentElement;
    const lineBreak2 = lineSpan.nextSibling;
    if (lineBreak2) {
      const nextLineSpan = lineBreak2.nextSibling;
      if (nextLineSpan) {
        const lineNumber = Number(nextLineSpan.id.split("-")[1]);
        nextLineSpan.style = `counter-reset: source-line ${lineNumber - 1}`;
      }
    }
    const sourceDiv = lineSpan.parentElement.parentElement.parentElement;
    const oldOffset = Number(sourceDiv.dataset.sourceOffset);
    sourceDiv.dataset.sourceOffset = oldOffset - "//| echo: fenced\n".length;
    lineSpan.remove();
    lineBreak2.remove();
  });
  const layoutDivs = Array.from(document.querySelectorAll("div.quarto-layout-panel div[id]"));
  function layoutWidth() {
    return lib.Generators.observe(function(change) {
      const ourWidths = Object.fromEntries(layoutDivs.map((div) => [div.id, div.clientWidth]));
      change(ourWidths);
      function resized() {
        let changed = false;
        for (const div of layoutDivs) {
          const w2 = div.clientWidth;
          if (w2 !== ourWidths[div.id]) {
            ourWidths[div.id] = w2;
            changed = true;
          }
        }
        if (changed) {
          change(ourWidths);
        }
      }
      window.addEventListener("resize", resized);
      return function() {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.layoutWidth = layoutWidth;
  let localResolver = {};
  function fileAttachmentPathResolver(n2) {
    if (localResolver[n2]) {
      return localResolver[n2];
    }
    if (n2.startsWith("/")) {
      if (quartoOjsGlobal.paths.docToRoot === "") {
        return `.${n2}`;
      } else {
        return `${quartoOjsGlobal.paths.docToRoot}${n2}`;
      }
    } else {
      return n2;
    }
  }
  lib.FileAttachment = () => ae(fileAttachmentPathResolver);
  const ojsConnector = new QuartoOJSConnector({
    paths: quartoOjsGlobal.paths,
    inspectorClass: isShiny ? ShinyInspector : QuartoInspector,
    library: lib,
    allowPendingGlobals: isShiny
  });
  quartoOjsGlobal.ojsConnector = ojsConnector;
  if (isShiny) {
    $(document).one("shiny:idle", () => {
      $(document).one("shiny:message", () => {
        setTimeout(() => {
          ojsConnector.killPendingGlobals();
        }, 0);
      });
    });
  }
  const subfigIdMap = new Map();
  function getSubfigId(elementId) {
    if (!subfigIdMap.has(elementId)) {
      subfigIdMap.set(elementId, 0);
    }
    let nextIx = subfigIdMap.get(elementId);
    nextIx++;
    subfigIdMap.set(elementId, nextIx);
    return `${elementId}-${nextIx}`;
  }
  const sourceNodes = document.querySelectorAll("pre.sourceCode code.sourceCode");
  const decorators = Array.from(sourceNodes).map((n2) => {
    n2 = n2.parentElement;
    const decorator = new PandocCodeDecorator(n2);
    n2._decorator = decorator;
    return decorator;
  });
  decorators.forEach((n2) => {
    if (n2._node.parentElement.dataset.syntaxErrorPosition === void 0) {
      return;
    }
    const offset2 = Number(n2._node.parentElement.dataset.syntaxErrorPosition);
    n2.decorateSpan(offset2, offset2 + 1, ["quarto-ojs-error-pinpoint"]);
  });
  const result = {
    setLocalResolver(obj) {
      localResolver = obj;
      ojsConnector.setLocalResolver(obj);
    },
    finishInterpreting() {
      return ojsConnector.finishInterpreting();
    },
    async value(name) {
      await this.finishInterpreting();
      const result2 = await ojsConnector.value(name);
      return result2;
    },
    interpretLenient(src, targetElementId, inline) {
      return result.interpret(src, targetElementId, inline).catch(() => {
      });
    },
    interpret(src, targetElementId, inline) {
      let targetElement;
      const getElement = () => {
        console.log("getElement called");
        targetElement = document.getElementById(targetElementId);
        let subFigId;
        if (!targetElement) {
          subFigId = getSubfigId(targetElementId);
          targetElement = document.getElementById(subFigId);
          if (!targetElement) {
            console.error("Ran out of subfigures for element", targetElementId);
            console.error("This will fail.");
            throw new Error("Ran out of quarto subfigures.");
          }
        }
        console.log("getElement will return", targetElement);
        console.log("state: ", { targetElementId, subFigId });
        return targetElement;
      };
      const makeElement = () => {
        return document.createElement(inline ? "span" : "div");
      };
      return ojsConnector.interpret(src, getElement, makeElement).catch((e2) => {
        let cellDiv = targetElement;
        let cellOutputDisplay;
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
          if (cellDiv && cellDiv.classList.contains("cell-output-display")) {
            cellOutputDisplay = cellDiv;
          }
        }
        const ojsDiv = targetElement.querySelector(".observablehq");
        for (const div of ojsDiv.querySelectorAll(".callout")) {
          div.remove();
        }
        const messagePre = document.createElement("pre");
        messagePre.innerText = e2.stack;
        const callout = calloutBlock({
          type: "important",
          heading: `${e2.name}: ${e2.message}`,
          message: messagePre
        });
        ojsDiv.appendChild(callout);
        ojsConnector.clearError(ojsDiv);
        ojsConnector.clearErrorPinpoints(cellDiv, ojsDiv);
        return e2;
      });
    },
    interpretQuiet(src) {
      return ojsConnector.interpretQuiet(src);
    },
    interpretFromScriptTags() {
      for (const el of document.querySelectorAll("script[type='ojs-module-contents']")) {
        for (const call of JSON.parse(el.text).contents) {
          switch (call.methodName) {
            case "interpret":
              this.interpret(call.source, call.cellName, call.inline);
              break;
            case "interpretLenient":
              this.interpretLenient(call.source, call.cellName, call.inline);
              break;
            case "interpretQuiet":
              this.interpretQuiet(call.source);
              break;
            default:
              throw new Error(`Don't know how to call method ${call.methodName}`);
          }
        }
      }
      for (const el of document.querySelectorAll("script[type='ojs-define']")) {
        for (const { name, value } of JSON.parse(el.text).contents) {
          ojsConnector.define(name)(value);
        }
      }
    }
  };
  return result;
}
window._ojs = {
  ojsConnector: void 0,
  paths: {},
  hasShiny: false,
  shinyElementRoot: void 0
};
window._ojs.runtime = createRuntime();
export {
  createRuntime
};
