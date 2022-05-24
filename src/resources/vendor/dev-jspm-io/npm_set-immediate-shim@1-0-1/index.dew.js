var exports = {},
    _dewExec = false;
export function dew() {
  if (_dewExec) return exports;
  _dewExec = true;
  exports = typeof setImmediate === 'function' ? setImmediate : function setImmediate() {
    var args = [].slice.apply(arguments);
    args.splice(1, 0, 0);
    setTimeout.apply(null, args);
  };
  return exports;
}