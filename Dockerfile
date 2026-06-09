FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ bash

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src/ ./src/
COPY tests/ ./tests/
COPY index.js ./
COPY config.yaml ./

RUN npm prune --omit=dev && \
    npm cache clean --force

FROM node:24-alpine

RUN apk add --no-cache python3 ruby curl bash jq unzip wget ca-certificates git file zip xz lz4 diffutils tree rsync openssh-server cron && \
    ssh-keygen -A && \
    mkdir -p /run/sshd && \
    adduser -S -G node -h /home/madz -s /bin/sh madz && \
    printf '%s\n' '#!/bin/sh' '[ -f /etc/profile.d/madz-env.sh ] && . /etc/profile.d/madz-env.sh' 'if [ -x "/app" ]; then' '    echo "Starting madz..."' '    cd /app && exec npm start' 'fi' > /etc/profile && \
    passwd -d madz && \
    sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords yes/' /etc/ssh/sshd_config && \
    printf '%s\n' 'AcceptEnv *' >> /etc/ssh/sshd_config && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY LICENSE ./
COPY src/ ./src/
COPY config.yaml ./
COPY index.js ./
COPY prompts/ ./prompts/
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN chown -R madz:node /app && \
    chmod -R g+rwX /app

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["sleep", "infinity"]
