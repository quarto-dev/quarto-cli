-- astpipeline.lua
-- Copyright (C) 2023 Posit Software, PBC

function quarto_ast_pipeline()
  local patterns = require("modules/patterns")
  local constants = require("modules/constants")

  local function astpipeline_process_tables()
    local function replace_spaces_not_in_tags(text)
      local parts = {}
      local intag = false
      local lastchange = 1
      for i = 1, #text do
        local char = text:sub(i, i)
        if not intag then
          if char == '<' then
            intag = true
          elseif char == ' ' then
            table.insert(parts, text:sub(lastchange, i-1))
            table.insert(parts, '&nbsp;')
            lastchange = i+1
          end
        else
          if char == '>' then
            intag = false
          end
        end
      end
      table.insert(parts, text:sub(lastchange))
      return table.concat(parts, '')
    end

    local function preprocess_table_text(src)
      -- html manipulation with regex is fraught, but these specific
      -- changes are safe assuming that no one is using quarto- as
      -- a prefix for dataset attributes in the tables.
      -- See
      -- * https://www.w3.org/html/wg/spec/syntax.html#start-tags
      -- * https://www.w3.org/html/wg/spec/syntax.html#end-tags
    
      src = src:gsub("<th([%s>])", "<td data-quarto-table-cell-role=\"th\"%1")
      src = src:gsub("</th([%s>])", "</td%1")
      src = src:gsub("<table([%s>])", "<table data-quarto-postprocess=\"true\"%1")
    
      return src
    end
    local function juice(htmltext)
      -- return htmltext
      return pandoc.system.with_temporary_directory('juice', function(tmpdir)
        -- replace any long data uris with uuids
        local data_uri_uuid = '273dae7e-3633-4385-9b0c-203d2d7a2d37'
        local data_uris = {}
        local data_uri_regex = 'data:image/[a-z]+;base64,[a-zA-Z0-9+/]+=*'
        htmltext = htmltext:gsub(data_uri_regex, function(data_uri)
          -- juice truncates around 15k characters; let's guard any over 2000 characters
          if #data_uri > 2000 then
            table.insert(data_uris, data_uri)
            return data_uri_uuid
          else
            return data_uri
          end
        end)
        local juice_in = pandoc.path.join({tmpdir, 'juice-in.html'})
        local jin = assert(io.open(juice_in, 'w'))
        jin:write(htmltext)
        jin:flush()
        local quarto_path = quarto.config.cli_path()
        local jout, jerr = io.popen(quarto_path .. ' run ' ..
            pandoc.path.join({os.getenv('QUARTO_SHARE_PATH'), 'scripts', 'juice.ts'}) .. ' ' ..
            juice_in, 'r')
        if not jout then
          quarto.log.error('Running juice failed with message: ' .. (jerr or "Unknown error"))
          return htmltext
        end
        local content = jout:read('a')
        local success, _, exitCode = jout:close()
        -- Check the exit status
        if not success then
          quarto.log.error("Running juice failed with exit code: " .. (exitCode or "unknown exit code"))
          return htmltext
        else
          local index = 1
          content = content:gsub(data_uri_uuid:gsub('-', '%%-'), function(_)
            local data_uri = data_uris[index]
            index = index + 1
            return data_uri
          end)
          return content
        end
      end)
    end   
    local function should_handle_raw_html_as_table(el)
      if not _quarto.format.isRawHtml(el) then
        return nil
      end
      -- See https://github.com/quarto-dev/quarto-cli/issues/8670
      -- and https://quarto.org/docs/authoring/tables.html#library-authors
      -- for the motivation for this change.
      if string.find(el.text, patterns.html_disable_table_processing_comment) then
        return nil
      end
      -- if we have a raw html table in a format that doesn't handle raw_html
      -- then have pandoc parse the table into a proper AST table block
      -- we're already at a state of sin here, cf https://stackoverflow.com/a/1732454
      -- but this is important enough to do a little more work anyway
      local pat = patterns.html_table
      local i, j = string.find(el.text, pat)
      if i == nil then
        return nil
      end
      return true
    end
    local function handle_raw_html_as_table(el)
      local eltext
      -- trim leading and trailing spaces
      el.text = el.text:gsub("^%s*(.-)%s*$", "%1")

      if(_quarto.format.isTypstOutput()) then
        eltext = juice(el.text)
      else
        eltext = el.text
      end
  
      local blocks = pandoc.Blocks({})
      local start = patterns.html_start_tag("table")
      local finish = patterns.html_end_tag("table")
  
  
      local cursor = 1
      local len = string.len(eltext)
  
      while cursor < len do
        -- find the first table start tag
        local i, j = string.find(eltext, start, cursor)
        if i == nil then
          -- no more tables
          break
        end
  
        -- find the closest table end tag 
        -- that produces a valid table parsing from Pandoc
        local cursor_2 = j + 1
        local nesting = 1
        while cursor_2 < len do
          local k1, l1 = string.find(eltext, start, cursor_2)
          local k2, l2 = string.find(eltext, finish, cursor_2)
          if k1 == nil and k2 == nil then
            cursor = len
            break
          end
          if k1 and (k2 == nil or k1 < k2) then
            nesting = nesting + 1
            cursor_2 = l1 + 1
          else
            -- not k1 or k1 >= k2
            nesting = nesting - 1
            cursor_2 = l2 + 1
            if nesting == 0 then
              local tableHtml = string.sub(eltext, i, l2)
              -- Pandoc's HTML-table -> AST-table processing does not faithfully respect
              -- `th` vs `td` elements. This causes some complex tables to be parsed incorrectly,
              -- and changes which elements are `th` and which are `td`.
              --
              -- For quarto, this change is not acceptable because `td` and `th` have
              -- accessibility impacts (see https://github.com/rstudio/gt/issues/678 for a concrete
              -- request from a screen-reader user).
              --
              -- To preserve td and th, we replace `th` elements in the input with 
              -- `td data-quarto-table-cell-role="th"`. 
              -- 
              -- Then, in our HTML postprocessor,
              -- we replace th elements with td (since pandoc chooses to set some of its table
              -- elements as th, even if the original table requested not to), and replace those 
              -- annotated td elements with th elements.
              tableHtml = preprocess_table_text(tableHtml)
              local tableDoc = pandoc.read(tableHtml, "html+raw_html")
              local found = false
              local skip = false
              _quarto.traverser(tableDoc, {
                Table = function(table)
                  found = true
                  if table.attributes[constants.kDisableProcessing] == "true" then
                    skip = true
                  end
                end,
              })
              if #tableDoc.blocks ~= 1 then
                warn("Unable to parse table from raw html block: skipping.")
                skip = true
              end
              if found and not skip then
                flags.has_tables = true
                if cursor ~= i then
                  blocks:insert(pandoc.RawBlock(el.format, string.sub(eltext, cursor, i - 1)))
                end
                blocks:insert(tableDoc.blocks[1])
              end
              cursor = l2 + 1
              break
            end
          end
        end
      end
      if #blocks == 0 then
        return nil
      end
      if cursor > 1 and cursor <= len then
        blocks:insert(pandoc.RawBlock(el.format, string.sub(eltext, cursor)))
      end
      return _quarto.ast.scaffold_element(blocks)
    end
    local function should_handle_raw_html_as_pre_tag(pre_tag)
      if not _quarto.format.isRawHtml(pre_tag) then
        return nil
      end
      local pat = patterns.html_pre_tag
      local i, j = string.find(pre_tag.text, pat)
      if i == nil then
        return nil
      end
      return true
    end
    local function handle_raw_html_as_pre_tag(pre_tag)
      local eltext
      if(_quarto.format.isTypstOutput()) then
        eltext = juice(pre_tag.text)
      else
        eltext = pre_tag.text
      end
  
      local preContentHtml = eltext:match('<pre[^>]*>(.*)</pre>')
      if not preContentHtml then
        quarto.log.error('no pre', eltext:sub(1,1700))
        return nil
      end
      preContentHtml = replace_spaces_not_in_tags(preContentHtml)
      preContentHtml = preContentHtml:gsub('\n','<br />')
      local preDoc = pandoc.read(preContentHtml, "html+raw_html")
      local block1 = preDoc.blocks[1]
      local blocks = pandoc.Blocks({
        pandoc.Div(block1, pandoc.Attr("", {}, {style = 'font-family: Inconsolata, Roboto Mono, Courier New;'}))
      })
      return _quarto.ast.scaffold_element(blocks)
    end
    
    local disable_html_table_processing = false
    local disable_html_pre_tag_processing = false
    if param(constants.kHtmlTableProcessing) == "none" then
      disable_html_table_processing = true
    end
    if param(constants.kHtmlPreTagProcessing) == "none" then
      disable_html_pre_tag_processing = true
    end
    
    local filter = {
      traverse = 'topdown',
      Div = function(div)
        if div.attributes[constants.kHtmlTableProcessing] and not disable_html_table_processing then
          -- catch and remove attributes
          local htmlTableProcessing = div.attributes[constants.kHtmlTableProcessing]
          div.attributes[constants.kHtmlTableProcessing] = nil
          if htmlTableProcessing == "none" then
            if div.attr == pandoc.Attr() then
              -- if no other attributes are set on the div, don't keep it
              return div.content, false
            else
              -- when set on a div like div.cell-output-display, we need to keep it
              return div, false
            end
          end
        end
        if div.attributes[constants.kHtmlPreTagProcessing] and not disable_html_pre_tag_processing then
          local htmlPreTagProcessing = div.attributes[constants.kHtmlPreTagProcessing]
          if htmlPreTagProcessing == "parse" then
            local pre_tag = quarto.utils.match('Div/[1]/RawBlock')(div)
            if pre_tag and should_handle_raw_html_as_pre_tag(pre_tag) then
              return handle_raw_html_as_pre_tag(pre_tag), false
            end
          end
        end
      end,
      RawBlock = function(el)
        if not should_handle_raw_html_as_table(el) or disable_html_table_processing then
          return nil
        end
        return handle_raw_html_as_table(el)
      end  
    };

    -- table_merge_raw_html from table-rawhtml.lua
    if _quarto.format.isHtmlOutput() then
      filter.Blocks = function(blocks)
        local pending_raw = pandoc.List()
        local next_element_idx = 1
        for _, el in ipairs(blocks) do
          if _quarto.format.isRawHtml(el) and
             el.text:find(patterns.html_table_tag_name) then
            pending_raw:insert(el.text)
          else
            if next(pending_raw) then
              blocks[next_element_idx] =
                pandoc.RawBlock("html", table.concat(pending_raw, "\n"))
              pending_raw = pandoc.List()
              next_element_idx = next_element_idx + 1
            end
            blocks[next_element_idx] = el
            next_element_idx = next_element_idx + 1
          end
        end
        if #pending_raw > 0 then
          blocks[next_element_idx] =
            pandoc.RawBlock("html", table.concat(pending_raw, "\n"))
          next_element_idx = next_element_idx + 1
        end
        for i = next_element_idx, #blocks do
          blocks[i] = nil
        end
        return blocks
      end      
    end

    return filter
  end

  return {
    { name = "astpipeline-process-list-tables",
      filter = _quarto.modules.listtable.list_table_filter(),
      traverser = 'jog',
    },
    
    { name = "astpipeline-process-tables",
      filter = astpipeline_process_tables(),
      traverser = 'jog',
    },
    
    { name = "normalize-combined-1",
      filter = combineFilters({
          extract_latex_quartomarkdown_commands(),
          forward_cell_subcaps(),
          parse_extended_nodes(),
          code_filename(),
          normalize_fixup_data_uri_image_extension(),
          {
            Str = function(el)
                if string.match(el.text, ":::(:*)") then 
                  local error_message = 
                    "\nThe following string was found in the document: " .. el.text .. 
                    "\n\nThis usually indicates a problem with a fenced div in the document. Please check the document for errors."
                  warn(error_message)
                end
            end
          },
      }),
      traverser = 'jog',
    },

    { 
      name = "normalize-combine-2", 
      filter = combineFilters({
          parse_md_in_html_rawblocks(),
          parse_floatreftargets(),
          parse_blockreftargets()
      }),
    },
  }
end
