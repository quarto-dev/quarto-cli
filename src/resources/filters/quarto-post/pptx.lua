function render_pptx_fixups() 
  if not _quarto.format.isPowerPointOutput() then
    return {}
  end
  return {
    -- Remove any non-openxml RawBlock as it seems to mess pandoc Powerpoint writer
    -- https://github.com/quarto-dev/quarto-cli/issues/9680
    -- https://github.com/quarto-dev/quarto-cli/issues/9681
    RawBlock = function(el)
      if el.format ~= "openxml" then
        return {}
      end
      return el
    end
  }
end 