--[[
Extension for generating email components needed for Posit Connect

1. Extracts the subject line of the email from a div with the class `subject`
2. Takes a div from a Quarto HTML document that has the class `email`, places that in
   a specially-crafted HTML-email template
3. Takes all references to images (i.e, image tags) and replaces them with CID
   (Content-ID) tags. When embedding an image in an HTML email, rather than linking
   to the image file on a server, the image is encoded and included directly in the
   message.
4. Identifies all associated images (e.g., PNGs) in the email portion of the document
   (as some may exist outside of the email context/div and creates Base64 encoded strings;
   we must also include mime type information
5. Generates a JSON file (.output_metadata.json) which contains specific email message
   components that Posit Connect expects for its own email generation code
6. Produces a local `email-preview.html` file for previewing the HTML email
--]]

-- Get the file extension of any file residing on disk
function get_file_extension(file_path)
  local pattern = "%.([^%.]+)$"
  local ext = file_path:match(pattern)
  return ext
end

-- Determine whether a Lua table is completely empty
function is_empty_table(table)
  return next(table) == nil
end

-- Determine whether a file exists at a specific path
function file_exists(path)
  local file = io.open(path, "r")
  if file then
    file:close()
    return true
  end
  return false
end

-- Trim surrounding whitespace for a string and truncate to a maximum length
function str_trunc_trim(str, max_length)
  local str_trimmed = str:match("^%s*(.-)%s*$")
  local str_formatted = string.sub(str_trimmed, 1, max_length)
  return str_formatted
end

-- Determine whether a single string is truthy or falsy
function str_truthy_falsy(str)
  local truthy_terms = {"true", "yes"}
  local falsy_terms = {"false", "no"}
  for _, term in ipairs(truthy_terms) do
    if string.match(str, term) then
      return true
    end
  end
  for _, term in ipairs(falsy_terms) do
    if string.match(str, term) then
      return false
    end
  end
  return false
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

-- Function to generate an HTML email message body using HTML email
-- template fragments, the rendered and extracted email component from
-- the document (`email_html`), and data specific to Connect custom emails
function generate_html_email_from_template(
  email_html,
  connect_date_time,
  connect_report_rendering_url,
  connect_report_url,
  connect_report_subscription_url
)

  -- Use the Connect email template components along with the `email_html`
  -- fragment to generate the email message body as HTML
  if connect_report_rendering_url == nil or 
     connect_report_url == nil or
     connect_report_subscription_url == nil then

    html_str =
      html_email_template_1 ..
      "<td style=\"padding:12px;\">" .. email_html .. "</td>" ..
      html_email_template_2 ..
      html_email_template_3 ..
      "<p>This message was generated on " .. connect_date_time .. ".</p>\n\n" ..
      html_email_template_4

      else

    html_str =
      html_email_template_1 ..
      "<td style=\"padding:12px;\">" .. email_html .. "</td>" ..
      html_email_template_2 ..
      html_email_template_3 ..
      "<p>This message was generated on " .. connect_date_time .. ".</p>\n\n" ..
      "<p>This Version: <a href=\"" .. connect_report_rendering_url .. "\">" .. connect_report_rendering_url .. "</a></p>\n\n" .. 
      "Latest Version: <a href=\"" .. connect_report_url .. "\">" .. connect_report_url .. "</a></p>\n\n" ..
      "<p>If you wish to stop receiving emails for this document, you may <a href=\"" .. connect_report_subscription_url .. "\">unsubscribe here</a>.</p>\n\n" .. 
      html_email_template_4
  end

  return html_str
end

local subject = nil
local email_images = {}
local image_tbl = {}
local suppress_scheduled_email = false

function process_meta(meta)

  attachments = {}

  local meta_email_attachments = meta["email-attachments"]
  meta_email_preview = meta["email-preview"]
  
  if meta_email_attachments ~= nil then
    for _, v in pairs(meta_email_attachments) do
      if (file_exists(pandoc.utils.stringify(v))) then
        table.insert(attachments, pandoc.utils.stringify(v))
      end
    end
  end
end

function process_div(div)

  if div.classes:includes("subject") then

    subject = pandoc.utils.stringify(div)
    return {}

  elseif div.classes:includes("email-text") then

    email_text = pandoc.write(pandoc.Pandoc({ div }), "plain")
    return {}

  elseif div.classes:includes("email-scheduled") then

    local email_scheduled_str = str_trunc_trim(string.lower(pandoc.utils.stringify(div)), 10)
    local scheduled_email = str_truthy_falsy(email_scheduled_str)

    suppress_scheduled_email = not scheduled_email

    return {}
  
  elseif div.classes:includes("email") then

    --[[
    Render of HTML email message body for Connect: `email_html`

    For each of the <img> tags found we need to modify the tag so that it contains a
    reference to the Base64 string; this reference is that of the Content-ID (or CID) tag;
    the basic form is `<img src="cid:image-id"/>` (the `image-id` will be written as
    `img<n>.<file_extension>`, incrementing <n> from 1)
    ]]

    local count = 1

    local render_div_cid = quarto._quarto.ast.walk(div, {Image = function(img_el)

      local file_extension = get_file_extension(img_el.src)
      local cid = "img" .. tostring(count) .. "." .. file_extension
      image_tbl[cid] = img_el.src
      img_el.src = "cid:" .. cid
      count = count + 1
      return img_el

    end})

    email_html = extract_email_div_str(render_div_cid)

    --[[
    Render of HTML email message body for Connect: `email_html_preview`

    We are keeping a render of the email HTML for previewing purposes (if the option
    is taken to do so); here, the HTML is self-contained where the image tags contain
    base64-encoded data
    ]]

    local render_div_base64 = quarto._quarto.ast.walk(div, {Image = function(img_el)

      local image_file = io.open(img_el.src, "rb")

      if type(image_file) == "userdata" then
        image_data = image_file:read("*all")
        image_file:close()
      end

      local encoded_data = quarto.base64.encode(image_data)
      local file_extension = get_file_extension(img_el.src)
      local base64_str = "data:image/" .. file_extension .. ";base64," .. encoded_data
      img_el.src = base64_str
      return img_el

    end})

    email_html_preview = extract_email_div_str(render_div_base64)

    -- Remove the the `.email` div so it doesn't appear in the main report document
    return {}

  end
end

-- Function to extract the rendered HTML from a Div of class 'email'
function extract_email_div_str(doc)
  return pandoc.write(pandoc.Pandoc( {doc} ), "html")
end

function process_document(doc)

  -- Get the current date and time
  local connect_date_time = os.date("%Y-%m-%d %H:%M:%S")

  -- Use Connect environment variables to get URLs for the email footer section
  -- If any of these are nil, a portion of the email footer won't be rendered
  local connect_report_rendering_url = os.getenv("RSC_REPORT_RENDERING_URL")
  local connect_report_url = os.getenv("RSC_REPORT_URL")
  local connect_report_subscription_url = os.getenv("RSC_REPORT_SUBSCRIPTION_URL")

  -- The following regexes remove the surrounding <div> from the HTML text
  email_html = string.gsub(email_html, "^<div class=\"email\">", '')
  email_html = string.gsub(email_html, "</div>$", '')

  -- Use the Connect email template components along with the `email_html` and
  -- `email_html_preview` objects to generate the email message body for Connect
  -- and the email HTML file (as a local preview)
  
  html_email_body = generate_html_email_from_template(
    email_html,
    connect_date_time,
    connect_report_rendering_url,
    connect_report_url,
    connect_report_subscription_url
  )

  html_preview_body = generate_html_email_from_template(
    email_html_preview,
    connect_date_time,
    connect_report_rendering_url,
    connect_report_url,
    connect_report_subscription_url
  )

  -- For each of the <img> tags we need to create a Base64-encoded representation
  -- of the image and place that into the table `email_images` (keyed by `cid`)

  local image_data = nil

  for cid, img in pairs(image_tbl) do

    local image_file = io.open(img, "rb")

    if type(image_file) == "userdata" then
      image_data = image_file:read("*all")
      image_file:close()
    end

    local encoded_data = quarto.base64.encode(image_data)
      
    -- Insert `encoded_data` into `email_images` table with prepared key
    email_images[cid] = encoded_data
  end

  -- Encode all of the strings and tables of strings into the JSON file
  -- (`.output_metadata.json`) that's needed for Connect's email feature

  if (is_empty_table(email_images)) then

    metadata_str = quarto.json.encode({
      rsc_email_subject = subject,
      rsc_email_attachments = attachments,
      rsc_email_body_html = html_email_body,
      rsc_email_body_text = email_text,
      rsc_email_suppress_report_attachment = true,
      rsc_email_suppress_scheduled = suppress_scheduled_email
    })

  else

    metadata_str = quarto.json.encode({
      rsc_email_subject = subject,
      rsc_email_attachments = attachments,
      rsc_email_body_html = html_email_body,
      rsc_email_body_text = email_text,
      rsc_email_images = email_images,
      rsc_email_suppress_report_attachment = true,
      rsc_email_suppress_scheduled = suppress_scheduled_email
    })
  end

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

    -- Only if the file exists should it be copied into the project directory
    if (file_exists(source_attachment_file)) then
      local attachment_text = io.open(source_attachment_file):read("*a")
      io.open(dest_attachment_path_file, "w"):write(attachment_text):close()
    end
  end
  
  -- Write the `.output_metadata.json` file to the project directory
  local metadata_path_file = pandoc.path.join({dir, ".output_metadata.json"})
  io.open(metadata_path_file, "w"):write(metadata_str):close()

  -- Write the `.email-preview.html` file to the working directory if the option is taken
  if (meta_email_preview) then
    quarto._quarto.file.write(pandoc.path.join({dir, "email-preview/email-preview.html"}), html_preview_body)
  end
end

function render_email()

  if not _quarto.format.isEmailOutput() then 
    return {}
  end

  return {
    Pandoc = process_document,
    Meta = process_meta,
    Div = process_div,
  }
end