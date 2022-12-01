-- license.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- read and replace the license field
-- with reshaped data that has been 
-- restructured into the standard license
-- format

local kLicense = "license"


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

function processLicenseMeta(meta)
  local licenseMeta = meta[kLicense]
  if licenseMeta then
    if pandoc.utils.type(licenseMeta) == "Inlines" then
      local licenseStr = pandoc.utils.stringify(licenseMeta)
      local license = licenses[licenseStr:lower()]
      if license then
        meta[kLicense] = {
          type = license.type,
          url = license.licenseUrl(meta.lang),
          text = pandoc.Inlines('')
        }
      else
        meta[kLicense] = {
          text = licenseMeta
        }
      end
    end
    return meta
  else
    return nil
  end
end

