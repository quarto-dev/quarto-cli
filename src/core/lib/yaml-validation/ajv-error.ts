/*
* ajv-error.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

// this is an interface from ajv which we're repeating here for
// simplicity and slightly extending

// export interface ErrorObject {
//   keyword: string; // validation keyword.
//   instancePath: string; // JSON Pointer to the location in the data instance (e.g., `"/prop/1/subProp"`).
//   schemaPath: string; // JSON Pointer to the location of the failing keyword in the schema
//   // deno-lint-ignore no-explicit-any
//   params: any; // type is defined by keyword value, see below
//   // params property is the object with the additional information about error
//   // it can be used to generate error messages
//   // (e.g., using [ajv-i18n](https://github.com/ajv-validator/ajv-i18n) package).
//   // See below for parameters set by all keywords.
//   propertyName?: string; // set for errors in `propertyNames` keyword schema.
//   // `instancePath` still points to the object in this case.
//   message?: string; // the error message (can be excluded with option `messages: false`).
//   // Options below are added with `verbose` option:
//   // deno-lint-ignore no-explicit-any
//   schema?: any; // the value of the failing keyword in the schema.
//   // NB we use "object" here because it's the typing given by ajv, even though deno lint doesn't like it.
//   // deno-lint-ignore ban-types
//   parentSchema?: object; // the schema containing the keyword.
//   // deno-lint-ignore no-explicit-any
//   data?: any; // the data validated by the keyword.
//   // a flag required by our internal processing to keep track of whether an error has been transformed
//   hasBeenTransformed?: boolean;
// }
