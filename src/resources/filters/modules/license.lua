-- license.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- read and replace the license field
-- with reshaped data that has been 
-- restructured into the standard license
-- format

local constants = require("modules/constants")

local function ccLicenseUrl(type, lang, version) 
  local langStr = 'en'
  if lang ~= nil then
    langStr = pandoc.utils.stringify(lang)
  end
  if langStr:lower() == 'en' then
    return 'https://creativecommons.org/licenses/' .. type:lower() .. '/' .. version .. '/'
  else 
    return 'https://creativecommons.org/licenses/' .. type:lower() .. '/' .. version .. '/deed.' .. langStr:lower()
  end 
end

local licenses = {  
  ["cc by"] = {
    type = "creative-commons",
    licenseUrl = function (lang, version) 
      return ccLicenseUrl("by", lang, version)
    end
  },
  ["cc by-sa"] = {
    type = "creative-commons",
    licenseUrl = function (lang, version) 
      return ccLicenseUrl("by-sa", lang, version)
    end
  },
  ["cc by-nd"] = {
    type = "creative-commons",
    licenseUrl = function (lang, version) 
      return ccLicenseUrl("by-nd", lang, version)
    end
  },
  ["cc by-nc"] = {
    type = "creative-commons",
    licenseUrl = function (lang, version) 
      return ccLicenseUrl("by-nc", lang, version)
    end
  },
  ["cc by-nc-sa"] = {
    type = "creative-commons",
    licenseUrl = function (lang, version) 
      return ccLicenseUrl("by-nc-sa", lang, version)
    end
  },
  ["cc by-nc-nd"] = {
    type = "creative-commons",
    licenseUrl = function (lang, version) 
      return ccLicenseUrl("by-nc-nd", lang, version)
    end
  },
}

local function parseCCLicense(license) 
  local pattern = '(cc by[^%s]*)%s*([%w%W]*)'
  local base, version = license:match(pattern)
  if base ~= nil then
    if version == '' then
      version = '4.0'
    end
    return {
      base = base,
      version = version
    }
  else
    return nil
  end
end

local function processLicense(el, meta) 
  if pandoc.utils.type(el) == "Inlines" then
    local licenseStr = pandoc.utils.stringify(el)

    local ccLicense = parseCCLicense(licenseStr:lower())
    if ccLicense ~= nil then
      local license = licenses[ccLicense.base]
      if license ~= nil then
        return {
          type = pandoc.Inlines(license.type),
          url = pandoc.Inlines(license.licenseUrl(meta.lang, ccLicense.version)),
          text = pandoc.Inlines('')
        }
      end
    end
    return {
      text = el
    }
  else 
    return el
  end
end

local function processCopyright(el) 
  if pandoc.utils.type(el) == "Inlines" then
    return {
      statement = el
    }
  else 
    if el[constants.kYear] then
      local year = el[constants.kYear]
      if pandoc.utils.type(year) == "Inlines" then
        local yearStr = pandoc.utils.stringify(year)
        if yearStr:find(',') then
          -- expands a comma delimited list
          local yearStrs = split(yearStr, ',')
          local yearList = pandoc.List()
          for i, v in ipairs(yearStrs) do
            yearList:insert(pandoc.Inlines(v))
          end
          el[constants.kYear] = yearList
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
            el[constants.kYear] = yearList
          end
        end

      end
    end
    return el
  end
end

local function processLicenseMeta(meta)
  if meta then
    local licenseMeta = meta[constants.kLicense]
    if licenseMeta then
      if pandoc.utils.type(licenseMeta) == "List" then
        local normalizedEls = {}
        for i,v in ipairs(licenseMeta) do        
          local normalized = processLicense(v, meta)
          tappend(normalizedEls, {normalized})
        end
        meta[constants.kLicense] = normalizedEls
      elseif pandoc.utils.type(licenseMeta) == "Inlines" then
        meta[constants.kLicense] = {processLicense(licenseMeta, meta)}
      end
    end


    local copyrightMeta = meta[constants.kCopyright]
    if copyrightMeta then
        meta[constants.kCopyright] = processCopyright(copyrightMeta)
    end
  end
  return meta
end


return {
  processLicenseMeta = processLicenseMeta,
  constants = {
    license = constants.kLicense,
    copyright = constants.kCopyright
  }
}
