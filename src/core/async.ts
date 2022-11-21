/*
* async.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export const sleep = (delay: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
};
