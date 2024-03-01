import yaml
import json
import glob

class Trie:

    def __init__(self):
        self.children = {}
        self.values = []
        self.entry = ""

    def insert(self, path, value):
        node = self
        for c in path:
            if c not in node.children:
                node.children[c] = Trie()
            node = node.children[c]
        node.values.append(value)
        node.entry = value["entry"]

    def json(self):
        if not self.children:
            return self.values
        return {k: v.json() for k, v in self.children.items()}
    
    def tabulator_leaf(self):
        result = {}
        for v in self.values:
            result[v["format"]] = v["table_cell"]
        return result

    def tabulator(self):
        if not self.children:
            return []
        result = []
        for k, v in self.children.items():
            children = v.tabulator()
            feature = k
            if v.entry != "":
                link = "<a href='%s' target='_blank'><i class='fa-solid fa-link' aria-label='link'></i></a>" % v.entry
                feature = "%s %s" % (link, k)
            d = {
                "sort_key": k,
                "feature": feature,
                **v.tabulator_leaf()
            }
            if children:
                d["_children"] = children
            result.append(d)
        result.sort(key=lambda x: x["sort_key"])
        return result

    def depth(self):
        if not self.children:
            return 0
        return max([v.depth() for v in self.children.values()]) + 1

    def size(self):
        if not self.children:
            return 1
        return sum([v.size() for v in self.children.values()])
    
    def walk(self, visitor, path = None):
        if path is None:
            path = []
        visitor(self, path)
        for k, v in self.children.items():
            v.walk(visitor, path + [k])

def extract_metadata_from_file(file):
    with open(file, "r") as f:
        lines = f.readlines()
    start = None
    end = None
    for i, line in enumerate(lines):
        if line.strip() == "---":
            if start is None:
                start = i
            else:
                end = i
                metadata = yaml.load("".join(lines[start+1:end]), Loader=yaml.SafeLoader)
                return metadata
    raise ValueError("No metadata found in file %s" % file)

def table_cell(entry, _feature, _format_name, format_config):
    if type(format_config) == str:
        format_config = {}
    result = []
    quality = format_config.get("quality", "unknown")
    if quality is not None:
        if type(quality) == str:
            quality = quality.lower()
        qualities = {-1: "&#x1F6AB;", 0: "&#x26A0;", 1: "&#x2713;", 2: "&#x2713;&#x2713;", "unknown": "&#x2753;", "na": "NA"}
        colors = {-1: "bad", 0: "ok", 1: "good", 2: "good", "unknown": "unknown", "na": "na"}
        color = colors[quality]
        quality_icon = qualities.get(quality, "&#x2753;")
        result.append(f"<span class='{color}'>{quality_icon}</span>")
    comment = format_config.get("comment", None)
    if comment is not None:
        # This is going to be an accessibility problem
        result.append(f"<span title='{comment}'>&#x1F4AC;</span>")
    return "".join(result)

def compute_trie():
    trie = Trie()
    for entry in glob.glob("qmd-files/**/document.qmd", recursive=True):
        feature = entry.split("/")[1:-1]
        front_matter = extract_metadata_from_file(entry)
        try:
            format = front_matter["format"]
        except KeyError:
            raise Exception("No format found in %s" % entry)
        for format_name, format_config in format.items():
            trie.insert(feature, {
                "feature": "/".join(feature),
                "format": format_name,
                "entry": entry,
                "format_config": format_config,
                "table_cell": table_cell(entry, feature, format_name, format_config)
            })
    return trie

def render_features_formats_data(trie = None):
    if trie is None:
        trie = compute_trie()
    entries = trie.tabulator()
    return "```{=html}\n<script type='text/javascript'>\nvar tableData = %s;\n</script>\n```\n" % json.dumps(entries, indent=2)

def compute_quality_summary(trie = None):
    if trie is None:
        trie = compute_trie()
    quality_summary = {"unknown": 0, -1: 0, 0: 0, 1: 0, 2: 0, "na": 0}
    n_rows = 0
    def visit(node, _path):
        nonlocal n_rows
        if not node.children or len(node.values):
            n_rows = n_rows + 1
        for v in node.values:
            config = v["format_config"]
            if type(config) == str:
                config = {}
            quality = config.get("quality", "unknown")
            if type(quality) == str:
                quality = quality.lower()
            if quality_summary.get(quality) is None:
                raise ValueError("Invalid quality value %s" % quality)
            quality_summary[quality] += 1
    trie.walk(visit)
    return {"n_rows": n_rows, "quality": quality_summary}