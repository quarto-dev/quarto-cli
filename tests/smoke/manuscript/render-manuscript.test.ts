/*
* render-embed.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testManuscriptRender } from "./manuscript.ts";

const article = docs("manuscript/base/index.qmd");
testManuscriptRender(
  article,
  "all",
  ["html", "jats", "docx"],
  [],
);

const ipynbSingleArticle = docs("manuscript/ipynb-single/article.ipynb");
const ipynbSingleOutputs = [
  "article-meca.zip",
  "data/lapalma_ign.csv",
  "images/la-palma-map.png",
  "images/reservoirs.png",
  "article-preview.html",
  "article.out.ipynb",
];
testManuscriptRender(
  ipynbSingleArticle,
  "all",
  ["html", "jats", "docx", "pdf"],
  ipynbSingleOutputs,
);

// deactivate this test for now while pandoc 3.1.6.2 is used
// See https://github.com/quarto-dev/quarto-cli/pull/6617#issuecomment-1695570171
// Next Pandoc version will fix it 
// TODO: reactivate for next pandoc version
if (false) { 
  const ipynbFullArticle = docs("manuscript/ipynb-full/article.ipynb");
  const ipynbFullOutputs = [
    "article-meca.zip",
    "data/catalogoComunSV_1663233588717.csv",
    "data/lapalma_ign.csv",
    "images/la-palma-map.png",
    "images/reservoirs.png",
    "images/stations.png",
    "notebooks/data-screening.ipynb",
    "notebooks/data-screening-preview.html",
    "notebooks/data-screening.out.ipynb",
    "notebooks/seismic-monitoring-stations.out.ipynb",
    "notebooks/seismic-monitoring-stations.qmd",
    "notebooks/seismic-monitoring-stations-preview.html",
    "notebooks/visualization-figure-creation-seaborn.ipynb",
    "notebooks/visualization-figure-creation-seaborn-preview.html",
    "notebooks/visualization-figure-creation-seaborn.out.ipynb",
  ];
  testManuscriptRender(
    ipynbFullArticle,
    "all",
    ["html", "jats", "docx", "pdf"],
    ipynbFullOutputs,
  );
}

const qmdSingleArticle = docs("manuscript/qmd-single/index.qmd");
const qmdSingleOutputs = [
  "index-meca.zip",
  "images/la-palma-map.png",
  "images/reservoirs.png",
  "index-preview.html",
  "index.out.ipynb",
];

testManuscriptRender(
  qmdSingleArticle,
  "all",
  ["html", "jats", "docx", "pdf"],
  qmdSingleOutputs,
);

const qmdFullArticle = docs("manuscript/qmd-full/index.qmd");
const qmdFullOutputs = [
  "index-meca.zip",
  "images/la-palma-map.png",
  "images/reservoirs.png",
  "notebook.qmd",
  "notebook.out.ipynb",
  "notebook-preview.html",
];
testManuscriptRender(
  qmdFullArticle,
  "all",
  ["html", "jats", "docx", "pdf"],
  qmdFullOutputs,
);