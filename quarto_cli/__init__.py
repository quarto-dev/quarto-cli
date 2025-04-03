import glob
import subprocess
import sys
from pathlib import Path


def find_version():
    g = str((Path(__file__).parent / "quarto-*").resolve())
    g = str((Path(glob.glob(g)[0]) / "bin" / "quarto").resolve())
    # if on windows, search for quarto.exe
    if sys.platform == "win32":
        g += ".exe"
    return g


def call_quarto(*args, **kwargs):
    return subprocess.run([find_version(), *sys.argv[1:], *args], **kwargs)


def run_quarto(*args, **kwargs):
    call_quarto(*args, **kwargs)
