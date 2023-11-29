-- meta.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- read and replace the authors field
-- without reshaped data that has been 
-- restructured into the standard author
-- format
local kAuthorInput =  'authors'

-- we ensure that if 'institute' is specified, we normalize it into
-- and array in this value, which this can safely read and process
local kInstituteInput = 'institutes'

-- By default, simply replace the input structure with the 
-- normalized versions of the output
local kAuthorOutput = kAuthorInput

-- Where we'll write the normalized list of affiliations
local kAffiliationOutput = "affiliations"

-- Where we'll write the normalized list of funding
local kFundingOutput = "funding"

-- Where we'll write the 'by-author' list of authors which
-- includes expanded affiliation information inline with the author
local kByAuthor = "by-author"

-- Where we'll write the 'by-affiliation' list of affiliations which
-- includes expanded author information inline with each affiliation
local kByAffiliation = "by-affiliation"
local kAuthors = "authors"

-- Funding placeholders
-- Normalized into:
-- funding:
--   - statement:
--     open-access: string (optional)
--     awards:        
    --   - id: string (optional)
    --     name: string (optional)
    --     description: string (optional)
    --     source: 
    --       - string | { country, type } & text | { institution } 
    --     investigator:
    --       - { text } | { name }
    --     recipient:
    --       - { text } | { name } | { institution }

-- add support for instition DOI in addition to ringgold/isni, etc...
local kFunding = "funding"
local kAwards = "awards"
local kAwardId = "id"
local kAwardName = "name"
local kAwardDesc = "description"
local kSource = "source"
local kSourceType = "type"
local kStatement = "statement"
local kOpenAccess = "open-access"
local kRecipient = "recipient"
local kInvestigator = "investigator"


-- Properties that may appear on an individual author
local kId = 'id'
local kName = 'name'
local kUrl = 'url'
local kEmail = 'email'
local kFax = 'fax'
local kPhone = 'phone'
local kOrcid = 'orcid'
local kNote = 'note'
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
local kDeceased = 'deceased'

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
local kDroppingParticle = 'dropping-particle'
local kNonDroppingParticle = 'non-dropping-particle'
local kNameFields = { kGivenName, kFamilyName, kLiteralName}

-- Academic titles or professional certifications displayed following a personal name (for example, “MD”, “PhD”).
local kDegrees = 'degrees'

-- the roles that an author may place
local kRoles = 'roles'
local kRole = "role"
local kDegreeContribution = "degree-of-contribution"
local kAuthorRoleFields = { kRole, kRoles }

-- CreDitT schema and definitions
local kWritingOriginal = "writing – original draft"
local kWritingEditing = "writing – review & editing"
local kFormalAnalysis = "formal analysis"
local kFundingAcquisition = "funding acquisition"
local kConceptualization = "conceptualization"
local kDataCuration = "data curation"
local kInvestigation = "investigation"
local kMethodology = "methodology"
local kProjectAdmin = "project administration"
local kResources = "resources"
local kSoftware = "software"
local kSupervision = "supervision"
local kValidation = "validation"
local kVisualization = "visualization"
local kCreditRoles = {kConceptualization, kDataCuration, kFormalAnalysis, 
                      kFundingAcquisition, kInvestigation, kMethodology,
                      kProjectAdmin, kResources, kSoftware, 
                      kSupervision, kValidation, kVisualization, 
                      kWritingOriginal, kWritingEditing}
local kCreditAliases = {
  ["writing"] = kWritingOriginal,
  ["analysis"] = kFormalAnalysis,
  ["funding"] = kFundingAcquisition,
  ["editing"] = kWritingEditing
}

local kVocabIdentifier = "vocab-identifier"
local kVocabTerm = "vocab-term"
local kVocabTermIdentifier="vocab-term-identifier"

local kCreditVocabIdentifier = "https://credit.niso.org"
local kCreditVocabTermIdentifiers = {
  [kConceptualization] = "https://credit.niso.org/contributor-roles/conceptualization/",
  [kDataCuration] = "https://credit.niso.org/contributor-roles/data-curation/",
  [kFormalAnalysis] = "https://credit.niso.org/contributor-roles/formal-analysis/",
  [kFundingAcquisition] = "https://credit.niso.org/contributor-roles/funding-acquisition/",
  [kInvestigation] = "https://credit.niso.org/contributor-roles/investigation/",
  [kMethodology] = "https://credit.niso.org/contributor-roles/methodology/",
  [kProjectAdmin] = "https://credit.niso.org/contributor-roles/project-administration/",
  [kResources] = "https://credit.niso.org/contributor-roles/resources/",
  [kSoftware] = "https://credit.niso.org/contributor-roles/software/",
  [kSupervision] = "https://credit.niso.org/contributor-roles/supervision/",
  [kValidation] = "https://credit.niso.org/contributor-roles/validation/",
  [kVisualization] = "https://credit.niso.org/contributor-roles/visualization/",
  [kWritingOriginal] = "https://credit.niso.org/contributor-roles/writing-original-draft/",
  [kWritingEditing] = "https://credit.niso.org/contributor-roles/writing-review-editing/"
}


-- an affiliation which will be structured into a standalone
local kAffilName = 'name'
local kDepartment = 'department'
local kAddress = 'address'
local kCity = 'city'
local kRegion = 'region'
local kState = 'state'
local kCountry = 'country'
local kPostalCode = 'postal-code'
local kISNI = "isni"
local kRinggold = "ringgold"
local kROR = "ror"

-- labels contains the suggested labels for the various elements which 
-- are localized and should correctly deal with plurals, etc...
local kLabels = 'labels'
local kAuthorLbl = 'authors'
local kAffiliationLbl = 'affiliations'
local kPublishedLbl = 'published'
local kModifiedLbl = 'modified'
local kDoiLbl = 'doi'
local kDescriptionLbl = 'description'
local kAbstractLbl = 'abstract'
local kKeywordsLbl = 'keywords'
local kRelatedFormats = 'related_formats'

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
local kModifiedTitle = 'modified-title'
local kDoiTitle = 'doi-title'

-- Deal with bibliography configuration as well
local kBiblioConfig = 'biblio-config'

-- The field types for an author (maps the field in an author table)
-- to the way the field should be processed
local kAuthorNameFields = { kName }
local kAuthorSimpleFields = { kId, kUrl, kEmail, kFax, kPhone, kOrcid, kAcknowledgements }
local kAuthorAttributeFields = { kCorresponding, kEqualContributor, kDeceased }
local kAuthorAffiliationFields = { kAffiliation, kAffiliations }

-- Fields for affiliations (either inline in authors or 
-- separately in a affiliations key)
local kAffiliationFields = { kId, kAffilName, kDepartment, kAddress, kCity, kRegion, kCountry, kPostalCode, kUrl, kISNI, kRinggold, kROR }

-- These affiliation fields will be mapped into 'region' 
-- (so users may also write 'state')
local kAffiliationAliasedFields = {
  [kState]=kRegion,
  [kAffiliationUrl]=kUrl
}

-- This field will be included with 'by-author' and 'by-affiliation' and provides
-- a simple incremental counter that can be used for things like note numbers
local kNumber = "number"
local kLetter = "letter"


-- Remove Spaces from the ends of tables
local function trimspace(tbl)
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
local function deepCopy(original)
	local copy = {}
	for k, v in pairs(original) do
		if type(v) == "table" then 
			v = deepCopy(v)
		end
		copy[k] = v
	end
	return copy
end

-- Finds a matching affiliation by looking through a list
-- of affiliations (ignoring the id)
local function findMatchingAffililation(affiliation, affiliations)
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

-- Add an affiliation to the list of affiliations if needed
-- and return either the exist affiliation, or the newly
-- added affiliation with a proper id
local function maybeAddAffiliation(affiliation, affiliations)
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

local function validateRefs(authors, affiliations)
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
          fail("Undefined affiliation '" .. pandoc.utils.stringify(affiliation[kRef]) .. "' for author '" .. pandoc.utils.stringify(author[kName][kLiteralName]) .. "'.")
        end
      end
    end
  end
end

-- Finds a matching author by author id
local function findAuthor(id, authors)
  for i, author in ipairs(authors) do
    if pandoc.utils.stringify(author[kId]) == id then
      return author
    end
  end
  return nil
end

-- Finds a matching affiliation by id
local function findAffiliation(id, affiliations)
  for i, affiliation in ipairs(affiliations) do
    if affiliation[kId][1].text == id[1].text then
      return affiliation
    end
  end
  return nil
end

-- Normalizes an affilation object into the properly
-- structured form
local function processAffilationObj(affiliation)
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

local kBibtexNameTemplate = [[
@misc{x,
  author = {%s}
}
]]

--- Returns a CSLJSON-like name table. BibTeX knows how to parse names,
--- so we leverage that.
local function bibtexParseName(nameRaw)
  local bibtex = kBibtexNameTemplate:format(pandoc.utils.stringify(nameRaw))
  local references = pandoc.read(bibtex, 'bibtex').meta.references
  if references then
    local reference = references[1] --[[@as table<string,any>]]
    if reference then
      local authors = reference.author
      if authors then
        local name = authors[1]
        if type(name) ~= 'table' then
          return nameRaw
        else
          -- most dropping particles are really non-dropping
          if name['dropping-particle'] and not name['non-dropping-particle'] then
            name['non-dropping-particle'] = name['dropping-particle']
            name['dropping-particle'] = nil
          end
          return name
        end
      else
        return nameRaw
      end
    else
      return nameRaw
    end
  else
    return nameRaw
  end
end

-- normalizes a name value by parsing it into
-- family and given names
local function normalizeName(name)
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
    if name[kLiteralName] then
      local parsedName = bibtexParseName(name)
      if type(parsedName) == 'table' then
        if parsedName.given ~= nil then
          name[kGivenName] = {pandoc.Str(parsedName.given)}
        end
        if parsedName.family ~= nil then
          name[kFamilyName] = {pandoc.Str(parsedName.family)}
        end
        if name[kDroppingParticle] ~= nil then
          name[kDroppingParticle] = parsedName[kDroppingParticle]
        end
        if name[kNonDroppingParticle] ~= nil then
          name[kNonDroppingParticle] = parsedName[kNonDroppingParticle]
        end
      else
        if #name[kLiteralName] > 1 then
          -- bibtex parsing failed, just split on space
          name[kGivenName] = name[kLiteralName][1]
          name[kFamilyName] = trimspace(tslice(name[kLiteralName], 2))
        elseif name[kLiteralName] then
          -- what is this thing, just make it family name
          name[kFamilyName] = name[kLiteralName]
        end
      end
    end
  end
  return name
end

-- Converts name elements into a structured name
local function toName(nameParts)
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
    if #nameParts == 0 then
      return {}
    else
      return normalizeName({[kLiteralName] = nameParts})
    end
  end
end

-- Normalizes a value that could be either a plain old markdown string,
-- a name, or an affiliation
local function processNameOrInstitutionObj(keyName, valueRaw, authors, affiliations, optional)
  if (pandoc.utils.type(valueRaw) == 'Inlines') then
    return { text = valueRaw }
  else
    if valueRaw.name ~= nil then
      return { name = toName(valueRaw.name) }
    elseif valueRaw.institution ~= nil then
      return { institution = processAffilationObj(valueRaw.institution) }
    elseif valueRaw.ref ~= nil then
      local refStr = pandoc.utils.stringify(valueRaw.ref)

      -- discover the reference (could be author or affiliation)
      local affiliation = findAffiliation({{ text = refStr }}, affiliations)
      if affiliation then
        return { institution = affiliation }
      else
        local author = findAuthor(refStr, authors)
        if author then
          return { [kName] = author[kName] }
        else
          fail("Invalid funding ref " .. refStr)
        end
      end
    else
      if not optional then
        fail("Invalid value for " .. keyName)
      end
    end
  end
end

local function processNameOrInstitution(keyName, values, authors, affiliations, optional) 
  if values ~= nil then
    local pandocType = pandoc.utils.type(values)
    if pandocType == "List" then
      local results = pandoc.List()
      for i, value in ipairs(values) do
        local resolved = processNameOrInstitutionObj(keyName, value, authors, affiliations, optional)
        if resolved ~= nil then
          results:insert(resolved)
        end
      end
      return results
    else
      local resolved = processNameOrInstitutionObj(keyName, values, authors, affiliations, optional)
      if resolved ~= nil then
        return { resolved }
      end
    end
  else 
    return {}
  end
end

local function processSources(sourceRaw, authors, affiliations)
  local pandocType = pandoc.utils.type(sourceRaw)
  if pandocType == 'Inlines' then
    return {{ text = sourceRaw }}
  else
    local result = processNameOrInstitution(kSource, sourceRaw, authors, affiliations, true)
    for i, key in ipairs({ kCountry, kSourceType }) do
      local valueRaw = sourceRaw[key]
      if valueRaw ~= nil then
        result[key] = valueRaw
      end
    end
    return result
  end
end

-- Normalizes an indivudal funding entry
local function processFundingGroup(fundingGroup, authors, affiliations)
  if pandoc.utils.type(fundingGroup) == 'table' then

    -- awards
    
    -- this is a table of properties, process them
    local result = {}

    -- statement
    local statement = fundingGroup[kStatement];
    if statement ~= nil then
      if pandoc.utils.type(statement) == "Block" then
        result[kStatement] = pandoc.utils.blocks_to_inlines({statement})
      elseif pandoc.utils.type(statement) == "Blocks" then
        result[kStatement] = pandoc.utils.blocks_to_inlines(statement)
      else
        result[kStatement] = statement
      end
    end

    -- open-access (must be a block so it emits a p)
    local openAccess = fundingGroup[kOpenAccess];
    if openAccess ~= nil then
      if pandoc.utils.type(openAccess) == "Inlines" then
        result[kOpenAccess] = pandoc.Para(openAccess)
      else
        result[kOpenAccess] = openAccess
      end
    end

    -- process any awards
    local awardsRaw = fundingGroup[kAwards];
    if pandoc.utils.type(awardsRaw) ~= "List" then
      awardsRaw = pandoc.List({awardsRaw})
    end

    local awards = pandoc.List({})
    for i, awardRaw in ipairs(awardsRaw) do
      local award = {};

      -- award-id, name, description
      for i, key in ipairs({ kAwardId, kAwardName, kAwardDesc }) do
        local valueRaw = awardRaw[key]
        if valueRaw ~= nil then
          award[key] = valueRaw
        end
      end
  
      -- Process the funding source
      local sourceRaw = awardRaw[kSource]
      if sourceRaw ~= nil then
        award[kSource] = processSources(sourceRaw, authors, affiliations) 
      end

      -- Process recipients
      local recipientRaw = awardRaw[kRecipient]
      if recipientRaw ~= nil then
        award[kRecipient] = processNameOrInstitution(kRecipient, recipientRaw, authors, affiliations)
      end

      local investigatorRaw = awardRaw[kInvestigator]
      if investigatorRaw ~= nil then
        award[kInvestigator] = processNameOrInstitution(kInvestigator, investigatorRaw, authors, affiliations)
      end

      awards:insert(award)
    end

    if next(awards) ~= nil then
      result[kAwards] = awards
    end

    return result
  else    
    -- this is a simple string / inlines, just 
    -- use it as the source
    return {
      [kStatement] = fundingGroup
    }
  end
end

-- Replaces an affiliation reference with a different id
-- (for example, if a reference to an affiliation is collapsed into a single
-- entry with a single id)
local function remapAuthorAffiliations(fromId, toId, authors)
  for i, author in ipairs(authors) do
    for j, affiliation in ipairs(author[kAffiliations]) do
      local existingRefId = affiliation[kRef]
      if existingRefId == fromId then
        affiliation[kRef] = toId
      end
     end
  end
end

-- Sets an attribute, initializeing the table if
-- is not yet defined
local function setAttribute(author, attribute)
  if not author[kAttributes] then
    author[kAttributes] = pandoc.MetaMap({})
  end

  local attrStr = pandoc.utils.stringify(attribute)
  -- Don't duplicate attributes
  if not author[kAttributes][attrStr] then
    author[kAttributes][attrStr] = pandoc.Str('true')
  end
end

-- Process attributes onto an author
-- attributes may be a simple string, a list of strings
-- or a dictionary
local function processAttributes(author, attributes)
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

-- Process an author note (including numbering it)
local noteNumber = 1
local function processAuthorNote(author, note)
  author[kNote] = {
    number=noteNumber,
    text=note
  }
  noteNumber = noteNumber + 1
end

local function setRole(author, role)
  if not author[kRoles] then
    author[kRoles] = {}
  end

  -- resolve shorthands
  local term = string.lower(role.role)
  local alias = kCreditAliases[term]
  if alias then
    term = alias
  end

  -- if this is a CreDiT Role then
  -- attach vocabulary decorations
  if tcontains(kCreditRoles, term) then
    role[kVocabIdentifier] = kCreditVocabIdentifier
    role[kVocabTerm] = term
    role[kVocabTermIdentifier] = kCreditVocabTermIdentifiers[term]
  end

  author[kRoles][#author[kRoles] + 1] = role
end

local function parseRole(role) 
  if pandoc.utils.type(role) == 'Inlines' or pandoc.utils.type(role) == 'Inline' then
    -- this is just a simple string representing the role
    return pandoc.utils.stringify(role) 
  else 
    for k,v in pairs(role) do
      return pandoc.utils.stringify(k), pandoc.utils.stringify(v)
    end
  end
end

local function setDegree(author, degree)
  if not author[kDegrees] then
    author[kDegrees] = {}
  end
  author[kDegrees][#author[kDegrees] + 1] = degree
end

-- Processes author roles, which can be specified either using `role:` or `roles:`
-- and can either be a single string:
-- role: researcher
-- or an array of strings:
-- roles: [researcher, writer]
-- or one or role objects with key role, value degree of contribution
-- like:
-- roles:
--   - researcher: lead
--   - writer: supporting
-- general in support, but derived a bit from 
-- https://credit.niso.org
local function processAuthorRoles(author, roles) 
  if tisarray(roles) then
    for i,v in ipairs(roles) do
      local role, contribution = parseRole(v)
      setRole(author, { [kRole] = role, [kDegreeContribution] = contribution })
    end
  else
    local role, contribution = parseRole(roles)
    setRole(author, { [kRole] = role, [kDegreeContribution] = contribution })
  end
end

local function processAuthorDegrees(author, degrees) 
  if tisarray(degrees) then
    for _i,v in ipairs(degrees) do
      setDegree(author, v)
    end
  else
    setDegree(author, degrees)
  end
end

-- Sets a metadata value, initializing the table if
-- it not yet defined
local function setMetadata(author, key, value)
  author[kMetadata][key] = value
end

local function setAffiliation(author, affiliation)
  if not author[kAffiliations] then
    author[kAffiliations] = {}
  end
  author[kAffiliations][#author[kAffiliations] + 1] = affiliation
end

local function byAuthors(authors, affiliations)
  local denormalizedAuthors = deepCopy(authors)

  if denormalizedAuthors then
    for i, author in ipairs(denormalizedAuthors) do
      denormalizedAuthors[kNumber] = i
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

-- Finds a matching author by affiliation id
local function findAffiliationAuthors(id, authors)
  local matchingAuthors = {}
  for i, author in ipairs(authors) do
    local authorAffils = author[kAffiliations]
    if authorAffils then
      for j, authorAffil in ipairs(authorAffils) do
        if authorAffil[kRef][1].text == id[1].text then
          matchingAuthors[#matchingAuthors + 1] = author
        end
      end
    end
  end
  return matchingAuthors
end

local function byAffiliations(authors, affiliations)
  local denormalizedAffiliations = deepCopy(affiliations)
  for i, affiliation in ipairs(denormalizedAffiliations) do
    local affilAuthor = findAffiliationAuthors(affiliation[kId], authors)
    if affilAuthor then
      affiliation[kAuthors] = affilAuthor
    end
  end
  return denormalizedAffiliations
end

-- Resolve labels for elements into metadata
local function computeLabels(authors, affiliations, meta)
  local language = param("language", nil);

  if not _quarto.format.isAstOutput() then
    meta[kLabels] = {
      [kAuthorLbl] = {pandoc.Str("Authors")},
      [kAffiliationLbl] = {pandoc.Str("Affiliations")}
    }
    if #authors == 1 then
      meta[kLabels][kAuthorLbl] = {pandoc.Str(language["title-block-author-single"])}
    else
      meta[kLabels][kAuthorLbl] = {pandoc.Str(language["title-block-author-plural"])}
    end
    if meta[kAuthorTitle] then
      meta[kLabels][kAuthors] = meta[kAuthorTitle]
    end

    if #affiliations == 1 then
      meta[kLabels][kAffiliationLbl] = {pandoc.Str(language["title-block-affiliation-single"])}
    else
      meta[kLabels][kAffiliationLbl] = {pandoc.Str(language["title-block-affiliation-plural"])}
    end
    if meta[kAffiliationTitle] then
      meta[kLabels][kAffiliationLbl] = meta[kAffiliationTitle]
    end

    meta[kLabels][kPublishedLbl] = {pandoc.Str(language["title-block-published"])}
    if meta[kPublishedTitle] then
      meta[kLabels][kPublishedLbl] = meta[kPublishedTitle]
    end

    meta[kLabels][kModifiedLbl] = {pandoc.Str(language["title-block-modified"])}
    if meta[kModifiedTitle] then
      meta[kLabels][kModifiedLbl] = meta[kModifiedTitle]
    end

    meta[kLabels][kDoiLbl] = {pandoc.Str("Doi")}
    if meta[kDoiTitle] then
      meta[kLabels][kDoiLbl] = meta[kDoiTitle]
    end

    meta[kLabels][kAbstractLbl] = {pandoc.Str(language["section-title-abstract"])}
    if meta[kAbstractTitle] then
      meta[kLabels][kAbstractLbl] = meta[kAbstractTitle]
    end

    meta[kLabels][kDescriptionLbl] = {pandoc.Str(language["listing-page-field-description"])}
    if meta[kDescriptionTitle] then
      meta[kLabels][kDescriptionLbl] = meta[kDescriptionTitle]
    end

    meta[kLabels][kKeywordsLbl] = {pandoc.Str(language["title-block-keywords"])}
    if meta[kKeywordsTitle] then
      meta[kLabels][kKeywordsLbl] = meta[kKeywordsTitle]
    end
    
    meta[kLabels][kRelatedFormats] = {pandoc.Str(language["related-formats-title"])}
    if meta["related-formats-title"] then
      meta[kLabels][kRelatedFormats] = meta["related-formats-title"]
    end
  end

  return meta
end

-- Get a letter for a number 
local function letter(number)
  number = number%26
  return string.char(96 + number)
end

-- Processes an affiatiation into a normalized
-- affilation
local function processAffiliation(author, affiliation)
  local affiliations = {}
  local pandocType = pandoc.utils.type(affiliation)
  if pandocType == 'Inlines' then
    -- The affiliations is simple a set of inlines,  use
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

-- Processes an individual author into a normalized author
-- and normalized set of affilations
local function processAuthor(value)
  -- initialize the author
  local author = pandoc.MetaMap({})
  author[kMetadata] = pandoc.MetaMap({})

  -- initialize their affilations
  local authorAffiliations = {}
  local affiliationUrl = nil

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
      elseif tcontains(kAuthorSimpleFields, authorKey) then
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
      elseif authorKey == kNote then
        processAuthorNote(author, authorValue)
      elseif tcontains(kAuthorAffiliationFields, authorKey) then
        -- process affiliations that are specified in the author
        authorAffiliations = processAffiliation(author, authorValue)
      elseif authorKey == kAffiliationUrl then
        affiliationUrl = authorValue
      elseif tcontains(kAuthorRoleFields, authorKey) then
        processAuthorRoles(author, authorValue)
      elseif authorKey == kDegrees then
        processAuthorDegrees(author, authorValue)
      else
        -- since we don't recognize this value, place it under
        -- metadata to make it accessible to consumers of this 
        -- data structure
        setMetadata(author, authorKey, authorValue)
      end
    end
  end

  -- If there is an affiliation url, forward that along
  if authorAffiliations and affiliationUrl then
    authorAffiliations[1][kUrl] = affiliationUrl
  end

  return {
    author=author,
    affiliations=authorAffiliations
  }
end

local function processAuthorMeta(meta)
  -- prevents the front matter for markdown from containing
  -- all the rendered author information that we generate
  if _quarto.format.isMarkdownOutput() then
    meta[kAuthors] = nil
    return meta
  end

  -- prefer to render 'authors' if it is available
  local authorsRaw = meta[kAuthorInput]
  if meta[kAuthors] then
    authorsRaw = meta[kAuthors]
  end

  -- authors should be a table of tables (e.g. it should be an array of inlines or tables)
  -- if it isn't, transform it into one
  if type(authorsRaw) == "table" then
    if (type(authorsRaw[1]) ~= "table") then
      authorsRaw = {authorsRaw}
    end
  end


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

  -- Add any affiliations that are explicitly specified
  local affiliationsRaw = meta[kAffiliations]
  if affiliationsRaw then
    local explicitAffils = processAffiliation(nil, affiliationsRaw)
    if explicitAffils then
      for i,affiliation in ipairs(explicitAffils) do
        local addedAffiliation = maybeAddAffiliation(affiliation, affiliations)

        -- for any authors that are using this affiliation, fix up their reference
        if affiliation[kId] ~= addedAffiliation[kId] then
          remapAuthorAffiliations(affiliation[kId], addedAffiliation[kId], authors)
        end
      end
    end
  end

  -- process 'institute', which is used by revealjs and beamer
  -- because they bear no direct relation to the authors
  -- we will just use their position to attach them
  local instituteRaw = meta[kInstituteInput]
  if instituteRaw then
    for i,institute in ipairs(instituteRaw) do
      -- add the affiliation
      local affiliation = processAffilationObj({ name=institute })
      local addedAffiliation = maybeAddAffiliation(affiliation, affiliations)

      -- note the reference on the author
      -- if there aren't enough authors, attach the affiliations to the
      -- last author
      local author = authors[#authors]
      if i <= #authors then
        author = authors[i]
      end
      if author then
        setAffiliation(author, { ref=addedAffiliation[kId] })
      end
    end
  end

  -- validate that every author affiliation has a corresponding 
  -- affiliation defined in the affiliations key
  validateRefs(authors, affiliations)

  -- number the authors and affiliations
  for i,affil in ipairs(affiliations) do
    affil[kNumber] = i
    affil[kLetter] = letter(i)
  end
  for i,auth in ipairs(authors) do
    auth[kNumber] = i
    auth[kLetter] = letter(i)
  end

  -- Write the normalized data back to metadata
  if #authors ~= 0 then
    meta[kAuthorOutput] = authors
  end

  if #affiliations ~= 0 then
    meta[kAffiliationOutput] = affiliations
  end

  -- Write the de-normalized versions back to metadata
  if #authors ~= 0 then
    meta[kByAuthor] = byAuthors(authors, affiliations)
  end

  if #affiliations ~= 0 then
    meta[kByAffiliation] = byAffiliations(authors, affiliations)
  end

  -- the normalized funding
  local funding = {}

  -- process the 'funding' key
  local fundingRaw = meta[kFunding]
  if fundingRaw then
    -- ensure that this is table
    if pandoc.utils.type(fundingRaw) ~= "List" then
      fundingRaw = pandoc.List({fundingRaw})
    end
    
  
    for i,fundingGroup in ipairs(fundingRaw) do 
      local normalizedFundingGroup = processFundingGroup(fundingGroup, authors, affiliations)
      if normalizedFundingGroup then
        funding[i] = normalizedFundingGroup
      end 
    end
  end
  
  -- write the normalized funding to output
  if #funding ~= 0 then
    meta[kFundingOutput] = funding
  end 

  -- Provide localized or user specified strings for title block elements
  meta = computeLabels(authors, affiliations, meta)

  -- Provide biblio-config if it isn't specified
  if meta[kBiblioConfig] == nil and not _quarto.format.isAstOutput() then
    meta[kBiblioConfig] = true
  end

  return meta
end

return {
  processAuthorMeta = processAuthorMeta,
  constants = {
    author = {
      output_key = kAuthorOutput,
      note = kNote,
      attributes = kAttributes
    }

  }
}