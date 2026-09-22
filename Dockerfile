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

# Terraform & tflint — downloaded binaries (not in Debian repos)
ARG TARGETARCH
RUN TF_VER="1.16.3" && \
    TFLINT_VER="0.64.0" && \
    ARCH="${TARGETARCH:-$(uname -m)}" && \
    case "$ARCH" in \
      amd64|x86_64) ARCH="amd64" ;; \
      arm64|aarch64) ARCH="arm64" ;; \
      *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://releases.hashicorp.com/terraform/${TF_VER}/terraform_${TF_VER}_linux_${ARCH}.zip" -o /tmp/terraform.zip && \
    unzip -o /tmp/terraform.zip -d /usr/local/bin && \
    rm /tmp/terraform.zip && \
    curl -fsSL "https://github.com/terraform-linters/tflint/releases/download/v${TFLINT_VER}/tflint_linux_${ARCH}.zip" -o /tmp/tflint.zip && \
    unzip -o /tmp/tflint.zip -d /usr/local/bin && \
    rm /tmp/tflint.zip && \
    chmod +x /usr/local/bin/terraform /usr/local/bin/tflint

# Environment
ENV HOME=/home/madz
WORKDIR /app

# Permissions
RUN chown -R madz:node /app /home/madz && \
    chmod -R g+rwX /app /home/madz

# Install uv (no native Debian package)
RUN pip install --no-cache-dir uv --break-system-packages

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
RUN mkdir -p /app/projects && chown madz:node /app/projects
COPY --chown=madz:node docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["sleep", "infinity"]
