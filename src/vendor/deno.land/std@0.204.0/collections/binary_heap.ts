// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { BinaryHeap as BinaryHeap_ } from "./unstable/binary_heap.ts";
import {
  ascend as ascend_,
  descend as descend_,
} from "./unstable/comparators.ts";

/** @deprecated (will be removed after 0.206.0) import from `collections/unstable/binary_heap.ts` instead */
export const ascend = ascend_;
/** @deprecated (will be removed after 0.206.0) import from `collections/unstable/binary_heap.ts` instead */
export const descend = descend_;
/** @deprecated (will be removed after 0.206.0) import from `collections/unstable/binary_heap.ts` instead */
export class BinaryHeap<T> extends BinaryHeap_<T> {}
