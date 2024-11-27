import { encode as base64Encode } from "encoding/base64";

export function asDataUrl(
  content: string | ArrayBuffer,
  mimeType: string,
) {
  const b64Src = base64Encode(content);
  return `data:${mimeType};base64,${b64Src}`;
}
