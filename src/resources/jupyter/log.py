import sys
import logging
import os
import inspect

TRACE = 25


def log_init(log_file, trace=False):
    # set level
    logger = logging.getLogger()
    if trace:
        logger.setLevel(TRACE)
    else:
        logger.setLevel(logging.WARNING)

    global file_handler
    # create handlers
    stderr_handler = logging.StreamHandler(sys.stderr)
    file_handler = logging.FileHandler(log_file)

    # create formatter and attach to handlers
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    stderr_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)

    # add handlers
    logger.addHandler(stderr_handler)
    logger.addHandler(file_handler)


# force flushing so programs which hang still produce output
if os.getenv("QUARTO_JUPYTER_FLUSH_LOGS"):

    def log(level, msg):
        logging.getLogger().log(level, msg)
        file_handler.flush()
else:

    def log(level, msg):
        logging.getLogger().log(level, msg)


def log_error(msg, exc_info=False, stack_info=None):
    if stack_info is None:
        stack_info = not exc_info
    logging.getLogger().log(
        logging.ERROR, msg, exc_info=exc_info, stack_info=stack_info
    )


def trace(msg):
    prev_frame = inspect.stack()[1]
    log(TRACE, "%s:%s - %s" % (prev_frame.filename, prev_frame.lineno, msg))
