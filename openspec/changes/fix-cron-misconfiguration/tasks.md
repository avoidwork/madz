## 1. Update crond startup flags

- [ ] 1.1 Locate crond startup command in Dockerfile
- [ ] 1.2 Add `-p` flag to permit user crontabs
- [ ] 1.3 Add `-P` flag to inherit PATH from environment
- [ ] 1.4 Add `-s` flag to log to syslog

## 2. Update crontab entries

- [ ] 2.1 Locate crontab entries in Dockerfile
- [ ] 2.2 Replace `node` with `/usr/local/bin/node` in all entries
- [ ] 2.3 Add output redirection `>> /var/log/cron-madz.log 2>&1` to all entries

## 3. Verify and test

- [ ] 3.1 Verify Dockerfile syntax is correct
- [ ] 3.2 Run `npm run test` to ensure tests pass
- [ ] 3.3 Run `npm run lint` to ensure lint passes