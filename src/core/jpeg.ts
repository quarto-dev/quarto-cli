/*
 * jpeg.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

export function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
}

// Reads the pixel size from the first start-of-frame (SOFn) segment, which
// holds it for baseline, progressive and lossless JPEGs alike.
export function jpegSize(bytes: Uint8Array) {
  if (!isJpeg(bytes)) {
    throw new Error("Not a jpeg file");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xFF) {
      throw new Error("Invalid jpeg marker");
    }
    const marker = bytes[pos + 1];
    if (marker === 0xFF) {
      // fill byte before a marker
      pos++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD8)) {
      // markers without a length or payload
      pos += 2;
      continue;
    }
    if (marker === 0xD9 || marker === 0xDA) {
      // end of image or start of scan data, with no frame header before it
      break;
    }
    const length = view.getUint16(pos + 2);
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC)
    const isFrame = marker >= 0xC0 && marker <= 0xCF &&
      marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isFrame) {
      if (pos + 9 > bytes.length) {
        break;
      }
      return {
        height: view.getUint16(pos + 5),
        width: view.getUint16(pos + 7),
      };
    }
    pos += 2 + length;
  }
  throw new Error("No jpeg frame header found");
}
