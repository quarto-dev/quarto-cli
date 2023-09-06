local LineScanner = {}
LineScanner.__index = LineScanner

function LineScanner:new()
   return setmetatable({
      first = true,
      comment = false,
      after_function = false,
      enabled = true
   }, self)
end

-- Raw version of string.gsub
local function replace(s, old, new)
   old = old:gsub("%p", "%%%0")
   new = new:gsub("%%", "%%%%")
   return (s:gsub(old, new))
end

local fixups = {
   { "=", " ?= ?" }, -- '=' may be surrounded by spaces
   { "(", " ?%( ?" }, -- '(' may be surrounded by spaces
   { ")", " ?%) ?" }, -- ')' may be surrounded by spaces
   { "<FULLID>", "x ?[%[%.]? ?[ntfx0']* ?%]?" }, -- identifier, possibly indexed once
   { "<IDS>", "x ?, ?x[x, ]*" }, -- at least two comma-separated identifiers
   { "<FIELDNAME>", "%[? ?[ntfx0']+ ?%]?" }, -- field, possibly like ["this"]
   { "<PARENS>", "[ %(]*" }, -- optional opening parentheses
}

-- Utility function to make patterns more readable
local function fixup(pat)
   for _, fixup_pair in ipairs(fixups) do
      pat = replace(pat, fixup_pair[1], fixup_pair[2])
   end

   return pat
end

--- Lines that are always excluded from accounting
local any_hits_exclusions = {
   "", -- Empty line
   "end[,; %)]*", -- Single "end"
   "else", -- Single "else"
   "repeat", -- Single "repeat"
   "do", -- Single "do"
   "if", -- Single "if"
   "then", -- Single "then"
   "while t do", -- "while true do" generates no code
   "if t then", -- "if true then" generates no code
   "local x", -- "local var"
   fixup "local x=", -- "local var ="
   fixup "local <IDS>", -- "local var1, ..., varN"
   fixup "local <IDS>=", -- "local var1, ..., varN ="
   "local function x", -- "local function f (arg1, ..., argN)"
}

--- Lines that are only excluded from accounting when they have 0 hits
local zero_hits_exclusions = {
   "[ntfx0',= ]+,", -- "var1 var2," multi columns table stuff
   "{ ?} ?,", -- Empty table before comma leaves no trace in tables and calls
   fixup "<FIELDNAME>=.+[,;]", -- "[123] = 23," "['foo'] = "asd","
   fixup "<FIELDNAME>=function", -- "[123] = function(...)"
   fixup "<FIELDNAME>=<PARENS>'", -- "[123] = [[", possibly with opening parens
   "return function", -- "return function(arg1, ..., argN)"
   "function", -- "function(arg1, ..., argN)"
   "[ntfx0]", -- Single token expressions leave no trace in tables, function calls and sometimes assignments
   "''", -- Same for strings
   "{ ?}", -- Same for empty tables
   fixup "<FULLID>", -- Same for local variables indexed once
   fixup "local x=function", -- "local a = function(arg1, ..., argN)"
   fixup "local x=<PARENS>'", -- "local a = [[", possibly with opening parens
   fixup "local x=(<PARENS>", -- "local a = (", possibly with several parens
   fixup "local <IDS>=(<PARENS>", -- "local a, b = (", possibly with several parens
   fixup "local x=n", -- "local a = nil; local b = nil" produces no trace for the second statement
   fixup "<FULLID>=<PARENS>'", -- "a.b = [[", possibly with opening parens
   fixup "<FULLID>=function", -- "a = function(arg1, ..., argN)"
   "} ?,", -- "}," generates no trace if the table ends with a key-value pair
   "} ?, ?function", -- same with "}, function(...)"
   "break", -- "break" generates no trace in Lua 5.2+
   "{", -- "{" opening table
   "}?[ %)]*", -- optional closing paren, possibly with several closing parens
   "[ntf0']+ ?}[ %)]*", -- a constant at the end of a table, possibly with closing parens (for LuaJIT)
   "goto [%w_]+", -- goto statements
   "::[%w_]+::", -- labels
}

local function excluded(exclusions, line)
   for _, e in ipairs(exclusions) do
      if line:match("^ *"..e.." *$") then
         return true
      end
   end

   return false
end

function LineScanner:find(pattern)
   return self.line:find(pattern, self.i)
end

-- Skips string literal with quote stored as self.quote.
-- @return boolean indicating success.
function LineScanner:skip_string()
   -- Look for closing quote, possibly after even number of backslashes.
   local _, quote_i = self:find("^(\\*)%1"..self.quote)
   if not quote_i then
      _, quote_i = self:find("[^\\](\\*)%1"..self.quote)
   end

   if quote_i then
      self.i = quote_i + 1
      self.quote = nil
      table.insert(self.simple_line_buffer, "'")
      return true
   else
      return false
   end
end

-- Skips long string literal with equal signs stored as self.equals.
-- @return boolean indicating success.
function LineScanner:skip_long_string()
   local _, bracket_i = self:find("%]"..self.equals.."%]")

   if bracket_i then
      self.i = bracket_i + 1
      self.equals = nil

      if self.comment then
         self.comment = false
      else
         table.insert(self.simple_line_buffer, "'")
      end

      return true
   else
      return false
   end
end

-- Skips function arguments.
-- @return boolean indicating success.
function LineScanner:skip_args()
   local _, paren_i = self:find("%)")

   if paren_i then
      self.i = paren_i + 1
      self.args = nil
      return true
   else
      return false
   end
end

function LineScanner:skip_whitespace()
   local next_i = self:find("%S") or #self.line + 1

   if next_i ~= self.i then
      self.i = next_i
      table.insert(self.simple_line_buffer, " ")
   end
end

function LineScanner:skip_number()
   if self:find("^0[xX]") then
      self.i = self.i + 2
   end

   local _
   _, _, self.i = self:find("^[%x%.]*()")

   if self:find("^[eEpP][%+%-]") then
      -- Skip exponent, too.
      self.i = self.i + 2
      _, _, self.i = self:find("^[%x%.]*()")
   end

   -- Skip LuaJIT number suffixes (i, ll, ull).
   _, _, self.i = self:find("^[iull]*()")
   table.insert(self.simple_line_buffer, "0")
end

local keywords = {["nil"] = "n", ["true"] = "t", ["false"] = "f"}

for _, keyword in ipairs({
      "and", "break", "do", "else", "elseif", "end", "for", "function", "goto", "if",
      "in", "local", "not", "or", "repeat", "return", "then", "until", "while"}) do
   keywords[keyword] = keyword
end

function LineScanner:skip_name()
   -- It is guaranteed that the first character matches "%a_".
   local _, _, name = self:find("^([%w_]*)")
   self.i = self.i + #name

   if keywords[name] then
      name = keywords[name]
   else
      name = "x"
   end

   table.insert(self.simple_line_buffer, name)

   if name == "function" then
      -- This flag indicates that the next pair of parentheses (function args) must be skipped.
      self.after_function = true
   end
end

-- Source lines can be explicitly ignored using `enable` and `disable` inline options.
-- An inline option is a simple comment: `-- luacov: enable` or `-- luacov: disable`.
-- Inline option parsing is not whitespace sensitive.
-- All lines starting from a line containing `disable` option and up to a line containing `enable`
-- option (or end of file) are excluded.

function LineScanner:check_inline_options(comment_body)
   if comment_body:find("^%s*luacov:%s*enable%s*$") then
      self.enabled = true
   elseif comment_body:find("^%s*luacov:%s*disable%s*$") then
      self.enabled = false
   end
end

-- Consumes and analyzes a line.
-- @return boolean indicating whether line must be excluded.
-- @return boolean indicating whether line must be excluded if not hit.
function LineScanner:consume(line)
   if self.first then
      self.first = false

      if line:match("^#!") then
         -- Ignore Unix hash-bang magic line.
         return true, true
      end
   end

   self.line = line
   -- As scanner goes through the line, it puts its simplified parts into buffer.
   -- Punctuation is preserved. Whitespace is replaced with single space.
   -- Literal strings are replaced with "''", so that a string literal
   -- containing special characters does not confuse exclusion rules.
   -- Numbers are replaced with "0".
   -- Identifiers are replaced with "x".
   -- Literal keywords (nil, true and false) are replaced with "n", "t" and "f",
   -- other keywords are preserved.
   -- Function declaration arguments are removed.
   self.simple_line_buffer = {}
   self.i = 1

   while self.i <= #line do
      -- One iteration of this loop handles one token, where
      -- string literal start and end are considered distinct tokens.
      if self.quote then
         if not self:skip_string() then
            -- String literal ends on another line.
            break
         end
      elseif self.equals then
         if not self:skip_long_string() then
            -- Long string literal or comment ends on another line.
            break
         end
      elseif self.args then
         if not self:skip_args() then
            -- Function arguments end on another line.
            break
         end
      else
         self:skip_whitespace()

         if self:find("^%.%d") then
            self.i = self.i + 1
         end

         if self:find("^%d") then
            self:skip_number()
         elseif self:find("^[%a_]") then
            self:skip_name()
         else
            if self:find("^%-%-") then
               self.comment = true
               self.i = self.i + 2
            end

            local _, bracket_i, equals = self:find("^%[(=*)%[")
            if equals then
               self.i = bracket_i + 1
               self.equals = equals

               if not self.comment then
                  table.insert(self.simple_line_buffer, "'")
               end
            elseif self.comment then
               -- Simple comment, check if it contains inline options and skip line.
               self.comment = false
               local comment_body = self.line:sub(self.i)
               self:check_inline_options(comment_body)
               break
            else
               local char = line:sub(self.i, self.i)

               if char == "." then
                  -- Dot can't be saved as one character because of
                  -- ".." and "..." tokens and the fact that number literals
                  -- can start with one.
                  local _, _, dots = self:find("^(%.*)")
                  self.i = self.i + #dots
                  table.insert(self.simple_line_buffer, dots)
               else
                  self.i = self.i + 1

                  if char == "'" or char == '"' then
                     table.insert(self.simple_line_buffer, "'")
                     self.quote = char
                  elseif self.after_function and char == "(" then
                     -- This is the opening parenthesis of function declaration args.
                     self.after_function = false
                     self.args = true
                  else
                     -- Save other punctuation literally.
                     -- This inserts an empty string when at the end of line,
                     -- which is fine.
                     table.insert(self.simple_line_buffer, char)
                  end
               end
            end
         end
      end
   end

   if not self.enabled then
      -- Disabled by inline options, always exclude the line.
      return true, true
   end

   local simple_line = table.concat(self.simple_line_buffer)
   return excluded(any_hits_exclusions, simple_line), excluded(zero_hits_exclusions, simple_line)
end

return LineScanner
