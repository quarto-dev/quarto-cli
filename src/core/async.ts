/*
* async.ts
*
* Copyright (C) 2020-2023 Posit, PBC
*
*/

export const sleep = (delay: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
};
