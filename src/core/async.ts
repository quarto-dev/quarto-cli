/*
* async.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export const sleep = (delay: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
};
