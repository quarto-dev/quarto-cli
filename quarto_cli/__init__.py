import sys
import subprocess
import glob
from pathlib import Path

def find_version():
    g = str((Path(__file__).parent / "quarto-*").resolve())
    return Path(glob.glob(g)[0]) / "bin" / "quarto"

def call_quarto(*args, **kwargs):
    return subprocess.run([find_version(), *sys.argv[1:], *args], **kwargs)

def run_quarto(*args, **kwargs):
    call_quarto(*args, **kwargs)