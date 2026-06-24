# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Builds all PoC projects and the launcher inside a Node container.
# The final image only contains the built static assets — no Node or source.
FROM node:20-alpine AS builder

# GEMINI_API_KEY is baked into the React PoC builds at compile time.
# Pass it via: docker-compose up --build (reads from .env in this directory)
ARG GEMINI_API_KEY=""
ENV GEMINI_API_KEY=$GEMINI_API_KEY

WORKDIR /app

# ── Launcher ──
COPY package*.json vite.config.js index.html ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm install --prefer-offline && npm run build

# ── halliMane ──
COPY pocs/halliMane/package*.json ./pocs/halliMane/
RUN cd pocs/halliMane && npm install --prefer-offline
COPY pocs/halliMane/ ./pocs/halliMane/
RUN cd pocs/halliMane && npm run build

# ── kalyanKendra ──
COPY pocs/kalyanKendra/package*.json ./pocs/kalyanKendra/
RUN cd pocs/kalyanKendra && npm install --prefer-offline
COPY pocs/kalyanKendra/ ./pocs/kalyanKendra/
RUN cd pocs/kalyanKendra && npm run build

# ── kushals ──
COPY pocs/kushals/package*.json ./pocs/kushals/
RUN cd pocs/kushals && npm install --prefer-offline
COPY pocs/kushals/ ./pocs/kushals/
RUN cd pocs/kushals && npm run build

# ── paragon ──
COPY pocs/paragon/package*.json ./pocs/paragon/
RUN cd pocs/paragon && npm install --prefer-offline
COPY pocs/paragon/ ./pocs/paragon/
RUN cd pocs/paragon && npm run build

# ── reliance ──
COPY pocs/reliance/package*.json ./pocs/reliance/
RUN cd pocs/reliance && npm install --prefer-offline
COPY pocs/reliance/ ./pocs/reliance/
RUN cd pocs/reliance && npm run build

# ── sulthan ──
COPY pocs/sulthan/package*.json ./pocs/sulthan/
RUN cd pocs/sulthan && npm install --prefer-offline
COPY pocs/sulthan/ ./pocs/sulthan/
RUN cd pocs/sulthan && npm run build

# ── technoSport ──
COPY pocs/technoSport/package*.json ./pocs/technoSport/
RUN cd pocs/technoSport && npm install --prefer-offline
COPY pocs/technoSport/ ./pocs/technoSport/
RUN cd pocs/technoSport && npm run build

# ── usPolo ──
COPY pocs/usPolo/package*.json ./pocs/usPolo/
RUN cd pocs/usPolo && npm install --prefer-offline
COPY pocs/usPolo/ ./pocs/usPolo/
RUN cd pocs/usPolo && npm run build

# ── vBazaar ──
COPY pocs/vBazaar/package*.json ./pocs/vBazaar/
RUN cd pocs/vBazaar && npm install --prefer-offline
COPY pocs/vBazaar/ ./pocs/vBazaar/
RUN cd pocs/vBazaar && npm run build

# ── Assemble _deploy/ ──
RUN mkdir -p _deploy && \
    cp -r dist/.           _deploy/           && \
    cp -r pocs/halliMane/dist    _deploy/halliMane    && \
    cp -r pocs/kalyanKendra/dist _deploy/kalyanKendra && \
    cp -r pocs/kushals/dist      _deploy/kushals      && \
    cp -r pocs/paragon/dist      _deploy/paragon      && \
    cp -r pocs/reliance/dist     _deploy/reliance     && \
    cp -r pocs/sulthan/dist      _deploy/sulthan      && \
    cp -r pocs/technoSport/dist  _deploy/technoSport  && \
    cp -r pocs/usPolo/dist       _deploy/usPolo       && \
    cp -r pocs/vBazaar/dist      _deploy/vBazaar

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.29.4-alpine-slim
COPY --from=builder /app/_deploy /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
