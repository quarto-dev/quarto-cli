// https://developer.mozilla.org/en-US/docs/Glossary/Base64

export function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

export function bytesToBase64(bytes) {
  const binString = String.fromCodePoint(...bytes);
  return btoa(binString);
}

export function base64ToStr(base64) {
  return new TextDecoder().decode(base64ToBytes(base64));
}

export function strToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}
