/*
* random.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// The maximum is exclusive and the minimum is inclusive
export function randomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}
