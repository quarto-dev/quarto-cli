---
title: "Table"
format:
  pdf: 
    keep-md: true
    keep-tex: true
    # crossref: false
    # filters:
    #   - pandoc-crossref
tblPrefix: "tableeee"
---




::: {.cell .cell-code}

:::


See @Tbl:label.

::: {.cell .cell-code}

```r
knitr::kable(head(mtcars), format = "html",caption = "A grand table")
```

::: {#tbl:jj .output .display_data}
```{=html}
<table>
<caption>A grand table</caption>
 <thead>
  <tr>
   <th style="text-align:left;">   </th>
   <th style="text-align:right;"> mpg </th>
   <th style="text-align:right;"> cyl </th>
   <th style="text-align:right;"> disp </th>
   <th style="text-align:right;"> hp </th>
   <th style="text-align:right;"> drat </th>
   <th style="text-align:right;"> wt </th>
   <th style="text-align:right;"> qsec </th>
   <th style="text-align:right;"> vs </th>
   <th style="text-align:right;"> am </th>
   <th style="text-align:right;"> gear </th>
   <th style="text-align:right;"> carb </th>
  </tr>
 </thead>
<tbody>
  <tr>
   <td style="text-align:left;"> Mazda RX4 </td>
   <td style="text-align:right;"> 21.0 </td>
   <td style="text-align:right;"> 6 </td>
   <td style="text-align:right;"> 160 </td>
   <td style="text-align:right;"> 110 </td>
   <td style="text-align:right;"> 3.90 </td>
   <td style="text-align:right;"> 2.620 </td>
   <td style="text-align:right;"> 16.46 </td>
   <td style="text-align:right;"> 0 </td>
   <td style="text-align:right;"> 1 </td>
   <td style="text-align:right;"> 4 </td>
   <td style="text-align:right;"> 4 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> Mazda RX4 Wag </td>
   <td style="text-align:right;"> 21.0 </td>
   <td style="text-align:right;"> 6 </td>
   <td style="text-align:right;"> 160 </td>
   <td style="text-align:right;"> 110 </td>
   <td style="text-align:right;"> 3.90 </td>
   <td style="text-align:right;"> 2.875 </td>
   <td style="text-align:right;"> 17.02 </td>
   <td style="text-align:right;"> 0 </td>
   <td style="text-align:right;"> 1 </td>
   <td style="text-align:right;"> 4 </td>
   <td style="text-align:right;"> 4 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> Datsun 710 </td>
   <td style="text-align:right;"> 22.8 </td>
   <td style="text-align:right;"> 4 </td>
   <td style="text-align:right;"> 108 </td>
   <td style="text-align:right;"> 93 </td>
   <td style="text-align:right;"> 3.85 </td>
   <td style="text-align:right;"> 2.320 </td>
   <td style="text-align:right;"> 18.61 </td>
   <td style="text-align:right;"> 1 </td>
   <td style="text-align:right;"> 1 </td>
   <td style="text-align:right;"> 4 </td>
   <td style="text-align:right;"> 1 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> Hornet 4 Drive </td>
   <td style="text-align:right;"> 21.4 </td>
   <td style="text-align:right;"> 6 </td>
   <td style="text-align:right;"> 258 </td>
   <td style="text-align:right;"> 110 </td>
   <td style="text-align:right;"> 3.08 </td>
   <td style="text-align:right;"> 3.215 </td>
   <td style="text-align:right;"> 19.44 </td>
   <td style="text-align:right;"> 1 </td>
   <td style="text-align:right;"> 0 </td>
   <td style="text-align:right;"> 3 </td>
   <td style="text-align:right;"> 1 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> Hornet Sportabout </td>
   <td style="text-align:right;"> 18.7 </td>
   <td style="text-align:right;"> 8 </td>
   <td style="text-align:right;"> 360 </td>
   <td style="text-align:right;"> 175 </td>
   <td style="text-align:right;"> 3.15 </td>
   <td style="text-align:right;"> 3.440 </td>
   <td style="text-align:right;"> 17.02 </td>
   <td style="text-align:right;"> 0 </td>
   <td style="text-align:right;"> 0 </td>
   <td style="text-align:right;"> 3 </td>
   <td style="text-align:right;"> 2 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> Valiant </td>
   <td style="text-align:right;"> 18.1 </td>
   <td style="text-align:right;"> 6 </td>
   <td style="text-align:right;"> 225 </td>
   <td style="text-align:right;"> 105 </td>
   <td style="text-align:right;"> 2.76 </td>
   <td style="text-align:right;"> 3.460 </td>
   <td style="text-align:right;"> 20.22 </td>
   <td style="text-align:right;"> 1 </td>
   <td style="text-align:right;"> 0 </td>
   <td style="text-align:right;"> 3 </td>
   <td style="text-align:right;"> 1 </td>
  </tr>
</tbody>
</table>
```
:::
:::



::: {#tbl:charles}
```{=html}
<table>
  <caption>Monthly savings</caption>
  <tr>
    <th>Month</th>
    <th>Savings</th>
  </tr>
  <tr>
    <td>January</td>
    <td>$100</td>
  </tr>
</table>
```
:::





Phasellus convallis auctor quam, in rhoncus diam. Maecenas commodo id neque vel venenatis. Etiam vel tempus arcu, vitae faucibus sem. Vestibulum posuere urna at est scelerisque molestie. Nam eget tortor vulputate, consequat quam et, mattis est. Nullam tempus dolor nibh, quis sodales lorem tristique congue. Morbi enim metus, pulvinar eget ante non, tristique gravida ante. Pellentesque consequat vel tortor a vestibulum. In hac habitasse platea dictumst. Nullam quis condimentum dui. Nunc consequat nunc ut ligula dignissim, quis tempus mi tincidunt. Aliquam fringilla, diam ac mollis efficitur, mi sem tincidunt tellus, vel pharetra metus augue ac ex.

Mauris ullamcorper finibus tempus. Quisque aliquam, dui eu fringilla pulvinar, velit purus gravida lacus, vel porttitor massa purus eu nunc. Nullam eu sem dictum, tincidunt quam eget, ultricies purus. Vivamus congue viverra fermentum. Nulla pretium neque a accumsan lacinia. In id mi nec urna luctus volutpat nec a risus. Donec arcu dui, dictum a sollicitudin vel, consequat vel libero. Nam tempor hendrerit neque, id imperdiet purus efficitur id. Duis ac nunc sit amet odio venenatis convallis sed non lacus.

::: {#tbl:another}
In porta finibus lorem vitae dignissim. Nulla interdum leo ut tincidunt aliquet. Morbi sollicitudin, est in fermentum efficitur, ipsum dolor imperdiet diam, vel vulputate arcu eros a neque. Ut posuere massa erat, sed porttitor tortor placerat in. Cras dignissim a tellus nec tincidunt. Integer posuere scelerisque volutpat. Donec ut efficitur mauris, ut facilisis lectus. Praesent felis metus, interdum eu mollis at, convallis ac dui. Donec sed mi vitae est commodo sodales. Vivamus facilisis rhoncus lectus, a ultricies libero ullamcorper non. Duis sollicitudin sapien a nisi porta venenatis. Vestibulum ultricies sem ac augue feugiat porta. Sed iaculis mauris fermentum, ultricies dolor vitae, gravida massa. Aliquam hendrerit volutpat hendrerit. Quisque quam libero, convallis nec ante ut, accumsan sagittis elit. Proin mauris diam, feugiat eu ipsum ac, viverra semper arcu.

Table caption for another
:::


| Col1 | Col2 | Col3 |
|------|------|------|
| A    | B    | C    |
| E    | E    | F    |
| G    | H    | I    |

: The Caption {\#tbl:label}


See @tbl:charles for additional data.


