export function b64EncodeUnicode(str: string) {
  return btoa(encodeURIComponent(str));
}

export function unicodeDecodeB64(str: string) {
  return decodeURIComponent(atob(str));
}
