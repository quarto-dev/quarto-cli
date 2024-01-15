import yaml
import json
import base64

class Trie:

    def __init__(self):
        self.children = {}
        self.values = []

    def insert(self, path, value):
        node = self
        for c in path:
            if c not in node.children:
                node.children[c] = Trie()
            node = node.children[c]
        node.values.append(value)

    def json(self):
        if not self.children:
            return self.values
        return {k: v.json() for k, v in self.children.items()}
    
    def tabulator(self):
        if not self.children:
            result = {}
            for v in self.values:
                result[v["format"]] = v["file"]
            return result
        result = []
        for k, v in self.children.items():
            result.append({
                "feature": k,
                "_children": v.tabulator()
            })
        return result

    def depth(self):
        if not self.children:
            return 0
        return max([v.depth() for v in self.children.values()]) + 1

    def size(self):
        if not self.children:
            return 1
        return sum([v.size() for v in self.children.values()])

def render_features_formats_table(filename):
    s = yaml.load(open(filename), Loader=yaml.SafeLoader)

    features = Trie()
    for l in s:
        features.insert(l["feature"].split("/"), l)

    formats = {}
    for l in s:
        formats[l["format"]] = features.depth() + len(formats) - 1

    n_columns = features.depth() + len(formats) 

    table_cells = list(list(None for _ in range(n_columns)) for _ in range(features.size()))
    table_headers = list(None for _ in range(n_columns))

    def add_spanners(node, row, col):
        # if node.children:
        #     print("<<<")
        #     print(row, col)
        #     print(json.dumps(node.json(), indent=2))
        #     print(">>>")
        for k, v in node.children.items():
            # print("::::", row, col)
            table_cells[row][col] = "<td class='spanner' rowspan='%s'><div class='inner_spanner'>%s</div></td>" % (v.size(), k)
            for i in range(row+1, row + v.size()):
                table_cells[i][col] = ""
            add_spanners(v, row, col + 1)
            row += v.size()
    def add_headers():
        for k, i in formats.items():
            table_headers[i] = "<th>%s</th>" % k
    def add_entries(node, row, col):
        for v in node.values:
            content = "[{{< fa link >}}](%s/%s.qmd)" % (v["feature"], v["format"])
            # content = "<a href='%s'><i class='fa-solid fa-link' aria-label='link'></i></a>" % v.get("file", "%s/%s.qmd" % (v["feature"], v["format"]))
            # encode as base64
            b64 = base64.encodebytes(content.encode("utf-8"))
            table_cells[row][formats[v["format"]]] = "<td><span data-qmd-base64='%s'></span></td>" % b64.decode("utf-8").strip()
        for _, v in node.children.items():
            add_entries(v, row, col + 1)
            row += v.size()
    add_spanners(features, 0, 0)
    add_entries(features, 0, 0)
    add_headers()
    table_headers[0] = '<th colspan="%s">↓ Features \\ Formats → </th>' % features.depth()
    for i in range(1, features.depth()):
        table_headers[i] = ""

    def render_table():
        html = []
        html.append("```{=html}\n<table class='features-formats-table'>")
        html.append("<tr class='header-row'>")
        for h in table_headers:
            if h is None:
                html.append("<th></th>")
            else:
                html.append(h)
        html.append("</tr>")
        for row in table_cells:
            html.append("<tr>")
            for d in row:
                if d is None:
                    html.append("<td></td>")
                else:
                    html.append(d)
            html.append("</tr>")
        html.append("</table>\n```\n")
        return "\n".join(html)
    return render_table()
import glob

def render_features_formats_data():
    trie = Trie()
    for entry in glob.glob("qmd-files/**/*.qmd", recursive=True):
        feature = entry.split("/")[1:]
        format = feature.pop().split(".")[0]
        trie.insert(feature, {
            "feature": "/".join(feature),
            "format": format,
            "file": "<a href='%s' target='_blank'><i class='fa-solid fa-link' aria-label='link'></i></a>" % entry
        })
    entries = trie.tabulator()

    return "```{=html}\n<script type='text/javascript'>\nvar tableData = %s;\n</script>\n```\n" % json.dumps(entries, indent=2)