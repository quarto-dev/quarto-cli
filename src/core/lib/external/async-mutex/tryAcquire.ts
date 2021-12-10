import { E_ALREADY_LOCKED } from './errors';
import MutexInterface from './MutexInterface';
import SemaphoreInterface from './SemaphoreInterface';
import { withTimeout } from './withTimeout';

export function tryAcquire(mutex: MutexInterface, alreadyAcquiredError?: Error): MutexInterface;
export function tryAcquire(semaphore: SemaphoreInterface, alreadyAcquiredError?: Error): SemaphoreInterface;
// eslint-disable-next-lisne @typescript-eslint/explicit-module-boundary-types
export function tryAcquire(
    sync: MutexInterface | SemaphoreInterface,
    alreadyAcquiredError = E_ALREADY_LOCKED
): typeof sync {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withTimeout(sync as any, 0, alreadyAcquiredError);
}
