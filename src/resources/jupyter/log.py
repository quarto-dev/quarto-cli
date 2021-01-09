
import sys
import logging

def log_init():
   # create logger (default to WARNING)
   logger = logging.getLogger()  
   logger.setLevel(logging.WARNING)
   # create handlers
   stderr_handler = logging.StreamHandler(sys.stderr)
   file_handler = logging.FileHandler('quarto-jupyter.log')
   # create formatter and attach to handlers
   formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
   stderr_handler.setFormatter(formatter)
   file_handler.setFormatter(formatter)
   # add handlers
   logger.addHandler(stderr_handler)  
   logger.addHandler(file_handler)   

def log_set_level(level):
   logger = logging.getLogger()  
   logger.setLevel(level)  

def log(level, msg):
   logging.getLogger().log(level, msg)

def log_error(msg, exc_info = False):
   logging.getLogger().log(logging.ERROR, msg, exc_info = exc_info, stack_info = not exc_info)
