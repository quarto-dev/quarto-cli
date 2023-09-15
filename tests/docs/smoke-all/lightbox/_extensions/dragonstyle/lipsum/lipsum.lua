

local lipsum

-- reads a file
local function read_file(path)
  local file = io.open(path, "rb") 
  if not file then return nil end
  local content = file:read "*a"
  file:close()
  return content
end

-- read lipsum data
function readLipsum() 
  if lipsum == nil then
    local file = quarto.utils.resolve_path("lipsum.json")
    local fileContents = read_file(file)
    if fileContents ~= nil then
      local json = quarto.json.decode(fileContents)
      lipsum = json
    else 
      quarto.log.error("Unable to read lipsum data file.")
      lipsum = {}
    end
  end
  return lipsum
end

local rangePattern = '(%d+)%-(%d+)'
local barePattern = '^(%d+)$'

return {
  ['lipsum'] = function(args, kwargs, meta)

    local paraStart = 1
    local paraEnd = 5

    if args[1] ~= nil then
      -- a range is specified, like 1-5, 2-3, 5-1
      local range = pandoc.utils.stringify(args[1])
      local _,_,startRange,endRange = range:find(rangePattern)
      if startRange and endRange then

        local startNumber = tonumber(startRange)
        if startNumber ~= nil then
          paraStart = startNumber
        end

        local endNumber = tonumber(endRange)
        if endNumber ~= nil then
          paraEnd = endNumber
        end
      else
        -- a number of paragraphs is specified, like 10
        local _,_,bareVal = range:find(barePattern)
        if bareVal then
          local endNumber = tonumber(bareVal)
          if endNumber ~= nil then
            paraEnd = endNumber
          end
        end  
      end
    end

    local paras = readLipsum();
    local outputParas = {}

    local count = paraEnd - paraStart + 1
    if paraStart > paraEnd then
      count = paraStart - paraEnd + 1
    end

    for i=1,count do
      local paraIdx = i + (paraStart - 1)
      if paraStart > paraEnd then
        paraIdx =  (paraStart + 1) - i
      end
      local outIdx = ((paraIdx-1)%(#paras-1))+1
      outputParas[i] = pandoc.Para(paras[outIdx])
    end
    
    return outputParas
  end
}
