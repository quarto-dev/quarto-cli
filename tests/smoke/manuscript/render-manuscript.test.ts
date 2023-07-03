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
  "article.ipynb.html",
  "article.out.ipynb",
];
testManuscriptRender(
  ipynbSingleArticle,
  "all",
  ["html", "jats", "docx", "pdf"],
  ipynbSingleOutputs,
);

const ipynbFullArticle = docs("manuscript/ipynb-full/article.ipynb");
const ipynbFullOutputs = [
  "article-meca.zip",
  "data/catalogoComunSV_1663233588717.csv",
  "data/lapalma_ign.csv",
  "images/la-palma-map.png",
  "images/reservoirs.png",
  "images/stations.png",
  "notebooks/data-screening.ipynb",
  "notebooks/data-screening.ipynb.html",
  "notebooks/data-screening.out.ipynb",
  "notebooks/seismic-monitoring-stations.out.ipynb",
  "notebooks/seismic-monitoring-stations.qmd",
  "notebooks/seismic-monitoring-stations.qmd.html",
  "notebooks/visualization-figure-creation-seaborn.ipynb",
  "notebooks/visualization-figure-creation-seaborn.ipynb.html",
  "notebooks/visualization-figure-creation-seaborn.out.ipynb",
];
testManuscriptRender(
  ipynbFullArticle,
  "all",
  ["html", "jats", "docx", "pdf"],
  ipynbFullOutputs,
);

const qmdSingleArticle = docs("manuscript/qmd-single/index.qmd");
testManuscriptRender(
  qmdSingleArticle,
  "all",
  ["html", "jats", "docx", "pdf"],
  [],
);
