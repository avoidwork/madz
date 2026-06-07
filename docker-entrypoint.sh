#!/bin/sh
# Forward container environment variables to sshd before exec
# This ensures variables set by Docker/Portainer are visible to sshd
# and subsequently to all user sessions and npm start

# Source all env vars from the current process environment
# /proc/self/environ contains null-separated KEY=VALUE pairs
# Use eval to import them, then export the ones we want to keep
eval "$(cat /proc/self/environ | tr '\0' '\n' | grep -v '^SHLVL=' | grep -v '^_=' | awk -F= '{print "export " $0}')"

exec "$@"
