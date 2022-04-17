-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- read and replace the authors field
-- without reshaped data that has been 
-- restructured into the standard author
-- format
local kAuthorInput =  'authors'

-- By default, simply replace the input structure with the 
-- normalized versions of the output
local kAuthorOutput = kAuthorInput

-- Where we'll write the normalized list of affiliations
local kAffiliationOutput = "affiliations"

-- Where we'll write the 'by-author' list of authors which
-- includes expanded affiliation information inline with the author
local kByAuthor = "by-author"

-- Where we'll write the 'by-affiliation' list of affiliations which
-- includes expanded author information inline with each affiliation
local kByAffiliation = "by-affiliation"
local kAuthors = "authors"

-- Properties that may appear on an individual author
local kId = 'id'
local kName = 'name'
local kUrl = 'url'
local kEmail = 'email'
local kFax = 'fax'
local kOrcid = 'orcid'
local kNotes = 'notes'
local kAcknowledgements = 'acknowledgements'
local kAffiliations = 'affiliations'
local kAffiliation = 'affiliation'
local kRef = 'ref'

-- attributes hold a list of strings which
-- represent true characteristics of the author
-- (for example, that they are the corresponding author)
-- the presence of a value means that it is true, the
-- absence of a value means that it is false
--
-- users can either write
-- attributes: [correspoding, is-equal-contributor]
-- or if attributes with these names are present (and truthy) 
-- on the author they will be collected into attributes.
-- For example-
--   author:
--     name: John Hamm
--     corresponding: true
--     is-equal-contributor: true
local kAttributes = 'attributes'

-- flag values for attributes (attributes is a list of 
-- flag names)
local kCorresponding = 'corresponding'
local kEqualContributor = 'equal-contributor'

-- metadata holds options that appear in the author key
-- that are not common to our author schema. we would like
-- to generally discourage this type of data since 
-- it will be difficult to reliably share across templates and
-- author representations, so we bucketize it here to 
-- suggest to users that this is 'other' data 
local kMetadata = 'metadata'

-- a name which will be structured into a name object that
-- look like:
-- name:
--   family:
--   given:
--   literal:
-- We can accept a literal string (which we parse to get the family and given)
-- or a structured object that declares all or some of the options directly
local kGivenName = 'given'
local kFamilyName = 'family'
local kLiteralName = 'literal'
local kNameFields = { kGivenName, kFamilyName, kLiteralName}

-- an affiliation which will be structured into a standalone
local kName = 'name'
local kDepartment = 'department'
local kAddress = 'address'
local kCity = 'city'
local kRegion = 'region'
local kState = 'state'
local kCountry = 'country'
local kPostalCode = 'postal-code'

-- labels contains the suggested labels for the various elements which 
-- are localized and should correctly deal with plurals, etc...
local kLabels = 'labels'
local kAuthor = 'author'
local kAffiliation = 'affiliation'
local kPublished = 'published'
local kDoi = 'doi'
local kDescription = 'description'
local kAbstract = 'abstract'

-- affiliation fields that might be parsed into other fields
-- (e.g. if we see affiliation-url with author, we make that affiliation/url)
local kAffiliationUrl = 'affiliation-url'

-- Titles are the values that we will accept in metadata to override the
-- default value for the above labels (e.g. abstract-title will provide the label)
-- for the abstract
local kAuthorTitle = 'author-title'
local kAffiliationTitle = 'affiliation-title'
local kAbstractTitle = 'abstract-title'
local kDescriptionTitle = 'description-title'
local kPublishedTitle = 'published-title'
local kDoiTitle = 'doi-title'

-- The field types for an author (maps the field in an author table)
-- to the way the field should be processed
local kAuthorNameFields = { kName }
local kSuthorSimpleFields = { kId, kUrl, kEmail, kFax, kOrcid, kNotes, kAcknowledgements }
local kAuthorAttributeFields = { kCorresponding, kEqualContributor }
local kAuthorAffiliationFields = { kAffiliation, kAffiliations }

-- Fields for affiliations (either inline in authors or 
-- separately in a affiliations key)
local kAffiliationFields = { kId, kName, kDepartment, kAddress, kCity, kRegion, kCountry, kPostalCode, kUrl }

-- These affiliation fields will be mapped into 'region' 
-- (so users may also write 'state')
local kAffiliationRegionFields = { kRegion, kState }

local kAffiliationAliasedFields = {
  [kState]=kRegion,
  [kAffiliationUrl]=kUrl
}

-- Normalizes author metadata from the 'input' field into 
-- consistently structured metadata in the 'output' field
function authorsMeta()


  


  return {
    Meta = function(meta)
      if not isHtmlOutput() and not isLatexOutput() then
        return
      end

      local authorsRaw = meta[kAuthorInput]
      
      -- the normalized authors
      local authors = {}

      -- the normalized affilations
      local affiliations = {}

      if authorsRaw then
        for i,v in ipairs(authorsRaw) do

          local authorAndAffiliations = processAuthor(v)
          
          -- initialize the author
          local author = authorAndAffiliations.author
          local authorAffils = authorAndAffiliations.affiliations

          -- assign an id to this author if one isn't defined
          local authorNumber = #authors + 1
          if author[kId] == nil then
            author[kId] = authorNumber
          end        

          -- go through the affilations and add any to the list
          -- assigning an id if needed
          if authorAffils ~= nil then
            for i,v in ipairs(authorAffils) do
              local affiliation = maybeAddAffiliation(v, affiliations)
              setAffiliation(author, { ref=affiliation[kId] })
            end
          end

          -- add this author to the list of authors
          authors[authorNumber] = author
        end      
      end

      -- Add any attributes that are explicitly specified
      local affiliationsRaw = meta[kAffiliations]
      if affiliationsRaw then        
        local explicitAffils = processAffiliation(nil, affiliationsRaw)
        if explicitAffils then
          for i,affiliation in ipairs(explicitAffils) do          
            maybeAddAffiliation(affiliation, affiliations)
          end
        end
      end

      -- validate that every author affiliation has a corresponding 
      -- affiliation defined in the affiliations key
      validateRefs(authors, affiliations)

      -- Write the normalized data back to metadata
      if #authors ~= 0 then
        meta[kAuthorOutput] = authors
      end

      if #affiliations ~= 0 then
        meta[kAffiliations] = affiliations
      end

      -- Write the de-normalized versions back to metadata
      if #authors ~= 0 then
        meta[kByAuthor] = byAuthors(authors, affiliations)
      end

      if #affiliations ~= 0 then
        meta[kByAffiliation] = byAffiliations(authors, affiliations)
      end

      -- Provide localized or user specified strings for title block elements
      meta = computeLabels(authors, affiliations, meta)

      return meta
    end
  }
end

-- Add an affiliation to the list of affiliations if needed
-- and return either the exist affiliation, or the newly
-- added affiliation with a proper id
function maybeAddAffiliation(affiliation, affiliations) 
  local existingAff = findMatchingAffililation(affiliation, affiliations)
  if existingAff == nil then
    local affiliationNumber = #affiliations + 1
    local affiliationId = 'aff-' .. affiliationNumber
    if affiliation[kId] == nil then
      affiliation[kId] = { pandoc.Str(affiliationId) }
    end
    affiliations[affiliationNumber] = affiliation
    return affiliation
  else 
    return existingAff
  end
end

function validateRefs(authors, affiliations) 
  -- iterate through affiliations and ensure that anything
  -- referenced by an author has a peer affiliation

  -- get the list of affiliation ids
  local affilIds = {}
  if affiliations then
    for i,affiliation in ipairs(affiliations) do
      affilIds[#affilIds + 1] = affiliation[kId]
    end  
  end

  -- go through each author and their affiliations and 
  -- ensure that they are in the list
  for i,author in ipairs(authors) do
    if author[kAffiliations] then
      for i,affiliation in ipairs(author[kAffiliations]) do
        if not tcontains(affilIds, affiliation[kRef]) then
          error("Undefined affiliation '" .. pandoc.utils.stringify(affiliation[kRef]) .. "' for author '" .. pandoc.utils.stringify(author[kName][kLiteralName]) .. "'.")
          os.exit(1)
        end
      end
    end
  end
end

-- Processes an individual author into a normalized author
-- and normalized set of affilations
function processAuthor(value) 
  -- initialize the author
  local author = pandoc.List({})

  -- initialize their affilations
  local authorAffilations = {}

  if pandoc.utils.type(value) == 'Inlines' then
    -- The value is simply an array, treat them as the author name
    author.name = toName(value);
  else
    -- Process the field into the proper place in the author
    -- structure
    for authorKey, authorValue in pairs(value) do
      if tcontains(kAuthorNameFields, authorKey) then
        -- process any names
        author[authorKey] = toName(authorValue)
      elseif tcontains(kSuthorSimpleFields, authorKey) then
        -- process simple fields
        author[authorKey] = authorValue
      elseif tcontains(kAuthorAttributeFields, authorKey) then
        -- process a field into attributes (a field that appears)
        -- directly under the author
        if authorValue then
          setAttribute(author, pandoc.Str(authorKey))
        end
      elseif authorKey == kAttributes then
        -- process an explicit attributes key
        processAttributes(author, authorValue)
      elseif tcontains(kAuthorAffiliationFields, authorKey) then
        -- process affiliations that are specified in the author
        authorAffilations = processAffiliation(author, authorValue)
      else 
        -- since we don't recognize this value, place it under
        -- metadata to make it accessible to consumers of this 
        -- data structure
        setMetadata(author, authorKey, authorValue)
      end
    end            
  end

  return {
    author=author,
    affiliations=authorAffilations
  }
end

-- Processes an affiatiation into a normalized
-- affilation
function processAffiliation(author, affiliation)
  local affiliations = {}
  local pandocType = pandoc.utils.type(affiliation)
  if pandocType == 'Inlines' then
    -- The affiliations is simple a set of inlines, use this as the nam
    -- of a single affiliation
    affiliations[#affiliations + 1] = processAffilationObj({ name=affiliation })
  elseif pandocType == 'List' then
    for i, v in ipairs(affiliation) do
      if pandoc.utils.type(v) == 'Inlines' then
        -- This item is just a set inlines, use that as the name
        affiliations[#affiliations + 1] = processAffilationObj({ name=v })
      else
        local keys = tkeys(v)
        if keys and #keys == 1 and keys[1] == kRef then
          -- See if this is just an item with a 'ref', and if it is, just pass
          -- it through on the author
          if author then
            setAffiliation(author, v)
          end
        else
          -- This is a more complex affilation, process it
          affiliations[#affiliations + 1] = processAffilationObj(v)
        end
      end
    end
  elseif pandocType == 'table' then
    -- This is a more complex affilation, process it
    affiliations[#affiliations + 1] = processAffilationObj(affiliation)
  end

  
  
  return affiliations
end

-- Normalizes an affilation object into the properly
-- structured form
function processAffilationObj(affiliation)
  local affiliationNormalized = {}
  affiliationNormalized[kMetadata] = {}
  

  for affilKey, affilVal in pairs(affiliation) do
    if (tcontains(tkeys(kAffiliationAliasedFields), affilKey)) then
      affiliationNormalized[kAffiliationAliasedFields[affilKey]] = affilVal
    elseif tcontains(kAffiliationFields, affilKey) then
      affiliationNormalized[affilKey] = affilVal
    else
      affiliationNormalized[kMetadata][affilKey] = affilVal
    end
  end

  return affiliationNormalized;
end

-- Finds a matching affiliation by looking through a list
-- of affiliations (ignoring the id)
function findMatchingAffililation(affiliation, affiliations) 
  for i, existingAffiliation in ipairs(affiliations) do

    -- an affiliation matches if the fields other than id
    -- are identical
    local matches = true
    for j, field in ipairs(kAffiliationFields) do
      if field ~= kId and matches then
        matches = affiliation[field] == existingAffiliation[field]
      end
    end

    -- This affiliation matches, return it
    if matches then 
      return existingAffiliation
    end
  end
  return nil
end

-- Process attributes onto an author
-- attributes may be a simple string, a list of strings
-- or a dictionary
function processAttributes(author, attributes) 
  if tisarray(attributes) then
    -- process attributes as an array of values
    for i,v in ipairs(attributes) do
      if v then
        if v.t == "Str" then
          setAttribute(author, v)
        else 
          for j, attr in ipairs(v) do
            setAttribute(author, attr)
          end
        end
      end
    end
  else
    -- process attributes as a dictionary
    for k,v in pairs(attributes) do
      if v then
        setAttribute(author, pandoc.Str(k))
      end
    end
  end
end

-- Sets a metadata value, initializing the table if
-- it not yet defined
function setMetadata(author, key, value) 
  if not author[kMetadata] then
    author[kMetadata] = {}
  end
  author[kMetadata][key] = value
end

-- Sets an attribute, initializeing the table if
-- is not yet defined
function setAttribute(author, attribute) 
  if not author[kAttributes] then
    author[kAttributes] = {}
  end
  
  -- Don't duplicate attributes
  if not tcontains(author[kAttributes], attribute) then
    author[kAttributes][#author[kAttributes] + 1] = attribute
  end
end

function setAffiliation(author, affiliation) 
  if not author[kAffiliations] then
    author[kAffiliations] = {}
  end
  author[kAffiliations][#author[kAffiliations] + 1] = affiliation
end


-- Converts name elements into a structured name
function toName(nameParts) 
  if not tisarray(nameParts) then 
    -- If the name is a table (e.g. already a complex object)
    -- just pick out the allowed fields and forward
    local name = {}
    for i,v in ipairs(kNameFields) do
      if nameParts[v] ~= nil then
        name[v] = nameParts[v]
      end
    end

    return normalizeName(name)
  else
    return normalizeName({[kLiteralName] = nameParts})
  end
end

-- normalizes a name value by parsing it into
-- family and given names
function normalizeName(name) 
  -- no literal name, create one
  if name[kLiteralName] == nil then
    if name[kFamilyName] and name[kGivenName] then
      name[kLiteralName] = {}
      tappend(name[kLiteralName], name[kGivenName])
      tappend(name[kLiteralName], {pandoc.Space()})
      tappend(name[kLiteralName], name[kFamilyName])
    end
  end

  -- no family or given name, parse the literal and create one
  if name[kFamilyName] == nil or name[kGivenName] == nil then
    if name[kLiteralName] and #name[kLiteralName] > 1 then
      name[kGivenName] = name[kLiteralName][1]
      name[kFamilyName] = trimspace(tslice(name[kLiteralName], 2))
    elseif name[kLiteralName] then
      name[kFamilyName] = name[kLiteralName]
    end
  end
  return name
end

function byAuthors(authors, affiliations) 
  local denormalizedAuthors = deepCopy(authors)
  if denormalizedAuthors then
    for i, author in ipairs(denormalizedAuthors) do
      local authorAffiliations = author[kAffiliations]
      if authorAffiliations then
        for j, affilRef in ipairs(authorAffiliations) do 
          local id = affilRef[kRef]
          author[kAffiliations][j] = findAffiliation(id, affiliations)
        end
      end
    end  
  end
  return denormalizedAuthors
end

function byAffiliations(authors, affiliations)
  local denormalizedAffiliations = deepCopy(affiliations)
  for i, affiliation in ipairs(denormalizedAffiliations) do
    affiliation[kAuthors] = findAuthors(affiliation[kId], authors)
  end
  return denormalizedAffiliations
end

-- Finds a matching affiliation by id
function findAffiliation(id, affiliations) 
  for i, affiliation in ipairs(affiliations) do
    if affiliation[kId][1].text == id[1].text then
      return affiliation
    end
  end
  return nil
end

-- Finds a matching author by id
function findAuthors(id, authors) 
  local matchingAuthors = {}
  for i, author in ipairs(authors) do
    local authorAffils = author[kAffiliations]
    for j, authorAffil in ipairs(authorAffils) do
      if authorAffil[kRef][1].text == id[1].text then
        matchingAuthors[#matchingAuthors + 1] = author
      end
    end
  end
  return matchingAuthors
end

-- Resolve labels for elements into metadata
function computeLabels(authors, affiliations, meta) 
  local language = param("language", nil);
  meta[kLabels] = {
    authors = {pandoc.Str("Authors")},
    affilations = {pandoc.Str("Affiliations")}
  }
  if #authors == 1 then
    meta[kLabels][kAuthors] = {pandoc.Str(language["title-block-author-single"])}
  else 
    meta[kLabels][kAuthors] = {pandoc.Str(language["title-block-author-plural"])}
  end
  if meta[kAuthorTitle] then
    meta[kLabels][kAuthors] = meta[kAuthorTitle]
  end

  if #affiliations == 1 then
    meta[kLabels][kAffiliations] = {pandoc.Str(language["title-block-affiliation-single"])}
  else
    meta[kLabels][kAffiliations] = {pandoc.Str(language["title-block-affiliation-plural"])}
  end
  if meta[kAffiliationTitle] then
    meta[kLabels][kAffiliation] = meta[kAffiliationTitle]
  end

  meta[kLabels][kPublished] = {pandoc.Str(language["title-block-published"])}
  if meta[kPublishedTitle] then
    meta[kLabels][kPublished] = meta[kPublishedTitle]
  end

  meta[kLabels][kDoi] = {pandoc.Str("Doi")}
  if meta[kDoiTitle] then
    meta[kLabels][kDoi] = meta[kDoiTitle]
  end

  meta[kLabels][kAbstract] = {pandoc.Str(language["section-title-abstract"])}
  if meta[kAbstractTitle] then
    meta[kLabels][kAbstract] = meta[kAbstractTitle]
  end

  meta[kLabels][kDescription] = {pandoc.Str(language["listing-page-field-description"])}
  if meta[kDescriptionTitle] then
    meta[kLabels][kDescription] = meta[kDescriptionTitle]
  end

  return meta
end

-- Remove Spaces from the ends of tables
function trimspace(tbl) 
  if #tbl > 0 then
    if tbl[1].t == 'Space' then
      tbl = tslice(tbl, 2)
    end
  end

  if #tbl > 0 then
    if tbl[#tbl].t == 'Space' then
      tbl = tslice(tbl, #tbl -1)
    end
  end
  return tbl
end

-- Deep Copy a table
function deepCopy(original)
	local copy = {}
	for k, v in pairs(original) do
		if type(v) == "table" then
			v = deepCopy(v)
		end
		copy[k] = v
	end
	return copy
end