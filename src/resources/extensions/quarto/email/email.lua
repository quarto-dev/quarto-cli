--[[
Extension for generating email components needed for Posit Connect

1. extracts the subject line of the email from a div with the class `subject`
2. takes a div from a Quarto HTML document that has the class `email`, places that in
   a specially-crafted HTML-email template
3. takes all references to images (i.e, image tags) and replaces them with CID
   (Content-ID) tags. When embedding an image in an HTML email, rather than linking
   to the image file on a server, the image is encoded and included directly in the
   message.
4. identifies all associated images (e.g., PNGs) in the email portion of the document
   (as some may exist outside of the email context/div and creates Base64 encoded strings;
   we must also include mime-type information
5. generates a JSON file which contains specific email message components that Posit
   Connect is expecting for its own email generation code
]]

local lpeg = require("lpeg")

-- Define lpeg-based function to effectively replace string.gsub()
function gsub_lpeg(string, pattern, replacement)
  pattern = lpeg.P(pattern)
  pattern = lpeg.Cs((pattern / replacement + 1) ^ 0)
  return lpeg.match(pattern, string)
end

-- Define function to nicely print a table
function tbl_print(tbl, indent)
  if not indent then indent = 0 end
  local to_print = string.rep(" ", indent) .. "{\r\n"
  indent = indent + 2
  for k, v in pairs(tbl) do
    to_print = to_print .. string.rep(" ", indent)
    if (type(k) == "number") then
      to_print = to_print .. "[" .. k .. "] = "
    elseif (type(k) == "string") then
      to_print = to_print .. k .. "= "
    end
    if (type(v) == "number") then
      to_print = to_print .. v .. ",\r\n"
    elseif (type(v) == "string") then
      to_print = to_print .. "\"" .. v .. "\",\r\n"
    elseif (type(v) == "table") then
      to_print = to_print .. tbl_print(v, indent + 2) .. ",\r\n"
    else
      to_print = to_print .. "\"" .. tostring(v) .. "\",\r\n"
    end
  end
  to_print = to_print .. string.rep(" ", indent - 2) .. "}"
  return to_print
end

-- Define function to print a short version of a string
function print_short_str(string)
  local short_str_1 = string.sub(string, 1, 100)
  local short_str_2 = string.sub(string, -99)
  print(short_str_1 .. " ... " .. short_str_2)
end

-- Define function for Base64-encoding of an image file
function base64_encode(data)
  local b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  return ((data:gsub(".", function(x)
    local r, b = "", x:byte()
    for i = 8, 1, -1 do r = r .. (b % 2 ^ i - b % 2 ^ (i - 1) > 0 and "1" or "0") end
    return r;
  end) .. "0000"):gsub("%d%d%d?%d?%d?%d?", function(x)
    if (#x < 6) then return "" end
    local c = 0
    for i = 1, 6 do c = c + (x:sub(i, i) == "1" and 2 ^ (6 - i) or 0) end
    return b:sub(c + 1, c + 1)
  end) .. ({ "", "==", "=" })[#data % 3 + 1])
end

-- Define path for images associated with figures
local figure_html_path = "report_files/figure-html"

local html_email_template_1 = [[
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"> <!-- utf-8 works for most cases -->
<meta name="viewport" content="width=device-width"> <!-- Forcing initial-scale shouldn't be necessary -->
<meta http-equiv="X-UA-Compatible" content="IE=edge"> <!-- Use the latest (edge) version of IE rendering engine -->
<meta name="x-apple-disable-message-reformatting">  <!-- Disable auto-scale in iOS 10 Mail entirely -->
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"> <!-- Tell iOS not to automatically link certain text strings. -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!-- What it does: Makes background images in 72ppi Outlook render at correct size. -->
<!--[if gte mso 9]>
<xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
<![endif]-->
<style>
body {
font-family: Helvetica, sans-serif;
font-size: 14px;
}
.content {
background-color: white;
}
.content .message-block {
margin-bottom: 24px;
}
.header .message-block, .footer message-block {
margin-bottom: 12px;
}
img {
max-width: 100%;
}
@media only screen and (max-width: 767px) {
.container {
width: 100%;
}
.articles, .articles tr, .articles td {
display: block;
width: 100%;
}
.article {
margin-bottom: 24px;
}
}
</style>
</head>
<body style="background-color:#f6f6f6;font-family:Helvetica, sans-serif;color:#222;margin:0;padding:0;">
<table width="85%" align="center" class="container" style="max-width:1000px;">
<tr>
<td style="padding:24px;">
<div class="header" style="font-family:Helvetica, sans-serif;color:#999999;font-size:12px;font-weight:normal;margin:0 0 24px 0;text-align:center;">
</div>
<table width="100%" class="content" style="background-color:white;">
<tr>
]]

local html_email_template_2 = [[
</tr>
</table>
<div class="footer" style="font-family:Helvetica, sans-serif;color:#999999;font-size:12px;font-weight:normal;margin:24px 0 0 0;">
]]

local html_email_template_3 = [[
<p>If HTML documents are attached, they may not render correctly when viewed in some email clients. For a better experience, download HTML documents to disk before opening in a web browser.</p>
</div>
</td>
</tr>
</table>
</body>
</html>
]]

local subject = nil
local attachments = nil
local email_html = nil
local email_images = {}

-- TODO:
--   use a parameter to control whether to produce the contents
--   of the email div as the output, or everything but the email
--   div as the output

function Meta(meta)
  attachments = {}

  local meta_attachments = meta.attachments

  if meta_attachments ~= nil then
    for _, v in pairs(meta_attachments) do
      table.insert(attachments, pandoc.utils.stringify(v))
    end
  end

  print(#attachments)

  meta["rsc-report-rendering-url"] = "..."
end

function Div(div)
  if div.classes:includes("subject") then
    subject = pandoc.utils.stringify(div)
    return {}
  elseif div.classes:includes("email") then
    email_html = extract_div_html(div)
  end
end

-- function to extract the rendered HTML from a Div of class 'email'
-- try using pandoc.walk() and get each img
function extract_div_html(doc)
  return pandoc.write(pandoc.Pandoc({ doc }), "html")
end

function process_document(doc)
  -- Perform processing on the email HTML and generate the JSON file required for Connect

  -- TODO: examine environment variables on Connect to get these strings
  local connect_date_time = "2020-12-01 12:00:00"
  local connect_report_rendering_url = "http://www.example.com"
  local connect_report_url = "http://www.example.com"
  local connect_report_subscription_url = "http://www.example.com"

  -- The following regexes remove the surrounding <div> from the HTML text
  -- TODO: ensure that this works for a large variety of documents
  email_html = string.gsub(email_html, "^<div class=\"email\">", '')
  email_html = string.gsub(email_html, "</div>$", '')

  -- Use the Connect email template components along with the `email_html`
  -- fragment to forge the email HTML

  -- TODO: try to optimize this combining of strings, signal which of these
  --       are variables; idea: use functions to generate key fragments that
  --       will be combined

  local html_email_body =
      html_email_template_1 ..
      "<td style=\"padding:12px;\">" .. email_html .. "</td>" ..
      html_email_template_2 ..
      "<p>This message was generated on " .. connect_date_time .. ".</p>\n\n" ..
      "<p>This Version: <a href=\"" .. connect_report_rendering_url .. 
      "\">" .. connect_report_rendering_url .. "</a><br/>" ..
      "Latest Version: <a href=\"" .. connect_report_url ..
      "\">" .. connect_report_url .. "</a></p>\n\n" ..
      "<p>If you wish to stop receiving emails for this document, you may <a href=\"" ..
      connect_report_subscription_url .. "\">unsubscribe here</a>.</p>\n\n" ..
      html_email_template_3

  -- Get a listing of all image files in `report_files/figure-html`
  -- TODO: does Quarto provide a facility for this? Dealing with the filesystem directly seems not ideal
  -- TODO: there will certainly be more types of graphics than just PNG graphics, ensure that all graphics
  --       files are accounted for
  local figure_html_path_ls_png_command = "ls " .. figure_html_path .. "/*.png"
  local figure_html_path_handle = io.popen(figure_html_path_ls_png_command)
  local figure_html_dir_listing = nil

  if type(figure_html_path_handle) == "userdata" then
    figure_html_dir_listing = figure_html_path_handle:read("*a")
    figure_html_path_handle:close()
  end

  -- Create a table that contains all found image tags in the `html_email_body` HTML string
  local img_tag_list = {}
  for img_tag in html_email_body:gmatch("%<img src=.->") do
    table.insert(img_tag_list, img_tag)
  end

  -- Create a new table that finds paths to image resources on disk
  local img_tag_filepaths_list = {}
  for key, _ in ipairs(img_tag_list) do
    img_tag_filepaths_list[key] = img_tag_list[key]:match('src="(.-)"')
  end

  --[[
  For each of the <img> tags we need to do a few things in the order they were found:
    1. determine if the path resolved in `img_tag_filepaths_list` matches an actual
       path in `figure_html_dir_listing` (if there isn't a match, skip to the next iteration)
    2. assuming a match, create a Base64-encoded representation of the image and place that
       into the table `email_images` (it'll be needed for the JSON output file); also,
    3. modify the <img> tag so that it contains a reference to the Base64 string; this
       is essentially the creation of Content-ID (or CID) tag, where the basic form of it
       is `<img src="cid:image-id"/>` (the `image-id` will be written as `img<n>.png`,
       incrementing from `1`)
  ]]

  -- This gets the project output directory
  -- nil if no project, a path if so
  --print(quarto.project.output_directory)

  local image_data = nil

  --print("Directory Listing: \n" .. figure_html_dir_listing .. "\n")
  --print(tbl_print(img_tag_filepaths_list))

  for key, value in ipairs(img_tag_list) do
    if (true) then -- TODO: replace with check for each value in `img_tag_filepaths_list` having membership in `figure_html_dir_listing`

      local image_file_path = img_tag_filepaths_list[key]
      local image_file = io.open(image_file_path, "rb")

      if type(image_file) == "userdata" then
        image_data = image_file:read("*all")
        image_file:close()
      end

      local encoded_data = base64_encode(image_data)
      
      -- Prepare identifier for image and create an image tag replacement for within `html_email_body`
      local tbl_named_key_image_data = "img" .. key .. ".png"
      local cid_img_tag_replacement = "<img src=\"cid:" .. tbl_named_key_image_data ..  "\"/>"

      -- Insert `encoded_data` into `email_images` table with prepared key
      email_images[tbl_named_key_image_data] = encoded_data

      -- Replace tag with cid replacement version
      html_email_body = gsub_lpeg(html_email_body, value, cid_img_tag_replacement)
    end
  end

  -- print(html_email_body)

  -- Pandoc's resource processing is available in a JSON file

  -- Encode all of the strings and tables of strings into a JSON file that's
  --   needed for Connect's email feature
  -- TODO: handle variant with text-based email message bodies
  --       (using `rsc_email_body_text` instead of `rsc_email_body_html`)
  local str = quarto.json.encode({
    rsc_email_subject = subject,
    rsc_email_attachments = attachments,
    rsc_email_body_html = html_email_body,
    rsc_email_images = email_images,
    rsc_email_suppress_report_attachment = true,
    rsc_email_suppress_scheduled = false
  })

  -- TODO: Find out what the Connect output directory and write the file there
  --   (this is the Quarto project output dir)
  io.open(".output_metadata.json", "w"):write(str):close()

  
  local file = quarto.doc.input_file

  local dir = pandoc.path.directory(file)
  local resource = pandoc.path.join({dir, ".output_metadata.json"})

  print("directory is: " .. dir)
  print("resource is: " .. resource)

  quarto.doc.add_supporting(resource)
end

function Pandoc(doc)
  -- local rendering_email = get_option() -- TODO
  -- if rendering_email then
  --   -- make the content of doc be only the content of the .email div
  -- else
  --   -- remove the .email div from the document
  -- end

  process_document(doc)

  -- local json_file = io.open(".output_metadata.json", "r")

  -- if json_file then
    -- local contents = json_file:read("*all")
    -- json_file:close()
  -- else
    -- print("Error: could not open file")
  -- end
end
