FROM node:20-slim

ARG TARGETARCH
ARG OBSCURA_VERSION=latest

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Descarga el binario de Obscura (navegador headless para agentes) para la arquitectura del build.
# Ver https://github.com/h4ckf0r0day/obscura para otras plataformas.
RUN set -eux; \
  case "$TARGETARCH" in \
    amd64) OBSCURA_ARCH=x86_64 ;; \
    arm64) OBSCURA_ARCH=aarch64 ;; \
    *) echo "Arquitectura no soportada: $TARGETARCH" && exit 1 ;; \
  esac; \
  if [ "$OBSCURA_VERSION" = "latest" ]; then \
    RELEASE_PATH="releases/latest/download"; \
  else \
    RELEASE_PATH="releases/download/${OBSCURA_VERSION}"; \
  fi; \
  curl -fLO "https://github.com/h4ckf0r0day/obscura/${RELEASE_PATH}/obscura-${OBSCURA_ARCH}-linux.tar.gz"; \
  tar xzf "obscura-${OBSCURA_ARCH}-linux.tar.gz" -C /usr/local/bin; \
  rm "obscura-${OBSCURA_ARCH}-linux.tar.gz"; \
  chmod +x /usr/local/bin/obscura /usr/local/bin/obscura-worker; \
  obscura --version

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV MCP_COMMAND=obscura
ENV MCP_ARGS=mcp
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
