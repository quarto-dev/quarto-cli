function stackDelete(key) {
  var data = this.__data__, result = data["delete"](key);
  this.size = data.size;
  return result;
}
var __VIRTUAL_FILE = stackDelete;
export default __VIRTUAL_FILE;
