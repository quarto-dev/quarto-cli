function Div(div)
    if div.classes:includes("ensure-post") then
        div.classes:insert("called")
    end
    return div
end
