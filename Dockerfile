# a11yfix in a container: pinned Node, pinned Playwright/Chromium (from the
# lockfile), axe-core bundled, a non-root user. Rendering third-party HTML is
# attack surface; run it with limits, see docs/sandbox.md:
#
#   docker build -t a11yfix .
#   # file mode needs no network at all
#   docker run --rm --network none --cpus 2 --memory 2g --read-only \
#     --tmpfs /tmp --tmpfs /home/a11yfix --cap-drop ALL --security-opt no-new-privileges \
#     -v "$PWD:/work" a11yfix audit page.html --out /work/findings.json

FROM node:22.14.0-bookworm-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/rules-core/package.json packages/rules-core/
COPY packages/cli/package.json packages/cli/
RUN npm ci --include=dev
# Chromium version comes from the pinned playwright package.
RUN npx playwright install --with-deps chromium-headless-shell && rm -rf /root/.cache /tmp/*

COPY tsconfig.base.json ./
COPY packages packages
RUN npm run build && npm prune --omit=dev && rm -rf packages/*/test packages/*/src

RUN useradd --create-home --uid 10001 a11yfix
USER a11yfix
WORKDIR /work
ENTRYPOINT ["node", "/app/packages/cli/dist/cli.js"]
CMD ["--help"]
