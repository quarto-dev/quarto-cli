/*
* random.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

// The maximum is exclusive and the minimum is inclusive
export function randomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(cryptoRandom() * (max - min) + min);
}

export function randomHex(length: number) {
  const result = [];
  const hexRef = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
  ];
  for (let n = 0; n < length; n++) {
    result.push(hexRef[Math.floor(cryptoRandom() * 16)]);
  }
  return result.join("");
}

// version of Math.random() that uses web crypto
// https://stackoverflow.com/questions/13694626/generating-random-numbers-0-to-1-with-crypto-generatevalues
export function cryptoRandom() {
  const arr = new Uint32Array(2);
  crypto.getRandomValues(arr);

  // keep all 32 bits of the the first, top 20 of the second for 52 random bits
  const mantissa = (arr[0] * Math.pow(2, 20)) + (arr[1] >>> 12);

  // shift all 52 bits to the right of the decimal point
  const result = mantissa * Math.pow(2, -52);
  return result;
}
