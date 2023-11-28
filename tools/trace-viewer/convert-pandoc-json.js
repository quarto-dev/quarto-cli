// converts our trace filter's JSON output to a more compact format
// whose diffs are easier to read
//
// this doesn't work on arbitrary pandoc JSON, since we
// treat custom nodes in a particular way

const postProcessStrings = (array) => {
  if (array.length === 0) {
    return [];
  }
  const result = [array[0]];
  for (const el of array.slice(1)) {
    if (
      typeof result[result.length - 1] !== "string" ||
      typeof el !== "string"
    ) {
      result.push(el);
      continue;
    }
    result[result.length - 1] = result[result.length - 1] + el;
  }
  if (result.length === 1 && typeof result[0] === "string") {
    return result[0];
  }
  return result;
};

const convertListAttributes = (listAttr) => ({
  start: listAttr[0],
  style: listAttr[1].t,
  delimiter: listAttr[2].t,
});

const convertAttr = (attr) =>
  `('${attr[0]}', [${attr[1].map((s) => `'${s}'`).join(", ")}], [${attr[2]
    .map((s) => `'${s}'`)
    .join(", ")}])`;
const convertCitation = (c) => c;

// FIXME
const convertCaption = (caption) => caption;

const convertColSpec = (colSpec) => {
  const align = colSpec[0].t;
  const width = colSpec[1].c;

  return `(${align}, ${width})`;
};

const convertCell = (cell) => {
  return {
    t: "TableCell",
    attr: convertAttr(cell[0]),
    alignment: cell[1].t,
    row_span: cell[2],
    col_span: cell[3],
    content: convert(cell[4]),
  };
};

const convertRow = (row) => {
  return {
    t: "TableRow",
    attr: convertAttr(row[0]),
    cells: row[1].map(convertCell),
  };
};

const convertTableHead = (head) => {
  return {
    t: "TableHead",
    attr: convertAttr(head[0]),
    rows: head[1].map(convertRow),
  };
};

const convertTableBody = (body) => {
  return {
    t: "TableBody",
    row_head_columns: body[1],
    attr: convertAttr(body[0]),
    intermediate_head: body[2].map(convertRow),
    body: body[3].map(convertRow),
  };
};

const convertTableFoot = (foot) => {
  return {
    t: "TableFoot",
    attr: convertAttr(foot[0]),
    rows: foot[1].map(convertRow),
  };
};

const convert = (data) => {
  if (Array.isArray(data)) {
    return postProcessStrings(data.map(convert).flat());
  }
  if (typeof data === "object") {
    const constMap = {
      Space: " ",
      Null: null,
      SingleQuote: "'",
      DoubleQuote: '"',
    };
    if (constMap[data.t]) {
      return constMap[data.t];
    }
    if (data.t === "Str") return data.c;
    if (
      [
        "BlockQuote",
        "BulletList",
        "Plain",
        "Para",
        "Strong",
        "Emph",
        "Underline",
        "Strikeout",
        "Quoted",
        "SingleQuote",
        "Note",
      ].includes(data.t)
    ) {
      return {
        t: data.t,
        content: convert(data.c),
      };
    }
    if (
      ["AlignLeft", "AlignRight", "AlignCenter", "AlignDefault"].includes(
        data.t
      )
    ) {
      return data.t;
    }
    if (data.t === "Table") {
      return {
        t: data.t,
        attr: convertAttr(data.c[0]),
        caption: convertCaption(data.c[1]),
        colspecs: data.c[2].map(convertColSpec),
        head: convertTableHead(data.c[3]),
        body: data.c[4].map(convertTableBody),
        foot: convertTableFoot(data.c[5]),
      };
    }
    if (data.t === "Code") {
      return {
        t: data.t,
        attr: convertAttr(data.c[0]),
        text: data.c[1],
      };
    }
    if (data.t === "Cite") {
      return {
        t: data.t,
        content: convert(data.c[1]),
        citations: data.c[0].map(convertCitation),
      };
    }
    if (
      data.t === "Div" &&
      data.c[0][2].find((x) => x[0] === "__quarto_custom_table")
    ) {
      const attributes = Object.fromEntries(data.c[0][2]);
      const entry = attributes["__quarto_custom_table"];
      // const t = attributes["__quarto_custom_type"];
      const customTable = JSON.parse(entry);
      return {
        customAST: true,
        ...customTable,
        scaffold: convert(data.c.slice(1)),
      };
    }
    if (data.t === "Div" || data.t === "Span") {
      return {
        t: data.t,
        attr: convertAttr(data.c[0]),
        content: convert(data.c.slice(1)),
      };
    }
    if (data.t === "Header") {
      return {
        t: data.t,
        level: data.c[0],
        attr: convertAttr(data.c[1]),
        content: convert(data.c.slice(2)),
      };
    }
    if (data.t === "Link") {
      return {
        t: data.t,
        attr: convertAttr(data.c[0]),
        content: convert(data.c[1]),
        target: data.c[2][0],
        title: data.c[2][1],
      };
    }
    if (data.t === "Image") {
      return {
        t: data.t,
        attr: convertAttr(data.c[0]),
        caption: convert(data.c[1]),
        src: data.c[2][0],
        title: data.c[2][1],
      };
    }
    if (data.t === "CodeBlock") {
      return {
        t: data.t,
        attr: convertAttr(data.c[0]),
        text: data.c[1],
      };
    }
    if (data.t === "OrderedList") {
      return {
        t: data.t,
        listAttributes: convertListAttributes(data.c[0]),
        content: convert(data.c[1]),
      };
    }
    if (data.t === "MetaInlines" || data.t === "MetaBlocks") {
      return postProcessStrings(data.c.map(convert));
    }
    if (data.t === "MetaBool") {
      return data.c;
    }
    if (data.t === "SoftBreak") {
      return "";
    }
    if (data.t === "LineBreak") {
      return "\n";
    }

    if (data.t === "MetaString") {
      return data.c;
    }
    if (data.t === "MetaList") {
      return postProcessStrings(data.c.map(convert));
    }
    if (data.t === "MetaMap") {
      return convertMeta(data.c);
    }
    if (data.t === "RawBlock" || data.t === "RawInline") {
      return {
        t: data.t,
        format: data.c[0],
        text: data.c[1],
      };
    }
    if (data.t === "Figure") {
      return {
        t: data.t,
        attr: convertAttr(data.c[0]),
        content: convert(data.c[2]),
        caption: convertCaption(data.c[1]),
      };
    }
    if (data.t === "DefinitionList") {
      return {
        t: data.t,
        content: data.c.map(convert),
      };
    }
    if (data.t === "Math") {
      return {
        t: data.t,
        displayType: data.c[0].t,
        text: data.c[1],
      };
    }
    throw new Error(`Can't handle type ${data.t}`);
  } else if (typeof data === "string") {
    return data;
  }
  return {
    name: "<value>",
    children: [],
  };
};

const convertMeta = (meta) => {
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => {
      return [key, convert(value)];
    })
  );
};

export const convertDoc = (doc) => {
  return {
    meta: convertMeta(doc.meta),
    "pandoc-api-version": doc["pandoc-api-version"].join(","),
    blocks: doc.blocks.map(convert),
  };
};
