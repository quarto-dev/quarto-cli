import escape2 from "../unoptimized/escape.js";
import reEscape2 from "../unoptimized/_reEscape.js";
import reEvaluate2 from "../unoptimized/_reEvaluate.js";
import reInterpolate2 from "../unoptimized/_reInterpolate.js";
var templateSettings = {
  escape: reEscape2,
  evaluate: reEvaluate2,
  interpolate: reInterpolate2,
  variable: "",
  imports: {
    _: {escape: escape2}
  }
};
var __VIRTUAL_FILE = templateSettings;
export default __VIRTUAL_FILE;
