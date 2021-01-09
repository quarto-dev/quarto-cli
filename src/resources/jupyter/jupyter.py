
# run detached subprocess on windows
# https://docs.python.org/3/library/subprocess.html#module-subprocess
# https://stackoverflow.com/questions/52449997/how-to-detach-python-child-process-on-windows-without-setsid/52450172#
# and/or find a python process library that makes detached subprocess easy

# store transport files in correct user data directory:
# https://github.com/building5/appdirsjs/blob/master/index.js

# --kernel-debug (undocumented) mode with additional diagnostics on client and server

# implement domain sockets for unix?

# provide a setup chunk for julia

import os
import sys
import json
import stat
import pprint
import uuid
import signal
import subprocess
import daemon

from socketserver import TCPServer, StreamRequestHandler

from log import log_init, log, log_error
from notebook import notebook_execute, RestartKernel

class ExecuteHandler(StreamRequestHandler):

   def handle(self):

      try:
         # read input
         input = str(self.rfile.readline().strip(), 'utf-8')
         input = json.loads(input)

         # validate secret
         if input["secret"] != self.server.secret:
            self.server.request_exit()
            return

         # if this is an abort command then request exit
         command = input["command"]
         if command == "abort":
            self.server.request_exit()
            return

         # options
         options = input["options"]

         # stream status back to client
         def status(msg):
            self.message("status", msg)
      
         # execute the notebook
         persist = notebook_execute(options, status)
         if not persist:
            self.server.request_exit()
      except RestartKernel:
         self.message("restart")
         self.server.request_exit()
      except Exception as e:
         self.message("error", "\n\n" + str(e))
         self.server.request_exit()

   # write a message back to the client      
   def message(self, type, data = ""):
      message = {
         "type": type,
         "data": data 
      }
      self.wfile.write(bytearray(json.dumps(message) + "\n", 'utf-8'))
      self.wfile.flush()
  

class ExecuteServer(TCPServer):

   allow_reuse_address = True
   exit_pending = False
   secret = str(uuid.uuid4())

   def __init__(self, options):

      # initialize server
      self.transport = options["transport"]
      self.timeout = options["timeout"]
      super().__init__(("localhost",0), ExecuteHandler)

      # get the port number and write it to the transport file
      port = self.socket.getsockname()[1]
      with open(self.transport,"w") as file:
         file.write("")
      os.chmod(self.transport, stat.S_IRUSR | stat.S_IWUSR)
      with open(self.transport,"w") as file:
         file.write(json.dumps(dict({
            "port": port,
            "secret": self.secret
         })))


   def handle_request(self):
      if self.exit_pending:
         self.exit()
      super().handle_request()

   def handle_timeout(self):
      self.exit()

   def request_exit(self):
      self.exit_pending = True

   def exit(self):
      try:
         self.server_close()
         if os.path.exists(self.transport):
            os.remove(self.transport)
      finally:
         sys.exit(0)

  
def run_server(options): 
   try:
      with ExecuteServer(options) as server:  
         while True:
            server.handle_request() 
   except Exception as e:
      log_error("Unable to run server", exc_info = e)

# run a server as a posix daemon
def run_server_daemon(options):
   with daemon.DaemonContext(working_directory = os.getcwd()):
      log_init()
      run_server(options)   

# run a server as a detached subprocess
def run_server_subprocess(options):
   # detached process flags for windows
   flags = 0
   if os.name == 'nt':
      flags |= 0x00000008  # DETACHED_PROCESS
      flags |= 0x00000200  # CREATE_NEW_PROCESS_GROUP
      flags |= 0x08000000  # CREATE_NO_WINDOW
   else:
      signal.signal(signal.SIGCHLD, signal.SIG_IGN)

   # forward options via env vars
   os.environ["QUARTO_JUPYTER_OPTIONS"] = json.dumps(options)

   # create subprocess
   p = subprocess.Popen([sys.executable] + sys.argv + ["serve"],
      stdin = subprocess.DEVNULL,
      stdout = subprocess.DEVNULL,
      stderr = subprocess.DEVNULL,
      creationflags = flags,
      close_fds = True,
      start_new_session = True
   )


# run a notebook directly (not a server)
def run_notebook(options):
   # stream status to stderr
   def status(msg):
      sys.stderr.write(msg)
      sys.stderr.flush()

   # run notebook w/ some special exception handling. note that we don't 
   # log exceptions here b/c they are considered normal course of execution
   # for errors that occur in notebook cells
   try:   
      notebook_execute(options, status)
   except Exception as e:
      # CellExecutionError for execution at the terminal includes a bunch
      # of extra stack frames internal to this script. remove them
      msg = str(e)
      kCellExecutionError = "nbclient.exceptions.CellExecutionError: "
      loc = msg.find(kCellExecutionError)
      if loc != -1:
         msg = msg[loc + len(kCellExecutionError)]
      sys.stderr.write("\n\n" + msg + "\n")
      sys.stderr.flush()
      sys.exit(1)


if __name__ == "__main__":

   # initialize log
   log_init()

   try:
      # read command from cmd line if it's there (in that case 
      # options are passed via environment variable)
      if len(sys.argv) > 1:
         command = sys.argv[1]
         options = json.loads(os.getenv("QUARTO_JUPYTER_OPTIONS"))
         del os.environ["QUARTO_JUPYTER_OPTIONS"]
      # otherwise read from stdin
      else:
         input = json.load(sys.stdin)
         command = input["command"]
         options = input["options"]

      # start the server (creates a new detached process, we implement this here 
      # only b/c Deno doesn't currently support detaching spawned processes)
      if command == "start":
         if os.name == 'nt':
            run_server_subprocess(options)
         else:
            run_server_daemon(options)

      # serve a notebook (invoked by run_server_subprocess)
      elif command == "serve":
         run_server(options)
      
      # execute a notebook and then quit
      elif command == "execute":
         run_notebook(options)
        
   except Exception as e:
      log_error("Unable to run notebook", exc_info = e)
      sys.exit(1)

