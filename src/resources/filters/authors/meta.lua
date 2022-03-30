-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- read and replace the authors field
-- without reshaped data that has been 
-- restructured into the standard author
-- format
kAuthorInput =  'authors'
kAuthorOutput = 'authors'

-- Properties that may appear on an individual author
kId = 'id'
kName = 'name'
kUrl = 'url'
kEmail = 'email'
kFax = 'fax'
kOrcid = 'orcid'
kNotes = 'notes'
kAcknowledgements = 'acknowledgements'
kAffiliations = 'affilations'

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
kAttributes = 'attributes'

-- flag values for attributes (attributes is a list of 
-- flag names)
kCorresponding = 'corresponding'
kEqualContributor = 'equal-contributor'

-- metadata holds options that appear in the author key
-- that are not common to our author schema. we would like
-- to generally discourage this type of data since 
-- it will be difficult to reliably share across templates and
-- author representations, so we bucketize it here to 
-- suggest to users that this is 'other' data 
kMetadata = 'metadata'

-- a name which will be structured into a name object that
-- look like:
-- name:
--   family:
--   given:
--   literal:
-- We can accept a literal string (which we parse to get the family and given)
-- or a structured object that declares all or some of the options directly
kGivenName = 'given'
kFamilyName = 'family'
kLiteralName = 'literal'
kNameFields = { kGivenName, kFamilyName, kLiteralName}

-- an affiliation which will be structured into a standalone


-- The field types for an author (maps the field in an author table)
-- to the way the field should be processed
kNameAuthorFields = { kName }
kSimpleAuthorFields = { kId, kUrl, kEmail, kFax, kOrcid, kNotes, kAcknowledgements }
kAttributeFields = { kCorresponding, kEqualContributor }
kAffiliationFields = { kAffiliations}


-- Normalizes author metadata from the 'input' field into 
-- consistently structured metadata in the 'output' field
function authorsMeta()
  return {
    Meta = function(meta)
      local authorsRaw = meta[kAuthorInput]
      
      local authorData = {}
      if authorsRaw ~= undefined then
        for i,v in ipairs(authorsRaw) do
          -- initialize the author
          local author = {}

          -- the id, this will be overwritten if an explicitly provided
          -- identifier exists
          author[kId] = k

          -- initialize attributes and metadata
          -- todo lazy initialize attributes?
          author[kAttributes] = {}
          author[kMetadata] = {}

          if tisarray(v) then
            -- The value is simply an array, treat them as the author name
            author.name = toName(v);
          else
            -- Process the field into the proper place in the author
            -- structure
            for authorKey, authorValue in pairs(v) do
              if tcontains(kNameAuthorFields, authorKey) then
                -- process any names
                author[authorKey] = toName(authorValue)
              elseif tcontains(kSimpleAuthorFields, authorKey) then
                -- process simple fields
                author[authorKey] = authorValue
              elseif tcontains(kAttributeFields, authorKey) then
                -- process a field into attributes
                if authorValue then
                  author[kAttributes][#author[kAttributes] + 1] = pandoc.Str(authorKey)
                end
              elseif authorKey == kAttributes then
                if tisarray(authorValue) then
                  -- process attributes as an array of values
                  for i,v in ipairs(authorValue) do
                    if v then
                      if v.t == "Str" then
                        tappend(author[kAttributes], {v})
                      else 
                        tappend(author[kAttributes], v)
                      end
                    end
                  end
                else
                  -- process attributes as a dictionary
                  for k,v in pairs(authorValue) do
                    if v then
                      author[kAttributes][#author[kAttributes] + 1] = pandoc.Str(k)
                    end
                  end
                end
              else 
                author[kMetadata][authorKey] = authorValue
              end
            end
            
          end
          authorData[#authorData + 1] = author
        end      
      end
      meta[kAuthorOutput] = authorData
      dump(meta[kAuthorOutput])
      return meta
    end
  }
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
      name[kFamilyName] = n[kLiteralName]
    end
  end
  return name
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