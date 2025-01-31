# Notes for monitoring performance on Linux

Context: I've been having trouble getting consistent performance measurements on my MacBook Pro, so I decided to try my luck on an Intel Linux desktop running Ubuntu 24.

## `perf` settings

We'll want to monitor some performance counters that have potential security implications, so we need to disable some settings. ONLY DO THIS ON A MACHINE YOU TRUST AND THAT WILL NOT RUN POTENTIALLY-MALICIOUS THIRD-PARTY CODE!

### Source `scripts/linux-perf-settings.sh`

(These come from <https://easyperf.net/blog/2019/08/02/Perf-measurement-environment-on-Linux>)

### `sysctl.conf` settings

```
$ cat /proc/sys/kernel/perf_event_paranoid
```

If the result isn't `-1`, then add this to `/etc/sysctl.conf`:

```
kernel.perf_event_paranoid = -1
```

```
$ cat /proc/sys/kernel/kptr_restrict
```

If the result isn't `0`, then add this to `/etc/sysctl.conf`:

```
kernel.kptr_restrict = 0
```

After these changes, you'll need to reboot.
