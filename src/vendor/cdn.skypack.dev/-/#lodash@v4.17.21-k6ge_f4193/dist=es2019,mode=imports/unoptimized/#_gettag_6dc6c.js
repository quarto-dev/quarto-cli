import DataView2 from "../unoptimized/_DataView.js";
import Map2 from "../unoptimized/_Map.js";
import Promise2 from "../unoptimized/_Promise.js";
import Set2 from "../unoptimized/_Set.js";
import WeakMap2 from "../unoptimized/_WeakMap.js";
import baseGetTag2 from "../unoptimized/_baseGetTag.js";
import toSource2 from "../unoptimized/_toSource.js";
var mapTag = "[object Map]", objectTag = "[object Object]", promiseTag = "[object Promise]", setTag = "[object Set]", weakMapTag = "[object WeakMap]";
var dataViewTag = "[object DataView]";
var dataViewCtorString = toSource2(DataView2), mapCtorString = toSource2(Map2), promiseCtorString = toSource2(Promise2), setCtorString = toSource2(Set2), weakMapCtorString = toSource2(WeakMap2);
var getTag = baseGetTag2;
if (DataView2 && getTag(new DataView2(new ArrayBuffer(1))) != dataViewTag || Map2 && getTag(new Map2()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set2 && getTag(new Set2()) != setTag || WeakMap2 && getTag(new WeakMap2()) != weakMapTag) {
  getTag = function(value) {
    var result = baseGetTag2(value), Ctor = result == objectTag ? value.constructor : void 0, ctorString = Ctor ? toSource2(Ctor) : "";
    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString:
          return dataViewTag;
        case mapCtorString:
          return mapTag;
        case promiseCtorString:
          return promiseTag;
        case setCtorString:
          return setTag;
        case weakMapCtorString:
          return weakMapTag;
      }
    }
    return result;
  };
}
var __VIRTUAL_FILE = getTag;
export default __VIRTUAL_FILE;
