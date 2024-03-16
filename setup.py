from setuptools import setup, find_packages
import glob
import sys
import platform
from urllib.request import urlretrieve
from pathlib import Path
import os
import shutil
import subprocess

output_location = ""
quarto_data = []

# Clean up the build because caching appears to
# completely not work with dynamic package_data and version
shutil.rmtree("build", ignore_errors=True)
shutil.rmtree("quarto_cli.egg-info", ignore_errors=True)

def get_platform_suffix():
    if sys.platform == "darwin":
        return "macos.tar.gz"
    elif sys.platform == "win32":
        return "win.zip"
    elif sys.platform == "linux":
        m = platform.machine()
        if m == "x86_64":
            return "linux-amd64.tar.gz"
        elif m == "aarch64":
            return "linux-arm64.tar.gz"
        # TODO: detect RHEL7 since we have a special download for it
    else:
        raise Exception("Platform not supported")

def download_quarto(vers):
    global output_location
    global quarto_data
    global version

    suffix = get_platform_suffix()
    quarto_url = f"https://github.com/quarto-dev/quarto-cli/releases/download/v{vers}/quarto-{vers}-{suffix}"
    print("Downloading", quarto_url)
    try:
        name, resp = urlretrieve(quarto_url)
    except Exception as e:
        print("Error downloading Quarto:", e)
        commit=subprocess.run(["git","log","-1","--skip=1","--pretty=format:'%h'","--","version.txt"], check=True, text=True, capture_output=True, shell=True).stdout
        version = subprocess.run(["git","show", commit.replace("'", "")+":version.txt"], check=True, capture_output=True, text=True, shell=True).stdout.replace("\n", "")
        quarto_url = f"https://github.com/quarto-dev/quarto-cli/releases/download/v{version}/quarto-{version}-{suffix}"
        name, resp = urlretrieve(quarto_url)

    output_location = f"quarto_cli/quarto-{version}"
    os.makedirs(output_location, exist_ok=True)

    if suffix.endswith(".zip"):
        import zipfile
        with zipfile.ZipFile(name, 'r') as zip_ref:
            zip_ref.extractall(output_location)
    elif suffix.startswith("linux"):
        import tarfile
        with tarfile.open(name) as tf:
            tf.extractall(Path(output_location).parent.resolve())
    else:
        import tarfile
        with tarfile.open(name) as tf:
            tf.extractall(output_location)

    for path in glob.glob(str(Path(output_location, "**")), recursive=True):
        quarto_data.append(path.replace("quarto_cli" + os.path.sep, ""))

def cleanup_quarto():
    shutil.rmtree(output_location)

global version

version = open("version.txt").read().strip()
download_quarto(version)
setup(
    version=version,
    name='quarto_cli',
    install_requires=[
        'jupyter',
        'nbclient',
        'wheel',
    ],
    packages=find_packages(include=['quarto_cli', 'quarto_cli.*']),
    entry_points={
        'console_scripts': [
            'quarto = quarto_cli:run_quarto',
        ]
    },
    package_data={
        'quarto_cli': quarto_data,
    },
    include_package_data=True,
)
cleanup_quarto()
