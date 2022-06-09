// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
let defaultEncoding = "buffer";

const kKeyObject = Symbol("kKeyObject");

function setDefaultEncoding(val) {
  defaultEncoding = val;
}

function getDefaultEncoding() {
  return defaultEncoding;
}

export default { getDefaultEncoding, setDefaultEncoding };
export { getDefaultEncoding, kKeyObject, setDefaultEncoding };
