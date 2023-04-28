/** XML symbol */
export const $XML: unique symbol = Symbol("x/xml")

/** Flux */
export type Flux = Deno.ReaderSync & Deno.SeekerSync

/** Parser options */
export type ParserOptions = {
  reviveBooleans?: boolean
  reviveNumbers?: boolean
  emptyToNull?: boolean
  debug?: boolean
  flatten?: boolean
  progress?: (bytes: number) => void
  reviver?: (
    this: node,
    options: {
      key: string
      value: unknown
      tag: string
      properties: null | { [key: string]: unknown }
    },
  ) => unknown
}

/** Stringifier options */
export type StringifierOptions = {
  indentSize?: number
  nullToEmpty?: boolean
  debug?: boolean
  progress?: (bytes: number) => void
  replacer?: (
    this: null,
    options: {
      key: string
      value: unknown
      tag: string
      properties: null | { [key: string]: unknown }
    },
  ) => unknown
}

/** Stringifier extract */
export type extract = {
  raw: node
  text: string | null
  comments: string[]
  attributes: string[]
  children: string[]
  meta: meta
}

/** XML meta */
export type meta = { name: string; parent: null | node; cdata?: Array<string[]> }

/** Node type */
export type node = {
  [$XML]: meta
  [key: PropertyKey]: unknown
}

/** Document type */
export type document = {
  xml?: node
  doctype?: node
  [key: PropertyKey]: node | literal
}

/** Node type (user) */
export type unode = {
  [$XML]?: meta
  [key: PropertyKey]: unknown
}

/** Document type (user) */
export type udocument = {
  xml?: unode
  doctype?: unode
  [key: PropertyKey]: unode | literal
}

/** Literal type */
export type literal = string | boolean | number | null | undefined

/** Schema */
export const schema = {
  comment: "#comment",
  text: "#text",
  stylesheets: "$stylesheets",
  attribute: {
    prefix: "@",
  },
  property: {
    prefix: "@",
  },
  space: {
    name: "xml:space",
    preserve: "preserve",
  },
} as const

/** Seek mode */
export const SeekMode = Object.freeze({
  Current: Deno?.SeekMode?.Current ?? 0,
  Start: Deno?.SeekMode?.Start ?? 1,
  End: Deno?.SeekMode?.End ?? 2,
})

/** Entities */
export const entities = {
  xml: {
    "&lt;": "<",
    "&gt;": ">",
    "&apos;": "'",
    "&quot;": '"',
    "&amp;": "&", //Keep last
  },
  char: {
    "&": "&amp;", //Keep first
    '"': "&quot;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
  },
} as const

/** Tokens */
export const tokens = {
  entity: {
    regex: {
      entities: /&#(?<hex>x?)(?<code>\d+);/g,
    },
  },
  prolog: {
    start: "<?xml",
    end: "?>",
  },
  stylesheet: {
    start: "<?xml-stylesheet",
    end: "?>",
  },
  doctype: {
    start: "<!DOCTYPE",
    end: ">",
    elements: {
      start: "[",
      end: "]",
    },
    element: {
      start: "<!ELEMENT",
      end: ">",
      value: {
        start: "(",
        end: ")",
        regex: {
          end: { until: /\)/, bytes: 1 },
        },
      },
    },
  },
  comment: {
    start: "<!--",
    end: "-->",
    regex: {
      end: { until: /(?<!-)-->/, bytes: 4, length: 3 },
    },
  },
  cdata: {
    start: "<![CDATA[",
    end: "]]>",
    regex: {
      end: {
        until: /\]\]>/,
        bytes: 3,
      },
    },
  },
  tag: {
    start: "<",
    end: ">",
    close: {
      start: "</",
      end: ">",
      self: "/",
      regex: {
        start: /<\//,
        end: /\/?>/,
      },
    },
    attribute: {
      regex: {
        name: { until: /=/, bytes: 1 },
      },
    },
    regex: {
      name: { until: /[\s\/>]/, bytes: 1 },
      start: { until: /</, bytes: 1 },
    },
  },
  text: {
    regex: {
      end: { until: /(<\/)|(<!)/, bytes: 2 },
    },
  },
} as const
