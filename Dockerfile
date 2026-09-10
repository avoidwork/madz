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
    # Install vault CLI from HashiCorp releases
    VAULT_VER="2.0.4" && \
    curl -fsSL "https://releases.hashicorp.com/vault/${VAULT_VER}/vault_${VAULT_VER}_linux_amd64.zip" -o /tmp/vault.zip && \
    unzip /tmp/vault.zip -d /usr/local/bin && \
    rm /tmp/vault.zip && \
    chmod +x /usr/local/bin/vault && \
    ssh-keygen -A && \
    useradd -m -d /home/madz -s /bin/bash -G node madz && \
    mkdir -p /run/sshd /root/.cache /home/madz/.local/share/madz/logs && \
    printf '%s\n' '#!/bin/sh' '[ -f /etc/profile.d/madz-env.sh ] && . /etc/profile.d/madz-env.sh' 'if [ -x "/app" ]; then' '    echo "Starting madz..."' '    cd /app && exec node --expose-gc index.js --mode interactive' 'fi' > /etc/profile.d/madz-app.sh && \
    passwd -d madz && \
    # Dev container: allow empty passwords for SSH access
    sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords yes/' /etc/ssh/sshd_config && \
    printf '%s\n' 'AcceptEnv *' >> /etc/ssh/sshd_config

# Install uv (no native Debian package)
RUN pip install uv --break-system-packages

# Python dependency CVE scanning (v2.10.1)
RUN pip install --break-system-packages --no-cache-dir pip-audit==2.10.1

# Go vulnerability analysis (v1.2.0)
RUN go install golang.org/x/vuln/cmd/govulncheck@v1.2.0 && \
    mv /root/go/bin/govulncheck /usr/local/bin/govulncheck

# Rust dependency security auditing (v0.22.1) — compiled from source via apt rustc/cargo
# cargo-audit 0.22.2 requires rustc 1.88+; Debian apt provides rustc 1.85, so use 0.22.1
RUN cargo install cargo-audit@0.22.1 --locked && \
    cp /root/.cargo/bin/cargo-audit /usr/local/bin/cargo-audit && \
    rm -rf /root/.cargo/registry

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
