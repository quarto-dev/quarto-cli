import baseIsMatch2 from "../unoptimized/_baseIsMatch.js";
import getMatchData2 from "../unoptimized/_getMatchData.js";
import matchesStrictComparable2 from "../unoptimized/_matchesStrictComparable.js";
function baseMatches(source) {
  var matchData = getMatchData2(source);
  if (matchData.length == 1 && matchData[0][2]) {
    return matchesStrictComparable2(matchData[0][0], matchData[0][1]);
  }
  return function(object) {
    return object === source || baseIsMatch2(object, source, matchData);
  };
}
var __VIRTUAL_FILE = baseMatches;
export default __VIRTUAL_FILE;
