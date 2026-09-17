FROM node:26-slim AS builder

RUN apt-get update && \
    apt-get install -y python3 build-essential bash && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY scripts/ ./scripts/

RUN npm ci

COPY src/ ./src/
COPY tests/ ./tests/

RUN npm prune --omit=dev

FROM node:26-slim

# System packages
RUN apt-get update && \
    apt-get install -y python3 ruby curl bash jq unzip wget ca-certificates git gh file zip xz-utils lz4 diffutils tree rsync openssh-server openssh-client cron ripgrep tzdata chromium golang maven gradle openjdk-21-jdk python3-pip rustc cargo build-essential && \
    rm -rf /var/lib/apt/lists/* && \
    ssh-keygen -A && \
    useradd -m -d /home/madz -s /bin/bash -G node madz && \
    mkdir -p /run/sshd /root/.cache /home/madz/.local/share/madz/logs && \
    printf '%s\n' '#!/bin/sh' '[ -f /etc/profile.d/madz-env.sh ] && . /etc/profile.d/madz-env.sh' 'if [ -x "/app" ]; then' '    echo "Starting madz..."' '    cd /app && exec node --expose-gc index.js --mode interactive' 'fi' > /etc/profile.d/madz-app.sh && \
    passwd -d madz && \
    # Dev container: allow empty passwords for SSH access
    sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords yes/' /etc/ssh/sshd_config && \
    printf '%s\n' 'AcceptEnv *' >> /etc/ssh/sshd_config

# Environment
ENV HOME=/home/madz
WORKDIR /app

# Permissions
RUN chown -R madz:node /app /home/madz && \
    chmod -R g+rwX /app /home/madz

# Install uv (no native Debian package)
RUN pip install --no-cache-dir uv --break-system-packages

# Python dependency CVE scanning (v2.10.1)
RUN pip install --break-system-packages --no-cache-dir pip-audit==2.10.1

# Go vulnerability analysis (v1.2.0)
ENV GOBIN=/usr/local/bin
RUN go install golang.org/x/vuln/cmd/govulncheck@v1.2.0 && \
  rm -rf /home/madz/go /home/madz/.cache/go-build

# Rust dependency security auditing (v0.22.1)
ENV CARGO_INSTALL_ROOT=/usr/local/bin
RUN cargo install cargo-audit@0.22.1 --locked && \
  rm -rf /home/madz/.cargo

# Node package managers (yarn, pnpm) — available as globals
RUN npm install -g yarn pnpm

# OpenSpec CLI — global module
RUN npm install -g @fission-ai/openspec@latest

COPY --from=builder --chown=madz:node /app/node_modules ./node_modules
COPY --from=builder --chown=madz:node /app/package*.json ./
COPY --chown=madz:node LICENSE index.js config.yaml ./
COPY --chown=madz:node src/ ./src/
COPY --chown=madz:node prompts/ ./prompts/
COPY --chown=madz:node .skills/ ./.skills/
COPY --chown=madz:node docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["sleep", "infinity"]
