import cloneArrayBuffer2 from "../unoptimized/_cloneArrayBuffer.js";
import cloneDataView2 from "../unoptimized/_cloneDataView.js";
import cloneRegExp2 from "../unoptimized/_cloneRegExp.js";
import cloneSymbol2 from "../unoptimized/_cloneSymbol.js";
import cloneTypedArray2 from "../unoptimized/_cloneTypedArray.js";
var boolTag = "[object Boolean]", dateTag = "[object Date]", mapTag = "[object Map]", numberTag = "[object Number]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]";
var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
function initCloneByTag(object, tag, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag:
      return cloneArrayBuffer2(object);
    case boolTag:
    case dateTag:
      return new Ctor(+object);
    case dataViewTag:
      return cloneDataView2(object, isDeep);
    case float32Tag:
    case float64Tag:
    case int8Tag:
    case int16Tag:
    case int32Tag:
    case uint8Tag:
    case uint8ClampedTag:
    case uint16Tag:
    case uint32Tag:
      return cloneTypedArray2(object, isDeep);
    case mapTag:
      return new Ctor();
    case numberTag:
    case stringTag:
      return new Ctor(object);
    case regexpTag:
      return cloneRegExp2(object);
    case setTag:
      return new Ctor();
    case symbolTag:
      return cloneSymbol2(object);
  }
}
var __VIRTUAL_FILE = initCloneByTag;
export default __VIRTUAL_FILE;
