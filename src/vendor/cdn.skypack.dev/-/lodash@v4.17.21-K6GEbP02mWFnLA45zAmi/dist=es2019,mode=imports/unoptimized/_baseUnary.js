function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}
var __VIRTUAL_FILE = baseUnary;
export default __VIRTUAL_FILE;
