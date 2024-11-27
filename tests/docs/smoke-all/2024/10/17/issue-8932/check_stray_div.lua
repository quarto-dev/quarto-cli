function Str(str)
    if string.find(str.text, ":::") then
        crash()
    end
end