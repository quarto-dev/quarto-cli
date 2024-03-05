import subprocess
import sys
import re


julia_bin = sys.argv[1]
project = sys.argv[2]
julia_file = sys.argv[3]
transport_file = sys.argv[4]

if len(sys.argv) > 5:
  raise ValueError("Too many arguments")

cmd = [julia_bin, f"--project={project}", julia_file, transport_file]
print("cmd:", cmd)
subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
print("ran that")

# detached process flags for windows
flags = 0
if sys.platform == 'win32':
  python_exe = re.sub('python\\.exe$', 'pythonw.exe', python_exe)
  flags |= 0x00000008  # DETACHED_PROCESS
  flags |= 0x00000200  # CREATE_NEW_PROCESS_GROUP
  flags |= 0x08000000  # CREATE_NO_WINDOW
  flags |= 0x01000000  # CREATE_BREAKAWAY_FROM_JOB

# create subprocess
subprocess.Popen(cmd,
  stdin = subprocess.DEVNULL,
  stdout = subprocess.DEVNULL,
  stderr = subprocess.DEVNULL,
  creationflags = flags,
  close_fds = True,
  start_new_session = True
)