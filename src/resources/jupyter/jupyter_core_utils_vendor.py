# Copyright (c) Jupyter Development Team.
#   Originally in jupyter_core/utils/__init__.py
#   https://github.com/jupyter/jupyter_core/blob/main/jupyter_core/utils/__init__.py

from typing import Awaitable, Callable, List, Optional, TypeVar, Union, cast
import threading
import atexit
import asyncio
import inspect


class _TaskRunner:
    """A task runner that runs an asyncio event loop on a background thread."""

    def __init__(self):
        self.__io_loop: Optional[asyncio.AbstractEventLoop] = None
        self.__runner_thread: Optional[threading.Thread] = None
        self.__lock = threading.Lock()
        atexit.register(self._close)

    def _close(self):
        if self.__io_loop:
            self.__io_loop.stop()

    def _runner(self):
        loop = self.__io_loop
        assert loop is not None  # noqa
        try:
            loop.run_forever()
        finally:
            loop.close()

    def run(self, coro):
        """Synchronously run a coroutine on a background thread."""
        with self.__lock:
            name = f"{threading.current_thread().name} - runner"
            if self.__io_loop is None:
                self.__io_loop = asyncio.new_event_loop()
                self.__runner_thread = threading.Thread(target=self._runner, daemon=True, name=name)
                self.__runner_thread.start()
        fut = asyncio.run_coroutine_threadsafe(coro, self.__io_loop)
        return fut.result(None)


_runner_map = {}
_loop_map = {}

T = TypeVar("T")

def run_sync(coro: Callable[..., Awaitable[T]]) -> Callable[..., T]:
    """Wraps coroutine in a function that blocks until it has executed.

    Parameters
    ----------
    coro : coroutine-function
        The coroutine-function to be executed.

    Returns
    -------
    result :
        Whatever the coroutine-function returns.
    """

    if not inspect.iscoroutinefunction(coro):
        raise AssertionError

    def wrapped(*args, **kwargs):
        name = threading.current_thread().name
        inner = coro(*args, **kwargs)
        try:
            # If a loop is currently running in this thread,
            # use a task runner.
            asyncio.get_running_loop()
            if name not in _runner_map:
                _runner_map[name] = _TaskRunner()
            return _runner_map[name].run(inner)
        except RuntimeError:
            pass

        # Run the loop for this thread.
        if name not in _loop_map:
            _loop_map[name] = asyncio.new_event_loop()
        loop = _loop_map[name]
        return loop.run_until_complete(inner)

    wrapped.__doc__ = coro.__doc__
    return wrapped
