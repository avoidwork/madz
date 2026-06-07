#!/bin/sh
# Persist container environment variables into a sourceable file
# so they are available in all SSH login sessions.
#
# Environment variables set by Docker (e.g. via docker-compose.yml
# or --env) exist in /proc/self/environ when this script runs.
# We write them to /etc/madz-env.sh as export statements, then
# ensure /etc/profile.d/madz-env.sh sources that file.

# cat /proc/self/environ reads the null-separated env from this process.
# tr '\0' '\n' converts null bytes to newlines for sed to process.
# Each resulting line is a KEY=VALUE pair. We wrap non-internal ones
# with 'export ' and write to /etc/madz-env.sh.
tr '\0' '\n' < /proc/self/environ | while IFS= read -r line; do
  # Skip empty lines
  [ -z "$line" ] && continue
  # Check if it looks like KEY=VALUE (has an '=')
  case "$line" in
    *=*) ;;
    *) continue ;;
  esac
  # Skip internal bash/sh variables
  key="${line%%=*}"
  case "$key" in
    SHLVL|_=|PWD|OLDPWD|HOME|HOSTNAME|PS1|PS2) ;;
    LC_*) ;;
    LANG|LS_COLORS|TERM) ;;
    *) printf 'export %s\n' "$line" ;;
  esac
done > /etc/madz-env.sh

# Create profile.d script that sources the env file
printf '%s\n' '#!/bin/sh' '[ -f /etc/madz-env.sh ] && . /etc/madz-env.sh' > /etc/profile.d/madz-env.sh
chmod a+r /etc/profile.d/madz-env.sh

# Start sshd as a background process so it picks up injected env vars
/usr/sbin/sshd -D &

# Run the CMD (e.g. sleep infinity)
exec "$@"
