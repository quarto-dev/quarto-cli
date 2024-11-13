export function b64EncodeUnicode(str: string) {
  return btoa(encodeURIComponent(str));
}

export function UnicodeDecodeB64(str: string) {
  return decodeURIComponent(atob(str));
}
