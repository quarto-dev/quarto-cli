-- lua filter for RST-like list-tables in Markdown.
-- Copyright (C) 2021 Martin Fischer, released under MIT license

-- Changes for use in Quarto are
-- Copyright (C) 2025 Posit Software, PBC

-- Get the list of cells in a row.
local row_cells = function (row) return row.cells or {} end

local alignments = {
    d = 'AlignDefault',
    l = 'AlignLeft',
    r = 'AlignRight',
    c = 'AlignCenter'
}

-- This is like assert() but it can take a Block or Blocks 'where' argument
-- and will output the corresponding markdown (truncated at 1024 characters).
local function assert_(assertion, message, where)
    message = message or 'assertion failed!'
    if not assertion then
        local extra = ''
        if where then
            local blocks = pandoc.Blocks(where)
            local markdown = pandoc.write(pandoc.Pandoc(blocks), 'markdown')
            extra = ' at\n' .. markdown:sub(1, 1024) ..
                (#markdown > 1024 and '...' or '')
        end
        error(message .. extra, 2)
    end
end

-- Skip data-pos Divs inserted by the sourcepos extension
local function block_skip_data_pos(block)
    if (block.t == "Div" and block.attr.attributes["data-pos"]) then
        block = block.content[1]
    end
    return block
end

local function blocks_skip_data_pos(blocks)
    local new_blocks = {}
    for _, block in ipairs(blocks) do
        table.insert(new_blocks, block_skip_data_pos(block))
    end
    return new_blocks
end

local function get_colspecs(div_attributes, column_count)
    -- list of (align, width) pairs
    local colspecs = {}

    for i = 1, column_count do
        table.insert(colspecs, {pandoc.AlignDefault, nil})
    end

    if div_attributes.aligns then
        local i = 1
        for a in div_attributes.aligns:gmatch('[^,]+') do
            assert_(alignments[a] ~= nil,
                    "unknown column alignment " .. tostring(a))
            colspecs[i][1] = alignments[a]
            i = i + 1
        end
        div_attributes.aligns = nil
    end

    if div_attributes.widths then
        local total = 0
        local widths = {}
        for w in div_attributes.widths:gmatch('[^,]+') do
            table.insert(widths, tonumber(w))
            total = total + tonumber(w)
        end
        for i = 1, column_count do
            colspecs[i][2] = widths[i] / total
        end
        div_attributes.widths = nil
    end

    return colspecs
end

local function new_table_body(rows, attr, header_col_count)
    attr = attr or {}
    return {
        attr = attr,
        body = rows,
        head = {},
        row_head_columns = header_col_count
    }
end

local function new_cell(contents)
    local attr = {}
    local colspan = 1
    local rowspan = 1
    local align = pandoc.AlignDefault

    contents = blocks_skip_data_pos(contents)

    -- At the time of writing this Pandoc does not support attributes
    -- on list items, so we use empty spans as a workaround.
    if contents[1] and contents[1].content then
        if contents[1].content[1] and contents[1].content[1].t == "Span" then
            if #contents[1].content[1].content == 0 then
                attr = contents[1].content[1].attr
                table.remove(contents[1].content, 1)
                colspan = attr.attributes.colspan or 1
                attr.attributes.colspan = nil
                rowspan = attr.attributes.rowspan or 1
                attr.attributes.rowspan = nil
                align = alignments[attr.attributes.align] or pandoc.AlignDefault
                attr.attributes.align = nil
            end
        end
    end

    return pandoc.Cell(contents, align, rowspan, colspan, attr)
end

local function process(div)
    local class
    local target_classes = {"list-table", "list-table-body"}
    for _, target in ipairs(target_classes) do
        if div.attr.classes:find(target) then
            class = target
            div.attr.classes = div.attr.classes:filter(
                function(cls) return cls ~= target end)
        end
    end
    if class == nil then return nil end
    if #div.content == 0 then return nil end

    local content = blocks_skip_data_pos(div.content)

    local caption = {}

    -- look for a caption in front
    if content[1].t == "Para" then
        local para = table.remove(content, 1)
        caption = {pandoc.Plain(para.content)}
    end
    if #content == 0 then return nil end

    assert_(content[1].t == "BulletList",
            "expected bullet list, found " .. content[1].t, content[1])
    local list = content[1]

    -- also look for a caption in back
    if content[2] and content[2].t == "Para" then
        local para = table.remove(content, 2)
        caption = {pandoc.Plain(para.content)}
    end


    -- rows points to the current body's rows
    local bodies = {attr=nil, {rows={}}}
    local rows = bodies[#bodies].rows

    for i = 1, #list.content do
        local attr = nil
        local items = list.content[i]
        if (#items > 1) then
            local item = block_skip_data_pos(items[1])
            assert_(item.content, "expected list item to have row attrs",
                    item)
            assert_(#item.content == 1, "expected row attrs to contain " ..
                        "only one inline", item.content)
            assert_(item.content[1].t == "Span", "expected row attrs to " ..
                        "contain a span", item.content[1])
            assert_(#item.content[1].content == 0, "expected row attrs " ..
                        "span to be empty", item.content[1])
            attr = item.content[1].attr
            table.remove(items, 1)
        end

        assert_(#items == 1, "expected item to contain only one block", items)

        local item = block_skip_data_pos(items[1])
        if (item.t ~= 'Table') then
            assert_(item.t == "BulletList", "expected bullet list, found " ..
                        item.t, item)
            local cells = {}
            for _, cell_content in pairs(item.content) do
                table.insert(cells, new_cell(cell_content))
            end
            local row = pandoc.Row(cells, attr)
            table.insert(rows, row)

        else
            local tab = item
            -- XXX is there a better way to check that there's no caption?
            assert_((not tab.caption.long or #tab.caption.long == 0) and
                        (not tab.caption.short or #tab.caption.short == 0),
                    "table bodies can't have captions (they'd be " ..
                        "ignored)", tab)
            -- XXX would have to check against default colspecs to know whether
            --     any have been defined?
            -- assert_(#tab.colspecs == 0, "table bodies can't (yet) have " ..
            --         "column specs", tab)
            -- XXX should allow empty headers; this can happen with pipe tables
            -- assert_(not tab.head or #tab.head.rows == 0,
            --         "table bodies can't (yet) have headers", tab)
            assert_(#tab.bodies == 1, "table bodies can't contain other " ..
                        "table bodies", tab)

            if #rows > 0 then
                table.insert(bodies, {attr=nil, rows={}})
                rows = bodies[#bodies].rows
            end

            bodies[#bodies].attr = tab.attr
            for _, row in ipairs(tab.bodies[1].body) do
                table.insert(rows, row)
            end
        end
    end

    -- switch back to the first body
    rows = bodies[1].rows

    local header_row_count = tonumber(div.attr.attributes['header-rows']) or
        (class == 'list-table' and 1 or 0)
    div.attr.attributes['header-rows'] = nil

    local header_col_count = tonumber(div.attr.attributes['header-cols']) or 0
    div.attr.attributes['header-cols'] = nil

    local column_count = 0
    for i = 1, #row_cells(rows[1] or {}) do
        column_count = column_count + row_cells(rows[1])[i].col_span
    end

    local colspecs = get_colspecs(div.attr.attributes, column_count)
    local thead_rows = {}
    for i = 1, header_row_count do
        table.insert(thead_rows, table.remove(rows, 1))
    end

    local new_bodies = {}
    for _, body in ipairs(bodies) do
        if #body.rows > 0 then
            table.insert(new_bodies, new_table_body(body.rows, body.attr,
                                                    header_col_count))
        end
        -- XXX this should be a body property
        header_col_count = 0
    end

    return pandoc.Table(
        {long = caption, short = {}},
        colspecs,
        pandoc.TableHead(thead_rows),
        new_bodies,
        pandoc.TableFoot(),
        div.attr
    )
end

return {
    list_table_filter = function()
        return {Div = process}
    end
}
