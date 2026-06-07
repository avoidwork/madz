#!/bin/sh
# Persist container environment variables into a sourceable file
# so they are available in all SSH login sessions.
#
# Environment variables set by Docker (e.g. via docker-compose.yml
# or --env) exist in /proc/self/environ when this script runs.
# We write them to /etc/madz-env.sh as export statements, then
# ensure /etc/profile.d/madz-env.sh sources that file.

# Write env vars with export prefix so /etc/madz-env.sh is sourceable.
# Filter out shell-internal variables that don't need exporting.
env | sed 's/^\([^=]*\)=\(.*\)/export \1="\2"/' | grep -v '^export PWD=' | grep -v '^export SHLVL=' | grep -v '^export _=' > /etc/madz-env.sh

# Create profile.d script that sources the env file
printf '%s\n' '#!/bin/sh' '[ -f /etc/madz-env.sh ] && . /etc/madz-env.sh' > /etc/profile.d/madz-env.sh
chmod a+r /etc/profile.d/madz-env.sh

# Start sshd as a background process so it picks up injected env vars
/usr/sbin/sshd -D &

# Run the CMD (e.g. sleep infinity)
exec "$@"
