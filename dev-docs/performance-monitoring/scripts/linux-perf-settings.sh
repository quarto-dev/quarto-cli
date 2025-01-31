#!/bin/bash

# This assumes intel processors!!

# Intel
echo 1 > /sys/devices/system/cpu/intel_pstate/no_turbo
# AMD
# echo 0 > /sys/devices/system/cpu/cpufreq/boost

for i in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
do
  echo performance > $i
done

echo 0 > /proc/sys/kernel/randomize_va_space

