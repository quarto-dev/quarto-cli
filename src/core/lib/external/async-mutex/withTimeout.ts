import { E_TIMEOUT } from './errors';
import MutexInterface from './MutexInterface';
import SemaphoreInterface from './SemaphoreInterface';

export function withTimeout(mutex: MutexInterface, timeout: number, timeoutError?: Error): MutexInterface;
export function withTimeout(semaphore: SemaphoreInterface, timeout: number, timeoutError?: Error): SemaphoreInterface;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function withTimeout(sync: MutexInterface | SemaphoreInterface, timeout: number, timeoutError = E_TIMEOUT) {
    return {
        acquire: (): Promise<MutexInterface.Releaser | [number, SemaphoreInterface.Releaser]> =>
            new Promise(async (resolve, reject) => {
                let isTimeout = false;

                const handle = setTimeout(() => {
                    isTimeout = true;
                    reject(timeoutError);
                }, timeout);

                try {
                    const ticket = await sync.acquire();

                    if (isTimeout) {
                        const release = Array.isArray(ticket) ? ticket[1] : ticket;

                        release();
                    } else {
                        clearTimeout(handle);
                        resolve(ticket);
                    }
                } catch (e) {
                    if (!isTimeout) {
                        clearTimeout(handle);

                        reject(e);
                    }
                }
            }),

        async runExclusive<T>(callback: (value?: number) => Promise<T> | T): Promise<T> {
            let release: () => void = () => undefined;

            try {
                const ticket = await this.acquire();

                if (Array.isArray(ticket)) {
                    release = ticket[1];

                    return await callback(ticket[0]);
                } else {
                    release = ticket;

                    return await callback();
                }
            } finally {
                release();
            }
        },

        /** @deprecated Deprecated in 0.3.0, will be removed in 0.4.0. Use runExclusive instead. */
        release(): void {
            sync.release();
        },

        cancel(): void {
            return sync.cancel();
        },

        waitForUnlock: (): Promise<void> => sync.waitForUnlock(),

        isLocked: (): boolean => sync.isLocked(),
    };
}
