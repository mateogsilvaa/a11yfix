# Running a11yfix on untrusted pages

Rendering someone else's HTML in a browser is attack surface, and site mode runs the site's scripts. a11yfix limits
what a page can do in layers. Only the first two are always on.

## 1. In the browser (always on)

- **File mode**: page scripts are blocked with `Content-Security-Policy: script-src 'none'`; pages are served from a
  fake origin; every request outside the page's own directory is aborted. File mode never touches the network.
- **Site mode**: scripts run (that is the point of rendering a real site), but every request to an origin other than
  the target, or an origin you allow with `--allow-origin`, is aborted and counted in the report. Service workers and
  downloads are blocked. Each page gets a fresh browser context: no cookies, storage or cache shared between pages
  beyond the authentication you configure, which goes to the target origin only.

## 2. Politeness (always on in site mode)

Same-origin crawl, `robots.txt` honoured by default (with `Crawl-delay`), `--max-pages`, `--depth`, `--concurrency`
and `--delay`.

## 3. The container (recommended for sites you do not control)

The [Dockerfile](../Dockerfile) pins Node (22.14), Playwright and Chromium (from the lockfile) and axe-core, and runs
as an unprivileged user.

```sh
docker build -t a11yfix .

# file mode: no network at all
docker run --rm --network none --cpus 2 --memory 2g --read-only \
  --tmpfs /tmp --tmpfs /home/a11yfix --cap-drop ALL --security-opt no-new-privileges \
  -v "$PWD:/work" a11yfix audit page.html --out /work/findings.json

# site mode: network is needed; keep the other limits
docker run --rm --cpus 2 --memory 2g --read-only \
  --tmpfs /tmp --tmpfs /home/a11yfix --cap-drop ALL --security-opt no-new-privileges \
  -v "$PWD/out:/work" a11yfix site https://staging.example.com/ --out /work
```

CI builds the image and runs an audit and a verified fix inside it with `--network none`, a read-only root, no
capabilities and CPU and memory caps.

**What the container does not do**: restrict outgoing traffic to the target at the network level. Docker has no
per-host egress filter; the browser-level allowlist above is what stops third-party requests. If you need a network
guarantee, put the container on a network whose only route out is an egress proxy that allows the target host.
