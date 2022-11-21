/*
* lodash.ts
*
* piecemeal exports of lodash to make the tree-shaker happier
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import ld_cloneDeep from "lodash/cloneDeep.js";
import ld_debounce from "lodash/debounce.js";
import ld_difference from "lodash/difference.js";
import ld_each from "lodash/each.js";
import ld_forEach from "lodash/forEach.js";
import ld_isArray from "lodash/isArray.js";
import ld_mergeWith from "lodash/mergeWith.js";
import ld_shuffle from "lodash/shuffle.js";
import ld_template from "lodash/template.js";
import ld_toString from "lodash/toString.js";
import ld_uniq from "lodash/uniq.js";
import ld_uniqBy from "lodash/uniqBy.js";
import ld_isObject from "lodash/isObject.js";
import ld_isEqual from "lodash/isEqual.js";
import ld_orderBy from "lodash/orderBy.js";
import ld_escape from "lodash/escape.js";

export const cloneDeep = ld_cloneDeep;
export const debounce = ld_debounce;
export const difference = ld_difference;
export const each = ld_each;
export const forEach = ld_forEach;
export const isArray = ld_isArray;
export const mergeWith = ld_mergeWith;
export const shuffle = ld_shuffle;
export const template = ld_template;
export const toString = ld_toString;
export const uniq = ld_uniq;
export const uniqBy = ld_uniqBy;
export const isObject = ld_isObject;
export const isEqual = ld_isEqual;
export const orderBy = ld_orderBy;
export const escape = ld_escape;
