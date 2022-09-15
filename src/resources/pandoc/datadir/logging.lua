--[[
    logging.lua: pandoc-aware logging functions (can also be used standalone)
    Copyright:   (c) 2022 William Lupton
    License:     MIT - see LICENSE file for details
    Usage:       See README.md for details
]]

-- if running standalone, create a 'pandoc' global
if not pandoc then
    _G.pandoc = {utils = {}}
end

-- if there's no pandoc.utils, create a local one
if not pcall(require, 'pandoc.utils') then
    pandoc.utils = {}
end

-- if there's no pandoc.utils.type, create a local one
if not pandoc.utils.type then
    pandoc.utils.type = function(value)
        local typ = type(value)
        if not ({table=1, userdata=1})[typ] then
            -- unchanged
        elseif value.__name then
            typ = value.__name
        elseif value.tag and value.t then
            typ = value.tag
            if typ:match('^Meta.') then
                typ = typ:sub(5)
            end
            if typ == 'Map' then
                typ = 'table'
            end
        end
        return typ
    end
end

-- namespace
local logging = {}

-- helper function to return a sensible typename
logging.type = function(value)
    -- this can return 'Inlines', 'Blocks', 'Inline', 'Block' etc., or
    -- anything that built-in type() can return, namely 'nil', 'number',
    -- 'string', 'boolean', 'table', 'function', 'thread', or 'userdata'
    local typ = pandoc.utils.type(value)

    -- it seems that it can also return strings like 'pandoc Row'; replace
    -- spaces with periods
    -- XXX I'm not sure that this is done consistently, e.g. I don't think
    --     it's done for pandoc.Attr or pandoc.List?
    typ = typ:gsub(' ', '.')

    -- map Inline and Block to the tag name
    -- XXX I guess it's intentional that it doesn't already do this?
    return ({Inline=1, Block=1})[typ] and value.tag or typ
end

-- derived from https://www.lua.org/pil/19.3.html pairsByKeys()
logging.spairs = function(list, comp)
    local keys = {}
    for key, _ in pairs(list) do
        table.insert(keys, tostring(key))
    end
    table.sort(keys, comp)
    local i = 0
    local iter = function()
        i = i + 1
        return keys[i] and keys[i], list[keys[i]] or nil
    end
    return iter
end

-- helper function to dump a value with a prefix (recursive)
-- XXX should detect repetition/recursion
-- XXX would like maxlen logic to apply at all levels? but not trivial
local function dump_(prefix, value, maxlen, level, add)
    local buffer = {}
    if prefix == nil then prefix = '' end
    if level == nil then level = 0 end
    if add == nil then add = function(item) table.insert(buffer, item) end end
    local indent = maxlen and '' or ('  '):rep(level)

    -- get typename, mapping to pandoc tag names where possible
    local typename = logging.type(value)

    -- don't explicitly indicate 'obvious' typenames
    local typ = (({boolean=1, number=1, string=1, table=1, userdata=1})
                 [typename] and '' or typename)

    -- modify the value heuristically
    if ({table=1, userdata=1})[type(value)] then
        local valueCopy, numKeys, lastKey = {}, 0, nil
        for key, val in pairs(value) do
            -- pandoc >= 2.15 includes 'tag', nil values and functions
            if key ~= 'tag' and val and type(val) ~= 'function' then
                valueCopy[key] = val
                numKeys = numKeys + 1
                lastKey = key
            end
        end
        if numKeys == 0 then
            -- this allows empty tables to be formatted on a single line
            value = typename == 'Space' and '' or '{}'
        elseif numKeys == 1 and lastKey == 'text' then
            -- this allows text-only types to be formatted on a single line
            typ = typename
            value = value[lastKey]
            typename = 'string'
        else
            value = valueCopy
        end
    end

    -- output the possibly-modified value
    local presep = #prefix > 0 and ' ' or ''
    local typsep = #typ > 0 and ' ' or ''
    local valtyp = type(value)
    if valtyp == 'nil' then
        add('nil')
    elseif ({boolean=1, number=1, string=1})[valtyp] then
        typsep = #typ > 0 and valtyp == 'string' and #value > 0 and ' ' or ''
        -- don't use the %q format specifier; doesn't work with multi-bytes
        local quo = typename == 'string' and '"' or ''
        add(string.format('%s%s%s%s%s%s%s%s', indent, prefix, presep, typ,
                          typsep, quo, value, quo))
    elseif ({table=1, userdata=1})[valtyp] then
        add(string.format('%s%s%s%s%s{', indent, prefix, presep, typ, typsep))
        -- Attr and Attr.attributes have both numeric and string keys, so
        -- ignore the numeric ones
        -- XXX this is no longer the case for pandoc >= 2.15, so could remove
        --     the special case?
        local first = true
        if prefix ~= 'attributes:' and typ ~= 'Attr' then
            for i, val in ipairs(value) do
                local pre = maxlen and not first and ', ' or ''
                local text = dump_(string.format('%s[%s]', pre, i), val,
                                   maxlen, level + 1, add)
                first = false
            end
        end
        -- report keys in alphabetical order to ensure repeatability
        for key, val in logging.spairs(value) do
            -- pandoc >= 2.15 includes 'tag'
            if not tonumber(key) and key ~= 'tag' then
                local pre = maxlen and not first and ', ' or ''
                local text = dump_(string.format('%s%s:', pre, key), val,
                                   maxlen, level + 1, add)
            end
            first = false
        end
        add(string.format('%s}', indent))
    end
    return table.concat(buffer, maxlen and '' or '\n')
end

logging.dump = function(value, maxlen)
    if maxlen == nil then maxlen = 70 end
    local text = dump_(nil, value, maxlen)
    if #text > maxlen then
        text = dump_(nil, value, nil)
    end
    return text
end

logging.output = function(...)
    local need_newline = false
    for i, item in ipairs({...}) do
        -- XXX space logic could be cleverer, e.g. no space after newline
        local maybe_space = i > 1 and ' ' or ''
        local text = ({table=1, userdata=1})[type(item)] and
            logging.dump(item) or tostring(item)
        io.stderr:write(maybe_space, text)
        need_newline = text:sub(-1) ~= '\n'
    end
    if need_newline then
        io.stderr:write('\n')
    end
end

-- basic logging support (-1=errors, 0=warnings, 1=info, 2=debug, 3=debug2)
-- XXX should support string levels?
logging.loglevel = 0

-- set log level and return the previous level
logging.setloglevel = function(loglevel)
    local oldlevel = logging.loglevel
    logging.loglevel = loglevel
    return oldlevel
end

-- verbosity default is WARNING; --quiet -> ERROR and --verbose -> INFO
-- --trace sets TRACE or DEBUG (depending on --verbose)
if type(PANDOC_STATE) == 'nil' then
    -- use the default level
elseif PANDOC_STATE.trace then
    logging.loglevel = PANDOC_STATE.verbosity == 'INFO' and 3 or 2
elseif PANDOC_STATE.verbosity == 'INFO' then
    logging.loglevel = 1
elseif PANDOC_STATE.verbosity == 'WARNING' then
    logging.loglevel = 0
elseif PANDOC_STATE.verbosity == 'ERROR' then
    logging.loglevel = -1
end

logging.error = function(...)
    if logging.loglevel >= -1 then
        logging.output('(E)', ...)
    end
end

logging.warning = function(...)
    if logging.loglevel >= 0 then
        logging.output('(W)', ...)
    end
end

logging.info = function(...)
    if logging.loglevel >= 1 then
        logging.output('(I)', ...)
    end
end

logging.debug = function(...)
    if logging.loglevel >= 2 then
        logging.output('(D)', ...)
    end
end

logging.debug2 = function(...)
    if logging.loglevel >= 3 then
        logging.warning('debug2() is deprecated; use trace()')
        logging.output('(D2)', ...)
    end
end

logging.trace = function(...)
    if logging.loglevel >= 3 then
        logging.output('(T)', ...)
    end
end

-- for temporary unconditional debug output
logging.temp = function(...)
    logging.output('(#)', ...)
end

return logging
