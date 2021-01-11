
import sys
import logging

TRACE = 25

def log_init(log_file, trace = False):
   # set level
   logger = logging.getLogger()  
   if trace:
      logger.setLevel(TRACE)
   else:
      logger.setLevel(logging.WARNING)

   # create handlers
   stderr_handler = logging.StreamHandler(sys.stderr)
   file_handler = logging.FileHandler(log_file)

   # create formatter and attach to handlers
   formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
   stderr_handler.setFormatter(formatter)
   file_handler.setFormatter(formatter)

   # add handlers
   logger.addHandler(stderr_handler)  
   logger.addHandler(file_handler)   

def log(level, msg):
   logging.getLogger().log(level, msg)

def log_error(msg, exc_info = False):
   logging.getLogger().log(logging.ERROR, msg, exc_info = exc_info, stack_info = not exc_info)

def trace(msg):
   log(TRACE, msg)
