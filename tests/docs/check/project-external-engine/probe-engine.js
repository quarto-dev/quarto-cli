// Minimal external engine used to verify that `quarto check` discovers
// engines declared in _quarto.yml. It claims nothing and records itself in
// the check JSON result.

const probeEngineDiscovery = {
  name: "check-probe",
  defaultExt: ".qmd",
  defaultYaml: () => [],
  defaultContent: () => [],
  validExtensions: () => [],
  claimsFile: (_file, _ext) => false,
  claimsLanguage: (_language, _firstClass) => false,
  canFreeze: false,
  generatesFigures: false,
  checkInstallation: async (conf) => {
    if (conf.jsonResult) {
      conf.jsonResult["check-probe"] = { discovered: true };
    }
  },
  launch: (_context) => {
    throw new Error("check-probe engine does not render documents");
  },
};

export default probeEngineDiscovery;
