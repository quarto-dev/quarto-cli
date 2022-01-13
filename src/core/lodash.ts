/*
* lodash.ts
*
* piecemeal exports of lodash to make the tree-shaker happier
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import ld_cloneDeep from "lodash/cloneDeep";
import ld_debounce from "lodash/debounce";
import ld_difference from "lodash/difference";
import ld_each from "lodash/each";
import ld_forEach from "lodash/forEach";
import ld_isArray from "lodash/isArray";
import ld_mergeWith from "lodash/mergeWith";
import ld_shuffle from "lodash/shuffle";
import ld_template from "lodash/template";
import ld_toString from "lodash/toString";
import ld_uniq from "lodash/uniq";
import ld_uniqBy from "lodash/uniqBy";
import ld_isObject from "lodash/isObject";
import ld_isEqual from "lodash/isEqual";
import ld_orderBy from "lodash/orderBy";

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
