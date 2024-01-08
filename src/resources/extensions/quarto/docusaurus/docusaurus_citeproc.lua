function Pandoc(doc)
  local result = pandoc.utils.citeproc(doc)
  
  result = result:walk({
    Link = function(link)
      -- replace all links that would be rendered as <...> with explicit raw [...](...)
      -- Docusaurus doesn't like the <...> syntax
      if #link.content > 0 and link.content[1].text == link.target then
        return pandoc.RawInline('markdown', '[' .. link.content[1].text .. '](' .. link.target .. ')')
      end
    end
  })

  local result_str = pandoc.write(result, 'markdown_strict+raw_html+all_symbols_escapable+backtick_code_blocks+fenced_code_blocks+space_in_atx_header+intraword_underscores+lists_without_preceding_blankline+shortcut_reference_links+autolink_bare_uris+emoji+footnotes+gfm_auto_identifiers+pipe_tables+strikeout+task_lists+tex_math_dollars+pipe_tables+tex_math_dollars+header_attributes+raw_html+all_symbols_escapable+backtick_code_blocks+fenced_code_blocks+space_in_atx_header+intraword_underscores+lists_without_preceding_blankline+shortcut_reference_links')
  return pandoc.Pandoc({pandoc.RawBlock('markdown', result_str)})
end