-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC



kAuthorInput =  'authors'
kAuthorOutput = 'authors'

kAttributes = 'attributes'
kMetadata = 'metadata'

-- a name which will be destructured
kName = 'name'

-- destructured name values
kGivenName = 'given'
kFamilyName = 'family'
kLiteralName = 'literal'
kNameFields = { kGivenName, kFamilyName, kLiteralName}

-- simple mapped values
kId = 'id'
kUrl = 'url'
kEmail = 'email'
kFax = 'fax'
kOrcid = 'orcid'
kNotes = 'notes'
kAcknowledgements = 'acknowledgements'

-- flag values for attributes (attributes is a list of 
-- flag names)
kCorresponding = 'corresponding'
kEqualContributor = 'equal-contributor'

-- TODO: affilations
kAffiliations = 'affilations'

kNameAuthorFields = { kName }
kSimpleAuthorFields = { kId, kUrl, kEmail, kFax, kOrcid, kNotes, kAcknowledgements }
kAttributeFields = { kCorresponding, kEqualContributor }

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
                if authorValue == true then
                  author[kAttributes][#author[kAttributes] + 1] = pandoc.Str(authorKey)
                end
              elseif authorKey == kAttributes then
                -- process attributes
                for k,v in pairs(authorValue) do
                  if v == true then
                    author[kAttributes][#author[kAttributes] + 1] = pandoc.Str(k)
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