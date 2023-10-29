// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { BinarySearchTree as BinarySearchTree_ } from "./unstable/binary_search_tree.ts";

/** @deprecated (will be removed after 0.206.0) import from `collections/unstable/binary_search_tree.ts instead */
export class BinarySearchTree<T> extends BinarySearchTree_<T> {}
