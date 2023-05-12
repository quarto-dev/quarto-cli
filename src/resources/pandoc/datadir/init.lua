
------------------------------------------------------------------------------------------------------------------------------
-- Module: utf8_filenames
------------------------------------------------------------------------------------------------------------------------------
-- Filename: utf8_filenames.lua
-- Version:  2019-07-13
-- License:  MIT (see at the end of this file)

-- This module modifies standard Lua functions so that they work with UTF-8 filenames on Windows:
--    io.open
--    io.popen
--    io.lines
--    io.input
--    io.output
--    os.rename
--    os.remove
--    os.execute
--    dofile
--    loadfile
--    require
-- Only filename-related functions are modified (for example, this module DOES NOT change Lua patterns behavior).

-- Please note that filenames must contain only symbols from your Windows ANSI codepage (which depends on OS locale).
-- Unfortunately, it's impossible to work with a file having arbitrary UTF-8 symbols in its name.

-- This module is compatible with Lua 5.1, 5.2, 5.3, LuaJIT, and probably 5.4.
-- Lua implementations having shortened FP numbers (4-byte "float" instead of 8-byte "double") are not supported.
-- Lua 5.3+ implementations with shortened integers (int32 instead of int64) are OK.

-- This module returns a "convertor" function which converts a string from UTF-8 to OS-specific codepage.
-- On Linux/MacOS/etc. this module doesn't modify any Lua functions and returns "empty convertor" (which simply returns its argument).

-- Usage example #1 (executing a Lua script):
--    require"utf8_filenames"
--    dofile(script_filename_in_utf8)

-- Usage example #2 (loading a Lua module):
--    local convert_from_utf8 = require"utf8_filenames"
--    package.path = package.path..";"..convert_from_utf8(module_folder_in_utf8).."/?.lua"
--    require(module_name_in_utf8)

-- Please note that these examples would work on both Windows and Linux.
-- BTW, Windows does accept both / and \ as path separators, so it's OK to use / on any OS.

-- The conversion from UTF-8 to "Windows ANSI codepage" is implemented according to mapping tables published at unicode.org.
-- Mapping tables are stored in human-unreadable compressed form to significantly reduce module size.


local test_data_integrity = false  -- set to true if you are unsure about correctness of human-unreadable parts of this file

local function modify_lua_functions(all_compressed_mappings)

   local function convert_from_utf8(...)   -- for all OS except Windows
      return ...
   end

   local char, byte, floor, table_insert, table_concat = string.char, string.byte, math.floor, table.insert, table.concat

   local function decompress_mapping(compressed_mapping)

      local width, offset, base, CS1, CS2, get_next_char = 1.0, 0.0, 0.0, 7^18, 5^22, compressed_mapping:gmatch"%S"
---@diagnostic disable-next-line: unbalanced-assignments
      local mapping, trees, unicode, ansi, prev_delta_unicode, prev_delta_ansi = {}, {}, 0x7F, 0x7F

      local function decompress_selection(qty, tree)
         while width <= 94^7 do
            width, offset, base = width * 94.0, offset * 94.0 + byte(get_next_char()) - 33.0, (base - floor((base + width - 1) / 94^7) * 94^7) * 94.0
         end
         if qty then
            local big_qty = width % qty
            local small_unit = (width - big_qty) / qty
            local big_unit = small_unit + 1.0
            local offset_small = big_qty * big_unit
            local from, offset_from, left, right
            if offset < offset_small then
               width = big_unit
               offset_from = offset - offset % big_unit
               from = offset_from / big_unit
            else
               width = small_unit
               offset_from = offset - (offset - offset_small) % small_unit
               from = big_qty + (offset_from - offset_small) / small_unit
            end
            local len, leaf = 1.0, from
            if tree then
               leaf, left, right = 4, 0, qty
               repeat
                  local middle = tree[leaf]
                  if from < middle then
                     right = middle
                  else
                     left, leaf = middle, leaf + 1
                  end
                  leaf = tree[leaf + 1]
               until leaf < 0
               from, len = left, right - left
               offset_from = left < big_qty and left * big_unit or offset_small + (left - big_qty) * small_unit
               width = (right < big_qty and right * big_unit or offset_small + (right - big_qty) * small_unit) - offset_from
            end
            base, offset = base + offset_from, offset - offset_from
            CS1, CS2 = (CS1 % 93471801.0) * (CS2 % 93471811.0) + qty, (CS1 % 93471821.0) * (CS2 % 93471831.0) - from * 773.0 - len * 7789.0
            return leaf
         end
         assert((CS1 - CS2) % width == offset)
      end

      local function get_delta(tree_idx)
         local tree = trees[tree_idx]
         local val = tree[3]
         if val == 0.0 then
            local leaf = decompress_selection(tree[1], tree)
            local max_exp_cnt = tree[2]
            val = leaf % max_exp_cnt
            leaf = (leaf - val) / max_exp_cnt + 2.0
            val = 2.0^val
            val = val + decompress_selection(val)
            if leaf ~= 0.0 then
               return leaf * val
            end
         end
         tree[3] = val - 1.0
      end

      for tree_idx = 1, 2 do
         local total_freq = decompress_selection(2^15)
         local max_exp_cnt = decompress_selection(17)
         local tree, qty_for_leaf_info = {total_freq, max_exp_cnt, 0.0}, 3 * max_exp_cnt

         local function build_subtree(left, right, idx)
---@diagnostic disable-next-line: unbalanced-assignments
            local middle, subtree = left + 1
            middle = decompress_selection(right - middle) + middle
            tree[idx], idx = middle, idx + 3
            for next_idx = idx - 2, idx - 1 do
               if decompress_selection(2) == 1 then
                  subtree, idx = idx, build_subtree(left, middle, idx)
               else
                  subtree = decompress_selection(qty_for_leaf_info) - qty_for_leaf_info
               end
               tree[next_idx], left, middle = subtree, middle, right
            end
            return idx
         end

         build_subtree(0, total_freq, 4)
         trees[tree_idx] = tree
      end
      while true do
         local delta = get_delta(1)
         if not delta then
            delta = prev_delta_unicode
         elseif delta == prev_delta_unicode then
            decompress_selection()
            return mapping
         end
         unicode, prev_delta_unicode, delta = unicode + delta, delta, get_delta(2) or prev_delta_ansi
         ansi, prev_delta_ansi = ansi + delta, delta
         mapping[unicode] = ansi
      end
   end

   if test_data_integrity then
      print"-------------------------------------------------"
      print"Testing data integrity of all compressed mappings"
      for codepage, compressed_mapping in pairs(all_compressed_mappings) do
         print(codepage, pcall(decompress_mapping, compressed_mapping) and "OK" or "FAILED")
      end
      print"-------------------------------------------------"
   end

   if (os.getenv"os" or ""):match"^Windows" then

      local function get_windows_ansi_codepage()
         -- Reading the code page directly out of the registry was causing 
         -- Microsoft Defender to massively slow down pandoc (e.g. 1400ms instead of 140ms)
         -- So instead, look that up outside this filter and pass it in, which appears speed(ier)

         -- local pipe = assert(io.popen[[reg query HKLM\SYSTEM\CurrentControlSet\Control\Nls\CodePage /v ACP]])
         -- local codepage = pipe:read"*a":match"%sACP%s+REG_SZ%s+(.-)%s*$"
         -- pipe:close()
         -- return assert(codepage, "Failed to determine Windows ANSI codepage from Windows registry")
         local codepage = os.getenv("QUARTO_WIN_CODEPAGE")
         if codepage == nil then
          codepage = "1252"
         end
         return codepage
      end

      local codepage = get_windows_ansi_codepage()
      -- print("Your codepage is "..codepage)
      local compressed_mapping = all_compressed_mappings[codepage]
      if compressed_mapping then
         local map_unicode_to_ansi = decompress_mapping(compressed_mapping)

         local function utf8_to_unicode(utf8str, pos)
            -- pos = starting byte position inside input string (default 1)
            -- returns code, number of bytes in this utf8 char
            pos = pos or 1
            local code, size = byte(utf8str, pos), 1
            if code >= 0xC0 and code < 0xFE then
               local mask = 64
               code = code - 128
               repeat
                  local next_byte = byte(utf8str, pos + size) or 0
                  if next_byte >= 0x80 and next_byte < 0xC0 then
                     code, size = (code - mask - 2) * 64 + next_byte, size + 1
                  else
                     code, size = byte(utf8str, pos), 1
                  end
                  mask = mask * 32
               until code < mask
            end
            return code, size
         end

         function convert_from_utf8(utf8str)
            local pos, result_ansi = 1, {}
            while pos <= #utf8str do
               local code, size = utf8_to_unicode(utf8str, pos)
               pos = pos + size
               code = code < 128 and code or map_unicode_to_ansi[code] or byte"?"
               if code > 255 then
                  table_insert(result_ansi, char(floor(code / 256)))
               end
               table_insert(result_ansi, char(code % 256))
            end
            return table_concat(result_ansi)
         end

         local orig_os_rename = os.rename

         function os.rename(old, new)
            return orig_os_rename(convert_from_utf8(old), convert_from_utf8(new))
         end

         local orig_os_remove = os.remove

         function os.remove(filename)
            return orig_os_remove(convert_from_utf8(filename))
         end

         local orig_os_execute = os.execute

         function os.execute(command)
            if command then
               command = convert_from_utf8(command)
            end
            return orig_os_execute(command)
         end

         local orig_io_open = io.open

         function io.open(filename, ...)
            return orig_io_open(convert_from_utf8(filename), ...)
         end

         local orig_io_popen = io.popen

         function io.popen(prog, ...)
            return orig_io_popen(convert_from_utf8(prog), ...)
         end

         local orig_io_lines = io.lines

         function io.lines(filename, ...)
            if filename then
               filename = convert_from_utf8(filename)
               return orig_io_lines(filename, ...)
            else
               return orig_io_lines()
            end
         end

         local orig_dofile = dofile

         function dofile(filename)
            if filename then
               filename = convert_from_utf8(filename)
            end
            return orig_dofile(filename)
         end

         local orig_loadfile = loadfile

         function loadfile(filename, ...)
            if filename then
               filename = convert_from_utf8(filename)
            end
            return orig_loadfile(filename, ...)
         end

         local orig_require = require

         function require(modname)
            modname = convert_from_utf8(modname)
            return orig_require(modname)
         end

         local orig_io_input = io.input

         function io.input(file)
            if type(file) == "string" then
               file = convert_from_utf8(file)
            end
            return orig_io_input(file)
         end

         local orig_io_output = io.output

         function io.output(file)
            if type(file) == "string" then
               file = convert_from_utf8(file)
            end
            return orig_io_output(file)
         end

      else
         -- print("Mapping for codepage "..codepage.." not found")
      end

   end

   return convert_from_utf8

end

modify_lua_functions{

   -- Unicode to Windows ANSI codepage mappings (compressed and protected by a checksum)

   ["874"]  =  -- Thai, 97 codepoints above U+007F
      [[!%l+$"""WN^9=&$pqF'oheO#;0l#"hs)mI[=e!ufwkDB#OwLnJ|IRIUz8Q(MMM]],

   ["1250"] =  -- Central European, 123 codepoints above U+007F
      [[!<2#?v"1(ro;xh/tL_3hC^i;e~PjO"p<I\aTT};]Rb~M7/]&jRjfwuE%AJ)@XfBQy&\jy[V5:]!RtH]m>Yd8m?6LpsUA\V=x'VcMO<Wz+EOO
      0m7U`u|$Y5x?Vk*6+qJ@/0Lie77_b}OEuwv$Qj/w`+J>M*<g2qxD3qEyC&*{VGI'UddQ`GQ)L=lj<{S;Jm),f3yzcQOuxacHSZ{X'XIWzDz!?E
      =U0f]],

   ["1251"] =  -- Cyrillic, 127 codepoints above U+007F
      [[!-[;_8kMai7j]xB$^n)#7ngrX}_b%{<Cdot;P?2J&00&^wX|;]@N*fjq#ioX'v.&gG@ur~3yi8t1;xn40{G#NX?7+hGC{$D"4#oJ//~kflzs
      "_\z9qP#}1o|@{t`2NrM%t{MW?X9d6o:MqHl6+z]],

   ["1252"] =  -- Western, 123 codepoints above U+007F
      [[!)W$<c~\OdA5TJ%/J/{:yoE]K[d,c<Mv+gp_[_UuB52c;H&{leFk%Kd8%cHnvLrB[>|:)t.}QH*)]AD|LqjsB+JCdKmbRIjO,]],

   ["1253"] =  -- Greek, 111 codepoints above U+007F
      [[!./yDCq;#WAuC\C1R{=[n'FpSuc!"R\EZ|4&J?A3-z?*TI?ufbhFq1J!x@Sjff\!G{o^dDXl|8NLZ!$d'8$f^=hh_DPm!<>>bCgV(>erUWhX
      ?R+-JP@4ju:Yw#*C]],

   ["1254"] =  -- Turkish, 121 codepoints above U+007F
      [[!-(R[SPKY>cgcK5cCs4vk%MuL`yFx^Bl#/!l#M@#yoe|Jx+pxZuvh%r>O</n_gb>hDjmG]j#lA{]2"R-Z@(6Wy:Q~%;327b&fRSkF#BM/d+%
      iWmSx4E*\F_z=s>QeJBqC^]],

   ["1255"] =  -- Hebrew, 105 codepoints above U+007F
      [[!.b\.H?S\21+7efm'`w&MW_Jg,mRbB;{X@T\3::DC#7<m_cAE!:%C%c7/,./u[8w*h-iwpz03QY,ay%]MI*D]W&]UG^3(=20a7$zG[Ng7MLt
      sXIne(V37A?OO%|Hn13wMh-?^jNzhW`,-]],

   ["1256"] =  -- Arabic, 128 codepoints above U+007F
      [[!3n8GE$.to/ka%Nx`uOpcib>|9KU-N72!1J4c2NAUE3a,HlOE=M`@rsa||Nh_!og]:dILz9KNlF~vigNH*a0KxwjjfR*]?tO87(a3-RQex^V
      Ww&SY{:AqE|s%}@U8%rKcr0,NCjR:N&L'YyGu<us'sN*1pl=gAXOwSJ[v?f;imBhDu_)d$F8T?%S[]],

   ["1257"] =  -- Baltic, 116 codepoints above U+007F
      [[!:<_.XQ[;n35s%I?g9)b/7DiGwIR)zy&=6?/3)6iO%rSnC_6yjl'8#zeN0vcW_yX/2*J93+EJVrW,^Rhe,h7wWl"}neF2~F[PyD;BcrG*5=J
      fh<x!FJ?qSw9Xp!;WB3T<J^x?#Ie`xufezR'\I(eED]3d&)VJL$/+$Zf;W^I>L[3D5F<_IcGpn=oX"JR1%arS|FX|dia4]BeF>d5p`EV+:;*I<
      x^Voq{"f]],

   ["1258"] =  -- Vietnamese, 119 codepoints above U+007F
      [[!3n8C{%C0}&p3gE0~|&RVm9Wr&^ln1}'$gV{bml1oByN*bb:Bm^E;~B3-WjF6Qubq^`Y*6\0^w!DKpK<\7lHVELmSXN{2~B"0C"<1CYN2{$a
      5M?>|7%~qm{pXphwm3$}iyXjBYwtGqxp(f[!g^Ee9H.}1~0H-k-dzNDh1L]],

   ["932"]  =  -- Japanese, 7389 codepoints above U+007F
      [=[3+=&7~sLTy"n^PnVG*Gx&j>4Lxml%}fe|7_}nbsu1ImFj_eqZ%/jkS#qT2PD9?]Kq'fK>~C.Ymj<?gN+{6t]jtMgZWZpx>#VyzuhHQ=Nhul
      Hy,C`=^\&<RNc+r6<7~Qs'4MWS2^LR("L)f[0.7IbTe"^eDW|4~[6)P)i'4r-4*>X/rOoEsP.$yExlmU5m>WtY\^7]hCArb1#1H|Q=55V]zc$>
      G%s4WZYuUUFkq^wO(681x$$#J.`laeSd9~!}7Ip/*o#|[SO50hAWAwh`u*NwSng#rD{-.WtePD%lVgYW*`SGn.CZIG}@D+OO>YB"luuc-*J-$P
      Pj*S_Yc$'~c|,^<P;Wz+h_Ryy%d,*bw?+2Yi\'eEtdT6_nqT,(\4uh?E;Po^_crRRd6*qb4M|GG^u.w'rx/Cv82C"Bclo{B5.VT;9_(,o`%TT'
      pZ;nPpZ{uhA(UT(f6vz?bok1l4B%3~Gv'w/719D"PfTMW&!qn6L{zu#@Waj;DCsIW#I1xPumizI>DEtqFE<Bf0~dZ,o:u7@%<g`V^NBw<R7aJ$
      4%GA|Q};mz[9w}2F*+&]-Rpi'co)/86iR0=R3J,3m:9&szNGOvhLP]7+}@[}Y,7)}GXJmi*|N=L)Dg4%y.kC3lJ{KaGc>Wav/?*)T_}}af2hRP
      Ii]lNz|UAs/un_?$6St9u+><tRz;{&'}Byan=:s^t^D[Vt@b'suh%1gPW(Rn|cq{3y]\^+!{}g6<Jqo^%[^e"gcyA%4h@zf7X9>on~>stTvEHu
      ]geHLKtj@XG5Q%ttLU)05.*4o<*h~Vtp5LSmw"bRv*uaL)(s5WB-j!\uGg(\!w/o6"^Av88>.x{d&{0S?1*$""62or)97@2S,\Y.2\\8&FV*3J
      J`L6'UXC_Hj:}VCNpi"}0)c;B~.LXo_2|]3s:m.RT/a?quBI<^\{c'eL|*^*mM-=6VEyN~fNiE59X_2H=Ay.Uv$)SMA*qtd8tU4y"fr2,sGl?7
      fN:LpZ&"WA^D$V1(di[n>oZk@t-DYN=[#vlso$[o8u/^;w<{'mES%}0Z8EZ5[U=4Kc[<"8/'R7pc)QO0";m/wwj\]#N[U-jQt"e8|FE=\ur5es
      4F$5M=-^(:;D/.6HqvNf3<m@jzCF=hwrKs=so;Rfhw=/ozEY2J%/X9Dd@p%eC^G/Iq6szpqj:?oYk<-%Hu@ado**|[R?&VLZ6L?V$abn3L]L_>
      '9,!z9Y-=Jp{l-a1k_9nom]L`}\P6a(Lg4Nni3T5G%MeEaA6OscY4BEuD]%P|57}>a?,&|zrX:P{bL`Y|5yZ]F;vf'[c0ODor<VuL1g*\|/2mA
      IY-|+}+,R$F},F{gW}kjS.2IRk2-?w#=Vp%adE$vhGTK~o6/[}^>"^,e)dF&r:BdWhy}mfQov{zB<o9FT,))])KJ6IaJ.}myQ94;iuB'@={g0?
      {`}<Zkf.u6_}W-r{+&>4M_dig$Oo=u?>C'aDLC/D*f`n~5p7`qf>WUQ|sMLzsD21w8lD4410Ydndn@r~V2;T8iTtcM=)oU?h=rl8-FZkX-!E(h
      cEEWzjwNr>gr$A.zmh}2&5-a[AGDjcO:(jc:E,C,u1!/\5&!0R7&(*`Eqjtq+osO9'M{:$k1@\(A*M]C2,{^gL_OL>7&W1M5>w!}7dQ6G:q[z-
      Br>tUQBDzTTZLbLUC6G{Y*[z:S*6xc9=DvPhJ1HtPHV1osdrW3ga,Pf.MX[rJ<IoN9DU^>*B5bHh#nPkny7gNVmxy8oL;5]N-*|a1-F"Gw<^h9
      H$-6los2}g'b:c]c0~{ywe>5=w;,{]~.~488{z/J&rO\XG}8$*;y.402N#qQpj9#3r-ix$zj*v$dJC7\()bqdi!549}+u~;My]<cG0Ak,=&<+Z
      UDtdG))72o1tCES@]SEmD1S794N)`WCKp;7^WQbZ%%yhTZ#!k`~92I8U0`j}ZNi@\\?gHKv65_iBt[*j6nDOR|N%n{(!TzxmK>6&5bJotP^anT
      D_b%uRZ\5qb/:F0Ku=Y2*!6'i^lAxWJ#jt"M1c{)*v@,qD'VV/!wQ.c\4>;kt&_|%V8JPUEjCMvg_Ne<7UeQqo}W=8N3e0.h[[l@:477m_e5g+
      u&v/>TBR"+}i:pP-If^~hbZ[S-kK\9F,!D8QJrryQEzA7RIc\1?WTia_|#e/c=Aa#I`$YtT8%UZ6$Xt"?`X_/RC'vpn8f_5[ini3})^tns`\/)
      Hk4yx)'LsV\'kGq~+2?d"8)_zk/5\CoEp)0|SDQLA3WrT}T!{2lm9o>r0!|SoX97f/f.z:b/W}p>M|Q?Wcgb{<udgUOl3v(`ya-?ONo>O|&J7,
      RBvCFk["gIXLBzU%2N{hd8hEwHD,]:5#jd9v,4"oQ0X#(P1q'>KR[[&oKjj7|u''b}Pg!mc\4qoKTy-*1/;CkV&+}[-pIVG3v@EuWdtJ+3p@XW
      ]Sa01ZD{Dr=/HG3Rhi:WH%{+RO9A1,,"=Mcz7H(*drx5;uY7vA@amw~,i/>m*{NYV%}dB##c`+K8H}H1[`}~K>sG$kv3Gdc:x@oaJj@8m-wNIK
      gh?{F-b:EYDO\6r=GL,Z4pgA@uKyNg^rq0j[YZg,[ox#m%<7U"y\UJ4{z_Uj-z7.AKe@1X)Egs~Wkl*W%$|b?Kg@)%.gS^bzV;.S{R}TpuM}\0
      $3vACCQ))[fRvD#SW=5QW/'`WB/PqM&})tN1_|U4-3*G.9-7H.]I!yG%%~o8$ssX}cgEhU`&mH3[5}>.)<I>#3@~rD!Yx>v@jWLMQ-H20F@3O4
      E{uD^cG!vt$zJ-=tJsFOIo^ck$})34xN]D=HbEOqVr|"7@2yY6_z))sUt?nn>-s(S=SUA.3+b1){ne{RXWNS4[;Lmpk?{\EbQJ7Q4%=J6v|=N_
      _.."\BTJE}0`J7(882F20|DeZ2ms%="gk]3>f5fKTJ.p0x/atIg(%{bdLZZ\>0z1j]_iI5RT%*{Rt0{UL5I6In3RTk(l<HCDkIEn7fu=F[m;/K
      On=K=Q=Xcf{S!:6:1.8>Sd/]5Qy]:=$u-@8\Au6#yBnDe[@kC-^2e0kZRY[CVy&E2{de)Q,*IoHZOD)Xh*iT*@\7CV'WV`7IU33#{;r!Xw.Fj<
      4OhCk[MtJ*gMi$Bd1eJ^,moda]4W[6"!It"i:":II|zsDrz^)%.mRdTIt"JZ]m6;E:FMwF6w.8+}'d}rFV$SI+Ujg_&3U[xa`buN3e`%{R.,H=
      q]"-(iu,NDnUW*E'GN,z\0y_*-G0CHB#!zDp>?)2s"!XtEQhoX-l}Y%]VG?%a34QGTUA&$Tvmwokw,QP(F*l.Vvo"Ftw;yS8n.5ymW((B^>b]r
      wt#LNeUjh^egC;4)f0}q^M@kWR@t!?E&uK7<gW5DV@LsbuC+JErHz;;chy8"':zSse&*OS}QPGreziI`kQ"g`MX$K&>_R#"#V<b:ncjax"Rw"3
      1yF?>^Gm5+:om59?`(lDjH:|?v1g%EW|}!mf$4>>@7n.pvqv3;|ZVx+(U*Q>eA<b;^v0+:{49HDSAHo^"n%q??KQ1#F_yM?xG7f;;L6c&jO?r]
      ywNd&+)O%gfRt3A+;tmt$Mf<O==2vv,qpN!(kC'gS!PCo,p4pu%j!E~Z;$*inS19l8i#.8soMx!vD6XAV_rjed\h@/z2OTXNbjP+-DM-H>9mKx
      DS=XYp`l*)@[`/KZV=nvawT+pEvai<v.TV/:rm.[:~5clNk{u0J@ybIJ9*k-aBXzxZ@\zXemA8X?+[LsaH!O[EQZ5e:#+VSQnX9gHwk1Fjnlrk
      @MmjlS_![o6CUlH\Q:Px[AbrQH;,$f(Z^tp?Ya-R<^PW9I!UyLE:>^"4WRE,v2J+,e\e\e"EB&&5AD6x':ou63C:kOo/)1er*N{}ywN_]Y|HP6
      Z4ZZT^L0{AaIOd*H^5B|iUn<>=YZ7jBWjJmr-rlNcY9+;ZZ=l~M;%"$Wnf9'ui`E>x[=-M1XHU6F\d(i[i|Z*OuZralbIW:6@+wGcs$%@tZCTa
      o=OWO;-b'n@H3u6>;d05A/-}EMyY:>T`/Wd>%V?:qM/tbT\T$0%Bm~py[6W%6}>4-#d9(f1|xWXo[2{d~PYbtC$p{$f2>R+2(mcu1plYu%5y|9
      D8i<lzRq&}vx{b}74X%@K2|Rcq/&9Ngpx"c=B'cxP?+8X\wt`,2c]|O+j4C=Prr|70";{C[LX.^?gCbT(L5hUb2(.#l:x<<yL?(g>:0nG.gj#F
      x~63(HArB'h_k{obW0JFW@YgoZeM<X1&o@`ckvDo}?No>I}.6ao7.p:FvM7@JA=U0@QiT"Q[T=j[H5OxaYxoR$M@(ym_h6Bb1wN&I/j]725k#h
      pr+u^,}`id07#;\R+t}5yYmH/fk#!XqKLl<,Yv^=x.hj@v4.q]tiBx}2VdGBzmw(%A"'T!-8;-wDz.dlP(3);La)1*||[k(Po"<Ue#<jvc$v5(
      H%+}Y&w<4<Ttf,p1Je%gsf?TQ`]QdQHkuk-fc&c`L;t<_WWG[tJ@l10^qRX$%?]x}2d&Cm8+de_\l@VPr#&1L@8J/*h",fUh3,3fVL:6a3%#[L
      K@f@1&5&9$RXc%IjD'Vl)]lb/LP"{HrL(Lpelc_CLe(+,S~UhAfKJn3Ak:c]fk9:s=84UcQ!!z6VXolN;N;IsV|)=pCH6Gf}w$K^wF\=T$fD}/
      %?ABJQgyiBP~!jbC">1'Q>UrCsz4C-CR>Xw0S?{PBHAy\S@jJ'ES*kQ*D(3M:B5qi942'G^%G&qqrga8&$N`a14>v@GPD+m'`/0[DXF@Z0jSSY
      z]j#Bw]'uWf(5okA+*+B\hI}1.e)ped$u0S-#O~V^:VdQEG|<#JQp"4Ak9tHO?h/{yPWZv*W'>-msylMWt?45?"fW^1\Z%zJ'&#VfXAs_7}Eg-
      $2iQ`jTjyz<jD5fHT"y2ERu?li=X)%o-ePg;ICN&/`Q'Q.Grz\5kr7'Wk/?VnmZ.s|9K'F0Qjt3ik`YG=xjwze&Ner08/\%s"USp3/xC<2zY:.
      ~^EWxSO3}HPV@"G8WZ6<{3OH[zC4*$',?K-h'`7K<VNdSa)zzg:8s9kTna?fVg,uHx\!2dh(n-caw`9yL|Ap4Q4^r#_~)>u!=vnL/+~ms;{ouR
      ^=oZ@o$qWB`!B\4u):xnHD{@IRaAFj+UT}|J",EaN##PwzQi(O1b,fAUmMxS'!$R]b,Ss^HGXtKza=?gX)z%_?%29)W~bP86-IXXZC&E|n:7t"
      }l|Ow0;72,Zd~"gvD>1}`$>OO0[=_.i*"qWEWP-!^swWsjpo$wv[meyS3ta(.\q!faz^lq@g*9wq;Rs$*@$ryckoNyfx32|EacT4aCLGm1v{de
      EIiih:X8OlOA}xHf.p#)zTd0>("<G`;OD1NaAV:!(wq>L?.xGq+}Pf's(Hq!~g"u@am_e!-y3##^-hH@gd3b2bLyYOg@S2>aP[[+8Tn6TNOoVy
      N3KHj9t+j&z;9WNe2o=M.syk7-G0r[=+Zg=N%KeR(x-+xKBA@8k&PwG1v*U<Yr0W`^lRj<orTRQSnP8bLH@x8v6**U2<Sn*JG2g-Y@&Y[^dny2
      m\?bTrWrBfU?,O3Tz%kO%[Dg=9BYVMnrV?yk}x=_IqdnO&AjNL9TYt5kzglaM`{AyFOBEK20rC^d/{7o.N%^I%C&%DD"Z?'J14bv4v8I#q?*6h
      zK&H~7>e/p2cbdX~-FF$2DmK_J~"]K|UR!C'r"-G`QvH]*f_P$|OX2/~{_k"+~n7>V<\!};(yT+k2=dc}*RF!dt!aTE;gY{&GiG86BQDo`V2~;
      -t#>.?jXX.7P!SUZd_k&N4Pa-~lFz'*;~6WvH]0k;|s3SZY@H,MjE}'5Uu,dlXW>.<ZVo?:FHh!q7df?-#vlOX1"$\gHc8ZQ^+dg*:%2w/:he_
      `}vKrbS9:+rbY_4NmJuz.N0ch0r<[s{Z}o5bLi@@T{^DJ_uP%I+Aha9$kv$7Ot>i`Tgs8?.X3Yd+L}-H98]@]}{W!<s&+!zmxw[0~,udi>-s&l
      8y*]=c<twlx#;z/:rM[]jdBa@_,3A'ZfOy,"$wz>CWg7/j=O)}^<0H9,bLN1EF_U/.f.cy#h[q,?5yXA0q9b%GwK(C*"[/pVGiMo3%f+$\74Di
      |c@?p1iaY'%$_5IefGOQ}qm!U4.6i2:?R,"fzq?,Izwk%u[mU)#|VZJ3[#y3FaE}kg]jMe_@cWF/0utR^|.Wn8wo<:W2Qfx@$^:nhXvgkD4W+Q
      eb?E)O?xT.`@M*)0[A}uSs{T_)g>zoLNP}C^s&~]DK-aDI%P2yS1@Buw:jYbw<EtsBO$pTNRk+KPRWQo]J_uBb,QFP"mWPb~41kg'EWU3mHu/_
      :lT}L9,7K7;F-QI-S,cu?(@g<StUW$|G<epv9N|Vt:sF3w@4P]7=KkNSI%gN0+>x%KPSVG(.c#QT5J&^.O;,[xh51(Ayx'7a:~&z<;8muJwZ'a
      w!lYhk,POW-b"~%ZvHefKcX[="Ngyhe=RnrP@>asJu~5eux8UY]}m8z@mFoz<lAq1Y4qU=Gsk%qQw=cGGDWs.k&3g|Cr&d7a7vJn2(:i7LQFOS
      1[X\;#2,49H6v"['Zv`?sbL<+rNg{zc&6F;[T$%~t|@g5l+h}kb!OXz01gso"0QtLR8ACn)0U.OhlNwq,k+v_q<(6n>I~usafELixGwvRo_9p=
      ;e(>"wf~Xm7(&%JCX^4tI5-V7n^`Hll61^DFojjSa$K+3JP.q:$^ua0a'24)a8^/G8m3WfmWdN}Y/I:n1-,@F*X,}vYnyfevl);ktnTiY=SA+M
      U>mS4GT#!I[mk'j]a#h5]I_^K8,kl]V<([vv/j`KjM&~][q^>-LmS'j+X]O|I\)ocbKV,@20(qI8b`V]$M9!<l'1DX>wy%ph(7q~.lOu?sjp0b
      ya'U>eQ(TsTLMpb3KvV+4>m[*\f!BQAR7w|).{g+LGc=%y+n7:oQac$t@4:ub_~p+9d^L\_uW'wn?222sr3Itk`nrIW{23:OQ=q/=)n4{?aOCd
      kd,/Nhlt&j?n}(<_3-}W\m*-m5*FmyH'HaSDCGcmheDf@&iJTNMvJg?gl*9<R7|yJV<%yW:b_@y)Hy;O[}.J#ty_oRqsTSO/#!E[/32~>IY"N*
      ]5)[B.uOhUi?v?fjL4<>V>L;2XIZ'~b3g'#"1n5}7/eVlb<c9"W.28,\'\buS/>1kY9FXGGg#uKQE1|#K;N}wJc4bAkIq^qu6UxJi)+!~ikv!3
      ?c7mg]P2>Zd#3%/`^R\w!1Gu]xrw'r!5ms$('3|)-2(,vTlv*_ET[7mGIhxSv^@,3N\|@SG^.R1<(wV5`"Kc^[),k/Z^fPT5"r8z)![(3RDLAS
      ~OcylxH+=FC\T>^8jm9#Bn:1*sU06\=7wiu3htOw5.0dU?fI=)GT}R8]'xiD@2Y{jF#J)+I,1mH/[52Ul*AE]2.E"*9#ed/\T|IhCTgkTqx+ij
      '33|(V7;AXYo_DVOGS6E416}]$Ke7{(Um-O9R/_w$e*S*]=O@#Wpu8;c1v>BWL3Oip=L6+UUj1~Qb2Qq-!c"45|.'<(M5?U}}Y-%%M-K`<{cvI
      3lt\Se=WrtQxEZI90".S1D>p*DF#9:ah/CyPiA*j2;lK:JO1b={,5g5's_4o02,->kH.Y=rY_;_8e"K`]\`OMFq-=Bc6jL"s[G&T`,K7%CCy~Z
      3&J9(Qa=9'}NNkM)i14'YAV^}<[t;H"e@yi6iAX<e|iA31'Mq?2ib#M!kxPt%]iMF}A\{BVO+O.<KX`|+GI<[[DQCf]=OC|sHPf+#\J-!Od;r[
      >SGT?!r6p45)F-B(ga?$au5O`v8H)g'UwH~TMEMY-nn1EvG;('ThX*+5(3BdlL^k"bIZZxbL@z>d!Rj^8B1Lt#FAXWgb>a*{\/P!k2'cX$:}&@
      I}asGeb#LTPZbBuF:t8<..;n{AS^S@k+:-mJcaV'Ql,qrq!|NAyz6Ro!o*{?xAA<c\z|fWs;oDgGlB$~>|?Ec3bprqDvl{L=~?3[$Z}IrTG^Ka
      5PM0h$WsEVw2\QBJ"gVy2v.ubkd%_+;SL&^CT81>wWm@YR0-0K/m5PVY.qPB%(4L-"C<Af4>(}/[[PElSziB,t'=6d>!7z^^r14mGbW4l?";#@
      D"KFGa^LoXsWH>9]x`elDsrp!BH=Hj9CfG0xo=!CwY@d^*'ED[he7[<|O"^G@WVJ<-odk;V`&([|&4UMI/Pp3w:D.-,u2GzI@suXD,L$W-5[Z{
      LhjaFF#(+P|VVF5x&6O`Icz6}2L$7fa*:nbxkT!+7D-3QjN[Dbn"K5U\sXh|a<:F[l('ZXhE!^#-7iiYzgQ&XB]T`)!g$}/qd?/s>$'08N+"tF
      JdkE^"$\9AN$3Yi-xD>=T)BK|{'ZWT5A.uL`,"ql?$R'^>5v|9~X%XzX<h+A3Fp#6cm"_.pq1kC2d:Sg0'[w$yxf.pLv"Jt^:<SSFBi4^cO=&0
      o^)M9<OLniNvt?1W_Jh+)(pL@l^do.<UvXxTx<GOnDN39b]~z_=$2r)5sm{`<!J5XEv}0\jx=,*6,$_pt@$.?/f|u$EL0SHE0GBvaHfRG%44Bl
      G{0.-ufW5:dNRUlqL\$|zkbw\-A-hp6Qc3)AJ_{1tdT}4|L*xS=j0QN<yP6}fkIBlq?PU`I7`}M5'28GdW<w`*Ita%w^W_6^a3gf5Pa~mF};ni
      xov!@YucI)]V_.ldOnl9^bi$:qI"6CI_)!^4G(HwdDClA=aP;f$w]/?eojmG^P-Bj&_/z8xX'Qb$}_T"ueU")d}V120F)g]1;$O3>[_tE_YNDT
      6PaA}&s}xN{BNy}?K6"}:-dC"?*\%/dJ%2CGkW1j}VO/V1Szy(+f6,k&.M\$PWcgZ[ZXQXUf}+U[_ir=z45kR=.WS'~aA{r6>ZTr=Mc#jFC?g2
      ?<+ohgY&kIZgN^t~q!+gC*Co%n,fvL=R%Hh&x-|0v!76^'[lk&TUPq^"xubISp0P>4\5REJ^`Xs|Kx2Zp-~U+3Ur"W*<^<6IC=tG&mGg]\skh-
      xvm=7i)g#*a-|}g\;G6QKPvU=tt_"jW,]nC:|L:bCV?e6KSMG\A;:-Un7DL6AcN9IxyVjbqh=yYr6]V>nS[*BUEv=U`9k(_\[c#xzn<`Ru}c;6
      Ukmj1DZtQ!.pA,?JD2#R;oV(ei#,%\m"r?G^/GvaKZnC$bbqu|9J-1XhpYk|Npj;5r]hCEhv2.:Z:!*}]mO}{64`8ZRfk)[,geYleWpw5^eM%\
      5?CG)rHGIP[|QU.(m0f]Bt;-1>4gjoPM#?.\yDTY$^:+F2AM&<|#AD"-g[nV?RHx*L9K;I_4}?<;hG)E$@?d(0]%1pj?H#Z|oz*F+J>Xat|Av~
      _F"x>8=8;euSJ%c`jw|qRfGG&{S|\MOJ,rzkNZ>VFq+gRWXEEB3Or<DP#C:YKw}(&fd/)9P"kLrQ;r(;UrMumX{Y>pz8-f[YW\<(3`>6\-pk;W
      %A(E%}&>'cw!TW-AG!saRDJP0^d(HEvS]V.oDN{Jz'$0^z'0R[sNO:EE0/We*`!v*y_o",Z0g$lvE5OBC4=6luM'iKPS(<BRRO0#}*LNO2Pcc>
      v8w8\oYZwo<J;dAGN'&0X0%#G>$hoAdf;UNK::G+Ck1jR0ZN%F;&v1Gbzo8:|/htoq`YZ;=0*~jL(FvCvcp3\;6[wS$CIx%2'F0$;.Pl]\VVi'
      k[yxN5S1&h&b%M+jWLB&,4<@}=CRtXhf_/X|pN[Kd]]AIE.l1;A_?e=M<J-2Z55A.q"5}V(v*Mu6KB=K)75j[.X~0*I481h,<<KG_~Hxg9)h`*
      3~h.w)z.LXeoO",-OXo~]ofp]e3JpeU]Q~K%ebagLysLbd`}QD[4tPh|B<@.aGAxCc/lFZYH3Ug%_+\6@/X4qEKcs+rfi|6$V?mF,#~%:^-jIT
      C;:^~-MXbSi_H~im_qmX?p)Z"&ovNQ#SNPrs1ho>WO45+>FK(}xBvsF\nk}idT(n5b]=eo6UVBd}F,mH_Uw|S}7%Rl!{HN&#|_7+C^zdKV:zqw
      a+U!jbMG'l:oDf#>k$Gs$T(+@4IZ;pELTcz;>7yk^NRq{B<j1';jm'-}Z~*TB\%8[g!MDZW+^>?vhj;we%PP_SDKbNL6h:$a)~:`emir#wIH$J
      vjiLSE[Bu86:a[XSF/[tpxMpwg5.u(oZt|Tz;L*jE7NB='@D5)cb\ylIC~gK+isq9.2K(qmNug]A>J$#<q?!5Av"M43%x{=L>R:+_e'F1oeov&
      yl]wLm[6)[q%Ru~;AUGy<=six?2|%qezw\8vwJ,t`TTEeW%TwaxK5bK*TkR^j$>Wr$Nj2x%Q"d_R/@b!`*"6'2PrFQVi|K,'*6K1ld0~b6h\Bg
      %dGmlJ~w}73qo::Sf8+At?P0,Df'oYP,|#?w"_Dy&+s4f<QjVp#N=;~Uyd;GFwD{l``ohBaZpa;vp.EF;GlWu<ovYW1&vn.OH*=$3l<GNt?c!v
      4^JM`+"u,t>Q@y\0xjJz_}W.ejjmdz`<vXVw$Ak!6I\ycr&(32}|AS-OdnDU&4^,[:QH{`\E#xQFud[%Bc$uQPyY15CYO+4\dh&yD;OU]yM"G~
      {7!T]#,P69sPh8jaiT\b+(i=M2rs_+JO|j1&tWcP+J<J=uSx{lPSL/'HeA78\E+^8^"x]OfYi=`0u]/f,gNXw-U1F,Hm5!#Ij}p}~iE[i8m5T4
      ;h9$%l+GW40K;yEv&($(T?^w9U&dYM7MwiDd^`WN3QE}:O93[T&I3i,t37u#`cfK25QGaBF*TS;R)ofmWLdM\@V]>=Z&@?Bx++'"V+z,pAzR\J
      4v<!]v0'v>#Vf+@v"d<<'$"WqK@TrH1!&y);rIB7v@CgR;Cw3U|13]@"HSRHt0M7?q>jRxT5;o}5-=SNqE_R^{$kZ!%;?l,r/89@S`|@,dTG?"
      1ZW?_[8tW/`TYA*o|CpzPS^0DMW3zH.p/PyqMa~$"1;k[@x"YPMkw[sczP.Mr?=d3.8\Vq]OD+xfMh>6QC$Kv}D0he`4n.z&hw?fL.^wH}.]wo
      #6#looo_`qHrj5gyI\hP.\yT(-!;Bt3dPjXx>~0'E;#P3[?-%[<_P]:4eKx,Gx+t.Rg%\@K>V@-KF"nza`-X>..D.js|sbfGg;XAVH/Fxp<KVu
      "qD&d=(cqr"{jO*$!@pjR2*>8(DtAv6l'-ab=-S=5p'V_~u^!IrSWUYLHT9_Y/j,`wuU__xw/?c:V|\]Dq8d_0axY-7Rb6Jz(>,"!*@|L$s"I:
      \Nn2-cq=X'ZJ:tzHJ@R0bhCeZl*i)Sbol<tR)[Foh&G-8*`'~fJcG/<T=K7i-[L?/}9iQ4/'mj/5VA%BUXh:qN4afEd|v=_@*$L\^.R{OWv`K'
      +XE3{:P9%BDYVARab\HUx~]_n.mN~-BZiN.$4j41KY{OFqz~b2co&~+yl7X%Adhi"3(;bVY/>;u0jqGs'u;&uF'/j{m}AFRqhQV?8?5*2F|qV~
      zg+S6TD,yh\X>zh<.FownA;@uNs-I)G{l]81*+-,jord~&gyY#q]e,MAT3`28N.6":h=3+vS,lVKD@6$]qKae!ITU.ewqweL8!UcHpZ[5}.M"d
      ZrG6&)<KI!EX}-rt8@'[`a/<l}4y9wN=MP8{OmP&Mk|bSj}3P0b,X3JnQ*,;UN8<'b6l\Fa@`{e0/~S%[Yv>fV8|wHm0N#Zq*5yc&oSe=GiTYM
      cAvaSVan?{Mr9bV93ojkJm5F<{r-U`cfhsq#3z(2>A./U8%Tq474tB3$<7;N\kNP"$yeJE8=7@]UHEE:+<_z{`op.=|@S},Ayg6qCNJPTQDK8\
      /L'1wY-3Vk+DVEOR"EN(A3I+AxuSl+`-ZuGl6@i.18JVH/{*_)VohDI[`ed^O){KSlW@kM,ws_^{j:hFC5Teo;U.P8}9iIr+HG&|.COS}%ZE")
      1$QaN9Hi~KyUG@ZJVB=<_k?/-9]P0kj<3&$)r21/\Kg#K9;_C4dBf:<BQUy|iv)~arNrRyl8b.{I$Ji2"T_/Tp^]aN@4wlxPKL"Da~dAv:h2A3
      [`BHK=k"'L!4%xz(L$I4c=OFT?hmF#%qxyP#cr&`#Mj)ARH}tM~b/lOn?;]Mb`w:O8Jk7k@D0Piato<yuKR}w:BxD,|$%Oc>xU>3O#~uZ=GZ{3
      |43Xq'wm>1]+Auh'_5?.>fl"g1i$xHR=c0FM%>hV=LtnvQ{/kH8B`76Z::X;=^,oUE!<iqqy9E-*oSv,"YTDJ,YKvilt%nG%\eE;a8,_,K8]>m
      ~6up3slcqucAz,6+)Lnt4SO*kF+ME;,-a|s^/%*J:&-gPfs2:VM*62-4s'op%D_Ci}}E[X'5'B`-aaCU0+dL$G(bAiKoZ*hXhynhIj@!srBbGL
      `>Z)-uiN$Xj,KktACV(f:"xJ0xY3*Uqt/h*{TeG2&])'?elCdVO"F<]<=2CxV%(S@%NyhWV0v8:j%95MD>akjK9lI1pgU0rlS<!P-}%DG37e/h
      sdTp|0x'H``z:)^?(!J%m:`5#a]w6Fx+ISe9*Z,`'aIiw[k+4tkkZ[l(O&>~AJ\\;r{45FtaU.7LQT%O$lAd?pz.8itqQWX:.\c<dy{xGp=\6a
      ~u0wkV08#(n@Vei%)~$2FwB&+^O"=DW@=APyL/vaU!Z"2g`DGSa{+kjl]ddMel0-g#`QqC-2/P+G.PmYT@kkX7q$EwH]w12>{%[TMPx9Nw"r}?
      70AB*?ubP^neZ]6~&\0y9=G)7P\|:Oy3EA)\Iwn>^[Nc%-{?JT8$2Eq8=puK@=JPN?v2`^BIhf*cCK<P(,`+^;NoHPWq[+plT^tHlOFBX3[)/G
      ,U]Zo;/TChlgHc%$Ht*C8r3(E=!{f`qN*((HS30U[+1RxDiAz9ZumYiYVhg.wq'c68MG54my[KfY+G=k|SEi7()0.q=lV/TyDrzRu!rZKT6[VA
      E,c,^1[0#(O]2Ov&"=sE|HpRN'4,b*nH?p`%{~)DY8j>f$+~jR\v5s[jpo}K+oO^uT$Cgm7*<Zni=fss06&;P9.c%dnMDA3?$Fb+.g<j\BaJZi
      V_BTL]qL=AkPF}A8]:SKB1'}U2&nLr|wCrM3vOhhDcNi#<tV1bkV+m,G{4vnhOdLoJr!`Y=wx"6B;/O={`7DMh("Gz=#onp)e{e(=_"D%Vb~te
      t:?eu+AD#.l`lNz0oqX1`R3${HWK]6+RV7;#u<lx/}&a4,:{qRx9en,xWB='0`G>)<uci:^-FuNRL]`4ej$IBixOwCKHO}-]eWDC(%"LL3P'^/
      7fHzt0D9-t,MIiYz+oW>|+([>yQoKfExbEamKoL?og{-UKooZw8>tN&8|);/0=a`'`[P6Y6Y0v6W$J>Gn@a8.T;y7WZF}hi-?A4eWlZ,=!qV,=
      FRm80=SLru!#]yGTw&%(;=z$xsft]^Gt1%>mi;6yF_H--Lb}7*Ztbe<x5:<"{BZ[KT$;o[&TvE]xXv`o)LGnETl7p6u-'}Q+@l\)3<<&2p7ICb
      Rsx|O29J9W#}yYs#YI(mfmE##Vhxmb5Wt/G|1{UueXB,%/Srhd@,/NZ9nuJ;K-nDu"\$x158r\zJ0$]/is$W7pTJ1);"AFC0Jm[:~B5.Uh\&ol
      >~JJ>`E~c]Bt18Hb/ktJC&wb8SB1($0Vsf1/0P-LLLjwbRL+J?/US;o:H-veHc+c8yd:AB]]>u+]@4pQ*pS:Ti%Ndigm!/Xa=MMJi61p\KjC@M
      ?:dbt)%&qJhrC'!qw[p`>u)(aQt5LdXc`1L0)J&xWhvyH1yXJ&}a3;\tL'?;m:PaBpd=j~bhP~K"0y5JmZ3B/qVPW@k)4H'bL2T"FQ9mWJ-+2G
      x/-F3|ei'W{9IY,*=j;cAM4k0c,(&OQjp>ZV&wKn+2Wx7U#plLm,/QVo-R\&,y2,O^@g8C;v1#5%fD11~CT`.-B'|B0ZDG.}u_/uo2psV_OI[\
      ]aKaYD1t)1nhM=/.L,@L'c]("o3Kj.4iS[e!~ncyTuIB%Q,2<@.:.~lYGl9n7wANE'26,+h@X)5flScMas|aGwm0QQdj(RBh6_V95BqzwT1*cZ
      'u[&MOu!tv&I%A0<Q-1~r!3hBE0+o3.\P34nS*ZifTu(=G%@O~|6oN(1M`n5DvYY9KUC4c~yO_Zw;GL^=t`8%_ZT`'oEOeKCRLp/8)U0I/-DIY
      [lRIE`~@@4Nl=lWA3lwC@2P'_*N\t&A]=Zz=Q^06GY0ZBIN6P1x\z=5-Y4ct(:Q:.<k,B9QO$/^*cYa4gW?:lbsi&YraaH@1P.&|5c5`eKE0+a
      iO`.PmgD._3O,NBXQ;8tbp2O4~pNPV$(a`Us-,qjeZvBiJQ\{Qn')uIS}cv9@v66n5Z6fQ!A6IJ^H`6%aYUxp|L=Km4Dw1Zl!X/Vd]WV|r0]Z[
      RQX((_m*U5{U@%ndBaR=<pPT0Ps{$"g)(kmFqyIRkk3>Sv{,?qEya~Mo[UgV,@<FeOX3.j;XuQxpst`9W;V;9@YvA).kRZImX/_;z4I*8Ccv[_
      C.6w|0@#R05f,f*}5Z7|7rmE>K+9&'!9ih,incTghH-gXrA~O%:=E^vJ/K#jY2n0aOij;(RiKKZ66)M7bs6hb7BK_Y~#%[KU1FC:r{Ov)ao.p@
      ^W<>rz4M)wNC;g'}u/>0x)NY,[2P|^b,ANWUIFrPhIwhTQ27kZOV*6%D7cQoM,T8=u"9+u,4pMC.8b(h%&3VOliyc\2FSt#:KA2h{w6-:1Yh@h
      PnowA-V_,9M/I3`\)A[CSDK(TRN#n`Odq.cbbld6.WHsq=34(5:qM?_ii@MY&$YB%6]{V_Q+l7mA#!jJXxc)@N(NI!wLydm@Sy/qt*&eLd*>Rl
      h&pj#*MO53l>G[8<P4WKePJDnIeQQ1|N|PB=~hvBI3c_Gh?uod[:MVb83!!m(N5gG^s^@}4a(=f>,5@>A>.vU.RQTMSOU3uzKPsql5hd8G[!#%
      0X8Etb6d.Z[S@#i.w>Whv839)"`!r=,]=\Q!#?hp8&e:;OAP+&VWhZG]j`~\nzEv.p,b(]CJ\|2:,D\iGkCx$Z^Uj~po9M&$X'wT"|!bBt)uLN
      1;N`)!1|ZQQ/O<a,7Lfl~4qG2DTq06Om#@:I6fcR0H<YmDi?ysPt?Cn/.H]PfmznhAtV$4@:sf]k\slhR.pk/$EPOFNx?NBWO2KJ:Iw5rkoZx|
      fK!z<[G:<'tZ}S#pB"}WW)NR6FA*HD7X1/?OA=sEuu?kXN-K4tAtc\5ENUik(;!~O(,-<-bLdm/M>ij+i")S9saH*=?X>PxanZB(?uC2cT9I0f
      `'k>.#wD{E\DL@EX@(em*~5e3PjlxLeh@S[E)mDCz4*Cje!'91*vTE}5QJO$noN6.Lp<xirlpbn'kY<w&OlWS}a^*-}8z;R$Sw-Q7apU,jnE/I
      uN$V7sEkmi[6\So4=/n`k<Nd,UllV?##Xh*YO%Ix5.uO_*^hu+g[:aLO53"8.,Wd,Td.\0;eHv1l>^;3zrQlIvcf98Fo5|/`fu8/_*](:T9e:8
      pwK/)-ik2T7:@0oZ%`Jei#CS1M.l|bJtqQdUYz$d.1<[KdU:VCBN.PxzTK%_SF|""RCE!uUjmtT:<PbQS]L#,]P4H^Xv>MTHI!H]B.SXJs)08`
      ]Zg`j.6kKc*o{$wQ:V8i^(~-OOssak*K:Z>H|J|b/1LV#>g/7tT>r"gmZl7V{cF[3$$Cd<Eol!@[QW-#Bcs(iKx/X2h>Or4wbz0dtGw\R)W!+a
      JJ,[FAmyu={9Zu.7xf!;R4Ga+dI{v,s}*kq(I_Q)ndVj4Vnq<o>dB8<Zym|qF<2WMkKOD#;qeHPy)Zu0Ja_8vKK,>:~@yu4Aastr;n1B^_1MyX
      E=d7$0gkh9zG(1=TZIc(Mhf^V$3<yYH]f?DIvGy~ka2t{:iIH3>g#+dn\y~B&a6pdG<MiFRm4Pov-}5hC5wf(vJE+}s@6{I]1W7*wP\H+Q7B-8
      O\yGr!=1sANU7`"A8Ye[P3/K$0_[5J9]_42a6/}iu&@x!AO4~GJ'8yZw7cO@KX@-HA.;qK-='wtb>boh@i$p^S#<dQ/O6?!awE0'a&/ltpj_,Z
      bK@u~h"4@a{U%~3:%ZAe!yXdp:z2D@(>jtF[W<cgqgRK!s0F*XumX`WMNz()7d!LkT\=yq/:euM^<:X.fohW.)KgdJ'u'6BA,bVy-6i7+;"S|E
      9=66H0t*xauBuD&BeivzRsBFFYKE:^P%$3ZWQj".b/%~TComs"8EpH#fP5J<3K11tLC}Ld{O`$98x9Z}%:%$z]^B,VH4I+@}\xI9{L*fGimz9n
      [;k,]kL9}*Zj&ic>(_z'%0B4*2!cC{GcnA|lCA#Tb|aa9}dkP(qF(SGSNU?&gCYB1V6mL_F}Urcw'|:q5KQJ5[}D\3uiyLZAk=7{Puq>v9}4qk
      e};w}4L[J{(>t~t-oawQ{,;>frRZ\eLO\lQJ{"`H^E,l#6`XeD);nFJW?Vk4`a.!2Vt4f38&R&TAVE-%tilxAK@A[[UY2X>8=JK%9TkHyJ)@_^
      a"O$*G+GF(qhy)`c0/k)N79a0P*\T?TY").?4Qs?5BqbX&]s%yT~JO^bE@N7z]R,7U~oe|sn$x3$59fj[QxLLxwgvbx+K]aP8CiU4w8sn7Xf!6
      0'">,!o+%mux*|Q?D{GUY3Qm]7)k]E}8Nq(AF9\)SREQCFV5$P*NJs^g6yUQ7+?3m;vo@+w6=[4lT$pxLG3Z<(@\/]DNBbOwYITG;Z|Q>[z-jj
      R_GdC$70-l[n%w?%MzC7HIMfp5MhTq=Lm'F<b|7?lM=btQ~BTS3(Uw]r&P>6,~U^1K$HsIHodm9WMM=bx<X;n9q*9hjQy",V6BmU:jyT[7gX8)
      sf@C:>$F3_aJL$G'?4vYiz_j@2e4FZQeX*'TX`+Q6?:L)1YuSuBw5sji~w\U?Nf3zK,5@9$BaK*jVz!ygm5=X?)n:&.~_6B5|18Ot8(wks,;cw
      H<:$=ZI6Jj2N-G0H4mRXr\e,xVfn<fl[|/VGMh2R}IE/8\NP/?_ZQ[kt|O7pulSt6en00_8uZi`|}Qy((Q3q#ZhBsQll!0#/2JWEf["u$ts6Gp
      2b~i(GK2a1"MDHxmb\]}=:K@NhW!USgEL<t=B.ZIz#!3H.Ss,j/L8q@!:4<Szm,&X^?UHlA###.Vz>~55^RJSxe~'LIB2,^Z=(:L-<dZt=%2c4
      rrlfRll2LI=b]Rkrm}-&"n%i'!K+]WaMYm*=Oei<bNeb^(VvkhH~{BcMYa*uWILR'h?5nFKa/rR6jFy"eZSZl{H%p]SErhus\u9.0Y+4Upe]=],

   ["949"]  =  -- Korean, 17048 codepoints above U+007F
      [=[.?P*"%JdJY.\dApak>>jkl@@vlOMP(2HYtDqZ=CE{6w89$-QMAmM=yjyuext/9^>o"(n}rRN0XD|eH}+M7fc^f"gV;sYA&4"-]gYHf.oIGZ
      Ul+Wt?Do^tX+C)iSAsjU!$"crF~S_MV?9_/Z(@(=yGrY@yD_^/;}dmp_wYx%J%"_kCV/S;NwC+IzI7*0aGuv~qs\La%eI'y4;mNlkMGNkQR?:W
      x?K\z,V((+O(ZYm/xGGqik;L0k|3iWs@"|8?@j%MG{BK1Dk3pXHVnN^0[?X#Kqp~fd3wA,R;gvz}>XB{Q{Jo&>)#]'Cf&&T{TQ"H=|h^auS6>"
      :10_$.BeUI/7TzvDJwI{:2~z8IO3}T_n:ORStD8!M-kk^gD\I86G37`j5,+B*,vS~$6XF">A8o7)'pj5%3x?nwf3knRx1\HZR`_7DB3Rzj[Q|S
      3bx+#EV|z~]3M&pewrj|q)=[s:iZ%UF+sZd$t\sV%CD?cSOFEg0xizR|ME~`6x0kx'imf1aB}^Ql$RmH8C4Kf+W2(9;'v_kFs,~mIW?V:I!x7d
      -(z-A[D6B3LHcO1I).D*}{A(*)!yzZzAEJkowkf*$pOluBN_B@xW7a$wJX>RR;p\!zh;Vs{}7gB4v+u8IrZlPhk^m@~1Tx\hDGmF8>(N4&!1(P
      J3ks=(^b*"!r{{N/cx[@_~cJY`SXi(!1.G5q;)ttt4xWgorIb/Yn#pxMll-pJ-5xG%=aSdQ')iZ$W,Mvr*BW5;g%yh?PVe"3:B!1+2Nl(A3Lkv
      .AAPz(%Zx6gu4|=xufBEk1cY%qIl%L;[RB9O*US#RQf[>ToY0X=+Z>%7C~vkpxL1mpFsJ7;44|z!V=s-qKW0>z]xC4vPq\lpDsri}0E,KA=z:^
      Q+st(@ZgK4QNjts5Z6}1-OE?zEzNOREl]#)dJpIRlqmq{6iN,~nb~ma./YXED^b>2>,>6mrS#>815-3s6M8geiXiy,4W^62ccM.J5?@xC"Y`=Q
      y$A4|zIiJHF>sy'6hh!sB{eDra.eW{{mTZG;0cm>"Fd&BXY]D}2w$%wrm%.V.}YTR9Q>8A!mgH%*m)gLW'vSQou+;$M1zR;R9":8z[3b|VJB?e
      )Z2rV!@k>2|/#W-H(pmeZ\"=gB:6%oO~^NG}93wq5sx%RMhI9b6!60^Xy1z4G*0E=|6'Wn^P%;jwHFV`;C3P>AT,2lNNeWm'*|JH<Wlf,J[k+:
      aC9<=lUaU^,&(aO)Ka1G.PCe/:t2+Uxn|<mwq}T,&!ub8^5:.5tN|I}q:1$?^"mk6z~|}juv}M/L$p-=Zs[u%Q62Yz.VXOF}QE_EzacFiQppm9
      G#z/bMU(3I^>8h-RNCFGW$'-|X60kc|cYIeiv(5X?>:dR|qw-^/vTv[.A>iSQf$^it}+zp&>bTL*Sd/t0N%F~O.#Vg5/+AP4F6=*"{}sOxjT~h
      iW87A%2*VJ-&TnExoGa%iitm6cJuX-#wJYq,=/e3,WA}F7moF?GGNK{eA_~\R!G&=DqEVyLG%+8`f;uiG&*s\LJ5-@2REyvm\;qe`DVpB<ns6`
      Zh|Xm/g;d%$Nk^U,XNawfEz[nr-65h@fVv5^X"cz9)S|trOgmhmM\Fp.$Xx,DiA=WbRU"#2PI&z'g`/?/v-d!N1DgRf]B?Q|YNeUi-$6ZXGg7!
      <ymewD8gem^+$ySM*Ky\W[fJoUdV;{JpnV$/+d?q_0hJWIP/=-A~!4UGrXyLQN[\Wc]g."@%%*/UJrB0<kOItc[(U|9EL@nHbx_x<=!v/>),eN
      ),C1Q+OlaPLJ{b-~i%`q~DTWDU|D-J:.lgpLzHZfIFO4[Bf.Q.[c?f?|)K?_0a})kWG(R,MVmUXpyia6Gs0#4&hd*/~JJ${Tz%IC7$W.rV^y<d
      IKE#D_Z)Y{2hY2&K{WO?"_f|7ddUQt4C+DS'>dLxhN3Oh#l&9D.3dQ!`7?b=5[@*D94x.!F{!p)+Q*E3B!<eoPyI.SNpdH]!@es=^F'HP%^Kvb
      R>i(I|'7S^<eVx.g1},0|4<vKs+|ZG-c:Ihwg&9PUtei,Hu#$=@F%^xON[5+yMZQnr%zxJTGDB3"{XHDRPm,*2|DPt=~FpR%i:ccS@]lo]a=?<
      X][S7z;:)Q*7GzNKQ7W=`+X*HE+e!'X^S,pYuLo3e'Th8ms1a,XQl"la>9=IRXJQbvK=gn4z>qY0hm'CTl7;3<#/Y'hE)s8IrRhpi\h{%p3(^*
      &RZAO>>z7VKGK6[H}0AL[kA3WrrLBo.1J!:Ve4h%Y<s;n%,bkgWF"o`VQA][acJ,w]s6[d.G-$d*f}e$pOKWpCem9otU29?k&NX\$a#'.aIYv;
      ,S.Zdi0aq^mCnq5aH~B!afo6V[}GPk%K~\uI'cwIXn9BxM@Vj<2!47"JQk/3E0p{3ub[bv>$?|#=C@o!,al_*e},iS7=\9%NvKQfm9{uhx4-/I
      ,m){c?VKzYG=rr"L(-62J_-9R8<Ve{J;<qHBA|})`xo_o1X5!|k\BK-/,41Ksr$T59/lGFp%N1id%NWAa7^A-)C<y-Y%Mk1,e_$T?L{Jn7NBF\
      O]0&0y"~.|-P4Kg=,M[6}8\fP&@|<rD_345~->%ZEe-s~`V._A~_WH]61]e!y#A0H2"a0rpe9#2bLDL8Ip")o~cu-b5/S){*i[L@[x8@)YT>94
      kwy(SjEwK`iPB4<nzermQq#%.kJuR]23mo&[\sa,NY;I(#=@Q-0;&pz1c?hKAb8_-F-m46^Q`aI\0hpK-#4+JW_.`FE3_rUpxiW)06N3!.^)xb
      H]%VGAH`/Y.@y{n<vp&jn-xx0=8^q$>VmrQ0)1ii1!(2(?tZhAwz3uaS9O~csX;BH]m>'%7a?rmnNPveGx@h,`|B<BOosXF)EDrbI4ZIifXWUb
      v^\2G7i^Fl1]{30\MGrfNN0>upeq?[BbxJ~#z|wZqpRdc"S]roMN\Y0I<VLpVel\HAgWGL{\00Q2l_O'`G,G<;k81!/{4v~NxeUF}\@kVhX5,w
      yiKnC&h4r{RW@,1F=P"!c[}16W)b$"^/T5%L~Za|WEd+k<zlI`r*G"d)ep.m,C8sRR%ujLd7k];f}c5lSTQHK:=[gb=<*@brID5@wi|aj\@.)o
      8Hoz68Vy';cSS:K99Er&_Nr$W$P1ar_iZW\/veaS?,A'ctg/t!N'6Le@`?nzV's5K2DX|qdNX!*geVta-u|JSuTF"sw\+~!N(8RP(J#.lVJ27j
      js'Ytu1wB?7u@a%O5uI:oH45J<0.LMz2/"r}bFt/wG~om!N3F,mHXYQ2D,>a)mDC@)HW2pS[vfY{3}Rmh?cIbk-X\mj90#8xegQ[`)H&;#%W:I
      ]4t+rXLs,\4"z/dbz-0;lV:Zr#7SM]e0&74Dw|3*mer[JDj]+Y@|f"_T.yiVQL2P`&lHTuj0YPpWKK)pSZcK{IRu_gfFPRGWIH_lY&H4\iVu/z
      \%O+8"sZi$Djk*PL[sTnEByy^g{wun{(E$lVSbKv&_wmB(tx31%S=,g7j-=7I]|@frz#cc|2SG~IryH/J](*sg'rE*=Xn&~Tf`"$'au%%4S/+n
      psCs!HqU64TFjs>Xn]]#V2V~v~ySldR:{?0@@>:ac>l1\L.OT14*7Xx>JFG-#q0.I-UR!E.+UWVI\RIPiFn5~F?)'IV*lg7f?M/>I?IL^.8gik
      }&f+|3m^w#PVYn@A<Pi*%[KGs*.n!_PtY'c[P)(<FANZRX^l~2gv9S+COCp4Xe<O[GE>SYy3R1%:gs5UP9np>;V10'wB5-,wrSt@B'JJ4a=}NN
      V<6}hF6:~UKJIkJ\OqMpex'<yW[ccw9ny=@ml?|E\i~/V^NwB{&V,z\|9a4ntww#L/:Z>WH>+=!J1!#DzM$_w/DVU>O2y_due-Nn#9JOXQ}];!
      rbuM7jG&@5Q0r<sif%uv)P?Tz~uH4otJj(!F\m/bIe^%.q!8j'=|v(>w$k.n;wj@K%xWn6R^B1dQRLI,T<^Wpe:AXG@8]VQFc21z=m-TT9jxno
      4QNm1dBePs<'%l4Vj~RbxV2>QL<bt3*#LCEtu2}C}9YXugj&uWA#v`K]ORD{c^!3n0VWK0=IJ8gZ`hvJ|5cz(!_^G?B}E5Az'VtOydvE*DbpqA
      k*0in,>e--hpg>.mznB0]8=]AzWOl[8zf+rXKF-8x-h"92VkV7}(>G}|dT,:;jd5VZutz/]`SFhhB4F/.a=h=c.`7i6kJFgF%Ggaae^tZ<F:Sy
      'IuIs5kcO[~=ux,i3{M_\+(Uo3hm4Nl)LI]j=HTVVI$AA<cDRt[.QYbPL|-*aCC,;-CB;|c)TY+txu]@.1{?#amnX4r5.N$\GyEdm>`]X~x4a<
      #()TEz'u{&W5r@xQ|)IpQm]]"{z$4|~ybNTsx"ioy+Ey5<"I[|P;boqJ);iII-*!FK2=(+c,i]<;zj!o*k]Yo7>^](G(#$t04\g|Aq.&BiMG[9
      9U:=9}W]!LhXpygwMyA1zA`8!77X'SvU!;|nbO""cSd[zGx0XH3OI<qyA$z?oij2PJIS&V4IgGE4Z"0xh*&i:v%D_JfT9l;C?gAY}r1*OIa:G,
      Drej-QJ=Ag>l>9,NEO-6QzghN$Dh)8z.2@XYm`kC$hn\8wHXIBW&#~(;bNs*gC[$P(p*K9B[7?nOW?^0iZJ$z-RAQeuQ1^fbpDcz`N#A^.JCQ|
      3*FG@/DYL+$Hua[LsbV+59(5p$I|6eR"i+$)R`e-*.yKVAGakI655F}z,bYmn.]7I-fBm)<;*iuyMuxnHSh8""/3@zuD*+:OY$Je,ugjY9]zhm
      rW/e29X91jdNW>N!8*B*$&zw(+%>7}iPc[bOChX]}$\U'sV;*eI&nJ.DJmr[?qxP-FTh=Q|Ul9<H<r-RN4NnKJ`0DZ1MggG<$w:<[MFO-1>TYX
      KsQ:I=Af95pHEflnyw+l}YK<gnJria3Ww;zG6L+5j'-!~Ka,c|)_#U#J_m%BWUUZy@#;{%.[~:)QQC7/gx.q6.^0S4Ls+6D',=+2{~Nf<iMn!r
      klSaUdwXuC>FbFaj<41_0k`6R!*)66y,6/f/|jht;V;ianD'S.0jqUvK}jk4|65>4;}_aBE6>jb+HCDB0`@g=+i>fZ,:r+dh8fz7v`;V8'=+0[
      {@?|ixg4&tctBSRwPi<os*mi[=56*6XfH+dEeL_u)IJBbL[.ua.*UNrDY{ugaO1kQ.pPEvle4HPR1="(Mg]>{2!q%QM]<TRXflFFOrv4o{/2"$
      1j??q{H+kofWFZsF]`aLR~)&S;X6;.^N]Owq&[RvY(ZUd>}Jd^xqi"y/NH^R|[v/iD43A}zs|uzC*'5n}q.w<=x3mp`d@{H5NgHT}N's<5sMN&
      !Rqzn]Fpo+l$j|R!`P^N9>poUe@sjsTPVXsyfcSBN^Q}d>5H$),>K)J,M{5$b|mdK|(N:+q1n,`jH\A=;_X$aEaDcs@\_J0n\T7]*'Rtb!)UI!
      t}i\(*1.oN;Ij_f{p2Ph-ir{PZtnfXC26Jy.qeb/a;E%&Pk8=K'fx66s"gNVkH33liJYH0N\~_D:WBfV>rI_j^a1O(lT#L8_R(Mel:h\2(^B?R
      Ct=}azXv(VU:0gXb78G9BV1Ic8)r`"otFVP\g\#QR12j{Mh}cd31JbxF`Mf29?ES"xQ,)|:9Y@\(onVv=!|@&bHl!g]sdvRd:p|.;y|Z2se;{n
      =tIm7E~%Z/^MId9u~=q]eHzuQXo%d(9gr)"[H_D7>RRy9Eo~LQh6FpIgo'v*{Ga'By[{q(o<fp.c~-|8zRxi[Y}@o87l"$vcJx'ng_`NWhD:(%
      I7v;~9g)n(qb{HM2{$+\&*3%>Rc/8uOjs_M*M[ja96hd?v=U^<R{9feLAP>?YY(V3WKDfB\"3*p..z6~\Xat*qWzAxu)-T2Xt+p-YxDX2'QrI8
      vaw-YC;.pGg~EOo|8Ly0`VT]CXBD2r{|VAX&O#`,wl,GEQ/DU_lrM`y~A`nA]`'&%V0Nl{oZt53H&=7KZcm|?rXXc4,f`!n?7MlTaxZMcW8U{p
      <n~]O7\<0zc,Q3:xV*vxAc;,=o}Tu"bQ/FR+zcM!l@Q].6aUW\a"nC'`)G-yuM7&!{yP]pffAKz8&n3K}5)~69Qtes,W`t3.C2eVQPr^6bM#S$
      u1qjQLD$4e*#f/&{Ol24;^YU9}xV5?b2v*uv_h]O?-.a+Q~*=\__3H^yyip.rN[E{,NNgYE}Ljr~F=MNgq'Z*D@"++O]{,qw77k*Vh_=j"c'EI
      Kx&x%D!\&%U249GcY,~q_-HHj?'eN"YpoIV4mYGP_2t[CAp>dUkLibgscLZVN)G=W&7;R2*Y86I\'@J_VPs5l6N4|q|Q'51f;t;N^'RA;Lw~Sw
      6p`u*k[3>|90H&>R,a}rf6!*Eb9r|qKA!_%tOTbWj"fcr0sAnkQuUrmaKw]K^1z/mm}'sB-8<#I,U7[_|44$bwQ#.9vBI>R+Mwhn[!*~=MNXCi
      J22+i&qf52!i#j.hq0WP8p~.s+.yGw}Yel~n@[2u*C%Z^;A+~U"9}X0%l9F!LQa]yB4tcHqn7Mv}V7/G7DMhfAuNFszwAvG[24``t1f6AeZ2|w
      vzD!h/KJ*).B<HOYLlCc"AIQm067LBO{<2IA{&$BJY\Ajr'>s]fztTK)pM'Z{TId*Enfro~$~*wV'FxTFx$q;Cr<e*OsC$sa%.j7Iup'~amU#N
      b&"An4:,d{C/:c%53Cv%_j$ZDTj<iV=drrdt3;hJ|1p&M18LhPy=X_H1#BK(D1L>w)};yv{:E~JUR(qPCWxnfZIIb|:UBG^]Cj8ELONoVP)7o8
      r|TRv"vG%,1kfX-ny:8=NGjMhE08;`23vyJZIG:*Aq{^I"+Dom}QW%uYCT~u<f#]4P/6TrK6|a6@&!4jis:}hyO2r-a~)t]yKnx2+;-8]l;8'y
      n/;BvX.st^IW+|X3nu,6m>mw9[i\o__MZ3VVsN{`S:Aqh`b=(3i"xN,e^-97]X;E<gBcZP;Ip/c'iY^;9-*KmV9AkhH69V'E[);["Zxs]2v+qt
      uDc{G&&)(2|~7"+mtp@.|Sv;Gze_Q>wBYpJ%)w\bPm3>%~<<)c[#t!u]qZtFC!<.<33u{2f\B^8kQO;I>c#Z2-z~?k+w;Pg7MZ?<)8d#yK-j?w
      >X`d-W|F<')s)kl?e.yGJL(W(P%0lA6sOpr_m#?T`iDvtGpj\bDr'pFbn57EMVdZLCeMPu;G?IX0}I_~QQ/Gw|I{QZm;&:bCMl_VCn:7L1~fpN
      T-<iV5[As$N;(<D928JT>xkP1blxfAh/vrfcK`g3H*1<%&4*,[1'{[5HqHQ[E};7iZ>A\!U*:(xtb==")I\=qG1?XN6dVNq8FwNked.]gg>3ZN
      dDJ_o,=m>mV"*x,[]f(tc31L'MDv-/eFb[K:;]Xmk)?n%HcHDX\dA@M.!$(VR,W-ppZ>c=X~EU%s3LVl3OH[Ent9a61Q$"sPgl2}@MB8{$3c}i
      oftLOebZG6/^>NH36nG(vybF%hdwD`!W<hwwyge3Kl4^EdHA:^.$|5xXN2&U)jrPTxV#jQYIwb$FJ1@V|[=sx]yqb&Om-Tx$+D;FPi]=_Z}lNK
      <V>E5xx!z$Ld;RGwHy!{{Go6]_3(jyVcNGyDH+'^)(C`2~QmMKq^~dE@yfvL,'1m3i;|HP<PG9|ZkmY-09L^?!5&7!z6H%:_:(O&RHxIQB<{$,
      Pzn!eVrdV.[D`,b]94y&"AsI$y9%?9NbF\Yb?G(`0ccs/J=3M]{ejzMC,[T{Hg#P=Hqy#J%{4/.|syeu1X#Y[z+h_@'7FUJ:hCb-yoksTjwy!8
      `Ih!.].U[|oW(<Yd[L$q/i[$|+w<Ov'/L%">XvT]-_O<oZ\Q,z{^hqtK6gYRT=-ax5wF[GO1Cqcr5;lb_vbgM[GYcseMPpm*?r9hXg:O8?rc'g
      b&+eXS]Wkb&Z}>Of1z$dc1yM]8x-ecb,QC'Bu"[D/^E^=m93/y_06*%uu&q=Yo^@[;t[K0.=QK,raYOrccCTY#s%JT,c$)C5sl|MyVJKWTQW'<
      7x2~g.,}a{c\9Oh{qE"d`aAXA(Ta5467zdFY:vp:ug\Iz\nahnz%vf\1W9sF9Op)_8PSbUSV340Q#6.d:_6fxO2x:"03fBe#9Yi>w'v:M9n|X@
      U~;bGBinws3e=L&\(G48[Bjq0j%I)oeCgI?zL7f2x0)f3c}4OZQZ%#"&kDt6|TZ3S75\OM,P*.YYGhY#BetD)eJGYz)ocP(4O!ulf953!gjj+o
      vnJI+xwL.[zx,!1Vth+*w_X3px1:;ef;WSw4kQSOEM'R[EV[ASA:HIJh2n.,#uJd;So.:RNX0G-c:iH%OeX]jUj2(&j"CX>Wq+@XZsZafAAEtK
      G]^jGXkb9+5,KCmz*x"!Bh6OaAV.F6b>4Mt=+9a[XJM\X\HVgrav9)$?l$tV*]""O~1e:m;#-:J6Ing]atTtAs`vx;mop$FvKU;O;'Yn.b=Gj0
      vWW61Oz}d9c`;h1&o2`Agj\$EC}'/`G/%=X|`aT74`1jFX0KN.kHmt4(IXYQjs^-A4c;E{/XG(1<M?NFM1/UElj<96-~4=qmj}%[*ElQPR{,;{
      bE>wbh4JAJj$\DX[XSKud4~S#zHu`QuL;;k;-gLbf_cuh~M,?Ml~0rASf82m-U!%fZ#VnCux:e@%Sq|22i5R$Ne=>]e|[Vfu*jJcS'Ie&)0IH:
      v+"=p="}0oDT~=(xO8`RZB\,So\Y2_]!A@.1C^=WemN2G.qM'snZMIgagL?5Uj'1<BSz;_3z}2$WJASf-fEsfeXdEdZ=g][986Vyff-Gr=XJy}
      ,)4o,}3UO|tsnzl:J732?59KG.e)98L=mK'FZ$F-aQ<|FX[a{c0}4;+\P`~6y8gW|(>eIT]N*A_GX6.toXzx|bPPW5vGLU+8kkQV[bVCOK^Z]h
      )us8scS.w_e|_}@|Jj#MRx2F-&Z,M,{Xyw_|.{MM7nCSH`SQ)wtCRfdx}aZ\n[&j|S8!+R^dKW=,9qVK<T;6IPFwM*!=I.L3sE~uRwg}3R@iM&
      5y(:{f@'2\^I<Zu\|/FUc[mU0)Ut9~V|<:9ZVx4^x$m&mwW+R<}q1d1{uD;@)!Y#q&m[`\\#}$10*PjDRIeh:zm>e=Sr3>=7Fzz[PfvIDHTi`5
      H,l(V&$dQ#E,2]Iy*gH[=5{CrP.)baW:4[V]Z8%;eg_pbX{~w<URT<f"%fm')1R[w>C";y{+ovQydR`8yw-e05,`6}@&k/_WQ$:RuohP"zE6UV
      2l~Q5J~7ck6pP&o;zHfj3@!WLRwm/e(GgC0[(6L+PhVM[=iU}nA_zn]3B4&~pQYa&5`5sD<FRj]7R\"x=?3V,y<sRuhNLqE/D81l'*!6jgm~;f
      DJb[Ds!t_9qW}!U4r"t'U6Sv:\om_ZVDZ|k_$C=+eF%"D2HZQn_*5-n]~l5PaJ>r=HPwys-LR5YDU\UC[nxh96<,}!Q)au:Q&'P9zHvm5uA#:j
      KJ>0OGvb/mT{IW4wlH.&aAW~T]JQTR*h?!<c9A}B{4Y3_j='O0%',S*|zVN9m7x:@n<*aUNyu=s6HdC_7Y[3D,tT?U2RowG+@xdmyt<-?pM1d$
      ^TVuB\M:MVrv5?))Ggeasf?O{={#v`&-o3dGD-04PX!CQ/u5U,:mNOd(bl*h4G!9<|Y\'L0gO(<A-Nl".Y.]x"(=^Uevn9Z0rMviUK83&&4PA$
      h0vqOA+'.XZ$C;0wsM.tJH9)pkNZ6c(6)F$G8B_?xkuaYRwe+BKIeX]f8e!-3S.)W{_NhV60\oom*~&,l1CZT>Eh|tmi[$L$UwXlt?Ko5G,X&_
      }t$cjW"=e>X@&[fAm6xK9m)@2kJMJGLra3YOwJFel@}3s{_zpQ0<5xP6-dT}Ym_/VtC:,?4odK{cpY"N@J~jA>Nw^FQ;Y|_K;_T\:/QQ_k`]-M
      sasg:^GID_sSzsXZ;p:n3JS\T?qffK[8J*'MCG*`_M9K8xD%\.f<`*ih?85?PcA<!Da*k\"(Fl~h0'NtOUgcnX<q@4sC6a4jVOj8i[R<4he<E^
      ?p[7>gX3~5gi4:C)%+5OcQ'KR-jLH`o7y0wvAD4M'VV*~~3vQ'V_FacN!Q1ue+E6$>,'y&P;-xifk",yEb.!P%?jv)tJP%$8C|!?pC@|*>\b{K
      /+7j&lZ4+?8Dg6coiueKK<(K;Ek:3HYd+-uGrGP=W/?vkmsvq2#]n0~0i}@-snT39R}?Eh"%s[q4UFm)PB>4x+"b"C:}-]`tzjcyxnB!3Ls2^J
      /7oIqV6`/QQCp|UzBb\Dkl^5f4^;\S]%-&Pr>Y@G]E*^6/H\7*X"Rn=~4$0mW^g1LX2<3X!ly1X65BjWTy2FzbK^dTPUIn'UA}Ja&E:7\CUf2V
      {K$aN-%[mW:VDbda"KKB|(6.!9-Hz3,0*w}4VPB8i?/~?NEG4l1;UX^bg+4:CbBF;^n21\bTg`vBfFhAx9>H|]b?j'v\)yA7l({6k}=k`s{]0g
      Fb"E0tn2ZR($rgL6U0R9@4dTN>~d-]4!Ul[jju;Y"X|@|'}"R`;45w@n>EFF%U^0[6VAS&>8T-htl5;0^.V,tN^13R"<]{j<Hzy5`+@'h^jvAr
      _vhY^,(/1ws)6J.CnUwtJBeo9|P%ef_ZS{$3"<Y_A1/?[VlI9ws6E-_M#f+nA#CiRs$s1"|/lE-UxwE>^)'xb'd5SCqRE91~[k|n4;#%m:%+i(
      *aubA5=Pvwn-D';#`2eV=l@Zypk4u":v,5Z24"1#\7?I?"<oP"?}Cml[ghki_#gp+L~[0@_ds':eJX[M`6}40/u3f\H'U0~YR._q,[_/trnu-"
      Ur8ZYZKe/k'"fGFe-[DG=G6A2A9Zd8_K!?8D\`XCRKVm\x5G\xtsWH*O{Ekhd~U%5uegbn,?)DDmXT(s1PeJ6H4v1-K(=t4f84fbhKMKxum&#9
      w#rPc9cxmkde4>e?O|vAg!=uwEf]DH1y4u4.]pD4^Mc$<}.QwV\g}eg9B^{x3g)S#(F)<kZCum'wr@<9[a>|0YzR3df&h0V_5F>W'$:h1rh}mf
      |C&{zgP\J}ZeSQGN0!EzkLxL^]0^D4m5:m%2Re$XQikF2T^=78jWE?|84:6u5p99Y':"Mf3x*X/3.,dG~`V{:e7\,}pM'cx%RO3i.b[dQKinLn
      t:,UhuD8.u\_S3[7L;I@'A+`DlVR<3>s$mF_]MX]|atLizK&wN"Xq.KRjK|0t"w$3Ily(1AKu>$W:WAsmc-:"SS3/-tIyS;n'{pi>f&5ns_kr0
      $Wd|[2Pl!|p^8Y(zg),H]Qo?3\xG{gv64%PXJHlg@%FQa:OV>3@#}(^7N35~.LzR<osD|D]Lu;0DxUO$)uv8C2,}4J1eY]wLTVY$]?o8@4+(xy
      (["V(nVFqGm=lx@%(H}/t"wsX2,zd[>A57pCyaA~bbE{3RReOW,0[,Gutm<CaTFye;o4!<ppplh(r^RTdh1(&R[<x9JS4Rgm?bUhVk$RI;V['y
      `h$B,P=0KXxd[h]%y2t="Tt_Bkx]H*`VI.)$sW4/uC>FiI?mg%\XH%X0!wq.sx}DkUpk%9b=&uG%ZhWsa_Oy?wEH<{<|xC988hzFp^i_;kr{DF
      Y.N9,-iG`DlpVz*h"b'DU=upH:@5KvlAqKP]F;&[0c\F3SF`O|oQ\^@E1d6g$Vp7FS.)&Cg^{SP9<,jZ~u\}|n8E:>`A-bontp^{PV:*d|e~3;
      (3YJh090sls^Beyq\c4)cVSfj`FR|.U^2Qy31$./FXNP|fg(\ofU4#3PBN.oQc2(#o(AZSbu|YMj}\Gl<{`R/{dR4%QvUuc2Ffg~03EgJL)["I
      ANuBeyqV4r}=[O@Z(SDbE.\n./0wc^uaJ"|>O>>j]g4r]u(Tdq,@f=&E8-YB!a%%5P,VtYGOFh(T%r@RwjU)1d1e"f9lCv]pcUa8(e:8W-w%2)
      GB,JbJX}~MxIQt5#L4Mo,=N]agT["D)D;KxB#?tm1<SO^QOhE7cYWfARyko?&"~$!0~~g:*o&{K%T1@9BduG4aWj$iHffj7gBc'%JpWkz,K\F#
      9iLSI.A}'M)EX`O_[qrP[:NxDUmWhdmvY>(z2$g.~e7OS}KWnIDWu".U<RY%u^2%9(+"Q(UEoEXAQv>t?'BG&1.@2T}q8-oFwS^p)V6wm58LE(
      -=>gD@CBIy}##MG$&)5a5F/y2S^5)/nE`'lh0_p%["LJe~-.j&ar!(J_Y6VSS?Xw~5h:%6&hbD7wGbH*t]Jr$8}7XVe5$fH@+agP8atF;0guQ=
      |8?zTZJW*/pSZxcp*o)WgsmTBoatZPc9XpC&.6x7"li@=<YI&OsXwW,:)m]17/Y{d{IaGV3stw7kcK*vlJ@@U*Z.Ky$Mw"h|rZQS0J.~w]Op(|
      J#%;RO7Iw46b~%o"'fEO}-UYOSpKY.&|EfjesvrH[8Vy.4j5[9c7gFD)oQcss<PQ0DuU6^"qJF)lI$]C4EaK<$HzLpmN{D]@i~P)XXp!8'bN.r
      -uyHo}Qm=.NAd$iu&DAjJb:4qHF[#|4TBVKy5rku;&u,"qp[W.-hVY^\ZUq~YFD%?UEVJya&W5+Ld`H[,|(.D"z7TR-I;d=+L0|NqJ=Ek2*khT
      {?'Y%/Gy(JhqAi3-Z}iO4VcZ;F;U6m'B"HT)v)j9ndTM6</r@PxY8%>pM~[s7k"~NxM(qr2,^@F0toP}$*V]pYGL!^f2J05'>z2Uy7FG>Yf_"<
      /_a`UboR&SFaB#Y'`.wih;+n>9WdbGo-]H>$H\AG~C9'Ti[p6a<4Xq?]J}m\W$^zg9{giC(]&b}:CVjC{{-xUp2j^[:eGK%Jb9WvWQpQh)[^)9
      Hw<4vXJ{bvHBcUoNci[:G9W)b#)xfF=CJL.mS0e\?\YLu^#~c-j9,uw3n)'oc-&.J}#j*<K<Tl&x>>/}bz!|A25H~)/$!imZ5yF{scJOOb`G$j
      axjPw~f%L',s8Ss_5m-Tkt;(;'5`ukWZGQ`l1GWFX+'\d$wk}Q8UlvzCYNlgkEh6IkN+-%(4YV#")o3R`{*E9s4.4cvH<y[~v%a&[p/Vj_j^=z
      $+_$uP_vu#.53D;"Ke<YWon7o&#9=oz:WBBF,oZez,l!dL3fVJF*eU90j@e#:S=_SZA/!u&EK|7%QMAEZ},j*wr2?BS?TLQ+`}yHO-s-`ND_kx
      1R"zZ{?<~qlYoxHiyt@qG\7JZ)CM@pPiYxpqgj?OZ{.)`k2jF1ALFa?H$F[")g]7W8miH/M>@}l/QQ[tJl?<[^*-SHwBF_3%|#w(/D,q]J#4t-
      @#5CSH7GSL6a5}S]-sVYnD^@15te9ZlV>O:4B>QAI!O7Vzv8Uq\&QK)q5G3fNc*G~uRi{=pR0\CW=?m!ULE~Z$#APP3op~gKXppz7n%k|iCWQY
      PT2WK|)~n\#ns`,at?y,bybqO7rfgUa2oP)jY{P`CrY|.a]w/G{[bk,$t7K.yVu6S/k:$zLI\%eL"lE+NLz.\.cqDxouh!!svJ*uV85QL/s{81
      G,Ohjw^qnx*Odm*<P9,JHIJ=dg$HxZ&xAgT70uE%|&c&Tv3VN1\E$HuwBH?[&[Zm}|xUtz+/"w_ox/sv<dRv1<Zok2:ch{vfHQ@a[b%EaLvB21
      IMgK"\t8Lc'\*vWIJ{?d/tTY()m'q0jo>TY4~uo%3jDmICsY9$<CpH.B#b)b%Ww^(sn-{^D'*558#?d.HI%SSv4q!M!qMB0~uK*3FmZ+FMP0P%
      l$[<M#7I&b6>CV$e6*6xq~+84+ui<5$=WH9H{*zfV8eF^1TXcw,T7w+m\`D9H(Q{*`=&kDji0gmlubbhzpn2)XsF_1LiZ+xscE?_*<T/ssY!qs
      |+\bA2I^@kI_y.%Bp3I8?Jew4L7v-Wj]})*R{6!:d30@8s/oDS^b[8`AUD>Iy5}YW~cRoXZ$g_qYld67hzwoo#:|`RB<<dOazhF+%mt'>'1J3X
      Ez4Ehgekx>pyy*IP~G*GTS.=I[!nse@N-)FCu=S@]zWIZD>h#bv!(0X;d8JFHM]9C#%*u.!1J4b1wPAdr'k~1_{DzKT:.>M^r3e{~]yt3|YF~6
      3!PfJUri7:/RhzkSFT^xhi>'Va$lGvd6*7WjH,/4\}P(}{*kq|g_,/wDMa7\#GC~^sQ[_@QK{_h7C?[V1<e|X[fGCCyP4fh+nk%FJ|34t>?r<+
      0b6(q87e)'oV3s^nyP5Ckm?V0~x83!3i<az^ng@u[G]TV&7SPY8"oQeRLxD#>!J>.`V|tm2Y2X-"+Z!=aep'?"cMhx(L.r&jOh5XHJPb|.|-X4
      $RAeyPBugpY8}4|WppJ1!kX^c*K31^AD]VkXKq'lZvENvBg"Yx|9aKoh7R;UV9U3&v)iGdNk&n#iB(.}A^sZ<EGt.Bw$7bT+@rBy-"Fp(',5dy
      15|TVzj0`kk/liV6SK\}h0SAu|!;b'[KJx4Rm(W][q~Hk}YJ:H8Ox)b>,@BVD21XmbK9;`nGRN;KJ-*m=9"#ovF_cZ%4E-44Xns!+R|EsoGSfL
      uv<S7<GiO&'H<Y&P:PpcETW2JY,VLQ%)z=@dlG9i/bw`_D}5C1<D%lxX,JVJVAo-Z-jwuR+rom6aV00kB&#]4Yvd$)<;>n_+M)2:'C}5-dHZII
      JY.IQ=(q1OSs-T1%`O1w"qJ%Xq;!D3qc*1j}+=5;ZC.}H4Z>=![3$J3E^f~b9H5@O7M;)A-_ntm|^2|?3?'*)srGP/h#_peF$:6]:kQ"zdl&<Q
      EO[sbGUR-9Eupv%WR^C:2rCrj">:FUBFJ21WP/e:>~{wkI$Qpebx\2+bnu=+jk&O/e:(?^{jTV2@0IzH$9va;qOX[JCbtlUVf|;Jck!.R+it9B
      ge}Eo'WW?(glphv]Nm|}Uc*2&=x~mSb])lT^Oe79>G\/]N=y(XNCb5YtrNnT|f3p:leH8n@f9CgmT3>9`?B'k"r[mdu/v/Qyt\X~;6&1,nCUi"
      i/,M5-1OBAV\#lFlyneI,QGn#/>UC7jrlsta{f5c2I3TyZRei{6~Uv{EL(ltze,zGKOLgi@.]U)rrywoAR3>ZlvH>LzxN532}W7L%JjO.UJo<<
      |O>dN/jOMW+;r*a&/N[s[c{`c<~$#QcQe2`?p9+0$s>[\r9Z7UWl+~U_5>Wh5%4>yVQ:g39OTeN:.L|D50lP;+6C`<jOjBK}91$eK;L!Raw~zu
      [4wXh5m}KRR8~&,9{^g#hq.E[6J}5^cii9O+L#5[?Z75E|)I7P@>8#o~m:~9ftPx(spn66n_;tH#Q;3iNWrP;Gvy#q.|rk6OXHhlZ1d3HtB%[%
      N)MS8'n-t9aD0`4Ir5A2KRpV-(H~i:A)0z$l'W1&=+Uh9`,Ss3+'k|y"F<HUjl]LY4ys;qg7$>v}~P2b[p]QgIS@Ffw*B(1I'LH^DDL~m2ZbLl
      6LpcCtk6bDhD6>5WZ+Y2<>()~g]=bH`YHIss4vsR]4}-bGh@E]F4cN75{Ey0&O[=F2mf6vbRT/]#q>1Z58sN:Fcw-IVY!ks;Y>`9fKCUhgUVnT
      0!I2&":I#m=JM%4o{kb=vy|%*Nz)+Y/YdIbBRjhF6Ftfgnv`!/>_PSR+c*m5S-@KvmtrK.YJYMM)sq(>w2po~`Lp);P~:,GX0yr-?AJ0kW)Kxo
      U"SgC?oZ/7}s,fc79i1[K2Q`9l?OgJl0dG'nbgM&*`=]Fy&lzbd>XZgkUO[IN=`A#K%C5K!ckK$&4w0EXO\}Z'p9eLoObZ&94T(>7dfzlTg/sc
      O8UAE({G+#0@vl&BmUuIBxaeH_!^p-81.k5n`V0]],yX~R~{Ul{@M\xn{r,6Oa4.[~pJ5<m,`6ieMX4|LB0cWDvYrEJ.{gZd7;~~"%(Nc?o.c}
      )^<|/iL>]-F$/_9?6m6.^#ePI\,CA_@;FR)|3leFjcS4*{Mpc/xy9*\]Bi5#)?B&]y,Olh-td7Ph*.)0'C%9\K4OT:xje];:Qt_`Y|1LHt_ch#
      4ydpYRHc~Tl0p|hT~WV$;1Jt0%r~LgZzOH8[Z~}X|J\\>y.HwR{{7`*tkG=qes82q*t$TW43tstJ|+i"2:]m9P"\!w}MDCA.,+y6B4bJDV~"`N
      wH<wq_b|wHBh.I+;.*w\"9*cMcO,tpiuKI/=L"DARh42?Ub<u2saRLbRp7!gMi`>aRHf:k0Gf/`0!kWj2}a"Tl[e5MyG"Ni]=GWK!H_J7?4vR_
      -5dO6gh_*X^K.a-'V33r]rj+Zr(\"{gy]r[%5\SFqQH}i!2wALaTs5#2?8WRjUmQOBpp9Rv5CJxcO<a5=XmDaTIGJz0)taEa4:xXR%~ypzD]O^
      sC@e;XW}P7*yQh:UQSV+g:UQp*{]PfpZT?NA5Xq7aFvvrb%(Lc8[%COt\zekbNf}w.|(~mfs(mga'{QmE5No;Y9/C2~RfYrz5;d\:)ef{O~m1^
      M6#.F`lU<0\tCZqME;[HM5JO:5z,=L0!jjQOHJ9dXh,&X/deglr,T"fGbSm.Ny6^%yKpi)Q5Z8Z1VB.k.Q(";(!*%D^8>/)sBs7%M%-B_e$!=F
      4.^?@6'Cv8vH-"3r)_pFw6nxIn-Gso;j_x2`"zp^q5~dW!D:v-:i&7AKX'_v^Q\7fG;buWh|G(bpy=_4;j|]PG8$=Tn3ZjWH]h_ZAyh#_Al#}7
      wt5$:"_@?n0kxP0JZHMvi9G!IyP0Iv0w'25F{,d#",pQrVPk+{kb,ve0+}zT*y4[8/S(*+gS)nwDV^y;,!J;]|1N{au[rD*j(UUH'5\Yc%E6'N
      <o1W.4T~(4\[Jpg_fgd9G}QR#ur=[[CP[d{ox`6DTg!)V9*,md\^~h;VlWEh|ym,d<n"<v[lWD@t)FFS,pERd(Pm3dyBCA(")qd*[*h<?n\Pq1
      Ch|=H*l|SOV1a@=*yvR\]TV3@${-D9H<+VF~P<g"H|0?SJng}$(Ym#nBE`3i[TXg$^*nFNFbs)<z&YhZS.3^rtC,?OH0|A2nw;[PCcsY!v5gQ5
      |<B</Ys.RlzX:\]$sy3dWTPTi;caN!Z(p-/CNLT)rx4BmevqKrCN4t?(z,Nft_qz8Z%w[z7t&1eY#oqOb;j+,S}K~kIhXj}ANK(Lh7EW_U%U5U
      eQ"2iSV648/!XI<E\]`"Iix~i+!uDoSen8gdmt)[bEd]==KQU(Sv?pK++?mwk\Lb?1k)`lM^\\u?yb)ZN;:thKUU]aZ%@-)BJ7tq%Ez8*czn2s
      gnA/B5CgcVPH/'c*p%D4H9y*c|MUC$48c\rXBaJ:T>HU\hEh/]6rX.m<!SGEMyyO&:"^tqq*'px%B"D9Z&\K^\_PwgU@E*x1qjTYRIa=v>IH<.
      C(MYj>5JS'iTP`7\+8-'-;BO^tM5ntZJz`}.^g!Nk>Q~TGpX"c[Qt~p61P<mO:[T{|d1zXv0`$((W]GrLYe|\t6$\Fc(XIdJtFFx+>#_Ba>Yuc
      1}#"ps5:vLQKUO]V{D8.(W~ketn[5Z,UsimqnwNw5&5hrYk>yw2k'O@>}>VfA;.a,7LSm@]PWMLw^{n1s$(+OR^~ZdXN\fT@|1)*xOQy`!E1%F
      <bl>_8F+>-W]@sX{z,G3`urKovn~9,o:8Zp1fd3@HY=VBi%=biPes^gM^lY5%9-"W|B]RSGt8!@au3E3&EGaHRVZ|}FX[HB>Z,4~g{A$ZN:2W$
      z#Q|_soa:=S`qsE@Oc|s>6(sV1}e0{\c*pURo'sbm6sB'gHKqhI11#1\:8e>D;Pb>*7R~G,c[G`;iasl=Zd#w*tG"8gn!5kJ!i6b9=1D}/KBPv
      s}Vt"J^3edQA~iYdK8uZv79lNLun}]wyqk`y&HGUsmTBHZI><q8=&\/'l5@-O0y%v"!N&[mOf=#s2}y_l'o'm;dQvrPRprujZT*B!Ru-@H-4|h
      <=$n}}G<C5^GQ>JSkN}e4e]Tqu(lsQdE/SqL~9V{qyHDov.3~yq)jT~"3hT#qc<5<tHIM`|k.'J7J{#UVsTCxkv$pwEWLrV)~**kD71,,_no1F
      R[n](.<J0)Qb]C-]4yZY&I;!sGsHs6Sc)nkJoP8^f)MO+LtI]v<y)<qY1]cM-Fy^1OE;Iwx@1h#Y<ruHl:?Y(,#1|)T^pD{H^BLBOo7zQ>F&Ak
      9"XJYyvbU=W(&9g;*!9s-$UI7w=="&viLDsBPmI2[J~'9S'C.'wr]#9.RwRpB3(%R8xput#AWxr&PBt_)bZHa+JAd=gck)q7cCmK){o{q2s`C/
      qh5Rqv86k<IB,4j=%]t'%<WD48frb@7pe\U:U|3()s:Ho+pz!r]vM@zX'@Fp4~}mSCkr8KnKK6+PcwM,Poi}mPl@mA3-oQ.6KJ'*BMh.p~_3X'
      -9atRmkbP}"<h6EjARaCM`6lLY(ui==:\{B3UTDg#F$*G~d|>u/on:e[7=#Zppj}tw[`G;2/0_6w[QtX~!:WnC$HV;iXC0}H{lJ*2s3\eC8kl:
      FUPn.OW`'_:?wC/1]O=16A&l'q(Cb$4he$m_N?S<x61Z2?Il7S`j:j6<LEplo+'y>m}a|bd7pMEA!J?U&K1HZ{>p#6O/^XVK[QO*`2Zxk8[sw\
      J%V5u|3Rvf%;^U~-Y;$[()@_=VVUw'PGJZ>gTt/.2RaL]%S0^DGP-k7QZ;a1dxu~_Xxu0k<Pe+g2V}3N}5iVUTJX"<fh>aQbBkhODf~dRaDLe.
      nEz/Y%$XGM]I/2tpa)E%X+U&1OFvsn)KfZp^>I*H0u9\~W{j[-J=c@Ist)iAcS!;*MIE?V$Et?7PexPSyxSGA{hRskoZQt@>!XA}P7R;Nwg.~E
      UG??eZf}1-N^Mra!eL8c,JPqd*"hy;Rd'b-;bW+dp6C/"p*kvDkXY33mF}=>HJ=4xf=:AMs:yZA%='{!aq`*:SSUoS~ldJ;@fM-?17k;{cg-"O
      wO?1Gvp1./pr+I+xZE0A[vLCEPU@s-::3?{V?p*BH1J^_-^'Mi4+nRJ.-eH<i-'sQnB*{2GWZ,sJNJ*yI>K[K55;q]Mtn>Flw_=>~1<x|'BS[D
      xQ3WiDV5rpue{_X-'eRz9<Xzz]b/cpZU?S95H'u,q^$/`eBBL]j7j[uXW^*7Iq@\CG8{`X!_n~8<RoACor(;eOFf<IRWAW^Hd0b,22Ug:MCf,%
      hyC|)6x&PW^RrusneqF:>l}X@9#$7S:YDYUYu#8^{w[%lGJeu8@J52{~s&qR[qZ]+eqM`miFm=Qf<;i}to.~YF<~\-i'O)YqDL[K2"<7m\<KJ!
      RHB(,(cD34a=_Cwnz)/0tfROaH0r[wiV!{kil6R/O&:OBxMe\^=>.cH7\L"Ra{{Us,r~`Kg$=?fRe=;Ky0qQ<qU=ceI>t'`,fLHMZ5?tjm!2Jq
      K2X)'/ga7!0&ZF<f`dVfU~&urnR5"x4&Ke_<bj9r{Tw3L}?+;3o/j[SXPUA:HW"A]8xoS[!Z2u}Fi?|?mQYnAS.S1n:!;.b;:D&:9jnL'16'-D
      @?tqpb.3>x_L""/?{ot_Q'a+N_oELz=wSF-yWq_QM2-thxMi5!?FE}al$pH}zSz]TxX&I-xP&;I8Igx.RY:GWOc1C_M)R6=h0ur'MB8kMtd/v;
      Ity~*}O/!A5qeJk,o=9w,Rmnl_uEqcGzG?D$6nCFRM0zJ'Z]'!?LjcxbeZ8[J{XA8C}`rQABfr};b&Z[}O!.ebT<2*HT7qK*$X:&),T'(`cb/j
      3TTrLe-,_bN]r*#yu8\55rNK*/EKGB.-F5F{2/5<J.!eTSg?U{25`4C~`@Z8PP_?!h4yR_Av3b8F^.c3.hOi<'@J,=9m]DAGc}?{CG;7P"^3&0
      oO!jX%LZPE7ir_%u-($r&Rw`(Xm:P4n,0=btn-#!}zY|#Jp[fPVScs.zp!1ZGk[1@CCL}z~\2f=,kRPLjJ6*EJ5p&k;5CIzv))^q)jf"&UexV%
      P1SUi+WNh?I,v'XeG+K~+bGM0TVf9eb%(W9msGGHgO?yqTaq5a<G*:{EqL'{S,4_?9=}C&Fuda0DJnNHLMQnO%_MKY|~i>8Me4j,EC{ybvy'%O
      EUQ{>Xo{xL9j2(7*)E3$F5X|NB[%ay*.2ee\5[I?b02GuueY>MGz{Y*l3:l&T'Yd;gZs\aG~,Xb*9XP1LGY6tiwMCSe.UWD0TY[zw91mY'04Yt
      SQo1rV$%O*Ui2O%|$OFRh^\Rl>/%lDFf$nW7f`$tNA-d;<W3'2"{&&P,#q5^J\Z?|xJw~JRa_*e_bKI0#raukcPU=abT}Qk[>T@)DtUwwK|`;8
      T-%sm/'(A=ERz|G36=v=.edqdojsDi&6-;)t-|4o~PIBkmjHt~lt5mvS43[I:KXQk<fP&y\=Ly<nz-PX]Y??=m@Gsrg3W0ze4_LE5"0xuR39dv
      _F>qD"{xrm-O;jWwzVvTo84n<%@U3B-GdCK}+~S^G[-Vl8o!52m%\Q"KF~w$ETau,4zWI12"lQ^D|i]QC-43-,cgu=|fK8\mCY,9x&0B~;2Y<!
      WMQtXgJ{:7hVjVDl#GDbOqTe2bnE$JLV7?'.-E$Db~U*,b&0;v^UwM{MS0G%HNn:j@<u:fD|uC8qe>m"},{W)>jq+XpVlpmB){tio;Ut`-|"G5
      (!g2HGV6`XI2$uw7"H`QM_+_v}?Z8Wi)Sn41'EBcF|#4XA2Jvqvgcn8mFTnu(bGM}C~>t0'orS\{xpn$3)WXf^$gJo+4zd\A{"kjRQf!tJ!uf0
      WgnA.i{@GRn+ow}_~(5j$rSrC@XG|L9.XcN3s&;]^%UJAMt3qp=/3v|`I/]V|=4#=C.!-}UeQk00!<v6[Aq_4)p9UC[y8)\R~jlp[+rd&Z)/L#
      -48XU#,1V)HEx*74nXnFt{b)wmaR"-<&NN$%dJ>fYn+|6>iSP?\%uah?p1Wm>}1YG{Cq~*i5r>#BlHI=!JzDSsC@q1FMH|fE47.__&B2CFC%"V
      qO/+OV[bt'Td;Yr>HC<hh.=79LlU\R<c,X]:T/<k5.WOLsNu=\rw`@RYq+KP{3~\Gqw*)oj'7YGh(HKMUQw4'nO\e:rfB9i-6c%`pEF38DZj1F
      5F.h>Ks|$zTKGu}h#`]PVFFw").}_i;Is'~#zmsCgQ!Yf`0UU2(>x:[d3XZu-'Ee{,OYK}_[!X^3e#>OAa{L(Z*4b@`&F|EaHM+Z<bx\@-\Y8(
      vVV_B`Lo%&b|,jv+bW!T8Fn)&{\:Yn5@P*Jz$(:vc*e,1MT*W'Uv:~$u]g>s_vvcfTu@mn5@Hhc1SO[v!dYFb1xv@fA}VHQVT?}X]X!^`A3$1I
      ua:Oai$lW0J}OV;`!$4!3d9R"H-04n`9,DK!-ZqW$Es9!(ib(ELQZ'yWxo6/tf!OXfe/?3jpW@SWbzH,.=]zo9=br@tK0GX>V+~?-R7Sp$5Pmb
      z4y[;9I)i@L$[)q%C&C_}+$-KSG{T;zZWxGEa+`|?)UvBifJ3#L)m0Xw7Boap~/7zX5cx~hkt`nPU7]Ko1[kJV/)DBI7M`wL3`;3ks&v_*z8"<
      zF~SA\D):-,D@,y[jd?S~aUbR[nufx'r\),PA|1MX--B%H>I]<z;>_Cd'o(;Utq@`t3_J'5LQ{.K$><0/wwjmeH6U&h;M9Xoe56?MVAXQHO%W8
      l`L~`\;7d[F#rf{|xv,5Z|n"EY.Weq>mo:VR)HRM}M[;gV~cv\x0=C)J#C8/*%$2#h!VATnHWx`}c:y_HPKb1/H<5RitiR<NK*}3^S|$!n]&&N
      *5U"j)}m[u"SWGUdQhgIcyh05n?%K+jcF,SvY\)6n/RY$}?prn%nxLcI?W?#B:opY!;sq%w551|NBHnJ1p`&x>l0d&lVqtLN(jBZXpQPaxX?x!
      }qI63G*KSLve'sM+!G3lE<Imd@[DfwUKW(.)dfFD6PqZJ"xpc.D+jEVJ*;_y\'oag,k~L3C4KtmefbcmJ%h(@>B+*#bdSOz[@ab<NK4t5GY`({
      2'+2-zgDZ3w$oIWMp567!gyb|\5G?M:6d_J<J2Ff.]}|u4Hi4xWKP1T4$Tk{STU3A]t=_XKJ-j'My_Y/D]p=_d\u#?9]@wqjmL[$*FACFW]cqf
      *-Gfn^(mdx(]+]4/>fE2!/D$naK0]uPhG!]jM|1k*m3}PN]|a4CheAMn~7{2/^D/I;f`!}A+-]f~(!xA`C=*dZ0k)V3m+Tk5nMm[.2NU#mE2JZ
      /+Yu`*hrPvs0k-SKfMS|0T<EP>7)sa5s+1K~#W8#&BV$*yt`CJ9kGP_)T~U*TYv_Az>E{#bIKk|~szlr`%^DD"t{'Fxf+~t>DhEuu'UdU7KH7B
      yzCTvekl%[@H;UP>,P;n)8UcA@r(_som2a|!xM=mB-)r#6MMGg/Bjy;^Dbj'I`!AVjbW@~^lrBk[aD!p=r[WE2OmB8L8SFvT+K}yE?ZQSM.EqD
      -1u_zx}@!:8I=^y*n"T"k=x2SG\@Z}merC{FgU*[XG:l7kTBj~D6/%(n[4<CBU_FPl:G\d/=9Mz\B-^1-M:rBq%*?R,dpP}4>dFRX2d3qU#+Fs
      ?GIK"D|dzFF]&gO|f-s|)`pd0K33%_c9j'D$$r/33pJcgCV^mM}wVXplY%]J0PHB8RG+cb3UN#BprAddjzw9A/6i40g!Fe8e^?{L%(e_gQ@EkS
      V?,XP"^%WSCM"K{cQ2_?Ne_pEpdP_Xc]Mz_6hJ<VAs&:#sRp-i{N<ywc)N@"5s@]{!d"@W@7w?nYh:O9n(U6[_yI}g`S+5J"[nnV"f)ic5uH7\
      Wj32O=PF[bpnNTcy~TZ\2&U068#Ko|E:f6?+b?K5p~gRgbiq`EVBm)mT~6Sflw43{jZ%:\h1_'hgrJ_6-f7+&@bi))M8O9bx%^Z,>-^XKXFu~d
      nzKEY4>G.S.d>|@cjCs,39+.!6^lfuf6CqgO;uUdP'Z!VvBkfNeW6_7yR,/)QsqxL$mn"q<4@N/U}*@,ljpviITxu#1*Iey0*7YOp>L1x<&eT#
      @V[?z3&CGwCI,O5Jd3pawR\?l6L+TbA^ZSJ3{{TC&k;kL/`i-|-0hUrE5=U?"H!6.p=w]<"9*'d9(oL[kPC42Q>COmt7C1!I\VnIN~:0NtM,i1
      8mI8T`g9/rT,,TcKK1?@jz}89tT>F+G]6X0`|fL(,T=y?1>tO}q7mtVa~BdzM6/Aqj\=Ln9kVATO7+da&`S=RB*Z~=;_O%,<'2=\,+,dEu&T{K
      %LFy'Mxr203RCkCO,|3kG+|>=stG_4\q~hCVSO[TPD=<l[mx=p@wXTV8(=4{}3*'?Y-Q}|'DJzflb5%<#'@,2BY7:lz|w}{\o!UH4n<L^,K$pz
      j|F:Y/Y!)O1D,4]<J2?k0w20kj_IF/;d&4%;@'>F.'S$v'ylnEg(e]\<|.`V~s:x0(Z[%)_@K]7O\*~b@u90c%lQ^orZ3[n+%?"RU`ABw7a#?x
      jH06xB]"21hB/*,Wj(iw9]#"Kt6(/t)Y.8^!ukVG/%L0m6c7X(OMQa@@.Tv}7]w(H43vSNY?.9tl)[ei-=&[40;6iZZNPuvDLs1@'I\>0H;[%%
      y!tL@LAK~6?f(7(5by)Ql9]X8{PWyA/"C%s:3YRmlo{LP*+CE9#pBo>A}ChkK9@.@u(IN@UkCj^>f!/SettD6TIF/\jW06l{T3^zv&RA~xD{P7
      ufCe%sNQCfs4R+U9n7*4!XRiA|"RQ>Qr_im3bf;5|kN8XVF5*zw"@s6E;L]K)RS4ZG*nfk$vFr5**,8aA@w5gi+=[(UO6[50(SCylrC\mq0YFv
      5+>"vC_Ooih$[0[3j,=^'z$lK*iYacW/}Tfc\I*"Dj5[d{]opB)VE*/Z3`K=_f14.WL%jVp4omt^;l+{?J((]ABef2n$a;FHC$#"aj~^.Ay;^!
      ,V^e5Ve=gFzF_mxO/IpkjSoxV96?}ef""!ra3Q<RJpnsyE\`CBL$L3spS]0H<FpJ3tv0tw%*7'%!@~z$]{a>(#/{6j7i4cmwl[5AEn9<{$c'u^
      w{GDIQ1L-0dyVa:KG6GZ/8!Ywq<Tv.VT__j-K%\;ja=7qbVJQKc6D>Q\:48R53!WEM6$_kRm4D).AYFg",B!$DRe+jUQf51D&BV=Nh=t;Z$h*G
      L8x'y)#>fL|a%HWqO9QM#'X*M/p.nqtPTsY`zz?Ub?#m49a(Um6eP.&?NMvpvV;]Z~]~WWz;Oy%QZnjBVDcF`Sdh+eNpXO!;A7jjEq(eq'Rg`=
      f;9^I0~Z5nIJTbUtfnEckHWtj`sATud/1$jJ}l,52>OBVuJE!xci5*k3n7C/@Tzmv`3Q|(MZ!&p5pH[PUSJcn/UQ7:mOepXyS\*|$J^O-|Xq{j
      Qlj@^2djU\r@Xtoe:$Dv''k:%WTz)VVPzSYPlUckX(0\P(@?\<tb613Z\[{X#}jK8mYL3S3#{b9mZY;\(2&]T:_al`9-/\87Rc~v:YV5vQ['nV
      ^}YN56DQNx=edSa|g>&nuxi8{/!Y8_=5(T'o$FF2!j%4"a(W%y]5r>^,v0rzc*w)e4ZU;yp\R]7HQ,J,3t$N1_T)gM'?J1'*=bS_S4]}~eg@</
      ?/&'|{~o5m*nhKTEQwPFTWp[#LMbTrN/(-5`P{0@TJs"Q*frEl,+(].FhQfR/C\M:.B^}A8+K@q9z3D.Am45|5K$%.2_<t7qiMzG0xhs#PvcAd
      riwR;WX1!8_as""p7)XH?HSKL${@WgNm%F`g=;-Hs5`[Rv-"k6%:Nnh'7<|L)??zCQs]bR`bydIiXsWY{+eWqcg%\8rb256<"BUm+?8|r/wAC}
      lmDs^Q5+89^{"y*)Y$Ta|1C@'x~k;Lg|8p7g*T}1ks6yt.{]>/^~uDi*Xh)MreE+;w9s~"3IJG`cN!=c*|^cY%@'jzWc&qmTCr_T6N>'P}*VMc
      VkQsXY^)UsoA?K_Wj{DVFXQ&80/w}U$kO?lH3@Khu3(n-O+R7hDQKlE?]=],

   ["936"]  =  -- Simplified Chinese, 21792 codepoints above U+007F
      [=[!cq%Lf7]BuTvd\U$`xY;Ze%;A&P\kuvz~3R?dWHc6_}0*g^iH5?2RM4s9j-8~\oon,AgsbSH_mPJl-8Y@4D@,'P#{#~/"O[/w[;cmtOz:%p
      -*4YA##^(FdQJ9Ur:ynHFL+NEb4\AF`Tlf<+\4RsHBy0KA-^3-J}(H5b!rj=rl2v8$yhK'rHo4v2;ByE2I)LZ1Ke`#AF<GmW0U-},5@0i&A\8`
      y'178n}$>R``)Mx{l-T`8@*BYs!PI?W_a3GYF"xe!rXhMXRGT4NIPg#j=}?>0/>WW%AK,,\B%Jib^Osm%WV0<0>(fDRt"CJ*;`6''sZm{x$-;f
      T(4!":9:$8=n9GSg5obD/o&Jcthrr`T)3(.ng?l}0*3h+i?N[V.UgqD!sWdHI],E=r+W?&G(HmBvXW}C{f{yG2=:G[#`es5**|umb`O+jLMuzI
      2<&Mbsfo){~fHiC5Q~$|b]Z9;NEfM]l!|IcFX[Ac8J}B!s1{fZ@9k.zB*`t)3:5X"MRQzKsA>8?0CC#V^P$*-_jH?H<'#nvn0yU{A0sdfcPDUT
      F27'PNTY(Y:a3LZ5#}Eb:(2v$@$4E|ew7l4ats0Nb>vS(?hg`1"`zveqBK8_6KMMm''c]GDwNT2_x{sHdSLid<RZ?@43;y~EIw]yh],)vd9cSs
      >Yg@Fgo~=2/$^2s'Qw"D~@0`]L)=x]|[Q[_G6'o?0wh[7h"!FfYW0{v\U)GBKw"q&[zq>(r_IQ{+:x^jt|X/A$ZWdU;(l5EyRo$9!slilrgDuW
      9,S@xm+UpqY<%e>E&&b<u>vHV@d~I"-gz'M]cNLj4?!C)+QVM6|;YTQ/~S^l+f%Dei?14H7fVF6z$g>C~mZ2liR~|P~d>X.Osf//wfoqC~a$BC
      Z.})H7@^E3l]zzqs<3AH}i-!':_Ok=Y[#PuSa&p4gB(P<6#Lh5~D%<[i7I;@ppGpe+"cQ\}.`x44pF=L'HCW5/~r:;\v_mp!JL'v*T$I"|@h(7
      Vs/<@&Bn9f|8SCxl~;O/bEQs7vz2!&)Bby5\+[}bnba(Q_jXFN1F'BEe]>Vi$5A<<|;KKFN-D4GiKcAchq|=a7$!8hr:>OO8Kk(fS!IXx;UF+,
      #Mk.r&7Af+8?h:&0CetkX/JzYWzg$F*a>~|&yzDXN;+c2A\M'saKrt>8~mJLKa:dk="v2IQ7llRgj)I!.m$cX#qB3BLiup#0Q$^.nA^c8,N*)\
      1`6t:0%I#_jHkDsj'4@hfCg7(/ZgkM=A=t^p5i.ppDT0AgO^%pxrWL6Yp.;9Rn<`d9mgKOrK.A03cL*m6;nr$@>uo(*&0KITT2B[u3P5@b;_DC
      ";-Y,1.Hqk._YK)MJJ>.`Ps`IJz7;5oJ=D_:vWCTBtz`!=]I7EYz7uHe_B{Vzob+k@=I$='o3MX$3Jo!oTtPbl^cuHSLj6o(fYH)MoJle_{e(Z
      l25yTdwhfdRvEs{8.7tTTxxBCzcQ5Y/g\UO^#?m_/C7)<5Fc$X$>uA$<&N%w~ZwU6RKM8"%~aT(#'8Ju;VjMl\rrPC8'T\pB"o-jl,NqsP[Tkd
      /|dE{p?)MghlpRy@DPF,ugi.\iHP6SBLlCs@GSm|FKo+3fkk.VX_)vxK3g4ki]XltyH^Z=6Vre'2Q0BcmHB0Q\MwjUEsg1"64Jdzv;2C`Fr)~{
      @\8:%_\5nw8x]fL_h'h<3/dN`LIF<]:=mc#|E[&$,+2?='^#<xdUED2DTj?pd^P6_<_`Q^aaMIrlS;OO=StUZR*33GR4iY6)MhIo4pI1)a9CcZ
      !grmbQ@e<M,<v(*d.nn|K".UTOhT:e(~rzf)b.Ez*B9YW1Tm9wsUn&'nwoyNfiQ<l!sm5j;_0e>_`O'.a87@kpt0HDr%$5/A'"XrB[;(FLqkIp
      eBB`;C6l1o-!@9y2Wrv'H$+%E)vfBjn.'r`Iw;*$IX,fdJ^xr`2May%(/54|O@%^>sMoQjwzYLjM&+Qj.['r^eyJ!F-!$A$l:&T=j({@>fN\7=
      2=lQOIc6=LpG*nZ>kbi5!0^ul7jO)LGBq9lTQJX;5KN)SLeA(BNm^A?0hG/~(HaWV1Bq1HYFsiWc"#&d|Vq(svyUC[|N\awgX)<KSW==yukqMc
      Cn%w]m}rvdXc{'jl*"M,FeiWgrm]<apu7W_&XPo:6L\C>I%_PXnu1!6C=R_<?ehZjJ{=kK&xq="4T`d>.')y41,9tv:=50)C)tx-D$83\+.Ac:
      vVQ{x93"_7_J}?4n'I7<D.c(ChfT|+Mt_p:CF;3'U)yyq{x(J;=oH"M}^'TlSLY7zwF8eQAey(aLQ_0`/T#C<z\T1(#^iwj5.aOStJG@q#IV>K
      =U2e8{3J']+*t2v>u6a6M9Y]+1#WBbpyx\6;:e+I.;h&[R{5!*Z,6A$lzqkQ6$t]cjXw,FUDhfL!4G9bP+o^Qeth)C^g#6DU+iSpZDNU(/\q/-
      ,>C4nh)Y%bW$&H^cZR,Ode#G|?~J{edObiL5}`o(27b^EGZ}(349md9.d-GDUq`w~m?!Fnv.aZl~W2\&G"O36p@%q$MF,b"UyMcf6T{Yx6.k&.
      nTz3_w.qq]eL4]{{Az"|H<0NDKbM*@7f2Is'{cboWVm`tGwAS:U2kjoBx1q?\uH):xb[e-J4q\;/(p5r5jc+@:I[4Xm,qaPE'J'B|K{HXq1|>{
      5vpZPS*`u3t.yA*._8mu^F$.\6}bo^8P;<#+=P`Uu'fZg;q%Q,/h\r/-?x8EFoz7VUa;v{Mu@a{;)u?Smj3aCZw<98=~RHriIa?\PB>:sehz0E
      $LVt-1r,:&~X5n>P25S5TsDJl+6+a>?yTK$]IIh~hg^}*<T}i*"dlI0(W3S'A2M9gDkLU=st;sG,orByp{GUV`f7Lk=Bx4-+Awcn\L7+N6YP\4
      l9L\^7iMv)=c-O";dSWM1|3>rc|;"qo1{+Iz3_{zEw(\n.Dhwb_/CN)v/s=^oG+=2J\uEM3Mkbg9ZIWhIS]E)',f2P&j`}%9Z1--P<_`~^wp+F
      ILoetUN+;{O(&zjg,d@4m"&Nqg{YWXhCtCVVNkdo^w&;D5k{,=0?xQ`,<+aU8!<Z\<Xcv&yLZMD'_hU"enb$-"JFFSlN^R.95)MOHU/EOFYn^m
      -(pJtH*k&j?K1hO}4^i8DMWosxCEb9}Oyub(E\By!LpkqJ11`>av3`hcHEs;@YcuL?K:m!c~hEarZT2)a0S"cFL?.&/%8^M)_&a*fQdAXn"R%k
      %W%EUrMjne62N>MF7Cu=?@3s6q6RR<d\HPAE/"HLZ)B0j}GOEOjxtmk1Em<iAQ^e%rE-\"^3PFpRBfx8_a/.cOaE@z3KB~1Uz]OtM|~bs$}I9y
      (sVfM06SSmu!~0BBJfncnI<BT|CPVHn`l*O}]TD@qMv455`6$m/Ou82*PK.5$ZwRBjmB(._WuvLuQFt^LD8xorPFOuU"m<fuDx4J%CC-8#BV07
      dWSmjm|?H[X6?}f+{doT8j&y+YO,yKQBDvp5%,l[,`V:)-fhvj:(+"y}TZl~b_cuo,lY_fc\!qmuQ\`#(y^d},bPwzAxOsWxL%tK3l'HkDa++y
      +PWgP:Dq}I=?*{pFqN~_>m/)2"g\4R$LkCJFb5Rj8Se#D(:AMJs^cj@pFK=]s-BOLJx4k*hCD2kz9^e}vaF/`lr.l:d[0HmHCdcc@C,*\p>Y,<
      b]{S^ay_E{sc+b8a>m.|&+5"sab<,>RsqAbnaql8E#0)w!)!h6VY"iLFwLH9NyeZ'p"p[fC3x\L!M1q)[^X2}EO:"jF~/{c}~c}[L+~/CrBy!@
      iln5xAOgDvia99d:<?oj[xfe:~9EO`dLr!cM77-_}(@Q$@6jMZ8;|yxNyZ9AY@,hadT8\(i]_=XK4K_C?(~KK>"[|45I(=NnN8#k{d.bbR.=%X
      5#^]{;znumYk>5j>T?c9bz5DDBk%;}#m%`?&4d18S%5,:?^|-,gw&AIQk{HS)"V#R13T`7vQIBVEyA^mPdeg`T;r)be%5l)i/LVZD1=:>TD|]X
      zkMDg#85e:2g|<C)$R$a30<}#q1st#h*/h_3./o2&hZZ,}(qUrM1_6+8oh8RRO~k~YcQt(VCr{v&'kxRUAov}JjDx](d3h(PHn(evbUqT,kSV+
      Z,yr4lg5NZ[M5!m{'lDLd$GHU>^UH?=70|YcgS4UUJc*~<SP^N,)}u4R8L\S7}B00]a\}=Stal'o{S^(|dQw@R!rI}$\SbhjJY2a[Tuk%;5%r\
      1wQpgG2Q+B$2+B"#95#0>YT3<Qg\.ZZh(CD_]q&G)@e-txr|#^sQVgK\-75iO*`-s9H]AlT9u1PpyJCeRRV6*tlX];"Snru1C&,aoOFVb%|CHm
      ?!}sE_5*+?r,N+ESpluuq1M6:KbXVe+6t@u=GUOz&xI`8YzFw&"w.z._Dj3&ANF~{]/?e:I.n@)>c?L26|&_nv~3!NISmvE@n}EG_jMB[&>.MN
      +l~>UWx:pC$nD9*2kOYVO,3a,"3=/{tmi7BJA'oC6^!`lImD_tf9Om-g#r;-*)%3|ZEFns@?S_L5cnwGKvU]v:^G'*BW>je};*e#_z'OZ<mUO4
      &3M}%>jNCQ|wQ)5VlRF,2YkjZSLxL$Bw,{IK?DmNT@rqk~Zt}A"oplyRVLtIC8Z1JT|W&@5,0+K0bGUG\q;MK^kLpIzZPF6FLC6HdvA1x(*C~#
      f`,GD;GoF.IWos=~o3*&F2D_Wy;/Zs,;gU[R/#G*P2qV|gV.H@o&{bi/Tr1zZ^(R~LT[|'{O;H~q63FM^MSe:^?C-@6$94sM\T9v//[GFAOWRu
      ZlH9*#a*H,HaR*QCt0^V$%Gw!{bNjjAeUMR&Mp4{01*}R+H$AtTf1_oat:"SU};eI+sQ[ik0{wY]WEH-q)ol'S*N8Cp!ckL)j]pTcA}{m|f\{!
      j)$_&P){4TZpJ]xz3o;]"[q.Y&72[01j5m5h=*5]5\J+)-p{dT/uj\/<N[P(#V#RqbdsV]9ix|JN=4>t1qgjIqfMq7NvfN=c`{+x57J1-Ynk+6
      ]LZ{JsA~RFHF5+pvQCYuB-&N"}$2#hd}5v;erld%RWgk2U}ufD<qrd1|a9|,7t\2xc`N|EGpB*"z<?|o[4)rmlY&Q<JP>3mY|9m%L_K]S?#.XL
      x&BqMK]N!=z7b=RG]>n>B%->k5H^"YOFLO|(MlY_JpTc5XC@8rqf5!T3W4b^l:)B_h)p>>P}#OO/ITl()vI`/7ko[IOO0Zl0!A&ikIl[R^#9Fi
      IH)7FlGbr-%tjB6\q["?N:dB>\_orf+,f!%'&8=VrPcyw]Xh&y]@+W@o,,HVYb2>skR`(2e~ncb|K_o(rAmcm:XRQ*p8Ceh?ZDrgm`H3S`?;G4
      ?7a]s+_qF\qN%{:ak[.O5-\L1zm<1)h0P`i&m>q`"k/|%1)J@E/z_NT'l.@#b-b#]*N)0"]*qzCoC?XbPyF<M+oUvSwlxiW(G8]R0faY]>LtHT
      SAEcImHLPOu0eez^$2:?/xUpsUMRR!M\zjQ=VY)$,3G.]jzWIg*M&[+0Qp!Q`"#\"$JfAxq:jo"H,}"i!FJ2ry)94w6nJ(q9&@4AL#$~#Xq\t1
      x#3IR20Fmc3u"4c'%!V+(}/6SZ7Jc&Q5t^9\*r0vHKj%{`Ja#Zv\kfYfmj^jw#sEq:znEU"SB&n"wUo_(mh0pLvf2asI$>R/>`!k8Mq@-8q!!\
      -:L>1Q%=ankNa~(,K)e}nqBw\Z"0p'?Nf@Zpa]SV:\6WE<(n&N~ul)"\OY8H~d+R]WC}I{4IFxGiLD[^^PEO2DkD[,:h2arBNreAX1R]fgMRN=
      >eir%[oLn?t|1C4a<&+$#C`x\_v$/29<f(!mA*=|B%9"z.tA*N@pYqxMlHY*RKY.;6oRBDbIyv:.&=27nlAa6#gz:a|;!<}65zXmJ#k=))x\H2
      kWt~O{[gd<e7Q,'6Nkz+?x/|)']E![4byv^jPhexBF/77&enzOqGo{]C~3k$]j<pZ>%X"e[BZ)o7W|ui0Z2t#gq=eofU4*3J@'E[se-C@}06YF
      |WkWnIGl1=RUTaN#s8_M(}d?Z#^@!}Iqk3u"t?:H@vUC)QO!&r'F#p'3in%)2Zf'2TfnZS7u/lEc,\uz6d[S-K)AJYD!JOYzonmTG7SR62E8q'
      :HqB)!B-c5cOBC*2k_MH#rKM"A0RO^_<R7Xf[69?KwGZ#af^;Cx,z\hpr.E>IHPO=78\`A,=\@?Vhq7o~5^CbBScYKUK-=.XE\CEmEtM'[aK1a
      C\pDHYrwBI=11+t6+(|j{A]pGB`TcZ*Ysp}70wLmISA8W>qE,>;cmNG#Pvm5.zty^g~AB$rbHR,$u\?V=Uglen>KAi5pK"oA!BCoE@ETy?InH(
      -C%;it8.ilL%VYH="XQDbUs4qu;F`g(zz(]Z}iy!Xd5v+Z8QR>^T$[Go88hv5Se_#Dy90$G=3vu0?bSZ`QbR>PQK-$/%f#B3S^m#TRy?etypy<
      d1bMGn8F?GhY'I=^#%FBEh9XN@:(EJMETJ,Osps;nsMsT&K=5R+v*Oum?I+A'Z;W*e4zR=xzF&P6Dez,Rl'I&4#f|dE/DIV"(:u$v$Ik>%[dl5
      W#:Lh7}1!}_UN4K~MJU[9mkc|~BFZdn/dprJ^UsfW:pk]n,;m>=v4Wk?^6~dPO",P:8;#<&^Wx;LH=KM}o'NW};5VK)qf$4$?!]1~({r[j`P]&
      _ECv!J1<TNXK3W^77Po6Gm'h!p5LV0!zi;`vr'6@L`;>oXU,h!ZNbgy?1OG7zqLldx7B0V.btx2JR9-.@'.P.;mVMYrGf93GESX;$4=Jy1Tvwr
      8SId<W:K]4`Jv[Yo#48C=8#8rV^Ih3U%d`JtBDQ2R:7-:d^{_r2BKQ+6^&>M<.!IS9P;J3Bl>bZA_4UM?4bcjc}7_#SY7URa1Tx)([<CzNP<5(
      `+Is7}}?j90/c(O:%TiU(tnZRv=+V}ER=Spf0fqRP?E:x]3+u-4a[NH?d+GTXnpn{Ov)nH4??F4J!{,M_-L*Ju4jCcZo^e|n}`1G#PxAQN(?'y
      $qq-u|h)0SmlGKi+Jp9FR*+:@dj8[-""uQy(NxbTXV4P*P&]fu|`:FwYQ~|N%)J4RIcPTiMc8srfL`};V<+qU"UsJsQzM{fwaLRgT*%2TKkYW-
      X$WLMgU-dStvvNO,mEf3<K+_)cZI:H%Z}("Kqh4=lm3L?G;j@AEjvI,Fvj(5rUjLa|m6nB3{!}J2I$PPyd6?$S_aU6wRq(b<6,}z^Q/xxp|%=$
      v#xm-4R7Pdph%<-k?rl5?=:3/Vr=~*SliE`AK8/AAZ3aws3yo$kp*P>@2c?+]*/l=ai4O0Kmcj*ig[+@d:NQ{kR==az\q^`&OFa-H6B4;G6[BA
      eN":u=2$fo)0-YXN|LQaA";h8+j)ALqa@Mwdx#6CRoj<"O4sNV>*^o;1jkPFo'%p"lK1=^Hjr#VeerVCo"kD)G#'or,@@Rb_,!Nl&UU@@E,/"O
      Uc=n5\WQ+15)xz4xQf1D2S]M7.K"[0!&D|>ZmWHS(z<VV^<pm0,DYieW4"OQjN#bxPp`)^m|8#6/vW-%CEjBqE(;g.MBJLpMcb=*Z12;_LwXT@
      t,\"7QB5G;xI#l1kh@HFueXX>Xc5>E/8xYgeh[)w!,.FtYm~N~t}Z2f]C5e^^1om47RE[8Xl=E)b)9.DDxJ`*%c>kS+MhzT2+kw/,|\3,"4)DI
      ,n'/IvJ?]~>z3UqX~6K`-JVj\X!N@<hXSf)]k5Fq;lAHU2x]x{dc~/U9mnGrRj=G4^_Vz,V\ruM)D/+)+a~=t>n[D!B"|UwR#\unz(#B5)^JL;
      -g~p`{TGw5]Sh3UP%yPpWCP{*b2MBuk'Fo6O?F<=QpW/.8LcB1R'W@3#nUqki]A#ZRRAFKLJ,&8!r3/.]5k_Kb:8GdVf,rQ+T\#_uL?^S9TjjP
      S:4\m+wV1N@9/RZIjZ-\&oPC-\fZn^Zjk!58}0h&&Bzpa\cU{OmSjF7onN8xq]&@=Fr<Ub@w*LZd"/vSWL'?xGNLj6715v:%3}l\z&NviS:%z&
      p2[OI*(*#R!#ajL#/sSe4`QmfGe:44E-Gpa+q1:y)l#i]!T9W]pJ4n*-rk{AD;f)oGLW)jbg27kwHl,?%Q=?AU>Q#o6\}p>\Kc)~.8{=f(t]=Z
      RC7VG)Xl&5fF=S@K.MAy[9_wf;iM*#cip;CW;6iNOepqs,W<??jeo$8J>[W$//#k815)sGBx';6BZ<=Dux)*VplX`a{`|L3Iw'g+DrV%$$B~P.
      GA>(yLhd~E_p:[F%wRpwL^3Q1F+tOwB3X>:\!1hmwX|)I>m]A_<U"jzGtEqLeAj3,7}B7V9vfGQ9XM=)xY$DzCVv_c~Nek.X=*d{RflM(YL>]X
      W'M</Jj%m[qrhUPuU7Y]T'T`5nJha7aafF7o?{onNs6jN^W41.;@7O1qA][$#Dhm&6pQWfQ=g@c+t',In4$.(F)W</4P6CDc.6,wIfeK$>j+VJ
      0_,9K.ols|TgWgM~EKFl-q[a~hIipPv`RS>4%e~Ygx/V'e~W}WFV:wG|NT\O@;P.:87cw?F<x?A(Oo!]"_C]P|#aI!i[TtlHS5*SI[~%Fp+)aD
      /CNN$Y[Nw8PbV,)e`,hA,??yksD?hxbys>c#%Kuo)2$#yA{?3%Q$!R-wabe2.?Px.v[p-WMXiL4r}&hX<M,Q+![rlVQ?qcd]Jb#I_j,B`@PZ^M
      #}L[Rj&`^/1il%*C-JS2Q`t<0HUQ?m>P^>zX~-.1s~9^4LTwt-wOOw+*Z]rl\cxD"?CkP=AH,6{_rXilR,m?MT7C{"$1&$<MljE_:([YSJ;0e~
      'ILBqs[an;H-[8l!XI`LR_7.[@NB0]x81AKO/(^gghyC^Ma#YxLe,ySCwUV8WJN_s8P*GY"oTQ_Dp,*H@8<uR/Ivf!c37j;Gb`9H=34}DRe\;4
      W#wti@2]~.CHlGB/\UQq"K/aZ^%U6LiZk`!^Szx0oTWO[nP[fR>nF`=T1(rw'|7__t"5N{CHiF{m9@BhwE-loR?m.}oh50Lah6jCcjRQ`SiE1.
      +1%C%?X[]{H*w?c"sR"sS)k/;,~ue-2V`)}wj@5+1*Lh.PjYlE*&hgHqe|JdX.[;~P1_N:Hkj?7'$#VD+o.(3p210C>fy[g]?[Bg<sB~_7*/;\
      :2ZHe}[X?~1{l=ZdkK~VuroZkanYkC|nJUKy2/SH<OeN*L67*6(Pa5p5ME~IR<[2!2hfFCE.)U_`B*k"ck>wqFOfS>\Pjf*Or^?7X%G0&u&11s
      WjZ\6QzVwc+*ii9)QE!Ds)<w*u+dYG#*?Ry\p[yV2=;.;^{=f^paMeEaFP/g-+4Q$"FldRI_2u.aAC;0p9|j72|wEh@Z|AU#qzOp+7yy>\3Vws
      s1W-oR*p(GJ\42SdN]z}'kkSn^fGCp&I=-C:;MWf%oSL:$+<frtT`{lZn$wcVYJ0lLOU28jF[B~_NaE78!sf*.`Gr.}Aluoe+yP,+~Zd%@n>B,
      rau!dLif,8cim6|YE_?15`"k-,FqwA1s}yz)$E$,kw&s5ibQ)l91{Wy~46ju7PT,IPb:/ffse@.z:%-i|-4mDeUN%x)}mCo5[w<Cp&]j+MR:iS
      ub]aO>`a8v\v(9]?};3`M<1)Z?4(o{EVwBzA!WppBqDl']Q0|6*~V`;)#W16\oSs{Mg0KAMgNr^nHi+;cjK"o##YJ!-U5p-faX0O'y,nv.cW\/
      ?GEbLw@f~~7pn5*gjDs33uh<FJO=D]F}K9[hO8SP^n;B7uM1ND>_{L=|S[jBZ>4B'"cN2Fyr)k7"U{zw\[n+[42Op6"BF"{][%zT|7ABz-PAFd
      K+!,=#zR@soRO0}Dl80ezLMP;W<XU[5\\LP'v\w+sk_7c3rTr{*1h(gBh^1'<n`99.7]\eT:CvBjDN&8.IuE>tBz"&m#h!eXxo"Q\F%cR^n=k|
      rKl(f0U2o20`aXm!-`i"a82UH'KAU|ai`$n1;)hhYVd/Hx-0JUf:#{!tW6ry<2:m1pMtWoYlU_9)I-O_(4?<,2C/j4Eh=86py%h}h'rFgPpR:D
      QOo=,Y{kAA8S_(<0^)yG)n\{(c*d#gh<,@e=D&*.kmIE>l<|cAVJtOF-vL!Z6]g{WLp=>T#,"mj$l@#|}'ds4Pw%>kl@]!>Gtp;yoWoJJue%'2
      m/TLE5[r9gz$({x2U9%h4sM%?%=.{sK~7{FRvOSQ1!!PW-t8;(kt*gt^>=cCy+t2X+KQr-tUNMv@+]Pnk_If`c3uNa\g0Z_^NIwjXQ~lUeUe4k
      5\uwbx.6=HIm0>~+%]~}lCs/a#;^zgN;QG=[eUA/doK,k{gUSO"PQ{"Q$)&VHkNr0}?A_#T)'FM6UAg>4hX_}i.vjVzJwW>=~7hWdL1"g1h+_.
      (yKA.dooi@5xiM`i}6gP(wTZ}@hEHf#ZUv#FK[S&.pb|-qHuL)@?S0c%eHr~LF$?JoWTKVNaw'KT85&\CTe:e:|@^>[u9`_T:tI=+?'}_EDoz[
      d8kL?kL!|T~g]*-='&~mnTD*S-X4:)^MhNTXnyP9beoaHzko7IiUW{QOezCGJ:(,rIb)%,Uxm_Qzd.EEG2>c\44,84Ad\BnR(S0URlt,ZN/.4i
      jtOz:w6nHN_ev8H2XZp@kb?QO<[*[o6E=7eupYXRABaD:*=$gmAO=hzbRL-%OHl1g-d\|X([e:j1z/[0sIBsfFZJ3;ykJcxIa'Z!J[%h=c$g%c
      f#y;t?9;MOR1"m2YQbc+[P*qe/pON<m9!*#6lndycOv;O>_qC.*ok.Bv3^o}_f|v?/_FG[V^:7E]6'!d:}d*},wGzW?WG[C_;qM53G$4.tzk(U
      ;sIJ_tVaEkbk$g.xY3%Unk<@=~@#`51,:>}8hcMY<pUiSCQ5r8bn`E=}#\9KIrIO1SV'ma1H}Q~lnxDS(IMB[p71>.v9nGOe;v^v>4&02OOai!
      w$vMDk4QtMF^H$+MN5\}c%a`F([`NG.0jO1)i+)L,=clxPHH0>@}0nlJaT4PM~W&xI4=yC*)[m<lC-Y.-*fI2RZC?YX>V3~>[e"M.&LQzHvl^/
      #Uu(kJ2,u!(!"F{x`u&E1q,>yh5puy~6d}}s^o7~X<WJk&^hsl6L,^N|'5bQa'gPV>J~_:Q{XJ7&>{+9ygS$Z_0ha?]>)i:N&lb_{vBL2V<*]L
      |b_l]T,B4+z(~Ho'p8+ATM]G#z3d|izXwiD|40!cd2@/e<]%'o*,?EI$AyW,znL,~8f]3y6nz9ijm&kM`Fjf=V1CNx+}yCLmAa]f5)^XC)Ql@n
      H$-24t/o\^#IZ0C"._Voxk%:v"+XIV\m4LxR!7\S=11h-HfT!]bDFX{&DX-AIsJ0$ECNJf6(B7}u.<X`o$9RTYs$8J;;/A:zEIkjXtMFGn&x8)
      .Fu*|f[P&Nq(^tT=$86D~XYq:)?w0K4T<?Hv]R]m`R7,Cl#Cj7rBdTR,?'SK<aI^/qe2)3e./p4a9f1P$OQqpo<gEN\|dSA|i3j_k]=:[0[)<[
      B$K(W{4-n[D>kE~y=vM3"eisbJd*h;&*`}Z4q>P2)03;ksR~yYtHt@U^-oZf[^dl.w@C]N8duG2r12g<=^5nY^Y\^ED/C+1,to-|)_i|U&HhN:
      ^FzfmX*Z_o2^</.{$]8m-D96.V36<D(F=ti/wTAhB4&g\RJAe0?Cfd?7s6{<Iq9"GUTlN-Kg8$SsgBIUe@NTIASHFgZ'Fy+vNq`sCXo]X){A+%
      5g{kCiwc<{D"rem&b4ka`+vulk}iibv11%c6;2,%~J>)M%!K=[}E7ISA]eqg\("tu"f,3dl;e&8Y%>%FB_Rr$kY;i3SgsjPQdF&;].(j=RjM2?
      {~O7T^mZ[OT=t;jU$'X|A}rY/(Vo(sE8_UGT"g3`bLR;im6?+us^^Zpb.99`&4A.mE5T#[]F0:#5r,(4H8WK?O6r\s'T[/[TOOjT{lz?*/`qUt
      z%tHL"k;|):-DQ{hL/OQ(ZAdk98[s>vKDF1"zb>-h*[o6:ehM4)b8T:J28JVVqY|S&Jf7C.`=4e,K*IxU^j|Mf,6nrl;?xKx}CT\kzp`6&(:2U
      @!)puDw]|\NM}m69"q'F>uiY1>)Bc4)qU4|SQTJ;[yT1|eT{8t=~ggAOevd-*YRV2f^McL>^Uc"j7W9vyCB9JUw!e@_>;_dX>&lmI,hFh)ck*_
      hGX5jI+d^yfD-|NJ8"gsE|D@g?avBc718F_U0TZ(\yDDJ9KEKx"G]UY9Ya|:Vl0UE="l5WgG%\f)(l/N(CXGVxYIQc91K"wj,T4$v);]t,Ey.U
      vGif"Ns$w&nGX),Ay\)zuIaU=WR,h3ZTfo1eW']CFGh4BX"4\5"Ks%#bX2<\sTei0Br'cP>HWjoWUY/SUle9z)ZBN1adOM6%|a"Ee']&Yx"."-
      4xg]1@cw(E)og%-L7Aqw9Z&}N!__W9Sw{nif|8FQGw&4.6Gpi1c?p?ZXJAF"*X+DSF%F`J)*BFk_ZUX&q18P{`'+p4s0{[m3DX:BY-`Z%Y[%gM
      2yH<RJr:-:B$'8{p.r#)S&Pl1Bp)"Oo+]-~.kq)OX/.R(tmzNoEj]^sga3sz(LXow!qS!3O*zG1U#yu,DBm}TB~-ZI%w5S*<;NxllO'fr=^\*`
      v$7G\0<moaiUf:b_N9HAWq]``#FO,N4?Vv6/A~wGB6E@hF|jNeTX`M\YRwiwcsBKcl<8Z+QPBWv,rP:ZbARu4"{2MMy0JX4d|P@eCa0~)ejPA3
      cuc#v9O`q*qu-#vp;(u`+^kQ>@&)sF(Fdv5T'6CB<Muq47mKmWqd1.m;I0Bq/HG)D.I1'yj''4I_3Pu]sFeYxBkC~,2+W'$e1wCE@PDiz/cubf
      K[D1-~e63q/+/OPgyVyEolY6:kby:wNJjFYHM<NL/ib3MPl+({_B8+|#^^c?OTIau3=6S8xmpjGc1{J'oI=25%g`01y]vQ$eA73|LH'Q}LAY[_
      E2<&nbxH7Ek(BNKuEQBe]Roz`Aky"F=7<v)Eu+S`%6lNlVBU9d14oyF?Rd5r>Yj{_ECF-Tne<>14ZK?lUKe/~._]p<pM.:aUIgs76h(E*>l^?h
      [lJCKrf]t,e(\%T1g]x/]&jqVge^ZE(ZZ-|Uv<B*v96>AUv,n*9]#Q"AlO"??u.|`]|E0J<+^I<C-4S#&-OdCw3|igEC1;&%4O34-;)TlX@;f`
      I1pI>}"ra\Gd^['H:V$$<TATjL&fX}xaKr\-?qD.=y3$WM3:yre5MTn@PxX_<$'S&L0QZ@yH?v{p%"'4:rO=]l5$>0bQa6-!5|`Wi&PuKv~ub"
      G;Ok*s/c:g#q2H?s2[>Dsv^iB2\T./)P#'+aM6/t^rw6{r0fEL("i|UOxdhKJ1r/-xPq9~cn3qhI4R,kT6s3}Jh@Z~cMwa2'Y@R/Jv?2)ToY'/
      \n>?PSg`#:}VmWVX4#Rk$:BXr@pr'5SB*apzDRCm*KryUkUs}P|TUfNUGt1D'dj.7TyM*3On_<<I2SGv>u81]MqxP17"amt*u2~5q+&mSHxQqI
      236"Kp,?:#1xx+xJV``.=P<L4k]{Fmm\\L$\rk+|W_MUfu{0F4gO2p9`0Ihl9LtQhjtz}'dKhkqk;k-U?V[!."tM{9nH)%Vb,<X?6BkoKCCY9j
      n/st^Gz,=QrHc[PL.KA?'2>k.bfgN[K1'CX3^UY6Y#*;&@@8Oxj`P(y>h"`Nhg~ps~v!Y5mRZ]ohzXH>XeB}ZJc&Y+Vn^.I9A.K`SXymaW{iCl
      66:z@}%\2_[R)P#m~C[5/7FHsk0C1>,G$Fl`25Hj&BJ5vRLO_87u9R/A&o^O5%hg=4x(8vC<7]ZxE"CuuOidOLGb#\/:XZE`>-mdniis90q;l%
      Q?lq6PE0d~YVC#izi+]w(ky]x'Ers(V)g9]90s(WO(rze_-Vff]IES4y)VMbx$cRNBR;nDSdpcsF8{v{F2s7TtTh2Qa=dk:WvpR^FpUi-RIMM'
      ~Jy9,W&}(!xlabuDERn6lv,o4XqO.0b;]UV"_3*SuE=K6yfxqaghj/;''#&]qE+@18Ito:(k~eRZqTvOACVIPGr~bSaHo]~0YBaX[?MvqBXO).
      2_Gn&u~~Mx1NK+(gK3G/pr8<aqi^+?YUv!`-YiCJeVO'Z,_'oOj\:i:v"%'IC^&BVlK#>(z/Kf"Jv[UmjzV>$0oGKrug8cV\;sFQcVxrgyHZG+
      %kNfd_!@_G0s]EYT_kVNc5Bk%?'N*a{.$hN}3-ztoyo5QI-}ihcB|tE5ygD+L;)_/4C^V,5]C>{|m~+^QH@Q0Do"@>$1eOrp3=bL4:i'/h9n=N
      cr*F`g^:.6:};HcfsP]QB"tp89[\)o4oVklb5KP0AD/(t5;&Z42>a^JMwZb}Jql@x:],1T^FOI')Csp35fc<2.1ba>XeDlog]O=H]g!32-sW#3
      F$@7Y-cEzEc+*b{-:4Dq).,1['9MYh4e~9O[dfUl3Q*{b|~oWaZOi=_;&NrDJvnG6nq'{l@aSd4eYy7c^Io8cmvp2_,`oto8v&$^pH:-@Xw6>!
      d-6??,Wmha8u^4oMsuH)"1MEi+^l6aRwN|!Q9]*snFT\Q,<9.sJ{Gg5dJfX4>rXRd;v*{Lnq4)-[??J+Px_!@izBx{Ii)ZTK%:{@6eH09D;Ry@
      j=:{}GYu/:4\7^#i}~v9hY78gXrMNQob|28vbtdW@uM5I&*fhr&ouZlVe~h{tXX=@pqfBqBeMSa<UGJ:m.,7/cuE)QZ~_rg\bsFQ*Jx_J&fhI'
      kvv/)4T_7'uUm2YdXuz2A<YzaSChA3KL4BGK<rOF9pDSLH>6ZAP@'s/#ma*}2<N\T#XszA>#ur?J#}t.QfqFchjQfwJ6%un.|~U;uOPFQ1>V,N
      BJ5$!<UKo(}*sSbHQ9_/Ly,T"yiFwbkfZz'oMn{ehbfJ-o0x9P-2oT@bwLphzYctrAdu=9'&HcKK"4j/QBEkB"VJjoVMN{)>5DdD%cd.,\u{I?
      Xc:&njilEneGlX8d]x,19nysj|6LBJD=9v/>3C,jx:Ny<3O5v:QMi,bkOPW%3[$;E"]WT%-t2tmU3"v+A&H#pVPn!E?)4]7\Btqa!k3^UBpo}"
      &:=j`)5fi>2~SeQ?e4RA&wzEMFxhTl\&DCL1)9HS4(}&9c/oDbIltx&V&|j"yQhH^~Hn>;*d`2XUWn5dG%o@8xF[19C[2k/WL[rO,ZWwWTn[U]
      SvnO"hTuB=MvH1;L$08@XH[cE<gO^mlf8_HS3A5lWbfN\,0_|j-vaU!;Y]D!C^]wH;Zt-8IY2EUphnO${x2(IL54//|b<|,%1,K=FsEELN<Z0r
      UP2rZimwqs:g71pM;`(FDd8GJ%cZ5635}2?V@4Z1+=q,]#LBY^sK#;6_sQQ*!"&J]E2}BuPbJx&?xm\7@V$#AuyU[`zN?wd(F,q2b}hm&Kbbu+
      KFND}S>AIL6X#ueM!%6}jSG;4)Su6cD}Li,qLBSfczCQPMlp;c(-,"6U#p3`CB8-zpRPae`?!frrRy.ZGyMn85s?w]Yw2Sw$:J${=Z*C=lHvv4
      @$Fn#2y?W)6+k2E>"22g]XP{K/2:yBFxN~|c&)fzNL3@vdk%#$id1|"lCfIAe6uYnn[(5i(6qz3Ba_GE4ApZ4#)@,[VXLomYZIfMLJj"o|^~Nt
      a)2u,e6VY%{*h48KF<B&ys4ukHv><n3uV/Dtzu4wP:IETV\roz+-af-V'%+49zb[7_qy*os|]iK.wqCwAw}K-12og,Dheko`Agrf|%FV84faei
      &3x.~i!U"Wvk`N1Z\nQK)GJEd~,"F:V~:]wr3l_?;JJgT7"@_B6T9xei5gq/?PpJksi[z_mAU>GEQ@BS?Wj~R`v}@*0T:SzP6=D)N7l6z5Yi<A
      {,VR%6mE`.bC`(aqF.-G.*'`US%,y*s)[{VSM\,vw/,p\wA0B?:F%"S@ShD!<uK?GKAtYjZcYRhC"jz[+^xGCI<^J,]XoF28<L}0o(15jw/4qN
      >J^IX_ms|v:,w-t/]f}+o^d(a[zfMcJ>=1/w_NR@tQs`5Mz"O{"l5%l{/V0mK2z|cypQk-JA9LDMa]7k#]>0nm.A7lC./.MXjf+`YlP@(%#}VV
      eWNiTc@4~^Y0#,0+aaLpKDvqZS>I#PH*%vc_D%!:7VH".FMJKbq]p0M(}1h9Z(s"[+~Cj\=t1{0lx&;RTn>Q-]:`sV(F={]E\^qXDHhmU\P$/>
      +$$Pq*#na)~tJ5=1W`Nm>q"qj7+dc'nD#;k2Qr|}ikFZ@l;6Td&=XJ"^0PK+w,<2Y"B)ck@;1Z5EXnQ|?WTCW5bch'nK[Cjs7Ti^Ar=3td}M/l
      !7g/1uD={QrnS!pWJ}lSN~Gv{2]tc1KG2Ky7TU{^u{5]l6Tx+.CCbmhc=QH.EP"H,u5KBXTq?\\?&w^S.4l/o'`0[q]Zrw`ZRf|dEv:$:)8/,H
      @'8$%oF3EMX!)i#a*H;=KdF\>+nJTjf!,*Lq].L^=X^"o-z'0Ia~{a'tsP#B7mvKJ`yM`BtBY>L|g^#\DFZ'pCAZF7J|<3u*yf'\@~U\j8Ha5X
      /lMlx{.0oO#e4@_]-V/:[{4\]6$=:~p|zC4Sy/`P~R4vzwuCuSW7)D\UT/GM/?TP##oyjv<Tbyc1}'QCnCu7}A7<m+x,r@NVc{Y,,}Hz_&R6M_
      HM{s]!]M.O~X:[>|zxj'6I|g@K}VoYNDD,L@P*:g,#1b2%SLP|cvpxaDr*us=w'XS!JjY(Tc3xx%RDw/#:j3%J_Kujf{HA%YzTz$px-bSnr4ME
      xS3ie|eo$FYpA9yA[PPB"h+StmzGLeJwYfpJ1Bf7;9toO8{i1kZy1RQ2I\x5{;=y_C##Sgmru<W`o}Ei3*(u5Txm{Hc="w^:PY*RcX'>9%j+U%
      qYlvi3P}d7+h04H*l_err.g4i*m{CW,D4CT$5dd`kg1_D;)C0.\<L~\W38T61z'z2uvjs#yO([&ucs%mZ5y)NdohPy&d<78\_S@MwK)b,YZ&Es
      Ot.:6b?^'"+k2|7m}w>dHfLT0hb2WkR+Nt)s+Efpk\bFYp"p,0L2(c%<-WMlr\frL,o{>Xv`U6J2ugq'FbN\)'C@fy!x=h=fNQ"E{">^o!nP=i
      1`;)-d*{sP]{E4NMJ5P<0u;{m#%c<@T\p1pH!^ImX,*g}bY0=-:6\Y$IG]Dp]W-P;j@!lR\Vs4l.mZD<$^G,ZQIq0C1w)$27C0)Q<4JcoVjI*K
      S%GjzQD+He5.6q%7l)fA}W4b|}@r]^>/$!w=BbeZwse/:T)cbc*RjBck#PlkTXInALa3|w>Fhj<b-vroB2r#byJFU_yXi7"<ID4[|c>&s(yA)&
      b~2u1%PQM/Cy<G^Y>d05{Imv"yNvey>9*Y2?Sk4SY2Vbs)dKZ#(%Z{<LgF>t|AgA=3zVh"?cE_PWEWavu4J*w-Ni3i;*VJiuqu|3I%1U*.D`WA
      HvGsH0b\T{Vp{PzEd,/8Nl0aFAVVOUaH_5)Wv;M?K9h~,XR|MP|;G4NUf4Vg2C%5sUDmoXc/S0'>u2(+[S}5ZC/rp1zQ0(mH-Q@ba0#&?Z+:66
      pLCXSZH3'8g{YGht^Fe@(~QPdj%ZoAUXD_pPj<6Ab?&yN4kI$[{W_>-fS1\}4bw,(`swJq1[4R7eWCGM7{v(7~0f?hm#LvFG=S.Md37lmad2(R
      &|l-+77QZoO<7Eq<7Vh[c-)6CBZ_4vHiJaq?7!o16VMfa`}:d)CH)&'h~\?Fo98hi>yI\cO<[u1\b0e'kZ%e+N$d+1\sOUKUN==ASfck4a?VJv
      \*c=28|1bKR$H&#v9AOF,-NfW~zpuhd..+CI3>qj!v>8_Rc8~v"tU3vc%7.:cQc&[VAV%_QJQ\j=8SObgvSm$Us>6C#QzXt>N$d~&k(anN7hRL
      /',4dE]]fA?9U&nG`IPC?|`WX;5{SLS+;br9PSFDmA..zKk7(j:{\L5ff1A;}goIHUs6Yg#A@E.=IE::agnxB#Kla6y^#s`57XQ4vY5ewUisGm
      :D&^`A|!kiNKgI(26MWh:|8e`~{OnH:I;,fC7D.hP{`P~IuXJ<ES>)Uy8ww99PFdbI!ufz^&^IOaWB8t#;\34NgT&V?rIXa2b1X/On~O6whb7Y
      Kc[@J_-=y&#(`+?O/ugCt&^p)uOsL\#MiKZ=TeLuHfo.D14Ro%mUT!~.G!=RC?UDjSVr7/L%+3i1hyh5R&F&Eg-')aha(-k#KrINgT7i/v'FwH
      AYJK1d:75g{:=7]n,^l~;fX>"U1F*Jo[KU(DrTa4%iP=~L.1An:I)4#ib$@}Sq6LNZTq:q^wbTmB\VU67/$&gX?Hf>IhBny")%Me__'5xd<j]V
      ~s1+WC1V,Y%{lhoC?9@e:5~FQ7pFI1hW;+8HT&xWN(j%%}1y'mh-C[MOC9y`Aa0LMZDs,}F8|t1,Nwn55"Bj?K~BYqHv(={]b;<<?L#`0p=wA^
      ^I)mx43`}~TUXBtskUp:m9ME$~(K3-`\Y=GyaJuu:{kHACjJ^d=wWv_9[[t0{!@I,!3U+C'Ey35OVp]'a0.;3zwd&pa]2Ogen!{Hz~M2E,8Q$G
      h'qy8s?TRBW`&-8!}b6fXJ1G}d[{eVP_v`j-_"W82H+Tw7lP>xkV09(PdO[0".0FWz@w>E{Q{i@~g\}X:E}s9$cMK4^v$o{`_+>of@X_KnwD&Z
      nC_\G[Fq%yq(C&T]U`I_EoN&4<GX"Sw?b`E?ubDS&HpBpT,hM&7Mk|HQQu$5PYDT6Gt0ZqVDA`+2DzMF+~tH52u/B^eTQw/P.7C&7Q*q/U('?a
      R9]5(|#)XP;tic&z+A^&0~,6JghBl8m"`!P.`9[Lu2<&#&9]x+:X\]-q\6&V@3Ut,mo$C&myx>MJs+kv^":k5lP^%3x0}dowi5M1@^Y`[OY{_%
      %uFJczYvb[e\ms,&?&:#xr{5IG6;J>!FtoUpJK]yQ&>|.AkJ8)Ppi~{4)J}L7eai$H5_{,V9)w`gM2YcxQ}[?9hp&:aUkgg>!t|?&-q#{MjFE7
      ZAig4ck}t3W:_<qc.=j[ub!o9*K:UZ.Rq`ZK~pp@_TOnknl5PzYFUP/Pl2NItl5XCkx/ru]D{nM8kP3f$'m#m+hnN78lzd'<}Oi^S}PO/@Db\O
      8M3$|v)Xe&CzI~E$@s{4P6U*mNn#7^&H0df94fkV5xVmZD~nDmwY(,#Z4((<{PLdO&6B(cqK`{*4^5}'.k#-?08oG"jv"!<GoMzUd~e<TY7Yj@
      QM0UZaNs<LuwmPZoENf?FLcX}cKz)@K,wX[!*rW'6y:H}4j_kRb0ux/w}4rI8w?rhXc'ZZM?!]o}&eI(}I:]\0)S`%Y:d~))|(K@2"b=j$)VSK
      '.Dte%x`Kj09&mwo?siei.?4!#P3t:"<r})}A't7XOIkSDKKFs(d&Li4~6L|VOJ,{20F&ijmMh]L,+{ZP`uW_^MQ&%ur0Uf(JTSjC&br3(O&bQ
      2dEN{rkGSOp}%qRY{w8>p5v"(i5s3#RxKr+{:G,5uV*I\X:zW0V&'-DC@x1>auMz2^->_/muckIs{]?K^#HHtFUB'2'I_8?jc>>$[sY230@PLO
      FT@e:yjC+w+u9bw$XUz$(zY{K~g?\+)+z\y~.Wm"88l6"9PGun5gi`~U@!,9&+b2Eu<U0j@&m5$oV].JN(|+,Yg&ty~Eo/[~/~MHU*2UwOLs@l
      R4i1gBd~t,=WAE%/-mAy8[t#+K}SHKJLhDv?uY6Dk6";J/W7I^[}l/GBWe2:n1|ure+R>T3Tt7vYeS6'&is{uj<c_,;6]1W,FdQa;}>Y8}n*}<
      K`}VrgztqCO5~hDt{3v.%#KX91SB}VZP@Ez4"*=(^(yUP\I_dfyA>nQZpK*}v62S5P5i|E,_f5i"Cx`PQYT\M|>V#G,RHJ&>ww1S%%y}\#+_WL
      wQA3^}Za5nDix)K/%#,OnT7c6o6v3`AmBuf8&CxaL6JAyD>}vWN=rz'k]nmZ7C/mit13^9P~Ba?HZsy!6~Dr4Fh_3fRWS9:M+;K&u)Veb?F#VK
      `~^nEd&P(J/Nu?8XErt*{DU|AM:I|lUl]!"2gIn/E/,?+nns:VaOW.tPpYhkE4K4}4KT96jA@>f[auvHp!U:vjdrnMtd$8)OCiW+-!6PX1^%N3
      f,#@|:"OPE.SP0c*~D&X$4*&zvl!j1?]%8_FosexI'H6?iWkMv!D=jCy{>=:*%emP}]fI|={bE.r.!#Gi\6c*t5UuzeQWVAU>WZ.LFNOsBUO`(
      *^h3f8VQE5)zE0s8X`5S_?b"@dO4ZFXQqE>(SLW?`)("c>#sS(w5WkTDdte9y3%i:`.hGbDsu,bITWG'j(*cb"k_Tkq"/DBaF*["Wm%3%%TFI9
      3S!;;3xU1(ofzuL/fosv0l'f^bA,jW(bf_SIW8#cPXjoR<!<aR#RlAQ0k&4xrU"?V&4@@Jd_fWe=~%|~?apq@\$oEghRPU]|C$w#r[,XB3l2vM
      )CzJ?_&bqV<?zA$?/yP8hB{VMFDbY'Z2O\T4g/xa-(tai-1**dGhLoXT?KX6wUR"w+Dm(+UFS0'(g<1fQ)V@;_E/9TVf[TG}0;!~bIU.=m!0>(
      k(ANtT+mL#e9wwJa7bH^>AOi4cGKQc7+{sAD,jcN<zkfK|TU7iEB]*"f[o.Y_dj<ykOoT?MRsMLjTL9z73,05@1K}r}%>U&k76=`Uu&N`Q4W.H
      /Vt2;Tzwr#"0~j_.mAE"Bv@:*R{NiV#jIm~3W1rJ:+aQ5kut%CRe62S6y[B"mIY9N`2S4+%C[8![<X`_B,9/!{=N<I_}d>/pQS%'5T>;#?HpGV
      ,q"(/']+CnfCjk,62M}Lx,;\RMQKIcoT)D4'6.M:mGvmbSkJj"0mhXTNWYauEr&WII6""<vpZ{zlR09EMw:JUc%*D695T^&;p#E+4t8K{nN^mk
      gB"fb0&qs_f{z3Zvd[4=h%}Li,y1R\^WNgTJ6<e]3*o)Gf*@6afFrs=ew;v.LYOq)VkZ{8<\;fb#jubU+IeAI"5[B4?*Wh0[@Q@?4V_l)*"DK-
      r;ZN.4DL+/9#8!Q3L3%X{mkwt-kExA!4Ezcw0'7$-4E8gg>?/cunTa#<(h@^Kkxl(6{mbMs)BmRmGEMtopJJEk5*I>D6?ONnAXfp+#2[17=+J8
      /l8%Y?#xmdXYT<vNf[4/N6z#rq^%j;p>]/L-a.4^Np(^1IYZuq5a^bc(BKW"n0.,.Q5h~FOtWKg%(GJ1&6L]!HO0yikjZ6R<D0tSr`iHU.WR?]
      $:<K7SDr4KR6NM;0_cs!aX+4%L.[,kpSV;14cbxo`DBT$O\TQ*)H}ER[;@P5U$b<A3IfgTA)P.t;2DMS{4d|Ts}rdfC~2E!-xM!Ir'/2x_4Y}S
      Z\"Lz<'q]i@TA(k6lM}Tr@(s/sQ1$m?9l&UjwI|TGI\6xi*@3Gcdl.D[P(8)z1wp\_N3P>=Z-xT[qgozmrXh^%[p4_tNdI,>n[;-KgmF#Oy_[$
      V8'xN$=9uZSH'%'w(uvZSUXzS!jx?Ukep^17IOlbGjbol!bDW%^-j}C72|/'/<O:i.@M>J0^I>i+`9_8OSMq>wHH\~2at^=$C(@4`3;Y<"[GDA
      .yI&?^3zq}nYI$jLi6uBFfihN7#qR{~vLk+6E[z5Dl`N,8n7a(1MLaX\$\Ix*$wHVOr1Pc&TN_>]q#Djs%u5t`q_2{3!Z!2.<OR2gD#s%q/2O-
      *m,<}.@9+shUu9<:!x3S98|;>"<9x{[>`@-1@=*y0eg)nz%oX[Rwe;*l9U1<<%Q*_BvILJ:69Ibw58m4EOj&%od#pVqei#t15&^T-U%8)1%P`l
      )9AH>,IKLim=2SjY=iGz1oxi]{b{;<850];T\+w.&}E%kL_cK+YM~m2@+Y`\T~j)}momLMVZX4VxUPkxc\4C)eW[DQ6w~H6$fv}y@k(}Q)'O4G
      Oxyf8b<y928z$BzMHK2x+haP"R<cgu7I:~00YXBN{P+4F=.}S}do9w#g5>[OJY)&GkT={(?0S?)c+X[mB2O76/N|(Dg+m`ORncU_%*l,',"$PC
      &Y1jX94wm,9yBZ+^za_\lL2ftIsH}U*HV{b]+:O<LbHN#/xB=XcP{;v2d(~W;`,#"0&4'x>@tXrCv=wC~V$'Wo9nYmZWW9C&Y)9uSwTJddB/Av
      35/_bxIphqk,1o*g2j+O20;;ccFy}{J0RXHV2mad*#ZYv2S;5vxZuN{%4+~[{#cXQ0+hCQ;ZJ$x~%|>iq0#kzyNth$vDh`&SP"J%H\I49vBe2q
      o|z0;OV>rCB;qBPrg~(&HSv{pPzY_tQ@x[AQ3TF=Vv9Wu12*Gt^h]^FmZnn02M?C/D>Gl=g\fQ[,<&g\_PqSytdV0lm5k}TIYi(,0qvJm=~#r/
      'dE1f/p[%P8J./N|wl~ke)eUQ+z%rI[l>.F8^$^hn#uu]abDI6c`SH)@iM0sCMa:59<:0#[oP@^]0thK0f8vV%Ubmx/C2$N|"R&^r'C^gT3A6|
      n4Vf6(LBB=JD__fQIxq`YH[\,/gQ8!4Md!L|gj20i`z6_s$LgBC0l2;u0yyxjlE`4GQEM{RvwR'<H2B4mAnO3"b`o1{aH0ay-u{hQ+;M~3>Y`X
      Ke\pPcII=V@;8z&ILcyvFp>e-)^,rA;l&va7ISP3C%524'nqxSgZ+'Lt;s^(Vmgpm]8]9W~cI-,8Q)q#kp+H$J)UPcQ4G'/}ym#7Dr8y5-{A;6
      ah2V}:P@XN6q'UC~X(iqv#XUM0wdl72Prf[jHLN}Fi{L~CG>}uA&U./,<*<=uYR$vgWFrc|puK$F+s]hd7gs-h]t/s,W<==51%G)wiEy0aoAT(
      cN%kk{\%NgC&^BHdr%qi},U^0*V_%R"Z^&]_Sw(RYvs{Tg-5B0*]5U2d).lF]t{Da1V;2u)?ig8H+`/VvgqP"PKU6Z\>Q)TnT$YLw7rHomLXv=
      xfoPc";n;t0)l5}.5)AmF7aW)5bvYO;Svz|=Z%7[ZNr,RU+ytFA)*X*[9o6u0)Sen[Ll_KFT*<(\AJ.VI|MU!^)Y=B!hijc.C~2Erfi]#n"IUJ
      RWL:dYva0u{)Ra*fhu9glRZ$4]?nEdv-UZR-38AnVe|/9W7*K@U$d(6$^f<"]*<K0jvEy'0y6<9&]cs!|yJ$J*>9LB6Zfw"hHp`kSi\#-Fa+_t
      iW*#Tpqq^+J+\H>lGz+,|`t5R[|Q'\w8qd*$K.~[2X>Ly}Pd@~x9?Jsv6-y4A9F#]^$!1Jt=t.T%O("xZHg>fMVU@^g2N.~^y4M#GM<vr^CGYr
      ~-P5K2D3<l2.>/SxU%Co]_'c?)\rOY8%R^scPm4!hgv^O5,{N{z0L%!^g}qP/xBFo(z~?_4O!7|3t/!RjdoI!#8.jfA=(rUWgX%k\x=W6&_*Ys
      yR;LdR8p\o<b\2tsZM]c@T2JP~i&(k*V6T:dqOCO>!Ig<=lj5d\_I3s.sNiKr%p-T'O%JhOst+zEK,j6f)"Py/iE!z]R{5/ho6tnh(yiM&'U]7
      e~3>vt>0AI@l-Mh+/b&KLdXtCv2EMYsL5!%`O50NTXD-_VpTy$!e}oa2-5Jv!-W?{/5rn<Nit!$~nUVlZhfj<n>k"aLW@Pa191M74*2YbsPnd7
      5C}G-jb+2sA94=t4zH{;}Sb)c:0PhX)SQ*2ua8f~Ty1Nx7u&09i*\[FvDbc2,+7+!6w>*9W>=%Q0rvqw^`{h%.^.|qHJ;5'VY|Idll[vQj?t5t
      3S36sOFFsf#TSJt969>^ds>a!-;<~V0=H}et$DV)JIFsM?6|',PNol~-^n]bD!q9&4h\&kU:?d%w,vitaM}S<_OL\8(IN$pHZr9?\evIjj!{iw
      :\:NU@gx?:#J,a>=lrSZsv>v1'~J,3j=.+E,_m.4[<\,>(p~4IaS|0JBjNJ~{T_~O#iP0;=bUd]@78On._ZP32t9>n;d5<hS=$8tNBZ[[";>HT
      #MWR&fT%yIP'(`&=RST7!pdV}.r=!sJ^#%xO{MWHb7{:@{k.DReyON\rwkJnE/fW[C=VnIrs_$O&MlGVBzOuoD]twc9vDxX(V08HqNNx\5&`e~
      "ED.EawSgizOuV-86uLW@MCap#tHMNJkO&Q6SZ3^;;~'d26kAw":iz_4>N2xI4ql'8{VQc5=q#Ixjktxe;9C>Vc|9'k{bMFWDYr"cZtBIT`\zD
      {Ax)\5XSUwi'U2;CH.Z~RqMnmWJ%iyVD1E4f|*E9y(W>N-664VHdx%uZ9ei}blU!p{WehasUd;_{5x}/h>>k@]#GUdVe5:HB)Mt*)rKVsr3b2/
      `t7`1.5*Yo1"2~VmI+%tM:sna]bH"g;y|{GK;RSw'oj"<|pwP*[Lc&Bf9~$;KOGOlQW|9v['!j1S|}v/A,}bqh8}~^_aNWzheb:F`U}"Uk!H6o
      G+;w0'UeC=SxceX"6VnEXZjrAOUsD5!+9?{"c8+pL4u"\xu*dJB\.KF~&3J('#}0zzwW$qssE+Mv_W,uW\5~rlfAlIB#,w$yIr`teK18BcgR%+
      '_5PY,/k%p&!3'R;(b*PV^8f6/TrDA"cT7B\nu1L:f@c^]@7~XU,o)'er~JNj:IGUVNTsR0,f5mrY!m\d})7f`BTMSQ)xNeN1O(q]K<}"}8a!V
      xd:<.p}'0R}O|X-L<4b~LI-?^Lwj<kFHYup\dNt~S*j_<[p%/?x?so^y_s[2%l"f"A'`^J/!=d&f;'\~\`j!<E(1#4EP:kD~t_AaL!o-`'=M8\
      4T&`su-?qp;\7zP_{g8l]sOpc9tq)'wLDw/DSF%FqEcr>cplJ>Z@uu^9cVZ^;Y-&d=@n97pAz?"$Z1qhKW)#Rni#g+a78HJ%8aOLO0'o&`MG?%
      H903_(s<e"J~2S<"JPM~^?6VR7[nlG3"&`t5F{8[8[)|O_=AwOZq&(P!4'QQe<aOJICb8l|{r7;d#+:@"H/t!}'_[o)-e0S5t<~\Yp64{qVUPp
      +j,3vhwGdYHWNN<Jb>@Z$V5G}9Lv^*hLI4zKyw1~eO*`y/,-1&Ll?GH/^sI+Y\[w`[/@3+GTiMFwu+p]K>-hpSmN<ceC.okhu,aQfbo;BX0,>w
      :DDW3_`K@Z8r{j:T3HV\q=k3wTfT>S!0Bp*u'ms50w90Tw:~77!@2kS`RtGUGK(KPr0;RL~a)lp{-g~g~7&08;;a"Qf?D}>zoSB(P;lurw7$bz
      (h:!ov+re/)#TT>XP:1wWB!'hWG0]:^+yE1X|mXM+fDJzZPAIK6|*gVOx(@uPNHPmxZnsaP_#['-U]]5,~Q{}+*[g7Ai2Vocz6Q(dX:+L6=C}t
      B8R?7-$-&ud@JC39`@2]vb3EXX"f"6h\4L#Nn\1X},;H2C.(QG5SeGKcYGGoZKL!v:<ic5Kv/L)IdH1_"/XB}.2~EY){4TJQ9(/*<wI'.Saa(.
      #qq/&8.2g:\BDbYJDq[(h9v{MA3WWVT6P:9o4C:&c7`oVgQFU#T[cge?C*LJ,.@WyT[B|dT<\CJm~!<rj0%4e"gn1tGps`{\rn>0xnq*IuDdv$
      QM4ZYrA+\@i-hk-x=@N&(tq$*6tCBwQs:N!N.q8!6`\Vw7//|S8;*d^>oV<5Ixo>|3#X-yo5-!e:EtoLf~SR"{?|iI`OIYzkJ4wKdbKfT2%STc
      wMj"?O?_'+<A$Ws>zH:!L;<{Py/+U(F?$lX@IB2,4Vl+|8XO6)-CTgKex"Jk#DlIJBFuO}R|lwWid+Z92K?hGW(dG,fjN{C'M2.0"u(tn0C&]V
      LO;=RU/1o0apYP|_U*|ddig@_(JU'Z#kP5H/yC6+Qqn1?d(]6WC9&8J(gX4l3p~1W@RywJDOFQva|iAl.<^YeQ;!jNBRplT7^$tn(z;q]w6gO~
      $+t&^]A{E(a*f87dDX)1jO8P:C6HR2:\<)R-LpgU%_TFrQsy6$mSQYY(GoodrF~dk#BUO4(YU=E|-jV<o-q!c^}l,Nc;k@?ply{SRJwm"?ygl@
      _V'nR:5E`jG,C"%i<0rH?whtKtxnN:rktV,M-q(}CQ2\p]RR|;R'T,}<:yT+#xIB`Dr4A(XaH?ahuf{K)i4*;-E+3"W-=t3G*4ewx7GSeJj`?5
      7JsAc%mlTxzqO$[1lA[Pp6U;8Ms|=iM=_FDIystE,t/U#Fz+2AG9K`~R)M\QJ'@1#_xRSyG&{qlH{R6:4Ut|y(t)JMbq@FD/,f}f/#Jq`.0/JO
      $#u$'X'8J-cSC>*wBB*f)^C6QcKh<$`/j0L+DjQ5co;]i_M`~8B~cJp.rZ;tOztd@/2h\/DC>5).kU4nVG/Ilq{q%=K"+#>'-ob^s@#;Wm~Zc,
      627s_yM}yk][vO3MaT[/LJ|M^^,Q"6+.NEer6@;},i?y>I*:op]R&c@eYL,*0YatDGL22*3Z^U7%|rL|-Tf#40khvH6EdjoP#&vH3U|Pca-dez
      @uO%$)saU{0=l9M?S*Q5Xso)(+eLiH~z|VE56M=hfB4ogGV'TYCR")^^8>NQsa/BqIR_>vv^+;.zoPgg#^CS'/FB(b(vDlPp}QQI&kv/([2H"K
      pj&pZpIZu[-&>Bj^6.xm+9[(Z)I#r#7O<}d2z,R|)aQgbaC%&:8e*y{OtD{?dofsd*jy^<xxZ0aM1@K?\`)f`?3<B6C32p-+o?#KYyi*zbL<w`
      ENFY{!]4qhW&mTVwV|M3w3B\TWHSK/!j+B,y&ceby1.rr8g&z84"nG?ca#f$WC&Z*fxhxNVBI1UN*vLqhq`&0SWy'8O9k?Wmz6/5nC&>-`\_m#
      _/9Yg}OZH,,4LYWxiZ+{>%B!tPkqj{t~Cf$#5XbD^+u&LE;#0)Zn>}!CES!7HmR39eh6IP\X3V>Tb}^h8796^>]B^EnB#`sSOiy")`W:YH'*g\
      A8F'mAvNePF1-T3,bYL2qIqOB#-a[5=@NM(",f4u24Z|4jOvOu/5=jwdQKV<R$\bpkq#f(ROGBCf^N6v9z1c\Yd5R;;&wrT,"6*gUwt`Y'c>^z
      Q`37'_O>s_l?,}t/p[mIIm3anI)MsIA30#>H|6{?gU%`87/6E-1jNMF:OW2XUuTJS;[T=^in}o(HZ{m~fb*Pvl]Yj78#PvfR2=.D~|!s5x~f(5
      .V&{dk8]gIi^_IB\:)5A:(n((vIkKE0\4&\x4Z2cG|X;w*cK=8yv\`fd`T|ujwE+[L.nf7}EYA7co:h5(kEGLP}_Gf:Q3n'gRE5";>3^&nA[RT
      \1!MIZgO~HtKYJ?kV1QnIK*\zm!8,@e>P+]LM%w[i%^pYp^+w#)m>P5BAC3VT831&Up;+;7j!LI2SaMR!e4uajg;!(dkeD[+6U@xh'TOVc:j+C
      &I="sZj,d~eD8alK%l%m_J2+qTH\$!Z10m!_en*Tt#Wt=u:$6'r#=DQ9!DgsWXkmWBTm^LaXAl%./i<&I&=>\c-e{e@sx%>8muf?0yMI/(lM+y
      sa{2/uWZ%V3j}lcyZ;!w0T3TD!#_7px9F0S!H12JV*pf?XJ;UUb'DDc`[fj)p(coGB(u[{+Y%8"d>nI![cab+Cz?h`ky~RiM;C?tCBck9?{KKb
      dF_B3|?4hbG|<'_unP$B_Y\U]TXxv#oh)<Ysz><o4*S`C"j)e82L2dwX()a6&WT@$"_b]7u"tjknN=(8n9(u+bs[c4cz[FXax-L*5$ys^kGhs.
      xyx}T&C<b[+[h\pc1Gf9~zoas3oVL)8B31eVsOQ}1uRh`1"Ay-UdM"x.8s>C=9fcNHeyV.I#E<9<Dn{B#VUZec`coPs[9h8A*bc^piVzB+ya+q
      r^q%2z)w`r-GShl3l_AHJ'S,3at4Dl{%K6*1ulH_Eyd[U8UC_.:Sh6Ww>h8gyqD\]&="h`oGv;jIwWYuY`|wNC6C`v;D'ah6JFv|.5/:FV;"v(
      #N]8507$RC"f?p_]h_Ml%hzT/KXq:TlYSD+We'>Q$lY^7*7x/d'!XT)5[J7lN@c6rw{p.8}9R\=oo_4#4*S6<6-EyDB>@btL8~>Q3[7e5^)YSG
      O<L5d:p_VwFvLykE}rklz_D+kJW*%oV8+c&5(~1FlVhV/ks*xk-Xj[9J#>7[)iCL?4{e}6f;Xxc|[}\Xx];U_U_(v&<+%vIB<@arIs3Y{2F4&$
      <B)qJ>rZ{miNes?#Emnmnav]T}4U#Mg)Ie<ZZU/B:$X]F@!eh:c1b[Z4*P`2\JrepHe,%V53f,$HF@c75y/Ovo?=9d44W/2<^=WyQGd>)Vz?Fb
      }'8~x5Ax6mwYUP`"7BAi$6f.xyi7u46c0\{S4+"@%Q$1&CCV@ONR7f0rma,tA<sr.99u$z0*K2d)Bpp}nEt5slXfQa=:[s$Vt_t%9/(g6,WO~(
      7+y,,~W.lX&;8*&{X\xYt%ne9'%uYn!y,G?t6R%EdB2D%56CGY$x{$ZwZ*!b$;pkzn5l6oJX7_MnSsq;n#8=J79^P,x3-CzueBgTUm2G$CYnC2
      Zm!e%@8Lb^}:u8`"mYEN@63{k5<<g1$9iPva:7+W2A)!&gz?/)WZt1@!>XZ$Tqx|9_*v)m=^Uo)#/jhKVsOl.etgJeZuqZ,cf@EWf&gh-B}*=p
      rY4st-[QX!\zm3i9lbCx{m/)Z:1~+;nk*K8&';pKk,3]uM=JeV<lx8!nZ8S6\8|yza8)sj!RBj[)5!tK]=],

   ["950"]  =  -- Traditional Chinese, 13493 codepoints above U+007F
      [=[83_O$Pic'CxRvF+;*M|!,mpBB[ewt(*+kIL]oI'*:[WMNP9+4i'J{0,}XWh[:~fla'zX|}}c00F{qc4j$!4C}NF)OkYGR342Us#NGA~1}}t
      k7Vc[:&|@;9sgWDS_;#utgGo*>Pgh8[k/#?P-sW4T\1k0uwF7~Ldx,!k#Yjn"y~`%|O~?E2,B`6i.A_SB1XXnc8*DN12l{rOG\)R6\3HIo"ZyC
      &I\1-r_7Ayq?jFmUZlUATH~*UTm}+^<)uyj4Iz|yW\!Wgpx:g'N%45=xQ)sORou8b2dyZE/$=DFxz&+Kr%?mpASH,r&/62b/ArR9?>fucu>xn*
      Lc!!C!@otWDub_N<QG4'yD5/*2I&\y[9\zt>=t:!qr-H2>apBP|+S6c4v,?am\P:+DuU"31UsY6]nq$s>aP*UY8uUSa"o$8+Dvv/Ax5(S`~g6.
      GdXcN/X|b'@u|pia>0tj-4"'t*;m_tb&&L<-w*!v#X}T6&!J3E(fLz]'<t*DM:28y^%5S07NBu5=IF`p8#VEK;~2b!Xv]'_t|H{?1:3KC2NI.4
      8>}vtAQCh4'Zq6?o7pPm)Q8MK6vd54Wzm7)^g?&eeBLFw+(t9bcUsS#d,5p?H2V>""kda`PCfzAa0jw-gW:%<F5i6nJ0T\,mLbCrSw,hm'2OA`
      =W/z;_znfR~13fc^1{H#$0`2!:w>$n$uItIC,/=-nh?Hwh#8{DqD)h|~zh41?lmK<=q0~^"as.[v!B/9!i`bB"+>%-WFuV'Q9Q:7x<Xf(\<x)r
      z2fK):!yBBA}$mJy)\`j]qod3a/B^?({RK)BI6A)wY=+JbK4me9v-`/jJdD>`YK\.$9.s?t~`V0c;{,OeO|fd:r/hvt$qFbgd6R6Vb,GVxLl**
      ,wj@JqIDBUuiAHY3MbCnrW#[gh)nV~lKoEF:=v@6W+lGPGV%f/iz:unOuVE`e~OGb%9)X[>IIRo.CR<*+SRK/ZubTd8gX24%i26A_ml)DvX{^2
      y6J%Oz:a\#x3%+a1G?Y"g@?By.Cu~Lq8.b>:u`M)_tls{*zgK`JqP"Kr1|oI[(ISbv|UR.Her%L#gJxIRlq9|nXfATB^}`]PN!\7pVO40DO.4"
      xa/'H=GTQ\*4],3O9a2+a!%B/)U=@GvFoHBZxqC"]&CB+#;ub'a1"Dq}Qc@*,8*k7!xdV4x-<=zJ/sh{_Jz>0+usa&X|q#e>/EUP#CGH8cs?.d
      \L8XANr[zv@]Orm8lP8!@^DQ:9T*xTDfHIJU}HNw!m~*OM=rdNC[(Y9A;k|NI|F'eN9e7B/%t{&"cP0|g(ArYzJWB$]M62FZ"f+>WK:gjDZ=)t
      [2p\{3U"fb(Y?x@]Fa#NZTNN!l&-`j=jonLmQItoa%w-.8W}^=P\FKx6ydVy=T_4jdt+yh]Qpu)P%kZ&5;mSb_%_Xn,o>-F}xB/;J%t~$s2/D1
      )"0ei!RXC]Q.~]9P8M~"tMMv,g::g3TX>\?;|!6xJp8Ao]q(CAeM\t3R:K8P1w@xF=t$Ie^`"[TGRJc"pk$1OpFiJ/cLMB1i*EODO\]~i;uvq~
      6ivjIs['@|_~<2U[57;v;F<Ae:,Lrg+ur;0$yP)Q@"XmmsqZ?Zo8;9we{eTwg)`"sK=lbN%MXO"[mW?UFj`M>`F3DLr:o+LV*A=R1[<&E:M*Yu
      Y0MMj9HE6qs<*J,K._T3+rFxkhQpz*AceAie'Y07UMTQx/~Tw}(1\E7@(T76Cpy&Bz$r(ghI"J0rG='ML99|fx43%db{YbHu;zRs|+57ZW"!6n
      `qQ1,_8**;S4)"1"[%JSK7/N:X?%k\<+O]k$0+$/"UWhwU6SAm-X_+_9LcjmW2[Ov=l6*n8FDnOCfoPL1RQ;hg&|!H9M67<c=HXk,XO7~|nhfa
      yBMl5BZjeXXO43KNUpGCT3&A;3zR$0}%+ar//c"h!,^:<n3G`VxQ=Bi6"8.{![*?jf23!Bgv+JwIPZat~$mO7Wb|zAj$R$-=BDO+Ni4S!5]tE*
      b?M|geP=UBW>QH~EpGD0U'}x,\iOLByO5TtlH!(Ws!R*8NV4s&qVI:YL,8*d0-\>x:JFQl3_11wFVP)ynI)U(i_OB"~!JRRoLA./8?CF$vfrn>
      uvPBjuhYH]YO;$8e~5grZK-U#{L${f*+Dey=b`J}0Q!z?5'L!fAae{1aSfIsKraWDPEv(E:6Ot4Mn-(a*H0*>Pp&}7N#3ROL<}6a!tu9lhXN#{
      D8hRrhI/.ZHa=3ROhUHKzSq0Z-yyCX]Z7`7bunU{G#@zS"'f"!ks0`;U/Mc98(`1eXB9h%t,Vs9Cds,4crGdF`[2;jt/-v2Z&Tt#?}'$JJBURq
      ,HXMu(T<GDh#!6=YXd,Pav+BBdYJb?+L/J8U#P_c!hs$`@UPEAP[fd_p`[h/w!WiVOl28Qq{pVOEoQ]@3^<yLXaPgjc$L6WLkg\V,F%:"](c=-
      P@vtnyV<iH3nYC`-Vb=AO1SKi@W4+6o,&]Fcp!-.|{jhpf1<6"/j53Kfff'c&boKgIxq&ifHOp_=aI1\rp\g>+*ijf9(:Cx1H;3}8}Kq>,oxju
      ndRH@&AwY`Hh,28Y=c$oY\]QFGkUA"B7krX6|5X[4VS7s1T"!L(8X;%~DUcZLPOqz|k'T8zeE1sFBRX=\"]g0x"pgjFyPij,ohi-0vzbV|m5$A
      ?<[,mNf*#eAc.-$_\\Ze[</6s0ujra*;0+9l,(=SGqO(y63JOkA"N?0/j&c[xaf^N}Op_D"gQaj4m3zyZ!FZI8T*[so("^cLnzePqxsca)1tCj
      U07i]i7L3AqM8pc@lBy26O6T+0y@CU=Z7''Ns0qwPuavx{IDO?Q<\<*3,Im;NGK*%H0#QG#_;5XDxQtK]to!@nd!ygttzSDGS(Fb9_\dZN|$+7
      (iO9$F'?;rK#M2cV?'un[w0~\W[+5\Sl7?mBS7B{6KN#JUl!.dtp*>:TxoT8zx<Tqx{0\FE;L(GL\Dc.Gi$sXpN0Qd0@}-]$J8d!Do$Ov~vnIa
      <i3<rAJbdJwnurqn[Th[DmLAZT+ODb^R@/@*65LK1nq$9]i%{)|1YOKoRWm.?N.eVB-&^,H\`&No@?So^!w313bwGNR}J;eoX\?~rdd8?D,[R8
      K0rv/*{5:J&qgMKZa0W`q5AXj?Kd(\FSxQXe<fNKLRA9gL^>uVlH{D-|7`b{aX;FGiMqbnSHJz?<{~>f<lIXqC[>z]c,dGx+H/f[M8-Ed{(b^%
      &@t-d#\Wq]0}$N>9V%M\`i71<-gY{WWg-Fo%rdT;$4o!%oax3WbSO8<VmGYhm-lXfZG<E=:KhF]!FaM]9ir7=saiXKxPN[f:qI|<g#j0PXi.%n
      UqTFRQuX,,6e9x>KQjBqnlII9)J(.mMtJXTt][cR}AN|-y*hLYUj#fI(qOOW93djd9[2HR"u|,k(Gp'De6_]?m#Izc4N"Oxg^9eX-7yK[M%DIt
      Rw*E)B=gzE'TGuj\]0/6':`.piav>0;W9u~R6%wi]Z^/;_:k:?DZZS)B3U05l*!Jlpi0nh3=<M,6tV03Gg=^Q?wPVwZX4=JSfdcdRLY#XY}DD(
      ~Q>Ou@p/o`8Oa,x7lk<</`{{VP:APVTP,>bz3zV\M_4sx5zeUK*LWFGjpNjDPh];{FwLs>|]|9gl&zG9Km>CE@]ZR<'qZ+M`mq%(jg+DB/ZMW_
      R2arQ490Tfvro$@"L<Q;1bv4PNDq.B7[$2$.1YLC#iRF+G#\AAxU~T2hd-AR<G,`x+?LBDmMK?/\_{Tt9b#J'*!MdgvRkZ~lmgn-xfA.xe=q#-
      s>LhbD!aDDIDNsp~]:!R`y:y~F=BV>XQbqBO0a*c%"UDl&?:.*wR<`BpJ7w).kzpjV^VV`J:Vh8r!Iz#8M]_yoSZ'1%aA'X7c/ScGt@:H=lCf+
      0Ds_h"6pjJ.Xet'q%D'u*%@(AroSKZuHj!|C>\MaKr1;#mk>u2'gOzyoGH+;"+wR(=XKIk&G;LdAkCBP.oE2Md13aDq![H\Ni^)[QvGnj.B,2`
      esLN;~(k[2WL#D=_":W=b67AEKKi&=mIuUmW>QQ&&|d00H!o".X>*.c|{NkML+Qy_fCItN+_\i:"b"V5qMV(B(m9s-U!%[/tss14`z$*eIuCUI
      k<;IAxn?i1vAiLqkK;LhID@K8oDFdCZ6a^lm'\PS[$34)U-vK~sF+*\A$tyIyEmTAqI]-xLl]^+q)dQDGuKA,:#>kff%^:sf<_B`U`e`es^_r#
      ]RfgX5/q%_'J#VwxegPeMlD+UcNgn/h!7AlA_aefTq2'QgW,9.AN2"6Ce*#)OOZ7Y-'cS~r)Sb%QiTH7(C.Fh8t_!FbGlo:`zLSmu9D8Tn!-5a
      W^)5Lse4@CI]+:U@w[9|Houu?_T:2L~\O`om'<}/$@]icWp.EmK5=,Zu6EK/F{@bc3_6T$q@>T^`G:8lW+8cu|f4\WEKmRYRtIEUKALwPQcJ/D
      PG.\OQ?HxYSOjx%@{(*so=.:q^E[s`O!u@{7Fld|l2\Y*{u5Y`dl/%cQ[1jq=W}Lsjj$~.J'HjZ*>W[Z}IJ):{W(w`YrR&mdO.p0BO$yX9%@=.
      &(E:B1Tg{OJh`_&"*R\1>g7EEEqrMJYrZSf8Z,)d93R"+#Xf[6r.K!;t1S=>2'uG9f,Aj<UHWbTj]}EyEhBz5l_3i@L+e<y195@C`oHSYW4v\J
      "3-r]c,=Np7oDFQ?}az>(AU4lG|/f"+22_(&RvbcU:9wi1'FQ<A}f&y0z}*omZ[9^1"B<T*uOAOL3#?T)E:Z1nsU<~q0DM3q4E&x/y]sjQ/iDw
      +>&nbIzoo>|TbjGa'gP"|#+Cb/F'S*JwWD;pEQ\?##FNXAJbnT3BQHgLeR`=:p&-E?7Rf/u~=;9N#~O9i>IdP2pvyNpx`xFuJ,4Uy%Mq:QeJ}w
      9]KuB8U_/PkaOGYm9n\#T3"]@:xwDe3MB*\FQ#"50N5tPoROit?W?_EQJ["q\`V)c%AYrfPUfI;Dj+I);oF]AAVU1(yfv6.xhgeNj^/OwV4)95
      a=oJfiU7(aRI=;3r@f5"8Xa:L3FZ#d)*ii!Lp*tRLOo`\FwSvQ?(jA-(Lzs&v'1w,%#bT,^L))56S1K^!Fdh{on0w6Jl@VvjKOaE7Fq`Dcak@`
      F+'x6ZNwD9<,(Ml'EDk}ZdpB-[^@8UzL&~UpD9FXp3Q$aP<E(]i/?@ibW$OcFGHj/(!g\I:[L>"?wAmYo,}%c$V2Io"vi}0Q:#IfOH|"g+mguD
      Y%&So|p5Qy<5UM9?MdX';oH#%'}2-Wb@'JIivQ9"Tt'o}gIx0Y8F~A~pm\::G:F,y]L&'-|jrc19r4<5aUZ}L^'V?Hk'[>T]iwjj&$W.>k?[&*
      zw:i]JYr]m^mg%t@k=)TMh/,flf^A;Hs`quF?9]Z:4=oYf)_`P(u/XS2\2WhH>6r8dsQ<(t)r*soG.S"fDquhQ7w45<"{d6(v,>Ecs2i)^n+VK
      jmcV47>9ZtwZkM,]d60`(+3T~P5'Y%>*m8rLjIQk\V9WJ.JrcX()\IwVo0o(u8"k}pT.t96;VMY2Qu@.;Nd5#Xum-tc-0Ih('BW5-thm0g0J-N
      o<QVyQ3>f$^R2=KK7X2>)#96umrFb\~we3.bp>[>u@=i>K^u0jJCMTv`ch*|lv:`v7`DpZ2Ydri-H6+{X"j_T@az0@dNZ=Gh0tL98*Ed7"Ff#{
      vd`4If:nWEBu{wM~gXq[{SX%!`Qt7HL?U<#FiHhgTCDQ\G+!Vi#bX(@D]BZa9Ob-`Sj)*Qx7')88H/T]Lf4`v?lOe^BWnwp+WtNSU;A<f/RJfy
      x"K]8lbk0U:r3E,XTwk*t.D(zlX=_q5?4{/Sn?CvHYrtB3c~|~H_Pt7`(_3Hg)A%aF=qmYzjQOZa$qMa<QLAalen&2M/~uuGT@LKa=xC},uz-u
      Cjv@N#Cs5r%{p&|!_@^2M*:VC#FCe.?,1j&8BjPz}YFbp*(aNM>;x1w(`GfXUkRwil8-H{q;w7BQ.!KY{pQnk-iu,~t%.<EL,fno24u4E$6@Qp
      px}MmcQ#$Qu5E>mNy,}_?z<:mQJfZ.M'eN;2Ab}ufLeO^qll~lMFPf6PKP$yg+AkqWwe&mird`u:Wk=KCOcQsEMqp?+Tp`0=#VshC#E{)Fs0i'
      MYAxl+1@;WGauG/I(OwXCM>@03HGzZK7</\@#="\4:8'{aG[sdTC]U=:/4]L>*7VB7?qz0:G2yUUHS36835B7\9H7/>J\>2smX?H\$OmQBR02%
      >6+jz@ZMN=H!jm=Hz#+Ufms{2G\*Q<B%5,_gb!>'}66$=9XItEGaO<L|,bH1:\r2tD4C:Xg6q^K_GaI7?E}Fd;hm,{rkL}j:)E6nPg^P5IzEbI
      9A!d*y$U9*wZn.)!LJ_5EN_+IK#rnn5V2Y|==Y4a[_fjGil{k_hh3:J\Qt7JUo6{I&/a[lP=-k?$HD5#9*RUpdL-1U_U+dB6r1c0Q;%*2U]%`W
      [ST6&QP}6WVxbfu8=.`HsI]r+j-1ZIAR|s@t$94]&./m$p?AT$L?j54jG=+3%FXob27{QX-Dok%LW@={2GEJ>@e+Io{9ZiZabnq!_"?SX%4[7$
      P[DvJu'9kc6B<^{hH2^4+P*{q{8C!+v9?Z5LRvvox/0IKy&8}V}z9<+-_b"o9T#83O1.o,*o?5vSs|;(k3$~1!~=*s#YIKdWK5Krfnq^pJE=fI
      1lndxnxz,bJ|qL&%%KrpuiNfEi1h}?3(1iwfE3-e!]b`t<o+^I?b1Pp`L!gx|e^a5}+y~9ju/t?d[Q@O+U)\WFIS($.tF(oYWXC/W?:([,Jz.E
      `]6@Omk&qQZo\TvGc%e!;M"hB!AzD850{@;#u-fH@ie9{Y.b[iY-GF5cB3]Hca}4c-5p5$%/o/rsNT.Q=J(zstK@]rj5\zM+H@Gb#{2VfS36-f
      u=N3c@s?Nj)DaIv1~6~#)}'V/d|-yEvvlU2-kdCLD'zC>]b)n8~;CwqK.4oO8Je1>>VsakxGgmVJLqAhAy|A)8;r{X$DmHHT4SMO.cVn]TT&,f
      /HWs310b3'{2vb^l,5_D54k.@b(47'!)aar?{ezc'FD*koP_?%l}aK2Gw+M\fvlVp<]\`dp"->G's?!}=&-EWa)pjs37Pe!0XYZV94I3Lp~eU)
      2-`?XQ;"w5oXz~[BPBGm>1'ZEs-oO5THuF0I$/6'0UiS?qsbEfSA*&pn,YTIY9lI8D'#h\tLTwD'51Xu\bq#kL=^M!L9?3sjG9?N6<@>hPD$v~
      r:*+udm%%@`,#vd4H&G)m2V`7RR6L+a8<lAM}Do7Vjict9!Gz[[O|$VRbfs0$?-\M_3+S1C)l?3Brqm}v}z0j?otl[4kEz@LOIq1R3:m|I^;ST
      zpg8mybee-sncJ~~-NV4y+c75&0Lqh>^*{0VPl]1m+-X4pV1p.N$#`\o2VbTaQpaL:@O+I9p$v;F+8b(QFqS]e%(V.X:aY;vv/[xsRT#pT_opN
      qzCG.qVdr{</F$ro6ma\`6@aM=3[g'Hw\d5[};/dC_ktkLfKwGKzO]6yYD^wSB<adF#=M(_h>DP0&qdg:Mp}^X~J)O%N|U]?mt&ah)7T";h7=q
      b.C]`W1<JmwOC"%jb\.QF~tLy~CG}vinSI9O]7e\OiIfphqsd+7S#DzRK{=#[.I&SGQP]eFO@6p(o9"'66wzZ=\6N{WH[Vm<9'%=\/O-<*wxcj
      1.2,e^I>M0m;]~+<^<2{!l;lbxRAwkm|&6z~<c!Rr{k/IO8oX{AIVX&sDx,0Ib=NCWX_ZuKq::G:.UP}m9G},+"yAuq'?Y:;=CI2T3VwqC("UU
      xhJs7,$_iJ'2(9R++&Q-S!G/^djy#$fxw2`sr6:DaizAd2d1;]%x)$@bj.N<+-Q-Fe%nnRf`~ZdG?v"!KLzL}K65"HJ3#\/J._@^@Ea^S?Wf%]
      lFGR#8$@xuAI{9xYYQ'9/9m$'|7K)FUuwUDO&89~~i#p,Pk]Jx;'{SbBMHRUNqQ=baG..9U[c$W=>d9M4_4\nG?5(qA2u3!V*)"s}L+PY6n3AB
      "f2"vfT`n}):`K(C\&e++ZOi$Ds'+x@'tZ%Vcp2(:q~AiZ`'~d8s7/"?V$r,x1WQTCqs1la`4:d;A\y1"}D5e^r:~:&~MT[bK,#`CE=1KlV{X*
      )qTEJM*H7_nLv@#Y,Akc\H9)rz;X*)T*%K@eo\\h%Gqa#hz`C?\RsLEkL$~ytE9W?31J$xj>AiLEnTBT9Jo|i#v<Yc&@g2znEo__L#_\C]vYj+
      DqZ2:><zE](E.S;QH6a-'O;Qwzyz`m]]1n^t-QV42Y0}Z0'Gipmzm5d.1}?h-;Hq8n<HH_2^/QS7k@clV&QJo#\ZpkV3GX4BL!%z$TF)GSMYNd
      :PERLvOGv}!"l>+t!z(&weRldB(g$x)p11NsA&]~f;NPk"Tkd6g`$(P2tD**=pw5fO`!/-$u$Vif[7>1}-FGfgY/MF-,p?d}Yv<Bb_>QDen{gK
      /]`(9!e_D-9%luc_i;M-E@h#wduwH(L6/dxHI6o:o"/F)iYKy*'<6]w_QF@m9SI|&,T'`0t7vf$3q'wD)'|:^Uw1!3\PS8=#H5Ya,33~+Ikd)x
      ^n+^wM.)+/:AC.nCp]xsg!)_@*ho5_7v.zrF#ktzq.eJjpwju[c~tRHUO1ydOWTKum5[ez1bR^c:N.K&OpcU*s(KcXU{T;D|xKGR1ty[Lb.28U
      !<$Bz2Llx6QpVzp.z"<cwRY&d8(~C3@Nmq8p1!p?[;DXT)j#]M:UV~eMcAo6s(Mx#s}~=3)ly;Ubwr,jy+oXO8D!lrCX+cxPC}$4g%PJ=IyNyw
      5Bpo\!qz[8["o^@fy[fJ=u1~b"><CNjG?sTx}R}+PmHJ7"W+^wadzguB.Z{,Sv;>mqymeC}@W;pZ\/"G,efcdzp[8^5mQ(9QHZui1{D@tp&M!3
      BA0qamW@X4ETFl=rWkv;1W*I_`|@r@dxh#Uy_at5Q(8?T}3Ro|z?@!+c>&:IzVSP\wJF<.LT*bl*N=NZOb[|/}3@9-#qLYipAd%,'{P$>sGsLO
      oY8Rf}"z&n?o2@FT>kNdtjY{mti|rGL63xzw5zm?O_X1msVi!]]}DU`(0{r&5^qF3]wO$b36[;P1O#ow"n/vjclFXbXhC&=d0p}3:Ov<6aqN(W
      x0?WfQovoOID'fB{P=$|mi?5{T51dM:1=sibgtgn9`v:^8S}qTUuw_^]76d_dLZA7h^T0i7\4ECD=zW.4&+s/nI<hr~D7UXND]#T6mkWi4HnC>
      *A/nh;G[-8r@0Sc%^VtXIhM}\WpK[~R2auY(tB)1a2@!6iyN{Ge`E|BQ=i$UM}ki=&MVhwYxGw8S/u[gQbW_smzRS!gl+'*X=dB6eag6uD3pA;
      d+M>7#"k~!mJu+/QM%.&@W6XDLJ1|FW9S#hycA[6=\C?\,WodRgiym'b+$-Wk'jE~;qp].1Y-.]]/6.5=)'*oM4tQaq+!oouf1Vv,Nlcs}K<^^
      qHq%ZRoRm%-cFFbFkZgVZKy)L[PqH5uA)^W4g(/2"qf0e)nYSW\!g^7ONpoR=48r"--xsR.:JenOlb^r\Y?:}#"J<^I-s<}s,9Rq~kEK)VfWI(
      -%ZhNV/!w%'x,7&7+H#/qRTD&2kSaEL:G?:]7xgt`,Mv~8&)EfHFqom=[gaYM@~{-p}gBr_z>9b+:R,f]NJ(]|CJb;"e?&n=_J-]=A.#AEdc)-
      dzb*9l,MyDB+^?p")$@jk%/I0=$zlzDGnvt`$[8^'"NhDW*JAie)Ex^u)bMU+a+"*ox'MSl\Deyw&]mG7pL?CwtWt)0D>Au72HT~3F#('&eP7x
      j=H7(f=[0R$j7NlKjvB?]$ypp*71C^,Nd4BB&u.*3Q~fz;"zH/nO>9_ftW>|:#;o+f#~iDvN^3fe7lA&O!xAQ]R+e|>eW&G)*T~pDqtipyC|J{
      )Xq#lc:7AL<3l2-8'>+^tl5yyt)znlbK2lgZTQ5_Q\8d">K?F"@f:|8'w%0!qxhV|&{lv}`>;kO.f9Pzz)1o2NA88JM_CPohb'n-c~WFesULi%
      53SX7@XwHZVBw_&{IQ1N%(oKJ9N{AKN&G4rYJ%!EX+pUkhM4;2HwPdkLfCeb4kWp2=HYphW*,#OXS1Z^'Y3E$.#(I%XYMRTV|5ACVeD/>Zo/"C
      }{uKb=}IaDHqT$c\U|aJfu4BHZR*'<Y#}Woa7A07e&=Y'ClG1#D$S*7h*dePNC]b%iH;uLxX7@taD6'ZA01R'ak}!0EbMZ3J&@N&~3<mE34F>L
      oj7JP8C#]QV#=+/%R"ib=g4[}#uDhCwLM|9@HN'IU6j2&dq."UXV3\8%|(sb9,x.k5GBa>iJJ$W+d]ay{w9f_gRrs@+`C}uDs_BsT!6mj5~$[T
      Lu"?8Z2ryZQC)&(nqP|')!!5S`A]b_0x8,TtQV|H*bZb-X]_wZ&gvK:(E;E"$gmuiL.?T?0^FD-q%Yr\hN>?M7gLE\:iP{s'4]1@h8sj~TWBii
      0/4B>f|e-d(U:BjwT(=eb)y)sP,=0';9!hn/_OOmxDM%,W4&8wsi1jHJiE`'C8=[od(k&6<YjQ=v`gWULX%<K"D+`Wwxv[GgA2s:'w5}Bwm<8X
      F`GSwIkvB(#le#9]DOskXMpl}}c!5UE*Tim)9y@&/4Cfy<6FJL@"(Fes@]s,]B0dc<qX`<PCB3;9HRK^(]xxo;zK:x,';6vtDU]fsM+=MHuPmk
      [Tju\/MaBx9IoZTZEI^'=*nCTTO"x`\5=a(L~u%x]cqb(4xBM)t1mElUrn>Z'&B~|J,#Ftm8ca[r*-z==w{77~C6d$p?SNs$x8FvWF0P:\B.Ql
      -7vNDVWy*.ki!`IW_tR&wC6DPtU9{6vKccMHxNN$bm;8PmhRh8;q>.v?J=I_)&Ny!55^le&4o78$=o@]A{zhGTE8i2%%2J:0oUxthps5z%u>2K
      Ck3q:%8%Or\$.({SAT3V{@;;aFP<Z'jxM]Duc>$v:`/{EDR38Pt7cFb<?`:5G>GL7.\mJG:evm72?|XdEG-kFXf/"2!JL"J,mZZ9}JsU<6!FaB
      Q`"mTxIK1"Z:gm2bwMu>DY'uc;Ldp0$@^++R<QTZ^a-&B48.1HtK[|}3tt"=->3(15^UxhiV_chsxt&<T.Asm*I_}Z+)Sr%/p$'Uszz]'s/=JH
      9JPc*hIHeh"R_"GkjMAMy\U+YY.VundQu4|7fL(~<EMD+wFBJV4yq[$b-VgPPp!pU|!75Sd'f(GQQP<?e!uT12TMFN/F=d[}w*[=G3."'y4,$s
      -JF>c^On?6m{'h+#1-+hT(Uv8xbGr%Hb,$"|@.QQJ%7"gY%]>az^s#$x;*7;T[%QjWL^}Wl?UP(~dF)mq(RmT%aB3-F!Mr9<q3a+U:='h@b=^]
      *ya5w'V;bF$3_{='OcGV#(Af#k=]]C=u{W"n)2^!0VX?\9@w.\:1rB}`ttT8?6"?itztz#P/Q<>O7En1J&|`sNkE'1{FYO9T!+1zvGL0xQ:q.C
      mYh#$n>i1i(RW1GP)*KftL=UL""pF*z=#fX*!r.'G1JbGRWrWyvl3NLO7*xXBS*2Ok_%\C[FVc5.5Ha|)~=`'Yn66@|VuD.6pweyW"\2~`.1v\
      mf9?q4fJQg+(^B1h[{is<Hm:pi0[!qSP^lu[!dIiV]VJz))n?/gc\MjjcVMgU8cmd%!TGfW#qNEse"c;:m+EI]ysLr^]yv:>At=G(leWY!~*SY
      l3W<l^5;AJnfR4p7Q2={YZ[`iP}cS;ZeXt`&%[GmX@1|GtldZ{&+s9&_U{8>tn>7D-z^|_CvLVg*y7aJ_kQ/r.w4DCUcE(NA,qiyz(!e4pa7KS
      [yPhe>O7Kx8,F}w2<HFM.@3PI_)C~yQUkmcx^`+N=b;e8W.M")rz<}M?Xh|yZ5$K~T2dI-d1I7n]-T}*a+WtIdj#'Qz5uc&#8.1N0X&/gA$@pR
      lbn4mROwH6&cO'2(@]kbS'5WcH6h}%l;7*Z<TY3>yBG~dtKc3U&~Y):WuB7"W4/I"`QN|Ss}#~Cck^z6nw'kPa{*H`%,46>?D*'DRQkSGsdHGn
      sX|>:dW4EEf{"z-'&#vX=J*?V-U9I26G)C<stG4E7xo({dZD%|(fb)(+v"/7h7Y`vRT"3JqP'~#Vn[%I{Lgk4)NHP5KrG33jrt#k@FW5yLw^Zi
      ZE+KFbgIaTpw,@:VbW?L;q^Vh@Rc:S=,u.Vz/$|25j:Wvo<@zba_%P|E:JH(L"X!h#`W^|m:JTGpVpMN==e&B'oCh%}m.Y^V4Ca/kafRX*/&,\
      g,OC2FT6sc80ZkIq;x+S{hgK-h<o=jXhJ*,@n:ymYiN@zvwTuPNV}XQy&=uufF'{V]noqo,<lxS<2`-<XP1|~`pw6H?xs2s>"=zkPWN5!R7%{V
      U*E?J]j~r-0nSX19p">8nd&XRUD&D}"%oAVE15{/Gqm)WAK~!g<Y~ZIofpxP2wO-NW\"BlahsKF1]GichTWA=K60_r5mD`-rkh..,}#2eF[r5p
      Xg:XpeHLJL|lktF{"U}#OmL;&0l&&"bx{Na28#*?E:&'@T}U(p`}i#vL:RKHK{io@6iD@K:}!sOMyUR,Mk)dw@MNIj#%2xD'~/t!8.,bq+@G:B
      ]4ly6tdWJ^op{yG53K-elsaDr;#0EhjiXUl{6P|kwV"6L-Iy%?u)0e_pq`\6[~Sm,z<e$(hK;rA\a\hGUGM\%eb(?55Ex(nLu/dCsk-d]nx~E`
      P)6YN-=yKJ">V$%Fh<DYLD|(O:.UgU(L4RoKOt]$s'v>f.D7p]ajzIMIREwIO.m{6ApE8^swlE\1#@'SE;cs.2`+OftiUjSF!?B%CR=a)tImB;
      yh[f{[PJP,[v>O'>wQR8C!|R-^6Rh-2z,uRRk=Uy+GtAFFJC*!\r+c0OG,{vY:!3Wu#ygnOOf#kA~S<dt?[k3=(X9L[FMwM_{yff88`>?,A)g;
      '_O/pIm&"{3U/+MKhn4:+F8Rh;7gY;C&dW#`W>K5\Y?F|z{P)~>E)kj.iSA0q"Br-#F6.CE7c;lyp^(9*pn^q:}MI/3Z;fK2+9L?45f/I'.'1#
      @`KR?c:pefzw&lr,m4tT0j/pZ(P?#b"&GOOLS|gfR!q=@zLD@:_T'S"}ChfmGbHW"i:pp5:FG-zlIF.VtS]@O<cX!m>5+uSn"V'>KO%.a[CAvh
      qT*1""s_ZOA}P|(lxO4,jHG7oRH(M/kO{9DK:SvCkYLjx15@L+kNF%NLNe)00ukXa')<[U,5|P;t;b48ytIy4Vi1H?e"2|tEfv3z?irv:b\=BP
      9?j\ozaX|fjO<\/^>*DLjh..SRX`tva@u{5c,OBZq#AtM|s;?S[E2PrQT]S8@uM)9=+BSr/.alGp3;@HvldFF$x2qfT}:.gqbw5\h1l.-Z],Ox
      20@~sROLi}dd%v^dwL7\`W0rQ#U<{R5pzJwc-Noa1YwYERH9[_3T-Q`{z'^M[DbB(-3S;xYfm<7ki6Ml,#H=C=,!U:5}hmEpt<*FnS1^cqW)'R
      ]w0GJ0w6Z(+kNn0,^<|ouq7mWMZ7|SX8c5aMY\~v+fb$Gv(6<w>y-%\&(${"_\;@*W1SiXAph@KXc.9TWjMR:}sD>7c+%$@$kQcKQ`"u"+}4mC
      x5X]~.pVib~rvy])eh[M)&P;-GcwI2}W#beSVT|Hh"xf*x]P+3.9y(muXwa_&+|yyjPj:"jTZcW5xg<Vc&I*fL%WXyi~t]7'I<IfBo6O7M6ss2
      6cN')SG=H-frvd+?^ukh^H720@FJq4C{7!0!J!g9&#*$8]huJ}0{'Qhr^BTzf4@$\!H"YCXvpt4)<gL<gV49'_U#.OWFhwF=?O^h?_!dj5TH\U
      |+`UpmmqdDq.sC+fF&si0CCfu|9a*+DSsf&d>YzP;v7~!s}_yBe:"1!{0(3Qe|ZU+CPcrY'lO}y6WbL@10'VU&:>~z`ER9-Akl\~?6%7sB&q4p
      w]9|^uf/9}H5aEO]R$hPO~{vMhf/'Jd1)bg8zs-EXUfx6XPJ5~c'.c3JSipIeueJzsJ_){Iwc]D"4J[RJNsi}R?+WHxn7IH)`0Kj>51}O{hZc9
      E\:Lq@{PPF`!@_f*GXy>/(S^ai"(wUZdmab*2\QyPfXH\[;(~fB`(7V_%4{AGR\XJka7Ho4{[/mkP;f~eSGy2sPPY84\9?$eD-$Dw)sCW|eeR6
      \n$IUMiA9WyTzO5;82[C!a9~S>R{10T_-1+"o[oW/cB|b}HhSogZ#-2H&:]1\ig4XPO/^)@#]@33Bi?Y8zK\(V~XQP)i\wyvfRyQ&~jj4(pla^
      D'Fxi(8.TC>L4kFF+u(JNHmOr{+i{,g{J1E4Ea%^n([t}xg^]sA|^}HY"'tyT'QycqZ`1aExI0yda\$VY<QzHK>5?-:Q/xS2?m,Wlv#bq/w.==
      dmg'K7TY'TpvVYIhaUOYLy[M%=_K{W]u5NXmsL2a5Us5F`~^tYZgP=SS)hL90#FR(#V16DA#"#;8%-S|x)]T*i^!>55x~n\s]QVMTZX)M/Cd=Z
      6-\]|l<YF|_Nyah9'OPf1M0MX/cesbh~nJX[k~IkFS+r+G_S$yVBI?$WzAAFU'd:V-ai/r2ptvc*J=KxVvZH:7Uf+V@V(l4}'}ArX&!2Q3nQlh
      "8U#i<-]QVZuJUc<HoX,p03S/DXXE[b/AHOr6}g~zM1u)R;-;"oszx-@{X6BhxY(26t(P'0'Y[4+2&WI'ST:7?O/N/WhWFZl^^yqxbUf!"?<|+
      6M<w@@'Zqr*0Vk!~hNQ5<\=ffV{(lSuJ]8aag"cxQ.*kN=l<(cOe]}Dhs#t>>u&x:qZh;Iz_<0<h#&9-4Q(M^:OAIv|=7W|N=`FH>7KW|C,}p~
      ^]Mq4|P{dpN7\E!'3XtaDCJ6g}@U>enr+YkZ_QXT+(E=08p]T^JOO?qme>h_-5cq7R<iOwIGKi[Q@4d`Zto"cmXtdMZh0Qa)}pl6*Lj|NxENqD
      IpDDv*yCiDo8E?<wM2uf#1Q.-(aNLVClAF?Mgu[AraLVXW46<eYpMl>qr;<.`QlUK;HPK>t~UZZqjICW&wOA.Ez~d%atfCO?Yh1fFLy;Hyu13y
      m2z6dUu"]0Sk^cy($Tln=\ZZ#Zh)<w2(n&Z](a1Ro*)K?:B2u*KT4Z)#=_*aLsX%Ok7j[5PJoKJv4rDgdpx:ct,c;5kw%**&A[5F[1}KyLS5,9
      s#(|d,IBY:?#)>Q^uYuCUGmjf6\zrx1u9jd)$V}(QB-lHA&_%_SvEC,gtcXUdD/nO3T]2W_WjOeA,L0N$w)N$mCgk"jF5b=Yepk[3PJg8JKttU
      +Izt!4<Y8PAF3PwL95976I$oB%lP;E\;y91`yC%2yoHu}k-a)?2WuNmT;m>{|l_](Lm\t<tQbiW;\UN]FSIwlq5*l7e$YCv]2~)6X&!]%{WcOs
      b]H=nt/L73a@s2bIEake5>979n*sUh=2R5/w<3L*8j&u#SSS=`.&FJ6r}I;z.Hm>7<`zR2qDcggy`8~M9%j7Rt_IW*{SU3#T.sVZzjg|9bGm:}
      `,DQWU@C`w'3Fgi):h9wUmVEJ.X\@dkZm5.>+tL~I!p@qL*2,<PH?ti`D.@QkY:hm|Avw~\6CS93VR?96lDD!_ASl"H5(|8o"2w2(;Mn]QWH4k
      ]et,QDG,bl:O6&;8W.WH2KB5Xk`z|^pG)H>I9`?\a]]bv0yd"[Zf?-hTibyCB_!?\|/~+-1CayZ#>lkNj>_S&O[J(`t?bIg""y$)"Ng;pC)3bp
      ""Dz$wRu9J}c#Ij~+Lw.6Pw?c&055X%\~9BkilMAvl]Ompm-u8"mmv\FVMQGMqD]{]X\3*k=:8x3)gw7gIEIx@`lc_]+Yirw=,$EcL3=Alb5X-
      SfD4r-|\<C~c&8dOhamdJvh;%W+i]4a|GKyRCO<f(a&/u(nx_X,HiGX0mbr=dW'AJu4$z^4{Aih&PGV`ljjx;<Xu.bkTtOq}8Yg>^q{eNAS4MF
      nFK5q%uQ1=La(etx~^%.P)?;O&8ctiA<X[D?j1w*3Itf&tGQVyYZ^-TB+>+K2a(C5d2'=|{$kQO{z^^E>7Y8ED1$9Mo]kNVf/F+y`*}SAh^c/&
      ;\F7#&;=5=(0fA"+5&Ea"(3#DjjebW_4CndsJWuf3LgaA9J:<gL_r"_A?$hmp_oyAWZp*pd.<{]psk]/s+f78"3<(tmG8WA%YtW9!K<A.Wt|ZV
      R?L~JRM$!W/dI<~{;)ss0@CL,eh}9T!Z3cv7c!nnudQ"mn9O;(92W@=3xo#Kt[*QJ3m0&{-!zc$p@7e=z[E$c.x_8J(!RGLa*@V3#|^OR9/U;+
      )2t/0[]z|6'UB$>RN[ubL`?1\_@8n/c?$0;T]oPq5OT8CSr+pR\>R&&`SWlJRvJs4BjdK5}zY<^]{.n~Sg1%sZ'q\0=$b1|"*i'Sm0V9gVsLQ*
      pG@'aIqZKJlm4fK=T&TwTPo/dPv;'$Y8i}r_wGgXS9EIu$|C")%ZSKU&kqWM{2<TRc/id]T-%zkx$0T?#_`,X9yB:660RJH.PG'~MQp!Gmky&1
      *NnVjZYCRihU(VG.0z_{Eum%-s%P"6@~pEEG)bjX4^l"%-V:'@%qix-UV,4MOlM|"jaC-M>M+K{69R=V#jPYNTo;gy(~lcn4E%@~3f[fLhhSd.
      $LCls2Ej]Z[|HW-/S!niIuFpl;k$*m;{LDK@W']|0d6_pRc"+^Qu4r[sk[+JMD,~2?8I6v0v-J1*}iINwJ>~/E[+b%:;.+2LGrtrPZ5gW6D";f
      AWVUgWA+;Imyg'%yuryi5%0:)b{St/RHljRnDD$}1$1{Vl40icHdYdnKStnD-bj?7N{0DZ8[@|yFbG8XF>UnKqxXng19(R,#a%"LD}*B!jkXuA
      r`l\9~n|8?3}?-H4o_Xy.\A.Nx~4+jSp'@0u::ad+Y%[HM$M`5BZH/wjR%$}^ui7)=VKF,/TGNRu1\mX@7_clJ"K:]bxn97AOk@6[<wWYsM6'd
      2sSc!D.MAn\6&,_+$Ne.g%]<Ycn3)cyRRIGX;8R"QZ~d6BrLyKskx%A!SZNB$'OO0@R?[n/j1*H}okoj}p$5~SYoXn|$a='\avNr"@1S3L;UL(
      W9OtP9%GJzEyPM0q;K'FXSPz5vX>RYG,$F-9imx<m]1?e>|N{<,Nfw[Ebr>W7sy'rZLp,fJ2wi-4q$.>M\ap8"wBUof:UeG}Cgiu&K[e9g'`W"
      X(Kz;kRR}.a5$|]ihaFwQNXW{"/*6N\T|Wgaf]x](H4f2_<f%T{!cy%TLT-fEuNH!`#9|"zV#t[N`vR=at?=SzyI&?8+EvQ:ZOu|l0"b:+Wn_"
      $LneD!`n"8I69~`!+]BA;$w/vH:(ksPD:DgFfH6aLx:3`"KC=TMxUx,[}#??9Nn{@j~u?'SgR^j#[CbPfpY3,)IBmf.WF$Zv.sJ<^+|0Q@yT2"
      R:eI<q.V`nuKA3TF_n`QRVb}ah6^_Y+Rm^U06^`&\&G5j!*Tq.\H2'WvOO~2kp?w4z:H)/ck{?yMqg#lc}R.F]E!gw.Q-3!bAoddR]+B/K&$ew
      M"ig3=/Arqid0;U4+zW4Wr+grl,,2Yhc7?ST8U6vaZ]:X%**P[<A6,AUg$oR&,)T+qW,>.AG{/\LP`Da=MXu.bc2Y?"}VU#A=G#7"_O~IRLZ&g
      yFuL656NXG`_6Cw!tz/+Q"J1G.D`2S~^@Wxgp%S;+en>>4OH@Eb=?V}`wdT2T|H*L(AZT&LEUv/r]u.KWDTWxPly_5RubZ>zHKN4%B]/`fCCoH
      M_DQ='V@O<}yo>=O{V!78{jeid)5]:A811ZGl$8#M^2B4=kS-$e}G)d;Fe5lnrw7cJa%M<Q?i.2^G26)M.5FX=d7Tzv<ViLHKk?%RK$G=vxT`y
      ?W`Dk*IN;#qLxNAr|)G341s$+-cCH*ac'7L{\Ei);*I\j=%tcR"8rkJ5q!S='F/PPs;@'*,*GgK/O@z<]#BAL@U'o@RpLns9YkAC+g@@W3ACOI
      C;O&-;kPidm-pX.\Yqrw5Wycn%s'[z{P(J/O[-v!7IuJ-GN>1c/7G+IYMcC1szX{2u|$dw^mfxV[#D_%[.bz.tai6fdawPRM1NwT=6+}i^EzKf
      7Ih?y5[QJ]/:rCu16W@IeA|T`l(>\S\{G5n!|c~w.=cN:*d+MX\ij4`q\I%`qgwK(:\EcTl>%D&t]LnHY8M0QG6b'`C:rF1E&M-#5U<xw.O:g$
      UI6l}jM*X:c@Vz+%!yz#!G`r'Rdxg(fDSFr?pDVa$<W;h[&T\6%E\{_#>>1"N78D=sBD7V7wr#vo{1',!YeMFO!l:j(|*9BHNq1[eDxN17P:pA
      OikV|pm%L:<<tr;e|6F_E:*g+wF/8A3.2NBw'VVR0"I;^Ytne9s9TAgtXf.%G/AIpJfD+4RpfH>J%YiYjc@IWnMc.T@dBF$|g5hZQjC0gwaj)b
      zsHnvf,jYAa2v.D:fr90Hlv$JkgBY{uIV='A3R3pj8HpbYu,Bw3u`bf+kbO[^h1b60&WSTK2Hi.uc-"k_x|$]sZ6bBy='dTf?MaG{LBXeq'M!Z
      ah70n{^Xif0O<i}`"+*oMs~_%[Sde.}V*R*V{N7Cxruc[Q1!M7Q?0v*%9&T5A5\n*%(wWq<PKb9rCPC^,rpAU%~Cz]U|S;`DSyi"oc}1j!uJ*t
      |39jIs4w1@k)ETV.\9e/ZAi+\x+fKW7a$_k&7T\ji1U(FWHtLp`40pW<o:=vXim(AU10|l73zO,-{QtU1e)^JK8vw29%%7]z)oPAFFGwl#KL(g
      g+dq"Lhac0M+E$"i)gOU?Bp)zy!*W&))SeJ]}eFkt>u{m<bpa(9I4Bj\mA5rbGP#<Gr4g~9I[[x4M4B4B@^9d:e;q7L0oX+qbza$^v7A6L[+M.
      #+hzL*ok:u:Rl7;V_GZ<uki|POQ4sQH09\J:]d)cRyy'Ea|{i_y]$4"~c|%(4yvw^09}famV\rR@-|:q)s-^;;G,6(_]'(AetwfE\cnW/<:3dY
      [Gbc)vpl~{JSfu~%}4%)&&.vV^S_"'Q}qC{zNR!_8Pol)K$1"~$T~jzO~mDzj<iCNM(]"b)6]mvRL#TiyWb;29To>uN^qDseHea=mpC}R@lPG?
      D'HZ<0Od-Kj)vQ"+5+eK"%}>Xrv0[g9GB{>u!Y`_EL$a80,:zcBE]n,Z'*}E-[gb'X}_Ofy5_cslKt&hBICN;!:]Adu,AiX4s4Y8yi9fjB>Zdu
      j<$uI9{m#xuM`Z]k@_ns,LFzO83/;>B#E7o03yV&aDY6nc1W]1RDGKO+nG@Zdn:Nm4>x)c>Zh,0v_C$evAD;.:h*?RA=R6b}agH4)uFwo}(s,g
      +<G#%>v28DXP8'aIB7%!xNm'Ubq0pC4H'~V+.+P9fOH]3/o&t/HBbQ&Lou:MN9!xeW@ZX}A-Hhi3\*!vO<L`2BU&5[M?yA4q+j=?SLAL/,b(m8
      /c<JxqyN~_|hR04"(1"o|N~RF*^Hw,;j_ZSi\MmF|*E\tWuM'mh:#hn=^+%rYH>J.?;CHAgn0k*bdcO!=L1]B,O5_#jnwz'AA;&2_)qJ{j`nNC
      @AT`ewaHz[,:Pzv|9mwpD!q22,H*nCm^^O=.v_~"Q|uk!*Re2@nZby"WEfZ,RU!WEYS<b'*E3W[81_~Z3?"7^M*gnMjl0p|dSL]o,?Mr;]lB}#
      9O0s$HmMZ8F,Dqqvt_+U.;eQ?2fhgwX+eN2Xdw[wW99H}oR9NOZGX5=?L\tyi*KKx5%_MvVDEA-G*#'G}Noe:s?iyZ94ZV$bc9#-br^I4g(YFc
      s@qlkCkxgj^q9o*ZIW>9R2Q3}WV3|TqKYJF&*"K]/%Oj{^%<"kcea+e'-9>Dn,r&AYr;@J,OC.JC,u-`KqFYH9-kYj#;b%Q#8azgeZT_:Qf`yx
      {S~"`N!_1\Vi7<cyPq{QXmF*y8DT!+.]AN2=iFh9ff}q&x>Esn{8F`XV/uqt\8HRnj420>y8;u%xC;p16K4:`HmMo34p9jAc`:^?E#K8c5_puz
      rC/h3\+\z5bo8'2-e"S'fNI_7JZEB7,;NH(Zw8qi"_ZH1\(R*07gqwBA0cPH$kMj#UTXs6xk\Xfb7TCaZ/VLQi^rSn%[l/(q>-3'$~q<lD6m+:
      >c::F&,-y8omIea_vFlO4>x,8QHPMb(W^:^-Vx14;7('St=~`?d7kgOBeIoNntiCn_|XJ5NT7RgJ9c\NA2PB=T=nltkNPZoO:!eq.Ti/=kiOt*
      868VoOcD>cLH}_D*p\AcQ4}ah{[@Pq[\X\bA+g$T^fy/2B9+)*ezq[qKg5a$2N6m;cp*sNux3g%?M\#]+b]mfjKn"<:hGP@opYL&\[q5yOv8%N
      sc(\/U"0AcSFw<@PO.09Jz]hkH8IqiSj1H]py;!K'bn`C'ss0y=jB;n(ODx<VSN.mH"$'~f1Z*0*NC@pw|U?0;J$^PWe{'dV,|ue}J>/jL507t
      `aA.mU.tU*wvR,(D=xG2Zv5c6Ep~z-j/B=qp)3\|eaoHpSJj1{d43?r1MD1br-|bdVrqM9F>mX{]5D5g]tP56*_WDLwU.]Jh+:5m+@qZw"uj9G
      pf.Bemz\dEZO198(,_s'B)B3Q$l?y[bmJ|,\#dGs[@/]&]W!|ZhfXTQ'BW88~c'yUbIhVrv+&$O~5L\I=tS-%=2bVi$1:",VFRSvNmd>,w<ofo
      ~rb6}'t0c&qFIh0y9/1_[)FJJf6sb%itG#CS8`wuz$*Z%KHb")0D#,J\n"{prr=DyWr::Dhp|-S?i"WOUpx"@2!sY36PUCHp~Td*P4O|\t#t6~
      "+{:;Qt,h~4CvCRaGWo*`z/f,q(~18kQ5JXm\F\9!yhiuS69$m1b6$uoFvG~<a;A.v}pVVdY)>/?i`*pO7bc\G~px@JpZid~wc'Pq<e]{=][v`
      p0gKhl;gwrXlop~Zd+X3=3Z/~S<CJJfOsvw0'6~^62qrmA*;x[b:&4WjkR^]gFDu[_oVV`g;:{D)V+`|t&C\*]WeTg3(5nn1=&A<"L_~5SNH(%
      ,wxuV;C52VV;w^^+fPy^/D[xnv`:]{%M|.kU(yO't@XxTZ(2E?f:Trx)ED]tv}N>\e~>;q`9OOddluWEBhmSs_<nmkw(G-=[r=C1KQ27i/,}Cs
      t_]a\zD^H8``~Ljuf1]]{GohGk;]R]\YEc%!|YCYjy*/f]IQ\=<9@2;]Am{F\Uc5bH57.H_,Q"+Y_1fop5=CLe:35;rm+IF-s~JG9K&4Cp^He#
      scvbk5L9vXesyP/<]9GN-S1mDd{o3~8o6[qjp[%'5^>GY#wLjHT[o~K8<e?rq2As>:Z[bnxh*4qWV$8]rUxM`|DGbPZj3l<s{97u"kj`,a=k%e
      }v\8mri%['sgHGJbRNHl1iil$Wqf[m#(Q3tX1T&-+KSFD=jE?ezL9Z2SU,eIgI?;s14b_><]Udu=5*Bo2_y68N[Iy2!P2JM'FV5<V]V10q|rDe
      -'SFv(oN/%|@`fu89vq{:P'f}wS"K9_-Dm{_>#i"aII4t7RDBn>_eh%l*a%?&pOTMN-dr%s\~(H{ve&7b0S[\3~J1=I'Dj|YKpt^`-;X6UJh\0
      EWe^.:mUdZ?_?wyh]FCNF'c#kR,,vSsujiaU8C^'+C*mW0>;4fkKuWEa5IL!.-gosgv>s[k/?B#[ALk-4J%fPOCd(z1+Q.I+?e]O@4R&&@l8=k
      PVjfoL~U/lz/TxtlGo,"zt^LZ]S>Z)[0b*JBsX!oQ]wXX,9V?B/w](JtBt,0T(#`eQ^K"gE!X+1GlS`>uqZ91mq[xWF`Li!b3zucrNU:~WU,v{
      C'/hhd_oh1!\_aUx_5McP\AGi/yZ>%82\`m3DiW:*`x*K5|gx2ctMr'."9$AAjNO@%dY!pg]SzQ`5;>2{[H~=VtD_}fS]]a/]3lTDs|NBph`6R
      SF4N#:q&aO&>xo]rTO0(ht\W$;A7yt"p.=0rY>UtIlE!.%=:q0u^Tg%jc!`vr:{bYIt7i(z#{yxU$<Yb|3e"^:GUlx9m**5*"\5hZ`]sU#7k'@
      1LAKRA>L}Ym@^i0*q,^XJI,FKjvzR_Y1Gp']61|wHq63}+3L:"dwLSPu3,Z"t:9b~YO<tmwhxR&`uA}h^&OyIy36IL8nT=%W$"0m^]4*O!x*1R
      @cHY<blNt/_$ISnbzULM=IHMqN\+kd-x=qH5[.'jg<CjOlRBLLWOtC%Ae3BHuk$YNq[,[}Zx7B07~WdNdjJ]3Q$oJO]6`\~Lx8\q%]nCMVni2f
      #J>qv/FK19J5;/Rt||3=}3wWq}x1|ngx(Eiod,8N&#RtGXI_0Z.fjiGh$%<@*@!c!kxJR}p2&c_+*_`DNA-A=`TDj=6(8Ri%QUYoK#2wqLP2y~
      ]zIk8/6LEIzPhr]zMN?MxH*o.8=D-znS{4"5nB&z,_t&bau']CC+TQp{tBm4|Sn~b*>J=AwmJ\:,sds9E"i7}mQP4C{c~iVjfCjH$BFaqBbVk(
      =f/?aC4\B:m-})A,x9#uz+KkPB]53dJgc>wrnb/r&6B-N&]btA+w`Lv4>r9-kX5^EOWZmNi['-Rlye,ggQ&#%ow_|Yt'r+2Q1A9t&]Pvul&0PW
      XvA*N7YV{qgIz#N.:p&&9h:}tH}s)u@vQmB+9x)]I4z6R/LXdu!Wj!%k0%8`Nm:yO9U0[ASvO<K^?A+[C&Vij;;91ea5Zi^'<(W]ap"OV<&gWX
      $mb^L3+%0Qqb'=l9<~0^=9^`$%[~Nl!hb@go{V>L_(j),]>{@f[Gse</k8\&9)X`]7AdEkGtM6oe_a6n5dJR}s4t0E,Y^GJ{9U3MZYGl1LM.W/
      O~Ya}z?F^.-@rhCQ=0*l!$n]Ebdk-!S2,kyMbIVheT{Y'1{ExK~<9rPmiY>z.e.|jeLN!#E=cX)3N?Zv8{bVxZ"*hlRY:;K"hYg(gu;e&JA.I}
      t`F,q>i40Fk=Jp)P|-~.w8^`'DUwat>q<gcJy)-5+B)#cw{N{uGk6NG0G+^r^D}GriK58IeD^P:&hJnl$/Ptl'8TTH?s[Aa\<zr|k4&Qy7<Lk%
      )Tc,4tQ?9/r?TyE7NUihBm5,M}7ByF+XCV.7G;=7@7?PP=gdLfb#Q/[UD?Z[3T>*61jdhU,D/9pY^=UUnSMq>R(/@ijPQ2-h/6`M&CdXW"Z,pY
      bE(8\dF"xBnUhcn.g|]T(am)p5-[Y(G~,??>[iV^$&!TsoP8e<c)En<m({h=5h{Q4^J_BA[DJu#Exb^{|6;L/0>X_>Z&c%wOP+*"_w!'{jbjax
      Ut8[l$/i`&ZK==ag1D(WkYt7"kvL-hk/["#-8s>/JKP'f"HBs<0l5Ej4pxE.d/8Vg=%<e6GUZ'x<-"t*a%*FTK[EI]lkV7d!^]xl!'Mi\S'T=7
      m:)EYBowos*"c&U|jnEz)_4g,'6v4MLkT-VZNcevB}Q4}L.7I>4B:YkE6>[-8CE8`K'`}Z10UBhysx4l87&:pw3Z@O9_E2TS/9NPuAzs^0]vlo
      YKug$Wxz~3]]L$z-2Pk{T/qgLzHr-.(6pk;T0,\J@Ho6A!@pWZSsTKdcBv`D*l\Xdb)C=0v2\hLB^XeCJi:!ns:ly}PQ]gP|9D6i"'Ix+Dwsn0
      $02X.L=ZB@?ZG)kO*by,[\nts=(ON-><d;o.qz?M-NhjQi^Lkb2K,.}#ppRIWLxdw[`ywOw)2IKS>i?1'L~?+oyYb5;I2s-9am3d\@Wj)RwzXG
      NlmMkG1ryt(Lkwqv4ueay^G\%<+.,BajD/pE[v(CKg^3.S%Sc*]X-]uOl[6vVNjqjc'sFkjiguS6?i.Ber<|Fa:H7|rktZ8eE;w`+E|F`M\na%
      E^3[R~87C>o2F\Dk'<C':-Y?^LF8{K)M?.;56|+vNi.[Uv29J\/6@?pBy]s^c,|D!HNl2}pl;k@9K|tgdlKoPq`-7$z'Af:H(|L#fnb,Oq>fT#
      mR4o[b)(zxpj1IZ!mcPQFELJ_;FH/9hGv.v[&Ngi'sFd44V}A[kUqX|s;<W#=IYOu?ZKUBl@Xs8Hm86(xdE;5t)zu.uKAHZ:/\`l?y=@'P^wo<
      b\yua/:,(g|Z<'2.rodVt8fEH6G}hg7Jtk&.g)<)%2>,)8-CTK#&DQi)PXcL&sJZnH+.[pT'L*1.]ee[:n%#kyI*i<h40*&@`p&%ez(G{uS}Qv
      uCD`Y-MD;*P[d=?L,Dt&E|.=H\bp:[4HQ,]*xf)M?m|PwBsQg"y05K#MZb,CYu3^PDbe1~+2os_H'F#f_y@iqq;~:+:f:&/h^,!$j@dYoNp/B:
      3/@A]+h:DwHEX?~51hCX@m'<*JecPV/Io<9wL}-m9X[?ju^~sa5hgfG9+Blhf{%;dJJE"E&!_R1ZP[28T:Cd.X/V#h2I0ZKObVw^6{?W'0YDRY
      nE0R4FsSeke#w*{</4_k,^o{{L<s{(r=q}T`9,p4wsN#QV*|U\yx55G*,/A!d?}V--KFkuF+w"6/@1]Pq*(Fb0e!{k'@7R\3E:~RTjaBroF)wR
      a3Z$*+,z9zJ9oiCf+H.t]Vo?mhR<=!roX23{Cm>lEYggN&"r*B)c"KGUk5l*:M:,u$1rZ>[C;x?+YtKK:LvgK0G`Rc?t-T6>N8$$lii$G&SP%2
      *Y)LU|PSf-Iq%e}r<p:q_n?&im{$sP~:P9-N-e`g86#nyu9@,@s"[-Ls^}fg?N"*B6us~E0T3ju+l+rsTW@jCP1Ww](#ROX&{gz4+!ZAhcAv`%
      SQ%fMNUEMs<^Lj4[\Nv.CNJm-w~f_^sgXZ6{!vf1S_qQEm`^+($:!8"3*%i,](cjd=X:Oj=~@/MIxLzsGOKUxK]6EImiOAmf/JU|4gfR$Xn{dV
      ysBQq"@9+HRcs_tkf}JJpxwAxseiXG:4D]BZ_9wD)CEmjW#H;~WL`m=Lk'b"V<:,"5xS6-c8oUQ0{)=o,/;[wht\JQ:qZu"3a~AzeM^3i<%fzk
      dF[=@{r4*D2`$,qY67J&T)f6S(<tFTL\CF&9TSx[4qw1ILPbj9'/KDqxxklP*_<qc^&^C!"a!mT,@;zp=s{F%O,?5,Oy<S$H~eSo#ne~2pkERq
      TvZ8HL9fJ'Q()lkaIkb7##T-6wp?+U|KdE3^$8j=T?kIT`3BYaUxDNG=m\]_9V|q2Hyl4yOB#A#A!Yg2*[D-!SCHPB`1@i?H2,O90&NmS#I4+y
      6@%P3!b*x1\Iww\I)L2^3Ca9ZR0`N'8OMo=m:z9"<=ieQd.Y-#X/)i:cy5f,5-nmIyFm~p}]S#8m._j$8D\u4mg*UJzF?x=T|;tOk<u`"Q}nK1
      hw:Y|yi?bsq<hYxZ3tOve;98X7ReJDN[+_R3bi@!tG<Uwx>M\0jm43&:zFhXiMAv]#kir%Fq6dxS&azk;t:v~T?/a"S\|g5:dr&NEn7B;CSZ7Z
      gnvx'3V7I,ul5/q(Gca>|zTAK|?5ksQXhv:g<8mn]AtIt<WZS<Xve*4@Mb,B[3ll~=46dWO#at.=_<hG~YQbi:GZFl1isjQa[dJ[8tsR'pEL%_
      /$iGAEDO7vJ[,^-0t/74*W!]1Y?#GN.O+[ukI",GfmqwqbiVIdC'~|KTBH7wm4i((~HD#+"SS*Q*&.nn4vaPo5$x*<1s@zg{)FcN;!'4kpypch
      U8Fg:,j1g":-.Ke[y/FkWI+xwCr_ZBtr&/CnG3\2+p&NDsIhE"@IJNP-ac{[SVn)5rzL&9#sj3z~qgGbkj^/g$tcgjwHY7\Hrj/'Bj?lqNCZCg
      m>pT"PBf!lph7D,c#!q{"7sEUtT)kx>t>pvB5?2;/.A6xW#L#_FyTC&!D4=Q=pNn~$,}VOPkF%Pjc<?T1/k?B.!$LXnNM2j!YR+CaQV(V,_\\l
      R<,!K||4zBU,y"3ptTmnPN2#b(5Zr1Q~9^%i*JtAngnNy=DH.@2/PnK&Wa@;Da;AQ\hv;YhHE*}R5~pZIUN>mZNJqaG(U13<xi]OqayJ|l52P/
      B8TWb.-m-RPd"+6mO!9eWrpJi/pxzc|sSdEe[=Bz[6LeT}X~*UFXXp_-+]dEyH3uxxG.A#Ms}dN=AN^[GqE;P]a{L7oiCw]EQ\Dbj3,;hkGT<}
      bwpTD=`8@~v;Xs4Ec}aOs:E\J]FVHbbvd{`ym-xJacjRB0(#NS2t9lSXNzLnH&eI}yDss-AL$a+"W2"6di&$px*d%TyuWWghScB7ZJV9@x`uiG
      CH<Qd~~vH#Y}ItL6zfyq"($,'@%\;Y/OB5Gs_fE}=UHWV]FD'{Y#Iq(=G:E)fEVV@D/h@d#,]TZG7GBjMIT}>O9%@Yn+pv$XD}*yDq21oi%p;X
      piEbTIai}&+&YViuD+Z`=9HA#0/!2"AsN/#RBs([WdwY!Jiqu#!':9tp,Jv^<NF+g;"&L[u&:8&:X~{-$Tzp!b=%'@o}E3#aGtlI=x4~1BB@jw
      ^y'dyY[kZ`S{G^@bG'5-7|gz!iB$=Z+`%l,V]MCVO)U7^1{h"O9F`jEm3YyW$fQ(2Z.d#JXg0LlX#c""LndYAy9Aq|&I\|>[dDhx'j8Fsyamh6
      z%AIx:*l<<*rWY"D^b7C4k^,?/^/m4Hi(%K-1ZUyM8kCzNk62l<~HlRd!S:S+9Epf4A!X%&3kIccBu,T9&Ne.{Lkk=ip`*v]VVyH!pZbN51KT)
      ;7GghgIyTQ^Ij9I8&\mp,^js^ov9L98R-(X>$'i%:?7N!/VKy7<mQNAQn/sCD^_L8q=NkJW/JfU@$@@{erLDtKPC'AS6!2y@Z3:8}s,p(Nalht
      _YEBpzX31@5'1WCV{?{a0wrXKz./uM8Li'{Cx6I@+nm)Zr9$Tq)bK%4%^@"`K~Oe$5;K(*/H87Z-XR3G?oA=^Z8,c-[kK[dG,F/P9YwQOV~sOb
      `cW4ym=C<M:BT"7+i.;a@B6!wNwgX*"<9dS2nM>Ry6I`y|`grUAArHR;maq3,p2#UhGOAAhb`AUdW2U3hK1{%vPo6Zto009`K]dA/N}Fan|j`%
      h:'xaW(@`:lFvG;{_`:"k']EUlrV?o<Q%|{{L`>ix2[PXh/@_|_kGQQrA:CQBRPm3]mL:Y<tPYHjE;Iy{gX'Rm[E+*i-'$[Alij}diA30rH+T-
      iq?V_ks1<_P9^ck^?VnulaIz@~8z`pIUoj#sMiy;JS::D*~N6?TDciB@Q(;?_"[vzZL-9!u]L_+~ca9MbuW1^W=LKm`Cj{J9Sp'Dvn|Ya0$XpB
      FLPqv;dmqk;&GE^y&E!E.L<h*xLbok!Zt4F7D:)^&D:cY3K4sknHmq:ApQ$7Gqtbw.wIDUiue(uwDN9OH_Bc)=V?_&}OkmuZ/u]#b3[_8v)5eI
      :D3m}']n45S6Jtt!y'Ols~xG2R-|JR7)EPr];m!'i"f]>*.mhC@$=@6nou7EXK6kte&|Loi1m\1(VpH?o`{Pqx.DX^R;p$Nl?w<wQdzHbl6[3R
      {+Xwbgz\Tc%Dr$Wp9jr/Bbnj<YF&7S8iu"q(8~U(=''q/n!ChOY+g`Gz0dx|5n<Ee*ky_<*npQC@^R|+Nn._}%lP`4r"D)L4I/yT5!t$A0=/&P
      }e.HeDI}ZwUZG6]%Pg{OYc(D}6kSuv|4[TVlS!<_)l%Uvuz^CCBs>:`3:o%k0W^v*x*@l^+S`BpNyK6z:deT.s`NcK+Z43$'u?JfD<2I&_>Q!p
      6bp3;AKIm81"gzfa}PPQAnfA=P-Gn}}8L}HZjjM3&g'/kMDhP"c\=UU>m{Pok#$^.T.~,J_KBl]ezTJiOE%Ng(~bV*ht1'Kz/`Fbb[8nZ%$u|#
      _G4:j_A`4IxJ*FT5N+09qyBbfNHH$9Xeep@8m]C:TplW~qq4a-I]me+wI+_'y=MGs*+^8138Nky<K8Zh+;Y#O4SpO5s(qrZx2hy&*ZMsGAav$l
      ZXcFgkq"'Fy1Y&1(9JUd}Ocsef`q@Mqhp9qF,L&bZ%{fJM?;=gO;]2C,fTC!8N)06E3>|]=],

}

-- Bootstrap our common libraries by adding our filter pandoc to the lib path
local sharePath = os.getenv("QUARTO_SHARE_PATH");
-- TODO: Need to ensure that we are resolving ahead of the other path
-- and understand consequences
-- Be aware of user filters which may be using require - need to be able load their modules safely
-- Maybe namespace quarto modules somehow or alter path for user filters
if sharePath ~= nil then 
  local sep = package.config:sub(1,1)
  package.path = package.path .. ";" .. sharePath .. sep .. 'pandoc' .. sep .. 'datadir' .. sep .. '?.lua'
end

-- dependency types that will be emitted to the dedendencies file
-- (use streamed json to write a single line of json for each dependency with
-- the type and the contents)
local kDependencyTypeHtml = "html";
local kDependencyTypeLatex = "latex";
local kDependencyTypeFile = "file";
local kDependencyTypeText = "text";

-- locations that dependencies may be injected
local kBeforeBody = "before-body";
local kAfterBody = "after-body";
local kInHeader = "in-header";

-- common requires
-- this is in the global scope - anyone downstream of init may use this
local format = require '_format'
local base64 = require '_base64'
local json = require '_json'
local utils = require '_utils'
local logging = require 'logging'


-- determines whether a path is a relative path
local function isRelativeRef(ref)
  return ref:find("^/") == nil and 
         ref:find("^%a+://") == nil and 
         ref:find("^data:") == nil and 
         ref:find("^#") == nil
end

-- This is a function that returns the current script
-- path. Shortcodes can use an internal function
-- to set and clear the local value that will be used 
-- instead of pandoc's filter path when a shortcode is executing
local scriptFile = {}

local function scriptDirs()
   local dirs = { pandoc.path.directory(PANDOC_SCRIPT_FILE) }
   for i = 1, #scriptFile do
      dirs[#dirs+1] = pandoc.path.directory(scriptFile[i])
   end
   return dirs
end

local function scriptDir()
   if #scriptFile > 0 then
      return pandoc.path.directory(scriptFile[#scriptFile])
   else
      -- hard fallback
      return pandoc.path.directory(PANDOC_SCRIPT_FILE)
   end
end

-- splits a string on a separator
local function split(str, sep)
   local fields = {}
   
   local sep = sep or " "
   local pattern = string.format("([^%s]+)", sep)
   local _ignored = string.gsub(str, pattern, function(c) fields[#fields + 1] = c end)
   
   return fields
end

function is_absolute_path(path)
   if path:sub(1, pandoc.path.separator:len()) == pandoc.path.separator then
      return true
   end
   -- handle windows paths
   if path:sub(2, 2) == ":" and path:sub(3, 3) == pandoc.path.separator then
      return true
   end
   return false
end

local files_in_flight = {}
function absolute_searcher(modname)
   if not is_absolute_path(modname) then
      return nil -- not an absolute path, let someone else handle it
   end
   local function loader()
      file_to_load = modname .. '.lua'
      if files_in_flight[file_to_load] then
         error("Circular dependency detected when attempting to load module: " .. file_to_load)
         error("The following files are involved:")
         for k, v in pairs(files_in_flight) do
            error("  " ..k)
         end
         os.exit(1)
      end
      files_in_flight[file_to_load] = true
      local result = dofile(file_to_load)
      files_in_flight[file_to_load] = nil
      return result
   end
   return loader
end
table.insert(package.searchers, 1, absolute_searcher)

-- TODO: Detect the root of the project and disallow paths
-- which are both outside of the project root and outside
-- quarto's own root
local function resolve_relative_path(path)
   local segments = split(path, pandoc.path.separator)
   local resolved = {}
   if path:sub(1, 1) == pandoc.path.separator then
      resolved[1] = ""
   end
   for i = 1, #segments do
      local segment = segments[i]
      if segment == ".." then
         resolved[#resolved] = nil
      elseif segment ~= "." then
         resolved[#resolved + 1] = segment
      end
   end
   return table.concat(resolved, pandoc.path.separator)
end

-- patch require to look in current scriptDirs as well as supporting
-- relative requires
local orig_require = require
function require(modname)
   -- This supports relative requires. We need to resolve them carefully in two ways:
   --
   -- first, we need to ensure it is resolved relative to the current script.
   -- second, we need to make sure that different paths that resolve to the
   -- same file are cached as the same module.
   --
   -- this means we need to put ourselves in front of the standard require()
   -- call, since it checks cache by `modname` and we need to make sure that
   -- `modname` is always the same for the same file.
   --
   -- We achieve both by forcing the call to orig_require in relative requires
   -- to always take a fully-qualified path.
   --
   -- This strategy is not going to work in general, in the presence of symlinks
   -- and other things that can make two paths resolve to the same file. But
   -- it's good enough for our purposes.
   if modname:sub(1, 1) == "." then
      local calling_file = debug.getinfo(2, "S").source:sub(2, -1)
      local calling_dir = pandoc.path.directory(calling_file)
      if calling_dir == "." then
         -- resolve to current working directory
         calling_dir = scriptDir()
      end
      if calling_dir == "." then
         -- last-ditch effort, use the current working directory
         calling_dir = pandoc.system.get_working_directory()
      end
      local resolved_path = resolve_relative_path(pandoc.path.normalize(pandoc.path.join({calling_dir, modname})))
      return require(resolved_path)
   end
   local old_path = package.path
   local new_path = package.path
   local dirs = scriptDirs()
   for i, v in ipairs(dirs) do
      new_path = new_path .. ';' .. pandoc.path.join({v, '?.lua'})
   end

   package.path = new_path
   local mod = orig_require(modname)
   package.path = old_path
   return mod
end


-- resolves a path, providing either the original path
-- or if relative, a path that is based upon the 
-- script location
local function resolvePath(path)
  if isRelativeRef(path) then
    local wd = pandoc.system.get_working_directory()
    return pandoc.path.join({wd, pandoc.path.normalize(path)})
  else
    return path    
  end
end

local function resolvePathExt(path) 
  if isRelativeRef(path) then
    return resolvePath(pandoc.path.join({scriptDir(), pandoc.path.normalize(path)}))
  else
    return path
  end
end
-- converts the friendly Quartio location names 
-- in the pandoc location
local function resolveLocation(location) 
   if (location == kInHeader) then
     return "header-includes"
   elseif (location == kAfterBody) then
     return "include-after"
   elseif (location == kBeforeBody) then
     return "include-before"
   else
     error("Illegal value for dependency location. " .. location .. " is not a valid location.")
   end
 end 

-- Provides the path to the dependency file
-- The dependency file can be used to persist dependencies across filter
-- passes, but will also be inspected after pandoc is 
-- done running to deterine any files that should be copied
local function dependenciesFile()
  local dependenciesFile = os.getenv("QUARTO_FILTER_DEPENDENCY_FILE")
  if dependenciesFile == nil then
    error('Missing expected dependency file environment variable QUARTO_FILTER_DEPENDENCY_FILE')
  else
    return pandoc.utils.stringify(dependenciesFile)
  end
end

-- creates a dependency object
local function dependency(dependencyType, dependency) 
  return {
    type = dependencyType,
    content = dependency
  }
end

-- writes a dependency object to the dependency file
local function writeToDependencyFile(dependency)
  local dependencyJson = json.encode(dependency)
  local file = io.open(dependenciesFile(), "a")
  if file ~= nil then
     file:write(dependencyJson .. "\n")
     file:close()
  else
     fail('Error opening dependencies file at ' .. dependenciesFile())
  end
end

-- process a file dependency (read the contents of the file)
-- and include it verbatim in the specified location
local function processFileDependency(dependency, meta)
   -- read file contents
   local rawFile = dependency.content
   local f = io.open(pandoc.utils.stringify(rawFile.path), "r")
   if f ~= nil then
      local fileContents = f:read("*all")
      f:close()

      -- Determine the format with special treatment for verbatim HTML
      if format.isFormat("html") then
         blockFormat = "html"
      else
         blockFormat = FORMAT
      end
   
      -- place the contents of the file right where it belongs
      meta[rawFile.location]:insert(pandoc.Blocks({ pandoc.RawBlock(blockFormat, fileContents) }))
   else
      fail('Error reading dependencies from ' .. rawFile.path)
   end
 
   
 end

 -- process a text dependency, placing it in the specified location
local function processTextDependency(dependency, meta)
   local rawText = dependency.content
   local textLoc = rawText.location

   if meta[textLoc] == nil then
      meta[textLoc] = {}
   end
   meta[textLoc]:insert(pandoc.RawBlock(FORMAT, rawText.text))
 end

 -- make the usePackage statement
local function usePackage(package, option)
   local text = ''
   if option == nil then
     text = "\\makeatletter\n\\@ifpackageloaded{" .. package .. "}{}{\\usepackage{" .. package .. "}}\n\\makeatother"
   else
     text = "\\makeatletter\n\\@ifpackageloaded{" .. package .. "}{}{\\usepackage[" .. option .. "]{" .. package .. "}}\n\\makeatother"
   end
   return pandoc.Blocks({ pandoc.RawBlock("latex", text) })
 end
  
 -- generate a latex usepackage statement
 local function processUsePackageDependency(dependency, meta)
   local rawPackage = dependency.content
   
   local headerLoc = resolveLocation(kInHeader)
   if meta[headerLoc] == nil then
      meta[headerLoc] = {}
   end
   table.insert(meta[headerLoc], usePackage(rawPackage.package, rawPackage.options))
 end
 
 
-- process the dependencies that are present in the dependencies
-- file, injecting appropriate meta content and replacing
-- the contents of the dependencies file with paths to 
-- file dependencies that should be copied by Quarto
local function processDependencies(meta) 
   local dependenciesFile = dependenciesFile()

   -- holds a list of hashes for dependencies that
   -- have been processed. Process each dependency
   -- only once
   local injectedText = {}
   local injectedFile = {}
   local injectedPackage = {}

  -- each line was written as a dependency.
  -- process them and contribute the appropriate headers
  for line in io.lines(dependenciesFile) do 
    local dependency = json.decode(line)
    if dependency.type == 'text' then
      if not utils.table.contains(injectedText, dependency.content) then
         processTextDependency(dependency, meta)
         injectedText[#injectedText + 1] = dependency.content   
      end
    elseif dependency.type == "file" then
      if not utils.table.contains(injectedFile, dependency.content.path) then
         processFileDependency(dependency, meta)
         injectedFile[#injectedFile + 1] = dependency.content.path
      end
    elseif dependency.type == "usepackage" then
      if not utils.table.contains(injectedPackage, dependency.content.package) then
         processUsePackageDependency(dependency, meta)
         injectedPackage[#injectedPackage + 1] = dependency.content.package
      end
    end
  end
end

-- resolves the file paths for an array/list of depependency files
local function resolveDependencyFilePaths(dependencyFiles) 
   if dependencyFiles ~= nil then
      for i,v in ipairs(dependencyFiles) do
         v.path = resolvePathExt(v.path)
      end
      return dependencyFiles
   else 
      return nil
   end
end

-- resolves the hrefs for an array/list of link tags
local function resolveDependencyLinkTags(linkTags)
   if linkTags ~= nil then
      for i, v in ipairs(linkTags) do
         v.href = resolvePath(v.href)
      end
      return linkTags
   else
      return nil
   end
end

-- Convert dependency files which may be just a string (path) or
-- incomplete objects into valid file dependencies
local function resolveFileDependencies(name, dependencyFiles)
   if dependencyFiles ~= nil then
 
     -- make sure this is an array
     if type(dependencyFiles) ~= "table" or not utils.table.isarray(dependencyFiles) then
       error("Invalid HTML Dependency: " .. name .. " property must be an array")
     end

 
     local finalDependencies = {}
     for i, v in ipairs(dependencyFiles) do
      if type(v) == "table" then
             -- fill in the name, if one is not provided
             if v.name == nil then
                v.name = pandoc.path.filename(v.path)
             end
             finalDependencies[i] = v
       elseif type(v) == "string" then
             -- turn a string into a name and path
             finalDependencies[i] = {
                name = pandoc.path.filename(v),
                path = v
             }
       else
             -- who knows what this is!
             error("Invalid HTML Dependency: " .. name .. " property contains an unexpected type.")
       end
     end
     return finalDependencies
   else
     return nil
   end
end

-- Convert dependency files which may be just a string (path) or
-- incomplete objects into valid file dependencies
local function resolveServiceWorkers(serviceworkers)
   if serviceworkers ~= nil then 
    -- make sure this is an array
     if type(serviceworkers) ~= "table" or not utils.table.isarray(serviceworkers) then
       error("Invalid HTML Dependency: serviceworkers property must be an array")
     end
 
     local finalServiceWorkers = {}
     for i, v in ipairs(serviceworkers) do
       if type(v) == "table" then
         -- fill in the destination as the root, if one is not provided
         if v.source == nil then
           error("Invalid HTML Dependency: a serviceworker must have a source.")
         else
           v.source = resolvePathExt(v.source)
         end
         finalServiceWorkers[i] = v

       elseif type(v) == "string" then
         -- turn a string into a name and path
         finalServiceWorkers[i] = {
            source = resolvePathExt(v)
         }
       else
         -- who knows what this is!
         error("Invalid HTML Dependency: serviceworkers property contains an unexpected type.")
       end
     end
     return finalServiceWorkers
   else
     return nil
   end
 end


local latexTableWithOptionsPattern = "(\\begin{table}%[[^%]]+%])(.*)(\\end{table})"
local latexTablePattern = "(\\begin{table})(.*)(\\end{table})"
local latexLongtablePatternwWithPosAndAlign = "(\\begin{longtable}%[[^%]]+%]{[^\n]*})(.*)(\\end{longtable})"
local latexLongtablePatternWithPos = "(\\begin{longtable}%[[^%]]+%])(.*)(\\end{longtable})"
local latexLongtablePatternWithAlign = "(\\begin{longtable}{[^\n]*})(.*)(\\end{longtable})"
local latexLongtablePattern = "(\\begin{longtable})(.*)(\\end{longtable})"
local latexTabularPatternWithPosAndAlign = "(\\begin{tabular}%[[^%]]+%]{[^\n]*})(.*)(\\end{tabular})"
local latexTabularPatternWithPos = "(\\begin{tabular}%[[^%]]+%])(.*)(\\end{tabular})"
local latexTabularPatternWithAlign = "(\\begin{tabular}{[^\n]*})(.*)(\\end{tabular})"
local latexTabularPattern = "(\\begin{tabular})(.*)(\\end{tabular})"
local latexCaptionPattern =  "(\\caption{)(.-)(}[^\n]*\n)"

local latexTablePatterns = pandoc.List({
  latexTableWithOptionsPattern,
  latexTablePattern,
  latexLongtablePatternwWithPosAndAlign,
  latexLongtablePatternWithPos,
  latexLongtablePatternWithAlign,
  latexLongtablePattern,
  latexTabularPatternWithPosAndAlign,
  latexTabularPatternWithPos,
  latexTabularPatternWithAlign,
  latexTabularPattern,
})

-- global quarto params
local paramsJson = base64.decode(os.getenv("QUARTO_FILTER_PARAMS"))
local quartoParams = json.decode(paramsJson)

function param(name, default)
  local value = quartoParams[name]
  if value == nil then
    value = default
  end
  return value
end

local function projectDirectory() 
   return os.getenv("QUARTO_PROJECT_DIR")
end

local function projectOutputDirectory()
   local outputDir = param("project-output-dir", "")
   local projectDir = projectDirectory()
   if projectDir then
      return pandoc.path.join({projectDir, outputDir})
   else
      return nil
   end
end

-- Provides the project relative path to the current input
-- if this render is in the context of a project
local function projectRelativeOutputFile()
   
   -- the project directory
   local projDir = projectDirectory()

   -- the offset to the project
   if projDir then
      -- relative from project directory to working directory
      local workingDir = pandoc.system.get_working_directory()
      local projRelFolder = pandoc.path.make_relative(workingDir, projDir, false)
      
      -- add the file output name and normalize
      local projRelPath = pandoc.path.join({projRelFolder, PANDOC_STATE['output_file']})
      return pandoc.path.normalize(projRelPath);
   else
      return nil
   end
end

local function inputFile()
   local source = param("quarto-source", "")
   if pandoc.path.is_absolute(source) then 
      return source
   else
      local projectDir = projectDirectory()
      if projectDir then
         return pandoc.path.join({projectDir, source})
      else
         return pandoc.path.join({pandoc.system.get_working_directory(), source})
      end   
   end
end

local function outputFile() 
   local projectOutDir = projectOutputDirectory()
   if projectOutDir then
      local projectDir = projectDirectory()
      if projectDir then
         local input = pandoc.path.directory(inputFile())
         local relativeDir = pandoc.path.make_relative(input, projectDir)
         if relativeDir and relativeDir ~= '.' then
            return pandoc.path.join({projectOutDir, relativeDir, PANDOC_STATE['output_file']})
         end
      end
      return pandoc.path.join({projectOutDir, PANDOC_STATE['output_file']})
   else
      return pandoc.path.join({pandoc.system.get_working_directory(), PANDOC_STATE['output_file']})
   end
end

local function version()
   local versionString = param('quarto-version', 'unknown')
   local success, versionObject = pcall(pandoc.types.Version, versionString)
   if success then
      return versionObject
   else
      return versionString
   end
end

local function projectProfiles()
   return param('quarto_profile', {})
end

local function projectOffset() 
   return param('project-offset', nil)
end

local function file_exists(name)
   local f = io.open(name, 'r')
   if f ~= nil then
     io.close(f)
     return true
   else
     return false
   end
 end


 local function write_file(path, contents, mode)
   pandoc.system.make_directory(pandoc.path.directory(path), true)
   mode = mode or "a"
   local file = io.open(path, mode)
   if file then
     file:write(contents)
     file:close()
     return true
   else
     return false
   end
 end
 
 local function read_file(path)
   local file = io.open(path, "rb") 
   if not file then return nil end
   local content = file:read "*a"
   file:close()
   return content
 end

 local function remove_file(path) 
   return os.remove(path)
 end

-- Quarto internal module - makes functions available
-- through the filters
_quarto = {   
   processDependencies = processDependencies,
   format = format,
   patterns = {
      latexTabularPattern = latexTabularPattern,
      latexTablePattern = latexTablePattern,
      latexLongtablePattern = latexLongtablePattern,
      latexTablePatterns = latexTablePatterns,
      latexCaptionPattern = latexCaptionPattern
   },
   utils = utils,
   withScriptFile = function(file, callback)
      table.insert(scriptFile, file)
      local result = callback()
      table.remove(scriptFile, #scriptFile)
      return result
   end,
   projectOffset = projectOffset,
   file = {
      read = read_file,
      write = function(path, contents) 
         return write_file(path, contents, "wb") 
      end,
      write_text = function(path, contents) 
         return write_file(path, contents, "a")
      end,
      exists = file_exists,
      remove = remove_file
   }
 } 

-- The main exports of the quarto module
quarto = {
  doc = {
    add_html_dependency = function(htmlDependency)
   
      -- validate the dependency
      if htmlDependency.name == nil then 
         error("HTML dependencies must include a name")
      end

      if htmlDependency.meta == nil and 
         htmlDependency.links == nil and 
         htmlDependency.scripts == nil and 
         htmlDependency.stylesheets == nil and 
         htmlDependency.resources == nil and
         htmlDependency.seviceworkers == nil and
         htmlDependency.head == nil then
         error("HTML dependencies must include at least one of meta, links, scripts, stylesheets, seviceworkers, or resources. All appear empty.")
      end

      -- validate that the meta is as expected
      if htmlDependency.meta ~= nil then
         if type(htmlDependency.meta) ~= 'table' then
               error("Invalid HTML Dependency: meta value must be a table")
         elseif utils.table.isarray(htmlDependency.meta) then
               error("Invalid HTML Dependency: meta value must must not be an array")
         end
      end

      -- validate link tags
      if htmlDependency.links ~= nil then
         if type(htmlDependency.links) ~= 'table' or not utils.table.isarray(htmlDependency.links) then
            error("Invalid HTML Dependency: links must be an array")
         else 
            for i, v in ipairs(htmlDependency.links) do
               if type(v) ~= "table" or (v.href == nil or v.rel == nil) then
                 error("Invalid HTML Dependency: each link must be a table containing both rel and href properties.")
               end
            end
         end
      end
   
      -- resolve names so they aren't required
      htmlDependency.scripts = resolveFileDependencies("scripts", htmlDependency.scripts)
      htmlDependency.stylesheets = resolveFileDependencies("stylesheets", htmlDependency.stylesheets)
      htmlDependency.resources = resolveFileDependencies("resources", htmlDependency.resources)

      -- pass the dependency through to the file
      writeToDependencyFile(dependency("html", {
         name = htmlDependency.name,
         version = htmlDependency.version,
         external = true,
         meta = htmlDependency.meta,
         links = resolveDependencyLinkTags(htmlDependency.links),
         scripts = resolveDependencyFilePaths(htmlDependency.scripts),
         stylesheets = resolveDependencyFilePaths(htmlDependency.stylesheets),
         resources = resolveDependencyFilePaths(htmlDependency.resources),
         serviceworkers = resolveServiceWorkers(htmlDependency.serviceworkers),
         head = htmlDependency.head,
      }))
    end,

    attach_to_dependency = function(name, pathOrFileObj)

      if name == nil then
         error("The target dependency name for an attachment cannot be nil. Please provide a valid dependency name.")
         os.exit(1)
      end

      -- path can be a string or an obj { name, path }
      local resolvedFile = {}
      if type(pathOrFileObj) == "table" then

         -- validate that there is at least a path
         if pathOrFileObj.path == nil then
            error("Error attaching to dependency '" .. name .. "'.\nYou must provide a 'path' when adding an attachment to a dependency.")
            os.exit(1)
         end

         -- resolve a name, if one isn't provided
         local name = pathOrFileObj.name      
         if name == nil then
            name = pandoc.path.filename(pathOrFileObj.path)
         end

         -- the full resolved file
         resolvedFile = {
            name = name,
            path = resolvePathExt(pathOrFileObj.path)
         }
      else
         resolvedFile = {
            name = pandoc.path.filename(pathOrFileObj),
            path = resolvePathExt(pathOrFileObj)
         }
      end

      writeToDependencyFile(dependency("html-attachment", {
         name = name,
         file = resolvedFile
      }))
    end,
  
    use_latex_package = function(package, options)
      writeToDependencyFile(dependency("usepackage", {package = package, options = options }))
    end,

    add_format_resource = function(path)
      writeToDependencyFile(dependency("format-resources", { file = resolvePathExt(path)}))
    end,

    include_text = function(location, text)
      writeToDependencyFile(dependency("text", { text = text, location = resolveLocation(location)}))
    end,
  
    include_file = function(location, path)
      writeToDependencyFile(dependency("file", { path = resolvePathExt(path), location = resolveLocation(location)}))
    end,

    is_format = format.isFormat,

    cite_method = function() 
      local citeMethod = param('cite-method', 'citeproc')
      return citeMethod
    end,
    pdf_engine = function() 
      local engine = param('pdf-engine', 'pdflatex')
      return engine      
    end,
    has_bootstrap = function() 
      local hasBootstrap = param('has-bootstrap', false)
      return hasBootstrap
    end,
    is_filter_active = function(filter)
      return preState.active_filters[filter]
    end,

    output_file = outputFile(),
    input_file = inputFile()
  },
  project = {
   directory = projectDirectory(),
   offset = projectOffset(),
   profile = pandoc.List(projectProfiles()),
   output_directory = projectOutputDirectory()
  },
  utils = {
   dump = utils.dump,
   table = utils.table,
   type = utils.type,
   resolve_path = resolvePathExt,
   resolve_path_relative_to_document = resolvePath,
   as_inlines = utils.as_inlines,
   as_blocks = utils.as_blocks
  },
  json = json,
  base64 = base64,
  log = logging,
  version = version()
}

-- alias old names for backwards compatibility
quarto.doc.addHtmlDependency = quarto.doc.add_html_dependency
quarto.doc.attachToDependency = quarto.doc.attach_to_dependency
quarto.doc.useLatexPackage = quarto.doc.use_latex_package
quarto.doc.addFormatResource = quarto.doc.add_format_resource
quarto.doc.includeText = quarto.doc.include_text
quarto.doc.includeFile = quarto.doc.include_file
quarto.doc.isFormat = quarto.doc.is_format
quarto.doc.citeMethod = quarto.doc.cite_method
quarto.doc.pdfEngine = quarto.doc.pdf_engine
quarto.doc.hasBootstrap = quarto.doc.has_bootstrap
quarto.doc.project_output_file = projectRelativeOutputFile
quarto.utils.resolvePath = quarto.utils.resolve_path

-- since Pandoc 3, pandoc.Null is no longer an allowed constructor.
-- this workaround makes it so that our users extensions which use pandoc.Null 
-- still work, assuming they call pandoc.Null() in a "simple" way.
pandoc.Null = function()
   return {}
end