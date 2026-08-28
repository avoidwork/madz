FROM rust:1.96-alpine3.21 AS cargo-audit-builder

RUN cargo install cargo-audit@0.22.2 --locked && \
    cp /usr/local/cargo/bin/cargo-audit /cargo-audit

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
    apk add --no-cache python3 ruby curl bash jq unzip wget ca-certificates git github-cli file zip xz lz4 diffutils tree rsync openssh-server openssh-client cronie ripgrep tzdata chromium go maven gradle openjdk21-jdk uv py3-pip && \
    # Install vault CLI from HashiCorp releases
    VAULT_VER="2.0.4" && \
    curl -fsSL "https://releases.hashicorp.com/vault/${VAULT_VER}/vault_${VAULT_VER}_linux_amd64.zip" -o /tmp/vault.zip && \
    unzip /tmp/vault.zip -d /usr/local/bin && \
    rm /tmp/vault.zip && \
    chmod +x /usr/local/bin/vault && \
    ssh-keygen -A && \
    adduser -S -G node -h /home/madz -s /bin/sh madz && \
    mkdir -p /run/sshd /root/.cache /home/madz/.cache/madz/logs && \
    printf '%s\n' '#!/bin/sh' '[ -f /etc/profile.d/madz-env.sh ] && . /etc/profile.d/madz-env.sh' 'if [ -x "/app" ]; then' '    echo "Starting madz..."' '    cd /app && exec node --expose-gc index.js --mode interactive' 'fi' > /etc/profile && \
    passwd -d madz && \
    # Dev container: allow empty passwords for SSH access
    sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords yes/' /etc/ssh/sshd_config && \
    printf '%s\n' 'AcceptEnv *' >> /etc/ssh/sshd_config

# Python dependency CVE scanning (v2.10.1)
RUN pip install --break-system-packages --no-cache-dir pip-audit==2.10.1

# Go vulnerability analysis (v1.2.0)
RUN go install golang.org/x/vuln/cmd/govulncheck@v1.2.0 && \
    mv /root/go/bin/govulncheck /usr/local/bin/govulncheck

# Rust dependency security auditing (v0.22.2) — pre-compiled from builder stage
COPY --from=cargo-audit-builder /cargo-audit /usr/local/bin/cargo-audit

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
