## 1. Update crond startup flags

- [x] 1.1 Locate crond startup command in Dockerfile
- [x] 1.2 Add `-p` flag to permit user crontabs
- [x] 1.3 Add `-P` flag to inherit PATH from environment
- [x] 1.4 Add `-s` flag to log to syslog

## 2. Update crontab entries

- [x] 2.1 Locate crontab entries in Dockerfile
- [x] 2.2 Replace `node` with `/usr/local/bin/node` in all entries
- [x] 2.3 Add output redirection `>> /var/log/cron-madz.log 2>&1` to all entries

## 3. Verify and test

- [x] 3.1 Verify Dockerfile syntax is correct
- [x] 3.2 Run `npm run test` to ensure tests pass
- [x] 3.3 Run `npm run lint` to ensure lint passes