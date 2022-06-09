function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}
var __VIRTUAL_FILE = overArg;
export default __VIRTUAL_FILE;
