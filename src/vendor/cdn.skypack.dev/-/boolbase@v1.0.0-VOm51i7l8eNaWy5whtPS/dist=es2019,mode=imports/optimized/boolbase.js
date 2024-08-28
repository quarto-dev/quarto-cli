var boolbase = {
  trueFunc: function trueFunc() {
    return true;
  },
  falseFunc: function falseFunc() {
    return false;
  }
};
export default boolbase;
var trueFunc2 = boolbase.trueFunc;
export {boolbase as __moduleExports, trueFunc2 as trueFunc};
