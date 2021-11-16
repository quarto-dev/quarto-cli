let mainPath;

export function setMainPath(path)
{
  mainPath = path;
}

// NB this doesn't do path resolution past the current directory!
export function getLocalPath(filename)
{
  const result = new window.URL(mainPath);
  result.pathname = [...result.pathname.split("/").slice(0, -1), filename].join("/");
  return result.toString();
}
