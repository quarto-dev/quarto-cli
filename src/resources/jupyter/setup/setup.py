
# reset state
%reset

# figure size/format
fig_width = {0}
fig_height = {1}
fig_format = '{2}'
fig_dpi = {3}

# matplotlib defaults / format
try:
  import matplotlib.pyplot as plt
  plt.rcParams['figure.figsize'] = (fig_width, fig_height)
  plt.rcParams['figure.dpi'] = fig_dpi
  plt.rcParams['savefig.dpi'] = fig_dpi
  from IPython.display import set_matplotlib_formats
  set_matplotlib_formats(fig_format)
except Exception:
  pass

# plotly express width/height defaults
try:
  import plotly.io as pio
  pio.renderers.default = "notebook_connected"
  import plotly.express as px
  px.defaults.width = fig_width * fig_dpi
  px.defaults.height = fig_height * fig_dpi
except Exception:
  pass

# enable pandas latex repr when targeting pdfs
try:
  import pandas as pd
  if fig_format == 'pdf':
    pd.set_option('display.latex.repr', True)
except Exception:
  pass


