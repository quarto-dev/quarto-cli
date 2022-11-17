/*
* binary-search.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

export function glb<T, U>(
  array: T[],
  value: U,
  compare?: (a: U, b: T) => number,
) {
  compare = compare ||
    ((a: unknown, b: unknown) => (a as number) - (b as number));
  if (array.length === 0) {
    return -1;
  }
  if (array.length === 1) {
    if (compare(value, array[0]) < 0) {
      return -1;
    } else {
      return 0;
    }
  }

  let left = 0;
  let right = array.length - 1;
  const vLeft = array[left], vRight = array[right];

  if (compare(value, vRight) >= 0) {
    // pre: value >= vRight
    return right;
  }
  if (compare(value, vLeft) < 0) {
    // pre: value < vLeft
    return -1;
  }

  // pre: compare(value, vRight) === -1 => value < vRight
  // pre: compare(value, vLeft) === {0, 1} => compare(vLeft, value) === {-1, 0} => vLeft <= value
  // pre: vLeft <= value < vRight

  while (right - left > 1) {
    // pre: right - left > 1 => ((right - left) >> 1) > 0
    // pre: vLeft <= value < vRight (from before while start and end of while loop)

    const center = left + ((right - left) >> 1);
    const vCenter = array[center];
    const cmp = compare(value, vCenter);

    if (cmp < 0) {
      right = center;
      // vRight = vCenter
      // pre: value < vCenter
      // pre: value < vRight
    } else if (cmp === 0) {
      // pre: value === center => center <= value
      left = center;
      // vLeft = vCenter
      // pre: vLeft <= value
    } else {
      // pre: cmp > 0
      // pre: value > center => center < value => center <= value
      left = center;
      // pre: vLeft <= value
    }
    // pre: vLeft <= value < vRight
  }
  return left;
}
