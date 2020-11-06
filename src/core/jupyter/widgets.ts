/*
* widgets.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import {
  kApplicationJavascript,
  kApplicationJupyterWidgetState,
  kApplicationJupyterWidgetView,
  kTextHtml,
} from "../mime.ts";
import { isDisplayData } from "./display_data.ts";
import { JupyterNotebook, JupyterOutputDisplayData } from "./jupyter.ts";

export function widgetIncludeFiles(nb: JupyterNotebook) {
  // a 'javascript' widget doesn't use the jupyter widgets protocol, but rather just injects
  // text/html or application/javascript directly. futhermore these 'widgets' often assume
  // that require.js and jquery are available. for example, see:
  //   - https://github.com/mwouts/itables
  //   - https://plotly.com/python/
  const haveJavascriptWidgets = haveOutputType(
    nb,
    [kApplicationJavascript, kTextHtml],
  );

  // jupyter widgets confirm to the jupyter widget embedding protocol:
  // https://ipywidgets.readthedocs.io/en/latest/embedding.html#embeddable-html-snippet
  const haveJupyterWidgets = haveOutputType(
    nb,
    [kApplicationJupyterWidgetView],
  );

  // write required dependencies into head
  const head: string[] = [];
  if (haveJavascriptWidgets || haveJupyterWidgets) {
    head.push(
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js" integrity="sha512-c3Nl8+7g4LMSTdrm621y7kf9v3SDPnhxLNhcjFJbKECVnmZHTdo+IRO05sNLTH/D3vA6u1X32ehoLC7WFVdheg==" crossorigin="anonymous"></script>',
    );
    head.push(
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js" integrity="sha512-bLT0Qm9VnAYZDflyKcBaQ2gg0hSYNQrJ8RilYldYQ1FxQYoCLtUjuuRuZo+fjqhx/qtq/1itJ0C2ejDxltZVFg==" crossorigin="anonymous"></script>',
    );
    head.push(
      "<script type=\"application/javascript\">define('jquery', [],function() {return window.jQuery;})</script>",
    );
  }
  if (haveJupyterWidgets) {
    head.push(
      '<script src="https://unpkg.com/@jupyter-widgets/html-manager@*/dist/embed-amd.js" crossorigin="anonymous"></script>',
    );
  }

  // write jupyter widget state after body if it exists
  const afterBody: string[] = [];
  if (haveJupyterWidgets) {
    afterBody.push(`<script type=${kApplicationJupyterWidgetState}>`);
    afterBody.push(
      JSON.stringify(nb.metadata.widgets[kApplicationJupyterWidgetState]),
    );
    afterBody.push("</script>");
  }

  // create pandoc includes for our head and afterBody
  const widgetTempFile = (lines: string[]) => {
    const tempFile = Deno.makeTempFileSync(
      { prefix: "jupyter-widgets-", suffix: ".html" },
    );
    Deno.writeTextFileSync(tempFile, lines.join("\n") + "\n");
    return tempFile;
  };
  const inHeaderFile = widgetTempFile(head);
  const afterBodyFile = widgetTempFile(afterBody);

  // return result
  return {
    inHeader: [inHeaderFile],
    afterBody: [afterBodyFile],
  };
}

function haveOutputType(nb: JupyterNotebook, mimeTypes: string[]) {
  return nb.cells.some((cell) => {
    if (cell.cell_type === "code" && cell.outputs) {
      return cell.outputs.some((output) => {
        if (isDisplayData(output)) {
          const outputTypes = Object.keys(
            (output as JupyterOutputDisplayData).data,
          );
          return outputTypes.some((type) => mimeTypes.includes(type));
        } else {
          return false;
        }
      });
    } else {
      return false;
    }
  });
}
