#!/sbin/openrcsh
set -e

/usr/sbin/sshd
exec sleep infinity
