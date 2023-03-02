import { quartoConfig } from "../core/quarto.ts";
import { info } from "log/mod.ts";

export function greet() {
  info(
    `Quarto v${quartoConfig.version()}`,
  );
}
