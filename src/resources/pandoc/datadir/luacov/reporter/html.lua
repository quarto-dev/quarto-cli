local luacov_reporter = require("luacov.reporter")

local reporter = {}

local HTML_HEADER, HTML_FOOTER, HTML_TOTAL, HTML_FILE_HEADER, HTML_FILE_FOOTER, HTML_LINE_HIT, HTML_LINE_MIS

local function parse_template(template, values)
    local content = template:gsub("{{([a-z_]+)}}", function(key)
        return values[key]
    end)
    return content
end

----------------------------------------------------------------
--- parse template
do
    local dir = string.gsub(debug.getinfo(1).source, "^@(.+/)[^/]+$", "%1")
    local dir_sep = package.config:sub(1, 1)
    if not dir_sep:find("[/\\]") then
        dir_sep = "/"
    end
    local template = require("luacov.reporter.html.template")

    --- Removes a prefix from a string if it's present.
    -- @param str a string.
    -- @param prefix a prefix string.
    -- @return original string if does not start with prefix
    -- or string without prefix.
    local function unprefix(str, prefix)
        if str:sub(1, #prefix) == prefix then
            return str:sub(#prefix + 1)
        else
            return str
        end
    end

    -- Returns contents of a file or nil + error message.
    local function read_asset(name)
        local f, open_err = io.open(dir .. "html" .. dir_sep .. name, "rb")

        if not f then
            error(unprefix(open_err, name .. ": "))
        end

        local contents, read_err = f:read("*a")
        f:close()

        if contents then
            return contents
        else
            error(read_err)
        end
    end

    local asset_types = {
        script = template.SCRIPT,
        style = template.STYLE,
    }

    local assets_content = {}
    for tag, assets in pairs(asset_types) do
        for _, name in ipairs(assets) do
            local content = read_asset(name)
            if (not assets_content[tag]) then
                assets_content[tag] = ""
            end
            if (tag == "script") then
                assets_content[tag] = assets_content[tag] .. "\n   <script type=\"text/javascript\">\n      "
            else
                assets_content[tag] = assets_content[tag] .. "\n   <" .. tag .. ">\n      "
            end
            assets_content[tag] = assets_content[tag] .. content:gsub("\n", "\n      ") .. "\n   </" .. tag .. ">\n"
        end
    end

    HTML_HEADER = parse_template(template.HTML_HEADER, {
        style = assets_content.style
    })

    HTML_FOOTER = parse_template(template.HTML_FOOTER, {
        script = assets_content.script,
        timestamp = os.date("%Y-%m-%d %H:%M:%S", os.time())
    })

    HTML_TOTAL = template.HTML_TOTAL
    HTML_FILE_HEADER = template.HTML_FILE_HEADER
    HTML_FILE_FOOTER = template.HTML_FILE_FOOTER
    HTML_LINE_HIT = template.HTML_LINE_HIT
    HTML_LINE_MIS = template.HTML_LINE_MIS
end
----------------------------------------------------------------

--- Encodes the HTML entities in a string. Helpfull to avoid XSS.
-- @param s (String) String to escape.
local function escape_html(s)
    return (string.gsub(s, "[}{\">/<'&]", {
        ["&"] = "&amp;",
        ["<"] = "&lt;",
        [">"] = "&gt;",
        ['"'] = "&quot;",
        ["'"] = "&#39;",
        ["/"] = "&#47;"
    }))
end

local HtmlReporter = setmetatable({}, luacov_reporter.ReporterBase)
do
    HtmlReporter.__index = HtmlReporter

    function HtmlReporter:on_start()
        self._summary = {}
        self:write(HTML_HEADER)
    end

    local HTML = ""
    local FILE_HTML

    local function write_to_html(content)
        HTML = HTML .. content
    end

    local function write_to_file_html(template, values)
        FILE_HTML = FILE_HTML .. parse_template(template, values)
    end

    local function coverage_to_string(hits, missed)
        local total = hits + missed

        if total == 0 then
            total = 1
        end

        return ("%.2f"):format(hits / total * 100.0)
    end

    local function coverage_to_number(hits, missed)
        return tonumber(coverage_to_string(hits, missed))
    end

    local function filename_to_id(filename)
        return filename:lower():gsub("(.lua)$", ""):gsub("([^a-z0-9_]+)", function(_key)
            return "-"
        end)
    end

    local function coverage_to_css_class(hits, missed)
        local coverageNum = coverage_to_number(hits, missed)
        local cssClass
        if (coverageNum < 40) then
            cssClass = "danger"
        elseif (coverageNum < 60) then
            cssClass = "warning"
        elseif (coverageNum < 75) then
            cssClass = "success-low"
        elseif (coverageNum < 90) then
            cssClass = "success-medium"
        else
            cssClass = "success-high"
        end
        return cssClass
    end

    --luacheck: no self
    function HtmlReporter:on_new_file(_filename)
        FILE_HTML = ""
    end

    function HtmlReporter:on_file_error(filename, error_type, message)
        io.stderr:write(("Couldn't %s %s: %s\n"):format(error_type, filename, message))
    end

    function HtmlReporter:on_empty_line(_filename, _lineno, line)
        if line == "" then
            FILE_HTML = FILE_HTML .. "\n"
        else
            FILE_HTML = FILE_HTML .. escape_html(line) .. "\n"
        end
    end

    function HtmlReporter:on_mis_line(_filename, lineno, line)
        write_to_file_html(HTML_LINE_MIS, {
            line = escape_html(line),
            lineno = lineno,
        })
    end

    function HtmlReporter:on_hit_line(_filename, lineno, line, hits)
        write_to_file_html(HTML_LINE_HIT, {
            hits = hits,
            line = escape_html(line),
            lineno = lineno,
        })
    end

    function HtmlReporter:on_end_file(filename, hits, miss)

        local coverage = coverage_to_string(hits, miss)

        write_to_html(parse_template(HTML_FILE_HEADER, {
            id = filename_to_id(filename),
            hits = hits,
            miss = miss,
            coverage = coverage,
            css_class = coverage_to_css_class(hits, miss),
            filename = filename
        }))

        write_to_file_html(HTML_FILE_FOOTER, {
            hits = hits,
            miss = miss,
            coverage = coverage,
            filename = filename,
        })
        write_to_html(FILE_HTML)
        self._summary[filename] = { hits = hits, miss = miss }
    end

    function HtmlReporter:on_end()
        local total_hits, total_missed = 0, 0

        for _, filename in ipairs(self:files()) do
            local summary = self._summary[filename]
            if summary then
                local hits, missed = summary.hits, summary.miss
                total_hits = total_hits + hits
                total_missed = total_missed + missed
            end
        end

        self:write(parse_template(HTML_TOTAL, {
            hits = total_hits,
            miss = total_missed,
            css_class = coverage_to_css_class(total_hits, total_missed),
            coverage = tonumber(coverage_to_string(total_hits, total_missed)),
        }))
        self:write(HTML)
        self:write(HTML_FOOTER)
    end
end
----------------------------------------------------------------

function reporter.report()
    return luacov_reporter.report(HtmlReporter)
end

return reporter
