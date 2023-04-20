-- license.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- read and replace the license field
-- with reshaped data that has been 
-- restructured into the standard license
-- format

local kLicense = "license"
local kCopyright = "copyright"

local kYear = "year"


local function ccLicenseUrl(type, lang) 
  local langStr = 'en'
  if lang ~= nil then
    langStr = pandoc.utils.stringify(lang)
  end
  if langStr:lower() == 'en' then
    return 'https://creativecommons.org/licenses/' .. type:lower() .. '/4.0/'
  else 
    return 'https://creativecommons.org/licenses/' .. type:lower() .. '/4.0/deed.' .. langStr:lower()
  end 
end

local licenses = {  
  ["cc by"] = {
    type = "creative-commons",
    licenseUrl = function (lang) 
      return ccLicenseUrl("by", lang)
    end
  },
  ["cc by-sa"] = {
    type = "creative-commons",
    licenseUrl = function (lang) 
      return ccLicenseUrl("by-sa", lang)
    end
  },
  ["cc by-nd"] = {
    type = "creative-commons",
    licenseUrl = function (lang) 
      return ccLicenseUrl("by-nd", lang)
    end
  },
  ["cc by-nc"] = {
    type = "creative-commons",
    licenseUrl = function (lang) 
      return ccLicenseUrl("by-nc", lang)
    end
  },
}

function processLicense(el, meta) 
  if pandoc.utils.type(el) == "Inlines" then
    local licenseStr = pandoc.utils.stringify(el)
    local license = licenses[licenseStr:lower()]
    if license ~= nil then
      return {
        type = pandoc.Inlines(license.type),
        url = pandoc.Inlines(license.licenseUrl(meta.lang)),
        text = pandoc.Inlines('')
      }
    else
      return {
        text = el
      }
    end
  else 
    return el
  end
end

function processCopyright(el) 
  if pandoc.utils.type(el) == "Inlines" then
    return {
      statement = el
    }
  else 
    if el[kYear] then
      local year = el[kYear]
      if pandoc.utils.type(year) == "Inlines" then
        local yearStr = pandoc.utils.stringify(year)
        if yearStr:find(',') then
          -- expands a comma delimited list
          local yearStrs = split(yearStr, ',')
          local yearList = pandoc.List()
          for i, v in ipairs(yearStrs) do
            yearList:insert(pandoc.Inlines(v))
          end
          el[kYear] = yearList
        elseif yearStr:find('-') then
          -- expands a range
          local years = split(yearStr, '-')

          -- must be exactly two years in the range
          if #years == 2 then
            local start = tonumber(years[1])
            local finish = tonumber(years[2])

            -- if they're in the wrong order, just fix it
            if start > finish then
              local oldstart = start
              start = finish
              finish = oldstart
            end
            
            -- make the list of years
            local yearList = pandoc.List()
            for i=start,finish do
              yearList:insert(pandoc.Inlines(string.format("%.0f",i)))
            end
            el[kYear] = yearList
          end
        end

      end
    end
    return el
  end
end

function processLicenseMeta(meta)
  if meta then
    local licenseMeta = meta[kLicense]
    if licenseMeta then
      if pandoc.utils.type(licenseMeta) == "List" then
        local normalizedEls = {}
        for i,v in ipairs(licenseMeta) do        
          local normalized = processLicense(v, meta)
          tappend(normalizedEls, {normalized})
        end
        meta[kLicense] = normalizedEls
      elseif pandoc.utils.type(licenseMeta) == "Inlines" then
        meta[kLicense] = {processLicense(licenseMeta, meta)}
      end
    end


    local copyrightMeta = meta[kCopyright]
    if copyrightMeta then
        meta[kCopyright] = processCopyright(copyrightMeta)
    end
  end
  return meta
end


return {
  processLicenseMeta = processLicenseMeta,
  constants = {
    license = kLicense,
    copyright = kCopyright
  }
}

