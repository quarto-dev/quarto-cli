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
6. Produces a local `index.html` file that contains the HTML email for previewing purposes
   (this can be disabled by setting `email-preview: false` in the YAML header)
--]]
local constants = require("modules/constants")
local connectversion = require("modules/connectversion")

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

-- v2: Collections for multiple emails
local emails = {}
local current_email = nil

-- v1 fallback: Document-level metadata
local subject = ""
local email_text = ""
local suppress_scheduled_email = false
local found_email_div = false

-- Track whether we detected v1-style top-level metadata
local has_top_level_metadata = false
local email_count = 0

-- Track whether to use v2 JSON format (multi-email array) or v1 format (single email)
local use_v2_email_format = false

-- Track Connect version capability for v2 format
local connect_supports_v2 = false


function process_meta(meta)
  if not found_email_div then
    return
  end

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

-- Function to check whether a div with the 'email' class is present in the document
-- and count them for version detection
function find_email_div(div)
  if div.classes:includes("email") then
    found_email_div = true
    email_count = email_count + 1
  end
end

function process_div(div)

  if not found_email_div then
    return nil
  end

  -- V2 mode: email div contains subject/email-text/email-scheduled
  if div.classes:includes("email") then
    
    -- Start a new email object
    current_email = {
      subject = "",
      email_text = "",
      email_html = "",
      email_html_preview = "",
      image_tbl = {},
      email_images = {},
      suppress_scheduled_email = nil,  -- nil means not set
      attachments = {}
    }

    -- Extract nested metadata from immediate children
    local remaining_content = {}

    for i, child in ipairs(div.content) do
      if child.t == "Div" then
        if child.classes:includes("subject") then
          current_email.subject = pandoc.utils.stringify(child)
        elseif child.classes:includes("email-text") then
          current_email.email_text = pandoc.write(pandoc.Pandoc({ child }), "plain")
        elseif child.classes:includes("email-scheduled") then
          local email_scheduled_str = str_trunc_trim(string.lower(pandoc.utils.stringify(child)), 10)
          local scheduled_email = str_truthy_falsy(email_scheduled_str)
          current_email.suppress_scheduled_email = not scheduled_email
        else
          table.insert(remaining_content, child)
        end
      else
        table.insert(remaining_content, child)
      end
    end
    
    -- Create a modified div without metadata for processing
    local email_without_metadata = pandoc.Div(remaining_content, div.attr)

    -- Process images with CID tags
    local count = 1
    local render_div_cid = quarto._quarto.ast.walk(email_without_metadata, {
      Image = function(img_el)
        local file_extension = get_file_extension(img_el.src)
        local cid = "img" .. tostring(count) .. "." .. file_extension
        current_email.image_tbl[cid] = img_el.src
        img_el.src = "cid:" .. cid
        count = count + 1
        return img_el
      end
    })

    current_email.email_html = extract_email_div_str(render_div_cid)

    -- Process images with base64 for preview
    local render_div_base64 = quarto._quarto.ast.walk(email_without_metadata, {
      Image = function(img_el)
        local image_file = io.open(img_el.src, "rb")
        if type(image_file) == "userdata" then
          local image_data = image_file:read("*all")
          image_file:close()
          local encoded_data = quarto.base64.encode(image_data)
          local file_extension = get_file_extension(img_el.src)
          local base64_str = "data:image/" .. file_extension .. ";base64," .. encoded_data
          img_el.src = base64_str
        end
        return img_el
      end
    })

    current_email.email_html_preview = extract_email_div_str(render_div_base64)

    -- Encode base64 images for JSON
    for cid, img in pairs(current_email.image_tbl) do
      local image_file = io.open(img, "rb")

      if type(image_file) == "userdata" then
        local image_data = image_file:read("*all")
        image_file:close()

        local encoded_data = quarto.base64.encode(image_data)
        current_email.email_images[cid] = encoded_data
      end
    end

    -- Add current email to collection
    table.insert(emails, current_email)
    current_email = nil

    -- Remove the email div from output
    return {}
  end
end

-- Function to extract the rendered HTML from a Div of class 'email'
function extract_email_div_str(doc)
  return pandoc.write(pandoc.Pandoc( {doc} ), "html")
end

function process_document(doc)

  if not found_email_div then
    return doc
  end

  -- Detect format upfront: Check Connect version and look for document-level metadata
  -- This must be determined before processing to avoid confusion about which format to use
  if connectversion.is_connect_version_at_least(constants.kConnectEmailMetadataChangeVersion) then
    connect_supports_v2 = true
  end

  -- Scan for document-level metadata at the TOP LEVEL of the document
  for _, block in ipairs(doc.blocks) do
    if block.t == "Div" then
      if block.classes:includes("subject") or block.classes:includes("email-text") or block.classes:includes("email-scheduled") then
        has_top_level_metadata = true
        break
      end
    end
  end
  
  -- Determine format: v2 only if Connect supports it AND no document-level metadata
  if connect_supports_v2 and not has_top_level_metadata then
    use_v2_email_format = true
  end

  -- V1 fallback: Process document-level metadata divs (not nested in email)
  -- We already know from the format detection above if these exist
  doc = quarto._quarto.ast.walk(doc, {
    Div = function(div)
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
      end
      return div
    end
  })

  -- Warn if old v1 input format detected
  if has_top_level_metadata then
    quarto.log.warning("Invalid email format detected (top-level subject/email-text). Outputting as v1 for backward compatibility.")
  end

  -- In v1 mode (document-level metadata), only keep the first email
  if has_top_level_metadata and #emails > 1 then
    quarto.log.warning("V1 format with document-level metadata should have only one email. Keeping first email only.")
    emails = { emails[1] }
    email_count = 1
  end

  -- If Connect doesn't support v2 format, only keep first email and warn
  if not use_v2_email_format and not has_top_level_metadata then
    quarto.log.warning("Detected Connect version < " .. constants.kConnectEmailMetadataChangeVersion .. " which doesn't support multiple emails. Only the first email will be sent. Upgrade Connect to " .. constants.kConnectEmailMetadataChangeVersion .. "+ for multi-email support.")
    emails = { emails[1] }
    email_count = 1
  end

  -- Get the current date and time
  local connect_date_time = os.date("%Y-%m-%d %H:%M:%S")

  -- Use Connect environment variables to get URLs for the email footer section
  -- If any of these are nil, a portion of the email footer won't be rendered
  local connect_report_rendering_url = os.getenv("RSC_REPORT_RENDERING_URL")
  local connect_report_url = os.getenv("RSC_REPORT_URL")
  local connect_report_subscription_url = os.getenv("RSC_REPORT_SUBSCRIPTION_URL")

  -- Determine the location of the Quarto project directory
  local project_output_directory = quarto.project.output_directory
  local dir
  if (project_output_directory ~= nil) then
    dir = project_output_directory
  else
    local file = quarto.doc.input_file
    dir = pandoc.path.directory(file)
  end
  
  -- Process all emails and generate their previews
  local emails_for_json = {}
  
  for idx, email_obj in ipairs(emails) do
    
    -- Apply document-level fallbacks with warnings
    if email_obj.subject == "" and subject ~= "" then
      quarto.log.warning("Email #" .. tostring(idx) .. " has no subject. Using document-level subject.")
      email_obj.subject = subject
    end
    
    if email_obj.email_text == "" and email_text ~= "" then
      quarto.log.warning("Email #" .. tostring(idx) .. " has no email-text. Using document-level email-text.")
      email_obj.email_text = email_text
    end

    if email_obj.suppress_scheduled_email == nil and suppress_scheduled_email then
      quarto.log.warning("Email #" .. tostring(idx) .. " has no email-scheduled setting. Using document-level setting.")
      email_obj.suppress_scheduled_email = suppress_scheduled_email
    end

    if is_empty_table(email_obj.attachments) and not is_empty_table(attachments) then
      email_obj.attachments = attachments
    end

    -- Default suppress_scheduled_email to false if still nil
    if email_obj.suppress_scheduled_email == nil then
      email_obj.suppress_scheduled_email = false
    end

    -- Clean up HTML
    local email_html_clean = string.gsub(email_obj.email_html, "^<div class=\"email\">", '')
    email_html_clean = string.gsub(email_html_clean, "</div>$", '')

    -- Generate HTML bodies
    local html_email_body = generate_html_email_from_template(
      email_html_clean,
      connect_date_time,
      connect_report_rendering_url,
      connect_report_url,
      connect_report_subscription_url
    )

    local html_preview_body = generate_html_email_from_template(
      email_obj.email_html_preview,
      connect_date_time,
      connect_report_rendering_url,
      connect_report_url,
      connect_report_subscription_url
    )

    -- Add subject to preview
    local subject_html_preview = "<div style=\"text-align: center; background-color: #fcfcfc; padding-top: 12px; font-size: large;\"><span style=\"margin-left: 25px\"><strong><span style=\"font-variant: small-caps;\">subject: </span></strong>" .. email_obj.subject .. "</span><hr /></div>"
    html_preview_body = string.gsub(html_preview_body, "</head>", "</head>\n" .. subject_html_preview)

    -- Build email object for JSON

    -- rsc_email_suppress_report_attachment (now inverted to send_report_as_attachment) referred to
    -- the attachment of the rendered report to each connect email.
    -- This is always true for all emails unless overridden by blastula (as is the case in v1)
    local email_json_obj = {
      email_id = idx,
      subject = email_obj.subject,
      body_html = html_email_body,
      body_text = email_obj.email_text,
      attachments = email_obj.attachments,
      suppress_scheduled = email_obj.suppress_scheduled_email,
      send_report_as_attachment = false
    }

    -- Only add images if present
    if not is_empty_table(email_obj.email_images) then
      email_json_obj.images = email_obj.email_images
    end

    table.insert(emails_for_json, email_json_obj)

    -- Write preview file(s). For v2 produce per-email previews; for v1
    -- produce a single index.html preview.
    if meta_email_preview ~= false then
      local preview_filename
      if use_v2_email_format then
        preview_filename = "email-preview/email_id-" .. tostring(idx) .. ".html"
      else
        preview_filename = "email-preview/index.html"
      end
      quarto._quarto.file.write(pandoc.path.join({dir, preview_filename}), html_preview_body)
    end
  end

  -- Generate JSON in appropriate format
  local metadata_str
  if use_v2_email_format then
    metadata_str = quarto.json.encode({
      rsc_email_version = 2,
      emails = emails_for_json
    })
  else
    -- V1 format: single email object with rsc_ prefix fields (backward compatible)
    -- Take the first (and should be only) email
    local first_email = emails_for_json[1]
    if first_email then
      local v1_metadata = {
        rsc_email_subject = first_email.subject,
        rsc_email_body_html = first_email.body_html,
        rsc_email_body_text = first_email.body_text,
        rsc_email_attachments = first_email.attachments,
        rsc_email_suppress_scheduled = first_email.suppress_scheduled,
        rsc_email_suppress_report_attachment = true
      }
      
      -- Only add images if present
      if first_email.images and not is_empty_table(first_email.images) then
        v1_metadata.rsc_email_images = first_email.images
      end
      
      metadata_str = quarto.json.encode(v1_metadata)
    else
      quarto.log.error("No emails found to generate metadata")
      metadata_str = quarto.json.encode({})
    end
  end

  -- Write metadata file
  local metadata_path_file = pandoc.path.join({dir, ".output_metadata.json"})
  io.open(metadata_path_file, "w"):write(metadata_str):close()

  -- Copy attachments to project directory
  for _, v in pairs(attachments) do
    local source_attachment_file = pandoc.utils.stringify(v)
    local dest_attachment_path_file = pandoc.path.join({dir, pandoc.utils.stringify(v)})

    if (file_exists(source_attachment_file)) then
      local attachment_text = io.open(source_attachment_file):read("*a")
      io.open(dest_attachment_path_file, "w"):write(attachment_text):close()
    end
  end

  return doc
end

function render_email()

  if not _quarto.format.isEmailOutput() then 
    return {}
  end

  return {
    {
      Div = find_email_div,
    },
    {
      Meta = process_meta,
      Div = process_div,
    },
    {
      Pandoc = process_document,
    }
  }
end