--[[
Connect version sniffing utilities for email extension

Functions to detect and compare Posit Connect versions from environment variables
]]

-- Parse Connect version from SPARK_CONNECT_USER_AGENT
-- Format:  posit-connect/2024.09.0
--          posit-connect/2024.09.0-dev+26-dirty-g51b853f70e
-- Returns: "2024.09.0" or nil
function get_connect_version()
  local user_agent = os.getenv("SPARK_CONNECT_USER_AGENT")
  if not user_agent then
    return nil
  end
  
  -- Extract the version after "posit-connect/"
  local version_with_suffix = string.match(user_agent, "posit%-connect/([%d%.%-+a-z]+)")
  if not version_with_suffix then
    return nil
  end
  
  -- Strip everything after the first "-" (e.g., "-dev+88-gda902918eb")
  local idx = string.find(version_with_suffix, "-")
  if idx then
    return string.sub(version_with_suffix, 1, idx - 1)
  end
  
  return version_with_suffix
end

-- Parse a version string into components
-- Versions are in format "X.Y.Z", with all integral components (e.g., "2025.11.0")
-- Returns: {major=2025, minor=11, patch=0} or nil
function parse_version_components(version_string)
  if not version_string then
    return nil
  end
  
  -- Parse version (e.g., "2025.11.0" or "2025.11")
  local major, minor, patch = string.match(version_string, "^(%d+)%.(%d+)%.?(%d*)$")
  if not major then
    return nil
  end
  
  return {
    major = tonumber(major),
    minor = tonumber(minor),
    patch = patch ~= "" and tonumber(patch) or 0
  }
end

-- Check if Connect version is >= target version
-- Versions are in format "YYYY.MM.patch" (e.g., "2025.11.0")
function is_connect_version_at_least(target_version)
  local current_version = get_connect_version()
  local current = parse_version_components(current_version)
  local target = parse_version_components(target_version)
  
  if not current or not target then
    return false
  end
  
  -- Convert to numeric YYYYMMPP format and compare
  local current_num = current.major * 10000 + current.minor * 100 + current.patch
  local target_num = target.major * 10000 + target.minor * 100 + target.patch
  
  return current_num >= target_num
end

-- Export functions for module usage
return {
  is_connect_version_at_least = is_connect_version_at_least
}
