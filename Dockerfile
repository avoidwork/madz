FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ bash

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src/ ./src/
COPY tests/ ./tests/

RUN npm prune --omit=dev

FROM node:24-alpine

# System packages
RUN apk update && \
    apk add --no-cache python3 ruby curl bash jq unzip wget ca-certificates git github-cli file zip xz lz4 diffutils tree rsync openssh-server openssh-client cronie ripgrep tzdata chromium go maven gradle openjdk21-jdk build-base uv && \
    # Add community repo for cargo (includes rustc)
    apk add --no-cache cargo --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community && \
    ssh-keygen -A && \
    adduser -S -G node -h /home/madz -s /bin/sh madz && \
    mkdir -p /run/sshd /root/.cache /home/madz/.cache/madz/logs && \
    printf '%s\n' '#!/bin/sh' '[ -f /etc/profile.d/madz-env.sh ] && . /etc/profile.d/madz-env.sh' 'if [ -x "/app" ]; then' '    echo "Starting madz..."' '    cd /app && exec node --expose-gc index.js --mode interactive' 'fi' > /etc/profile && \
    passwd -d madz && \
    # Dev container: allow empty passwords for SSH access
    sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords yes/' /etc/ssh/sshd_config && \
    printf '%s\n' 'AcceptEnv *' >> /etc/ssh/sshd_config

# Python dependency CVE scanning
RUN pip3 install --break-system-packages --no-cache-dir pip-audit

# Go vulnerability analysis
RUN go install golang.org/x/vuln/cmd/govulncheck@latest && \
    mv /root/go/bin/govulncheck /usr/local/bin/govulncheck

# Rust dependency security auditing
RUN cargo install cargo-audit --locked

ENV HOME=/home/madz

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY LICENSE index.js config.yaml ./
COPY src/ ./src/
COPY prompts/ ./prompts/
COPY .skills/ ./.skills/
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh && \
    chown -R madz:node /app /home/madz && \
    chmod -R g+rwX /app /home/madz

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["sleep", "infinity"]
