---
title: "GT SUmmary"
output: 
  html_document:
    keep_md: true
format:
  html:
    keep-md: true
knit: quarto render
---




::: {.cell .code}
::: {.output .display_data}
`<div class="mydiv">This is the div</div>`{=html}
:::
:::


## Modelsummary

::: {.cell .code}
::: {.output .display_data}
<table class="table table" style="width: auto !important; margin-left: auto; margin-right: auto; margin-left: auto; margin-right: auto;">
<caption>This title describes the content of this table.</caption>
 <thead>
  <tr>
   <th style="text-align:left;">   </th>
   <th style="text-align:center;"> Model 1 </th>
  </tr>
 </thead>
<tbody>
  <tr>
   <td style="text-align:left;"> (Intercept) </td>
   <td style="text-align:center;"> 324.082 </td>
  </tr>
  <tr>
   <td style="text-align:left;">  </td>
   <td style="text-align:center;"> (27.433) </td>
  </tr>
  <tr>
   <td style="text-align:left;"> mpg </td>
   <td style="text-align:center;"> -8.830 </td>
  </tr>
  <tr>
   <td style="text-align:left;">  </td>
   <td style="text-align:center;"> (1.310) </td>
  </tr>
  <tr>
   <td style="text-align:left;"> Num.Obs. </td>
   <td style="text-align:center;"> 32 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> R2 </td>
   <td style="text-align:center;"> 0.602 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> R2 Adj. </td>
   <td style="text-align:center;"> 0.589 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> AIC </td>
   <td style="text-align:center;"> 336.9 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> BIC </td>
   <td style="text-align:center;"> 341.3 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> Log.Lik. </td>
   <td style="text-align:center;"> -165.428 </td>
  </tr>
  <tr>
   <td style="text-align:left;"> F </td>
   <td style="text-align:center;"> 45.460 </td>
  </tr>
</tbody>
</table>
:::
:::

## GT Summary

::: {.cell .code}
::: {.output .display_data}
```{=html}
<style>html {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', 'Fira Sans', 'Droid Sans', Arial, sans-serif;
}

#ngeczbtkfa .gt_table {
  display: table;
  border-collapse: collapse;
  margin-left: auto;
  margin-right: auto;
  color: #333333;
  font-size: 16px;
  font-weight: normal;
  font-style: normal;
  background-color: #FFFFFF;
  width: auto;
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #A8A8A8;
  border-right-style: none;
  border-right-width: 2px;
  border-right-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #A8A8A8;
  border-left-style: none;
  border-left-width: 2px;
  border-left-color: #D3D3D3;
}

#ngeczbtkfa .gt_heading {
  background-color: #FFFFFF;
  text-align: center;
  border-bottom-color: #FFFFFF;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
}

#ngeczbtkfa .gt_title {
  color: #333333;
  font-size: 125%;
  font-weight: initial;
  padding-top: 4px;
  padding-bottom: 4px;
  border-bottom-color: #FFFFFF;
  border-bottom-width: 0;
}

#ngeczbtkfa .gt_subtitle {
  color: #333333;
  font-size: 85%;
  font-weight: initial;
  padding-top: 0;
  padding-bottom: 4px;
  border-top-color: #FFFFFF;
  border-top-width: 0;
}

#ngeczbtkfa .gt_bottom_border {
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
}

#ngeczbtkfa .gt_col_headings {
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
}

#ngeczbtkfa .gt_col_heading {
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: normal;
  text-transform: inherit;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
  vertical-align: bottom;
  padding-top: 5px;
  padding-bottom: 6px;
  padding-left: 5px;
  padding-right: 5px;
  overflow-x: hidden;
}

#ngeczbtkfa .gt_column_spanner_outer {
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: normal;
  text-transform: inherit;
  padding-top: 0;
  padding-bottom: 0;
  padding-left: 4px;
  padding-right: 4px;
}

#ngeczbtkfa .gt_column_spanner_outer:first-child {
  padding-left: 0;
}

#ngeczbtkfa .gt_column_spanner_outer:last-child {
  padding-right: 0;
}

#ngeczbtkfa .gt_column_spanner {
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  vertical-align: bottom;
  padding-top: 5px;
  padding-bottom: 6px;
  overflow-x: hidden;
  display: inline-block;
  width: 100%;
}

#ngeczbtkfa .gt_group_heading {
  padding: 8px;
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: initial;
  text-transform: inherit;
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
  vertical-align: middle;
}

#ngeczbtkfa .gt_empty_group_heading {
  padding: 0.5px;
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: initial;
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  vertical-align: middle;
}

#ngeczbtkfa .gt_from_md > :first-child {
  margin-top: 0;
}

#ngeczbtkfa .gt_from_md > :last-child {
  margin-bottom: 0;
}

#ngeczbtkfa .gt_row {
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
  margin: 10px;
  border-top-style: solid;
  border-top-width: 1px;
  border-top-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
  vertical-align: middle;
  overflow-x: hidden;
}

#ngeczbtkfa .gt_stub {
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: initial;
  text-transform: inherit;
  border-right-style: solid;
  border-right-width: 2px;
  border-right-color: #D3D3D3;
  padding-left: 12px;
}

#ngeczbtkfa .gt_summary_row {
  color: #333333;
  background-color: #FFFFFF;
  text-transform: inherit;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
}

#ngeczbtkfa .gt_first_summary_row {
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
}

#ngeczbtkfa .gt_grand_summary_row {
  color: #333333;
  background-color: #FFFFFF;
  text-transform: inherit;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
}

#ngeczbtkfa .gt_first_grand_summary_row {
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
  border-top-style: double;
  border-top-width: 6px;
  border-top-color: #D3D3D3;
}

#ngeczbtkfa .gt_striped {
  background-color: rgba(128, 128, 128, 0.05);
}

#ngeczbtkfa .gt_table_body {
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
}

#ngeczbtkfa .gt_footnotes {
  color: #333333;
  background-color: #FFFFFF;
  border-bottom-style: none;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 2px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 2px;
  border-right-color: #D3D3D3;
}

#ngeczbtkfa .gt_footnote {
  margin: 0px;
  font-size: 90%;
  padding: 4px;
}

#ngeczbtkfa .gt_sourcenotes {
  color: #333333;
  background-color: #FFFFFF;
  border-bottom-style: none;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 2px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 2px;
  border-right-color: #D3D3D3;
}

#ngeczbtkfa .gt_sourcenote {
  font-size: 90%;
  padding: 4px;
}

#ngeczbtkfa .gt_left {
  text-align: left;
}

#ngeczbtkfa .gt_center {
  text-align: center;
}

#ngeczbtkfa .gt_right {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

#ngeczbtkfa .gt_font_normal {
  font-weight: normal;
}

#ngeczbtkfa .gt_font_bold {
  font-weight: bold;
}

#ngeczbtkfa .gt_font_italic {
  font-style: italic;
}

#ngeczbtkfa .gt_super {
  font-size: 65%;
}

#ngeczbtkfa .gt_footnote_marks {
  font-style: italic;
  font-size: 65%;
}
</style>
<div id="ngeczbtkfa" style="overflow-x:auto;overflow-y:auto;width:auto;height:auto;"><table class="gt_table">
  
  <thead class="gt_col_headings">
    <tr>
      <th class="gt_col_heading gt_center gt_columns_bottom_border" rowspan="2" colspan="1"><strong>Characteristic</strong></th>
      <th class="gt_center gt_columns_top_border gt_column_spanner_outer" rowspan="1" colspan="3">
        <span class="gt_column_spanner"><strong>Tumor Response</strong></span>
      </th>
      <th class="gt_center gt_columns_top_border gt_column_spanner_outer" rowspan="1" colspan="3">
        <span class="gt_column_spanner"><strong>Time to Death</strong></span>
      </th>
    </tr>
    <tr>
      <th class="gt_col_heading gt_columns_bottom_border gt_center" rowspan="1" colspan="1"><strong>OR</strong><sup class="gt_footnote_marks">1</sup></th>
      <th class="gt_col_heading gt_columns_bottom_border gt_center" rowspan="1" colspan="1"><strong>95% CI</strong><sup class="gt_footnote_marks">1</sup></th>
      <th class="gt_col_heading gt_columns_bottom_border gt_center" rowspan="1" colspan="1"><strong>p-value</strong></th>
      <th class="gt_col_heading gt_columns_bottom_border gt_center" rowspan="1" colspan="1"><strong>HR</strong><sup class="gt_footnote_marks">1</sup></th>
      <th class="gt_col_heading gt_columns_bottom_border gt_center" rowspan="1" colspan="1"><strong>95% CI</strong><sup class="gt_footnote_marks">1</sup></th>
      <th class="gt_col_heading gt_columns_bottom_border gt_center" rowspan="1" colspan="1"><strong>p-value</strong></th>
    </tr>
  </thead>
  <tbody class="gt_table_body">
    <tr>
      <td class="gt_row gt_left">Chemotherapy Treatment</td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
    </tr>
    <tr>
      <td class="gt_row gt_left" style="text-align: left; text-indent: 10px;">Drug A</td>
      <td class="gt_row gt_center">&mdash;</td>
      <td class="gt_row gt_center">&mdash;</td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center">&mdash;</td>
      <td class="gt_row gt_center">&mdash;</td>
      <td class="gt_row gt_center"></td>
    </tr>
    <tr>
      <td class="gt_row gt_left" style="text-align: left; text-indent: 10px;">Drug B</td>
      <td class="gt_row gt_center">1.13</td>
      <td class="gt_row gt_center">0.60, 2.13</td>
      <td class="gt_row gt_center">0.7</td>
      <td class="gt_row gt_center">1.30</td>
      <td class="gt_row gt_center">0.88, 1.92</td>
      <td class="gt_row gt_center">0.2</td>
    </tr>
    <tr>
      <td class="gt_row gt_left">Age</td>
      <td class="gt_row gt_center">1.02</td>
      <td class="gt_row gt_center">1.00, 1.04</td>
      <td class="gt_row gt_center">0.10</td>
      <td class="gt_row gt_center">1.01</td>
      <td class="gt_row gt_center">0.99, 1.02</td>
      <td class="gt_row gt_center">0.3</td>
    </tr>
    <tr>
      <td class="gt_row gt_left">Grade</td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center"></td>
    </tr>
    <tr>
      <td class="gt_row gt_left" style="text-align: left; text-indent: 10px;">I</td>
      <td class="gt_row gt_center">&mdash;</td>
      <td class="gt_row gt_center">&mdash;</td>
      <td class="gt_row gt_center"></td>
      <td class="gt_row gt_center">&mdash;</td>
      <td class="gt_row gt_center">&mdash;</td>
      <td class="gt_row gt_center"></td>
    </tr>
    <tr>
      <td class="gt_row gt_left" style="text-align: left; text-indent: 10px;">II</td>
      <td class="gt_row gt_center">0.85</td>
      <td class="gt_row gt_center">0.39, 1.85</td>
      <td class="gt_row gt_center">0.7</td>
      <td class="gt_row gt_center">1.21</td>
      <td class="gt_row gt_center">0.73, 1.99</td>
      <td class="gt_row gt_center">0.5</td>
    </tr>
    <tr>
      <td class="gt_row gt_left" style="text-align: left; text-indent: 10px;">III</td>
      <td class="gt_row gt_center">1.01</td>
      <td class="gt_row gt_center">0.47, 2.15</td>
      <td class="gt_row gt_center">>0.9</td>
      <td class="gt_row gt_center">1.79</td>
      <td class="gt_row gt_center">1.12, 2.86</td>
      <td class="gt_row gt_center">0.014</td>
    </tr>
  </tbody>
  
  <tfoot>
    <tr class="gt_footnotes">
      <td colspan="7">
        <p class="gt_footnote">
          <sup class="gt_footnote_marks">
            <em>1</em>
          </sup>
           
          OR = Odds Ratio, CI = Confidence Interval, HR = Hazard Ratio
          <br />
        </p>
      </td>
    </tr>
  </tfoot>
</table></div>
```
:::
:::

## GT 

::: {.cell .code}
::: {.output .display_data}
```{=html}
<style>html {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', 'Fira Sans', 'Droid Sans', Arial, sans-serif;
}

#asvqfjuurq .gt_table {
  display: table;
  border-collapse: collapse;
  margin-left: auto;
  margin-right: auto;
  color: #333333;
  font-size: 16px;
  font-weight: normal;
  font-style: normal;
  background-color: #FFFFFF;
  width: auto;
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #A8A8A8;
  border-right-style: none;
  border-right-width: 2px;
  border-right-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #A8A8A8;
  border-left-style: none;
  border-left-width: 2px;
  border-left-color: #D3D3D3;
}

#asvqfjuurq .gt_heading {
  background-color: #FFFFFF;
  text-align: center;
  border-bottom-color: #FFFFFF;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
}

#asvqfjuurq .gt_title {
  color: #333333;
  font-size: 125%;
  font-weight: initial;
  padding-top: 4px;
  padding-bottom: 4px;
  border-bottom-color: #FFFFFF;
  border-bottom-width: 0;
}

#asvqfjuurq .gt_subtitle {
  color: #333333;
  font-size: 85%;
  font-weight: initial;
  padding-top: 0;
  padding-bottom: 4px;
  border-top-color: #FFFFFF;
  border-top-width: 0;
}

#asvqfjuurq .gt_bottom_border {
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
}

#asvqfjuurq .gt_col_headings {
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
}

#asvqfjuurq .gt_col_heading {
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: normal;
  text-transform: inherit;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
  vertical-align: bottom;
  padding-top: 5px;
  padding-bottom: 6px;
  padding-left: 5px;
  padding-right: 5px;
  overflow-x: hidden;
}

#asvqfjuurq .gt_column_spanner_outer {
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: normal;
  text-transform: inherit;
  padding-top: 0;
  padding-bottom: 0;
  padding-left: 4px;
  padding-right: 4px;
}

#asvqfjuurq .gt_column_spanner_outer:first-child {
  padding-left: 0;
}

#asvqfjuurq .gt_column_spanner_outer:last-child {
  padding-right: 0;
}

#asvqfjuurq .gt_column_spanner {
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  vertical-align: bottom;
  padding-top: 5px;
  padding-bottom: 6px;
  overflow-x: hidden;
  display: inline-block;
  width: 100%;
}

#asvqfjuurq .gt_group_heading {
  padding: 8px;
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: initial;
  text-transform: inherit;
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
  vertical-align: middle;
}

#asvqfjuurq .gt_empty_group_heading {
  padding: 0.5px;
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: initial;
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  vertical-align: middle;
}

#asvqfjuurq .gt_from_md > :first-child {
  margin-top: 0;
}

#asvqfjuurq .gt_from_md > :last-child {
  margin-bottom: 0;
}

#asvqfjuurq .gt_row {
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
  margin: 10px;
  border-top-style: solid;
  border-top-width: 1px;
  border-top-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 1px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 1px;
  border-right-color: #D3D3D3;
  vertical-align: middle;
  overflow-x: hidden;
}

#asvqfjuurq .gt_stub {
  color: #333333;
  background-color: #FFFFFF;
  font-size: 100%;
  font-weight: initial;
  text-transform: inherit;
  border-right-style: solid;
  border-right-width: 2px;
  border-right-color: #D3D3D3;
  padding-left: 12px;
}

#asvqfjuurq .gt_summary_row {
  color: #333333;
  background-color: #FFFFFF;
  text-transform: inherit;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
}

#asvqfjuurq .gt_first_summary_row {
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
}

#asvqfjuurq .gt_grand_summary_row {
  color: #333333;
  background-color: #FFFFFF;
  text-transform: inherit;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
}

#asvqfjuurq .gt_first_grand_summary_row {
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 5px;
  padding-right: 5px;
  border-top-style: double;
  border-top-width: 6px;
  border-top-color: #D3D3D3;
}

#asvqfjuurq .gt_striped {
  background-color: rgba(128, 128, 128, 0.05);
}

#asvqfjuurq .gt_table_body {
  border-top-style: solid;
  border-top-width: 2px;
  border-top-color: #D3D3D3;
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
}

#asvqfjuurq .gt_footnotes {
  color: #333333;
  background-color: #FFFFFF;
  border-bottom-style: none;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 2px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 2px;
  border-right-color: #D3D3D3;
}

#asvqfjuurq .gt_footnote {
  margin: 0px;
  font-size: 90%;
  padding: 4px;
}

#asvqfjuurq .gt_sourcenotes {
  color: #333333;
  background-color: #FFFFFF;
  border-bottom-style: none;
  border-bottom-width: 2px;
  border-bottom-color: #D3D3D3;
  border-left-style: none;
  border-left-width: 2px;
  border-left-color: #D3D3D3;
  border-right-style: none;
  border-right-width: 2px;
  border-right-color: #D3D3D3;
}

#asvqfjuurq .gt_sourcenote {
  font-size: 90%;
  padding: 4px;
}

#asvqfjuurq .gt_left {
  text-align: left;
}

#asvqfjuurq .gt_center {
  text-align: center;
}

#asvqfjuurq .gt_right {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

#asvqfjuurq .gt_font_normal {
  font-weight: normal;
}

#asvqfjuurq .gt_font_bold {
  font-weight: bold;
}

#asvqfjuurq .gt_font_italic {
  font-style: italic;
}

#asvqfjuurq .gt_super {
  font-size: 65%;
}

#asvqfjuurq .gt_footnote_marks {
  font-style: italic;
  font-size: 65%;
}
</style>
<div id="asvqfjuurq" style="overflow-x:auto;overflow-y:auto;width:auto;height:auto;"><table class="gt_table">
  <thead class="gt_header">
    <tr>
      <th colspan="6" class="gt_heading gt_title gt_font_normal" style>S&amp;P 500</th>
    </tr>
    <tr>
      <th colspan="6" class="gt_heading gt_subtitle gt_font_normal gt_bottom_border" style>2010-06-07 to 2010-06-14</th>
    </tr>
  </thead>
  <thead class="gt_col_headings">
    <tr>
      <th class="gt_col_heading gt_columns_bottom_border gt_left" rowspan="1" colspan="1">date</th>
      <th class="gt_col_heading gt_columns_bottom_border gt_right" rowspan="1" colspan="1">open</th>
      <th class="gt_col_heading gt_columns_bottom_border gt_right" rowspan="1" colspan="1">high</th>
      <th class="gt_col_heading gt_columns_bottom_border gt_right" rowspan="1" colspan="1">low</th>
      <th class="gt_col_heading gt_columns_bottom_border gt_right" rowspan="1" colspan="1">close</th>
      <th class="gt_col_heading gt_columns_bottom_border gt_right" rowspan="1" colspan="1">volume</th>
    </tr>
  </thead>
  <tbody class="gt_table_body">
    <tr>
      <td class="gt_row gt_left">Mon, Jun 14, 2010</td>
      <td class="gt_row gt_right">$1,095.00</td>
      <td class="gt_row gt_right">$1,105.91</td>
      <td class="gt_row gt_right">$1,089.03</td>
      <td class="gt_row gt_right">$1,089.63</td>
      <td class="gt_row gt_right">4.43B</td>
    </tr>
    <tr>
      <td class="gt_row gt_left">Fri, Jun 11, 2010</td>
      <td class="gt_row gt_right">$1,082.65</td>
      <td class="gt_row gt_right">$1,092.25</td>
      <td class="gt_row gt_right">$1,077.12</td>
      <td class="gt_row gt_right">$1,091.60</td>
      <td class="gt_row gt_right">4.06B</td>
    </tr>
    <tr>
      <td class="gt_row gt_left">Thu, Jun 10, 2010</td>
      <td class="gt_row gt_right">$1,058.77</td>
      <td class="gt_row gt_right">$1,087.85</td>
      <td class="gt_row gt_right">$1,058.77</td>
      <td class="gt_row gt_right">$1,086.84</td>
      <td class="gt_row gt_right">5.14B</td>
    </tr>
    <tr>
      <td class="gt_row gt_left">Wed, Jun 9, 2010</td>
      <td class="gt_row gt_right">$1,062.75</td>
      <td class="gt_row gt_right">$1,077.74</td>
      <td class="gt_row gt_right">$1,052.25</td>
      <td class="gt_row gt_right">$1,055.69</td>
      <td class="gt_row gt_right">5.98B</td>
    </tr>
    <tr>
      <td class="gt_row gt_left">Tue, Jun 8, 2010</td>
      <td class="gt_row gt_right">$1,050.81</td>
      <td class="gt_row gt_right">$1,063.15</td>
      <td class="gt_row gt_right">$1,042.17</td>
      <td class="gt_row gt_right">$1,062.00</td>
      <td class="gt_row gt_right">6.19B</td>
    </tr>
    <tr>
      <td class="gt_row gt_left">Mon, Jun 7, 2010</td>
      <td class="gt_row gt_right">$1,065.84</td>
      <td class="gt_row gt_right">$1,071.36</td>
      <td class="gt_row gt_right">$1,049.86</td>
      <td class="gt_row gt_right">$1,050.47</td>
      <td class="gt_row gt_right">5.47B</td>
    </tr>
  </tbody>
  
  
</table></div>
```
:::
:::
