-- llms.lua
-- Copyright (C) 2020-2026 Posit Software, PBC

local skippable_classes = {
    ["quarto-title"] = true,
    ["quarto-title-block"] = true,
    ["quarto-title-meta"] = true,
    ["sourceCode"] = true,
    ["code-with-filename"] = true,
    ["code-copy-outer-scaffold"] = true,
    ["quarto-figure"] = true,
    ["quarto-figure-center"] = true,
    ["quarto-figure-left"] = true,
    ["quarto-figure-right"] = true,
    ["quarto-float"] = true,
    ["quarto-float-fig"] = true,
    ["figure"] = true,
}
local droppable_classes = {
    ["navbar-container"] = true,
    ["nav-footer"] = true,
    ["listing-actions-group"] = true,
    ["listing-no-matching"] = true,
    ["code-with-filename-file"] = true,
    ["listing-categories"] = true,
    ["quarto-listing-category"] = true,  -- category filter sidebar
    ["listing-category"] = true,  -- individual category badges
}
local droppable_ids = {
    ["quarto-header"] = true,
    ["quarto-search-results"] = true,
}
local removable_classes = {
    ["anchored"] = true,
    ["sourceCode"] = true,
    ["md"] = true,
    ["code-with-copy"] = true,
    ["no-external"] = true,
    ["no-anchor"] = true,
}
local removable_attributes = {
    "categories",
    "listing-date-sort",
    "listing-file-modified-sort",
    "listing-date-modified-sort",
    "listing-reading-time-sort",
    "listing-word-count-sort",
    "aria-labelledby",
    "role",
    "onclick"
}

local function starts_with_level(cls)
    return cls:match("^level%d+$") ~= nil
end
local function starts_with_layout(cls)
    return cls:match("^quarto%-layout.+$") ~= nil
end
local function any_droppable(cls)
    return droppable_classes[cls]
end
local function any_skippable(cls)
    return skippable_classes[cls]
end

local function clean_element(el)
    el.classes = el.classes:filter(function(cls) return not removable_classes[cls] end)
    for i, k in ipairs(removable_attributes) do
        el.attributes[k] = nil
    end
end

local function handle_callout(div)
    local kind = "NOTE" -- NOTE, TIP, IMPORTANT, WARNING, CAUTION
    div.classes:map(function(cls)
        local callout_type = cls:match("^callout%-(%w+)$")
        if callout_type then
            local type_upper = callout_type:upper()
            if type_upper == "NOTE" or type_upper == "TIP" or type_upper == "IMPORTANT" or type_upper == "WARNING" or type_upper == "CAUTION" then
                kind = type_upper
            end
        end
    end)
    -- Use Strong text for the callout type marker instead of RawInline
    local title_node = pandoc.Plain({pandoc.Strong({pandoc.Str(kind .. ":")}), pandoc.SoftBreak()})
    local new_content = pandoc.Blocks(title_node)
    div.content:walk({
        Div = function(inner)
            if inner.classes:includes("callout-body-container") then
                new_content:extend(inner.content)
            end
        end
    })
    return pandoc.BlockQuote(new_content)
end

function Header(header)
    header.classes = header.classes:filter(function(cls) return not removable_classes[cls] end)
    header.attributes["anchor-id"] = nil
    if header.level == 1 then
        header.classes = header.classes:filter(function(cls) return cls ~= "title" end)
        header.identifier = ""
    end
    clean_element(header)
    return header
end

function Inline(inline)
    if type(inline.identifier) == "string" then
        clean_element(inline)
        return inline
    end
end

function Block(block)
    if type(block.identifier) == "string" then
        clean_element(block)
        return block
    end
end


function Link(link)
    clean_element(link)

    -- Check if link has meaningful text content
    local has_content = false
    for _, item in ipairs(link.content) do
        if item.t == "Str" and item.text:match("%S") then
            has_content = true
            break
        elseif item.t ~= "Space" and item.t ~= "SoftBreak" and item.t ~= "LineBreak" then
            has_content = true
            break
        end
    end

    -- Drop empty links (return just the content, which may be empty)
    if not has_content then
        return link.content
    end

    if link.target and link.target:match("%.html$") then
        link.target = link.target:gsub("%.html$", ".llms.md")
        if link.classes:includes("btn") then
            link.attr = pandoc.Attr()
        end
        return link
    end
    return link
end

function CodeBlock(code)
    code.classes = code.classes:filter(function(cls) return not removable_classes[cls] end)
    return code
end

-- Handle raw HTML blocks that contain figures/images
function RawBlock(raw)
    if raw.format == "html" then
        -- Try to extract images from figure elements
        local img_src = raw.text:match('<img[^>]+src="([^"]+)"')
        local img_alt = raw.text:match('<figcaption[^>]*>([^<]+)</figcaption>')
                     or raw.text:match('alt="([^"]+)"')
                     or ""

        if img_src then
            -- Convert to a markdown image
            return pandoc.Para({pandoc.Image({pandoc.Str(img_alt)}, img_src, img_alt)})
        end
    end
    return raw
end

function Div(div)

    if div.classes:includes("callout") then
        return handle_callout(div)
    end

    if #div.classes:filter(any_droppable) > 0 or droppable_ids[div.identifier] then
        return {}
    end
    if #div.content == 0 then
        return {}
    end

    local skippable =
      (div.classes:includes("section") and div.classes:filter(starts_with_level)) or
      #div.classes:filter(starts_with_layout) > 0 or
      div.identifier == "quarto-document-content" or
      #(div.classes:filter(any_skippable)) > 0

    if skippable then
        return div.content
    end
    clean_element(div)
    return div
end