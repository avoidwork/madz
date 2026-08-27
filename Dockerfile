FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ bash

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src/ ./src/
COPY tests/ ./tests/

RUN npm prune --omit=dev && \
    npm cache clean --force

FROM node:24-alpine

RUN apk update && \
    apk add --no-cache python3 py3-pip gcc musl-dev python3-dev ruby curl bash jq unzip wget ca-certificates git github-cli file zip xz lz4 diffutils tree rsync openssh-server openssh-client cronie ripgrep tzdata chromium golang maven gradle openjdk21 build-base kubectl helm k9s sqlite3 redis-cli postgresql-client mysql-client strace gdb htop tcpdump nmap vim tmux cmake && \
    # Add community repo for cargo/rustc
    apk add --no-cache cargo rustc --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community && \
    # AWS CLI v2 (not in Alpine repos)
    curl -sL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip && \
    unzip -q /tmp/awscliv2.zip -d /tmp/aws && \
    /tmp/aws/install && \
    rm -rf /tmp/awscliv2.zip /tmp/aws
    ssh-keygen -A && \
    adduser -S -G node -h /home/madz -s /bin/sh madz && \
    mkdir -p /run/sshd /root/.cache /home/madz/.cache/madz/logs && \
    printf '%s\n' '#!/bin/sh' '[ -f /etc/profile.d/madz-env.sh ] && . /etc/profile.d/madz-env.sh' 'if [ -x "/app" ]; then' '    echo "Starting madz..."' '    cd /app && exec node --expose-gc index.js --mode interactive' 'fi' > /etc/profile && \
    passwd -d madz && \
    sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords yes/' /etc/ssh/sshd_config && \
    printf '%s\n' 'AcceptEnv *' >> /etc/ssh/sshd_config && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv && \
    # Polyglot toolkit CLI tools (for .skills/ bundled skills)
    # yq — YAML parsing
    wget -qO /usr/local/bin/yq "https://github.com/mikefarah/yq/releases/download/v4.45.1/yq_linux_amd64" && \
    chmod +x /usr/local/bin/yq && \
    # Language-specific dev tools (used with graceful degradation)
    # pip-audit — Python dependency CVE scanning
    pip3 install --break-system-packages --no-cache-dir pip-audit && \
    # govulncheck — Go vulnerability analysis
    go install golang.org/x/vuln/cmd/govulncheck@latest && \
    mv /root/go/bin/govulncheck /usr/local/bin/govulncheck && \
    # cargo-audit — Rust dependency security auditing
    cargo install cargo-audit --locked

ENV HOME=/home/madz

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY LICENSE ./
COPY index.js ./
COPY src/ ./src/
COPY config.yaml ./
COPY prompts/ ./prompts/
COPY .skills/ ./.skills/
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN chown -R madz:node /app /home/madz && \
    chmod -R g+rwX /app /home/madz

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["sleep", "infinity"]
