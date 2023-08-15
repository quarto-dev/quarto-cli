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
--]]

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

function get_file_extension(file_path)
  local pattern = "%.([^%.]+)$"
  local ext = file_path:match(pattern)
  return ext
end

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
]]

local html_email_template_3 = [[
<div class="footer" style="font-family:Helvetica, sans-serif;color:#999999;font-size:12px;font-weight:normal;margin:24px 0 0 0;">
]]

local html_email_template_4 = [[
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
local image_tbl = {}

function Meta(meta)

  attachments = {}

  local meta_attachments = meta.attachments
  
  if meta_attachments ~= nil then
    for _, v in pairs(meta_attachments) do
      table.insert(attachments, pandoc.utils.stringify(v))
    end
  end
end

function Div(div)

  if div.classes:includes("subject") then

    subject = pandoc.utils.stringify(div)
    return {}
  
  elseif div.classes:includes("email") then

    --[[
    For each of the <img> tags found we need to modify the tag so that it contains a
    reference to the Base64 string; this reference is that of the Content-ID (or CID) tag;
    the basic form is `<img src="cid:image-id"/>` (the `image-id` will be written as
    `img<n>.<file_extension>`, incrementing <n> from 1)
    ]]

    local count = 1

    local renderDiv = quarto._quarto.ast.walk(div, {Image = function(imgEl)

      local file_extension = get_file_extension(imgEl.src)

      local cid = "img" .. tostring(count) .. "." .. file_extension

      image_tbl[cid] = imgEl.src

      imgEl.src = "cid:" .. cid

      count = count + 1

      return imgEl
    end})

    email_html = extract_div_html(renderDiv)

    return {}
  end
end

-- function to extract the rendered HTML from a Div of class 'email'
function extract_div_html(doc)
  return pandoc.write(pandoc.Pandoc({ doc }), "html")
end

function process_document(doc)

  -- Get the current date and time
  local connect_date_time = os.date("%Y-%m-%d %H:%M:%S")

  -- Use Connect environment variables to get URLs for the email footer section
  -- If any of these are nil, a portion of the email footer won't be rendered
  local connect_report_rendering_url = os.getenv("RSC_REPORT_RENDERING_URL") -- "https://connect.example.com/content/1234/_rev5678"
  local connect_report_url = os.getenv("RSC_REPORT_URL") -- "https://connect.example.com/content/1234/"
  local connect_report_subscription_url = os.getenv("RSC_REPORT_SUBSCRIPTION_URL") -- "https://connect.example.com/connect/#/apps/1234/subscriptions"

  -- The following regexes remove the surrounding <div> from the HTML text
  email_html = string.gsub(email_html, "^<div class=\"email\">", '')
  email_html = string.gsub(email_html, "</div>$", '')

  -- Use the Connect email template components along with the `email_html`
  -- fragment to generate the email message body as HTML
  if connect_report_rendering_url == nil or 
     connect_report_url == nil or
     connect_report_subscription_url == nil then

    html_email_body =
      html_email_template_1 ..
      "<td style=\"padding:12px;\">" .. email_html .. "</td>" ..
      html_email_template_2 ..
      html_email_template_3 ..
      "<p>This message was generated on " .. connect_date_time .. ".</p>\n\n" ..
      html_email_template_4

      else

    html_email_body =
      html_email_template_1 ..
      "<td style=\"padding:12px;\">" .. email_html .. "</td>" ..
      html_email_template_2 ..
      html_email_template_3 ..
      "<p>This message was generated on " .. connect_date_time .. ".</p>\n\n" ..
      "<p>This Version: <a href=\"" .. connect_report_rendering_url .. "\">" .. connect_report_rendering_url .. "</a>\n\n" .. 
      "Latest Version: <a href=\"" .. connect_report_url .. "\">" .. connect_report_url .. "</a></p>\n\n" ..
      "<p>If you wish to stop receiving emails for this document, you may <a href=\"" .. connect_report_subscription_url .. "\">unsubscribe here</a>.</p>" .. 
      "<br/>" ..
      html_email_template_4
  end

  -- For each of the <img> tags we need to create a Base64-encoded representation
  -- of the image and place that into the table `email_images` (keyed by `cid`)
  local image_data = nil

  for cid, img in pairs(image_tbl) do
    if (true) then

      local image_file = io.open(img, "rb")

      if type(image_file) == "userdata" then
        image_data = image_file:read("*all")
        image_file:close()
      end

      local encoded_data = base64_encode(image_data)
      
      -- Insert `encoded_data` into `email_images` table with prepared key
      email_images[cid] = encoded_data
    end
  end

  -- Encode all of the strings and tables of strings into a JSON file that's
  -- needed for Connect's email feature
  local metadata_str = quarto.json.encode({
    rsc_email_subject = subject,
    rsc_email_attachments = attachments,
    rsc_email_body_html = html_email_body,
    rsc_email_images = email_images,
    rsc_email_suppress_report_attachment = true,
    rsc_email_suppress_scheduled = false
  })

  -- Determine the location of the Quarto project directory; if not defined
  -- by the user then set to the location of the input file
  local project_output_directory = quarto.project.output_directory

  if (project_output_directory ~= nil) then
    dir = project_output_directory
  else
    local file = quarto.doc.input_file
    dir = pandoc.path.directory(file)
  end

  -- For all file attachments declared by the user, ensure they copied over
  -- to the project directory (`dir`) 
  for _, v in pairs(attachments) do
    local source_attachment_file = pandoc.utils.stringify(v)
    local dest_attachment_path_file = pandoc.path.join({dir, pandoc.utils.stringify(v)})
    local attachment_text = io.open(source_attachment_file):read("*a")
    io.open(dest_attachment_path_file, "w"):write(attachment_text):close()
  end
  
  -- Write the `.output_metadata.json` file to the project directory
  local metadata_path_file = pandoc.path.join({dir, ".output_metadata.json"})
  io.open(metadata_path_file, "w"):write(metadata_str):close()
end

function Pandoc(doc)

  process_document(doc)

end
