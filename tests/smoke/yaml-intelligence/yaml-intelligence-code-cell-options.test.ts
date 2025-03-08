import { testQuartoCmd } from "../../test.ts";
import { fileLoader } from "../../utils.ts";
import { printsMessage } from "../../verify.ts";

const yamlDocs = fileLoader("yaml");

const testYamlValidationFails = (file: string) => {
  testQuartoCmd(
    "render",
    [yamlDocs(file, "html").input, "--to", "html", "--quiet"],
    [printsMessage({level: "ERROR", regex: /Validation of YAML cell metadata failed/})],
  );
};

const files = [
  "fail-validation-knitr.qmd",
  "fail-validation-knitr-backticks.qmd",
  "fail-validation-jupyter.qmd",
  "fail-validation-jupyter-backticks.qmd",
  "fail-validation-julia.qmd",
  "fail-validation-julia-backticks.qmd",
];

files.forEach(testYamlValidationFails);

