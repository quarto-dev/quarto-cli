
import os
import sys
import re
import json
import stat
import pprint
import uuid
import signal
import subprocess

from socketserver import TCPServer, StreamRequestHandler

try:
   from socketserver import UnixStreamServer
except:
   pass


from log import log_init, log, log_error, trace
from notebook import notebook_execute, RestartKernel

import asyncio
if sys.platform == 'win32':
   from asyncio.windows_events import *
   asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


class ExecuteHandler(StreamRequestHandler):

   def handle(self):

      try:
         trace('handling server request')

         # read input
         input = str(self.rfile.readline().strip(), 'utf-8')
         input = json.loads(input)

         # validate secret
         if not self.server.validate_secret(input["secret"]):
            trace('invalid secret (exiting server)')
            self.server.request_exit()
            return
         if input["command"] == "file":
            filename = input["options"]["file"]
            input = json.load(open(filename, "r", encoding="utf8"))
            os.unlink(filename)

         # if this is an abort command then request exit
         command = input["command"]
         if command == "abort":
            trace('abort command received (exiting server)')
            self.server.request_exit()
            return

         # options
         options = input["options"]

         # stream status back to client
         def status(msg):
            self.message("status", msg)
      
         # execute the notebook
         trace('executing notebook')
         persist = notebook_execute(options, status)
         if not persist:
            trace('notebook not persistable (exiting server)')
            self.server.request_exit()
         else:
            self.server.record_success()
      except RestartKernel:
         trace('notebook restart request recived (exiting server)')
         self.message("restart")
         self.server.request_exit()
      except Exception as e:
         self.message("error", "\n\n" + str(e))
         self.server.record_error(e)

   # write a message back to the client      
   def message(self, type, data = ""):
      message = {
         "type": type,
         "data": data 
      }
      self.wfile.write(bytearray(json.dumps(message) + "\n", 'utf-8'))
      self.wfile.flush()
  
def execute_server(options):

   # determine server type
   is_tcp = options["type"] == "tcp"
   if is_tcp:
      base = TCPServer
   else:
      base = UnixStreamServer

   class ExecuteServer(base):

      allow_reuse_address = True
      exit_pending = False
      consecutive_errors = 0
      
      def __init__(self, options):

         trace('creating notebook server (' + 
               options["type"] + ': ' + options["transport"] 
               + ')')

         # set secret for tcp
         if is_tcp:
            self.secret = str(uuid.uuid4())
         else:
            self.secret = ""

         # server params
         self.transport = options["transport"]
         self.timeout = options["timeout"]

         # initialize with address (based on server type) and handler
         if is_tcp:
            server_address = ("localhost",0)
         else:
            server_address = self.transport
         super().__init__(server_address, ExecuteHandler)

         # if we are a tcp server then get the port number and write it 
         # to the transport file. change file permissions to user r/w
         # for both tcp and unix domain sockets
         if is_tcp:
            port = self.socket.getsockname()[1]
            trace('notebook server bound to port ' + str(port))
            with open(self.transport,"w") as file:
               file.write("")
            os.chmod(self.transport, stat.S_IRUSR | stat.S_IWUSR)
            with open(self.transport,"w") as file:
               file.write(json.dumps(dict({
                  "port": port,
                  "secret": self.secret
               })))
         else:
            os.chmod(self.transport, stat.S_IRUSR | stat.S_IWUSR)


      def handle_request(self):
         if self.exit_pending:
            self.exit()
         super().handle_request()

      def handle_timeout(self):
         trace('request timeout (exiting server)')
         self.exit()

      def validate_secret(self, secret):
         return self.secret == secret

      def record_success(self):
         self.consecutive_errors = 0

      def record_error(self, e):
         # exit for 5 consecutive errors
         self.consecutive_errors += 1
         if self.consecutive_errors >= 5:
            self.exit()

      def request_exit(self):
         self.exit_pending = True

      def exit(self):
         try:
            trace('cleaning up server resources')
            self.server_close()
            self.remove_transport()
          
         finally:
            trace('exiting server')
            sys.exit(0)

      def remove_transport(self):
         try:
            if os.path.exists(self.transport):
               os.remove(self.transport)
         except:
            pass

   return ExecuteServer(options)

  
def run_server(options): 
   try:
      with execute_server(options) as server:  
         while True:
            server.handle_request() 
   except Exception as e:
      log_error("Unable to run server", exc_info = e)

# run a server as a detached subprocess
def run_server_subprocess(options, status):

   # python executable
   python_exe = sys.executable

   # detached process flags for windows
   flags = 0
   if sys.platform == 'win32':
      python_exe = re.sub('python\\.exe$', 'pythonw.exe', python_exe)
      flags |= 0x00000008  # DETACHED_PROCESS
      flags |= 0x00000200  # CREATE_NEW_PROCESS_GROUP
      flags |= 0x08000000  # CREATE_NO_WINDOW
      flags |= 0x01000000  # CREATE_BREAKAWAY_FROM_JOB

   # forward options via env vars
   os.environ["QUARTO_JUPYTER_OPTIONS"] = json.dumps(options)

   # create subprocess
   subprocess.Popen([python_exe] + sys.argv + ["serve"],
      stdin = subprocess.DEVNULL,
      stdout = subprocess.DEVNULL,
      stderr = subprocess.DEVNULL,
      creationflags = flags,
      close_fds = True,
      start_new_session = True
   )


# run a notebook directly (not a server)
def run_notebook(options, status):

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

   # stream status to stderr
   def status(msg):
      sys.stderr.write(msg)
      sys.stderr.flush()

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

      # initialize log
      log_init(options["log"], options["debug"])

      # start the server (creates a new detached process, we implement this here 
      # only b/c Deno doesn't currently support detaching spawned processes)
      if command == "start":
         trace('starting notebook server subprocess')
         run_server_subprocess(options, status)

      # serve a notebook (invoked by run_server_subprocess)
      elif command == "serve":
         trace('running notebook server subprocess')
         run_server(options)
      
      # execute a notebook and then quit
      elif command == "execute":
         trace('running notebook without keepalive')
         run_notebook(options, status)
        
   except Exception as e:
      log_error("Unable to run notebook", exc_info = e)
      sys.exit(1)

