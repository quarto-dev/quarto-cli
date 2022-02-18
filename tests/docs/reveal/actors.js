import * as regression from 'https://cdn.skypack.dev/d3-regression';
import * as d3 from 'https://cdn.skypack.dev/d3';

export function plotActors(actors, talentWeight, looksWeight, minimum) {
    
  actors = transpose(actors).map(v => ({
    talent: v.x,
    looks: v.y,
    fame: v.x * talentWeight + v.y * looksWeight
  }));

  const w = 600;
  const h = 470;
  const result = d3.create("svg").attr("width", w).attr("height", h);
  const margin = 20;
  const xScale = d3.scaleLinear().domain([-2, 2]).range([margin, w - margin]);
  const yScale = d3.scaleLinear().domain([-2, 2]).range([h - margin, margin]);
  const points = result
    .append("g")
    .selectAll("circle")
    .data(actors)
    .join(enter => {
       const sel = enter
         .append("circle")
         .attr("r", 3)
         .attr("cx", d => xScale(d.talent))
         .attr("cy", d => yScale(d.looks))
         .attr("fill", d3.lab(50, 40, 20));
       return sel.filter(d => d.fame <= minimum)
         .attr("fill", "rgb(200, 200, 200)")
         .attr("r", 2);
    });
    
  const linearRegression = regression.regressionLinear()
    .x(d => d.talent)
    .y(d => d.looks)
    .domain([-2, 2]);

  const chosenActors = actors
    .filter(d => d.fame > minimum);

  const line = result
    .append("g")
    .append("line")
    .attr("stroke", d3.lab(20, 40, 20))
    .attr("stroke-width", 1.5)
    .datum(linearRegression(chosenActors))
    .attr("x1", d => xScale(d[0][0]))
    .attr("x2", d => xScale(d[1][0]))
    .attr("y1", d => yScale(d[0][1]))
    .attr("y2", d => yScale(d[1][1]));


  const xAxis = d3.axisBottom(xScale).ticks(3);
  result.append("g")
    .attr("transform", `translate(0, ${yScale(0)})`)
    .call(xAxis);

  result.append("text")
    .attr("x", xScale(0.05))
    .attr("y", yScale(2))
    .text("Looks");

  result.append("text")
    .attr("y", yScale(0.1))
    .attr("x", xScale(-2))
    .text("Talent");

  const yAxis = d3.axisLeft(yScale).ticks(3);
  result.append("g")
    .attr("transform", `translate(${xScale(0)}, 0)`)
    .call(yAxis);
  
  return result.node();
}

function transpose(df) {
  const keys = Object.keys(df);
  return df[keys[0]]
    .map((v, i) => Object.fromEntries(keys.map(key => [key, df[key][i] || undefined])))
    .filter(v => Object.values(v).every(e => e !== undefined));
}



