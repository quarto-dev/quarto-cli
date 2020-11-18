---
title: "leaflet"
knit: quarto render
format:
  html:
    keep-md: true
jupyter: true
---

```python label="fig:leaflet" fig.cap="my map 1" tags=["remove-code"]
from ipyleaflet import Map, Marker, basemaps, basemap_to_tiles
m = Map(
  basemap=basemap_to_tiles(
    basemaps.NASAGIBS.ModisTerraTrueColorCR, "2017-04-08"
  ),
  center=(52.204793, 360.121558),
  zoom=4
)
m.add_layer(Marker(location=(52.204793, 360.121558)))
m
```

See @fig:leaflet for more.
