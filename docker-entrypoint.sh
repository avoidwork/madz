#!/bin/sh
# Persist container environment variables into a sourceable file
# so they are available in all SSH login sessions.
#
# Environment variables set by Docker (e.g. via docker-compose.yml
# or --env) exist in /proc/self/environ when this script runs.
# We write them to /etc/madz-env.sh as export statements, then
# ensure /etc/profile.d/madz-env.sh sources that file.
#
# This also sets AcceptEnv * so the SSH server accepts any
# environment variable the client sends via SendEnv.

# Write environment variables to /etc/madz-env.sh.
# /proc/self/environ contains null-separated KEY=VALUE pairs.
# Convert to newlines, filter unwanted vars, write export lines.
: > /etc/madz-env.sh
printf '%s' "$(cat /proc/self/environ)" | tr '\0' '\n' | while IFS= read -r line; do
  key="${line%%=*}"
  # Skip entries without '='
  [ "$key" = "$line" ] && continue
  # Skip internal bash/sh variables
  case "$key" in
    SHLVL|_=|PWD|OLDPWD|HOME|LANG|LC_*|LS_COLORS|HOSTNAME|TERM\|PS1\|PS2)
      continue
      ;;
  esac
  printf 'export %s=%q\n' "$key" "${line#*=}"
done >> /etc/madz-env.sh

# Create profile.d script that sources the env file
printf '%s\n' '#!/bin/sh' '[ -f /etc/madz-env.sh ] && . /etc/madz-env.sh' > /etc/profile.d/madz-env.sh
chmod a+r /etc/profile.d/madz-env.sh

# Set AcceptEnv * so sshd accepts environment variables from the client
# (overridable per-variable by listing specific AcceptEnv directives)
sed -i '/^AcceptEnv /d' /etc/ssh/sshd_config
printf '%s\n' 'AcceptEnv *' >> /etc/ssh/sshd_config

# Run the CMD
exec "$@"
