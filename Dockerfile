FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ bash

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src/ ./src/
COPY tests/ ./tests/
COPY index.js ./
COPY config.yaml ./

RUN npm test && \
    npm prune --omit=dev && \
    npm cache clean --force

FROM node:24-alpine

RUN apk add --no-cache python3 ruby curl bash jq unzip wget ca-certificates git file zip xz lz4 diffutils tree rsync openssh-server && \
    ssh-keygen -A && \
    mkdir -p /run/sshd && \
    addgroup -S madz && \
    adduser -S madz -G madz -h /home/madz -s /bin/sh && \
    passwd -d madz && \
    sed -i 's/^PermitEmptyPasswords.*/PermitEmptyPasswords yes/' /etc/ssh/sshd_config && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY src/ ./src/
COPY config.yaml ./
COPY index.js ./

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D"]
