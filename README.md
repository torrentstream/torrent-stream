# Torrent Stream

Self-hosted Stremio addon for torrent streaming, with optional in-memory storage, and automatic TLS.

## How to run the app

### Building Docker image from source

1. Clone the repo
```bash
git clone https://github.com/torrentstream/torrent-stream.git
```
2. Edit the `.env` file as you need
3. Start with Docker Compose:
```bash
docker compose up -d
```

### Using prebuilt Docker image

1. Pull latest image from Docker Hub:
```bash
docker pull torrentstream/torrent-stream:latest
```
2. Start up container:
```bash
docker run -d \
  --name torrent-stream \
  --restart unless-stopped \
  -e DUCKDNS_TOKEN=your_duckdns_token \
  -e DOMAIN_NAME=your-subdomain.duckdns.org \
  -e ENCRYPTION_KEY=your_random_string \
  -e TORRENT_PROVIDERS=torrentio,ncore,insane \
  -e NCORE_USER=your_ncore_username \
  -e NCORE_PASS=your_ncore_password \
  -e INSANE_USER=your_insane_username \
  -e INSANE_PASS=your_insane_password \
  -p 3000:3000 \
  -p 443:443 \
  -v torrent_stream_caddy:/caddy \
  torrentstream/torrent-stream:latest
```

## How to install the addon

Stremio requires addons to be served over HTTPS. There are multiple ways to deal with this.

### Let Torrent Stream bypass the check

Using some client side API calls, Torrent Stream can get around Stremio's HTTPS requirement.

1. Run the app
2. Open your browser at http://localhost:3000 or http://192.168.1.10:3000 (replace LAN IP and port number according to your setup, obviously localhost will only work when the addon and Stremio client is running on the same host)
3. Click the Install Stremio Addon button, the app will detect that it is being served over plain HTTP and a dialog will pop up
4. Enter your credentials and press install, the addon will add itself to your Stremio account

### Use Caddy to resolve certificates

Caddy and it's DuckDNS plugin is bundled with the docker container and it can automatically serve the addon over HTTPS.

1. Create a DuckDNS account: https://www.duckdns.org
2. Create a subdomain in the DuckDNS dashboard and point it to your server's lan IP (you'll also need to disable DNS rebinding protection in your router settings if it was enabled)
3. Set these environment variables for the application:
- DUCKDNS_TOKEN: your DuckDNS token
- DOMAIN_NAME: your-subdomain.duckdns.org
4. Run the app, Caddy will request and renew TLS certificates automatically
5. Open your browser at https://your-subdomain.duckdns.org (wait until Caddy resolves the certificate if the page doesn't load at first)
6. Click the Install Stremio Addon button or right click it and copy link, then use the manifest URL to install it into Stremio

### Bring your own domain and/or reverse proxy

If you already have your own domain and a reverse proxy setup, or any other way to provision TLS certificates, you can use it to serve the addon over HTTPS.

1. Run the app
2. Set up your infrastructure so the addon is accessible at an HTTPS address, then open it in your browser.
3. Click the Install Stremio Addon button or right click it and copy link, then use the manifest URL to install it into Stremio

## Environment Variables

The following env vars can be used to configure the application:

| Variable | Description | Example |
| --- | --- | --- |
| PORT | The webserver's HTTP listen port. | 3000 |
| LOG_LEVEL | Desired log level. Possible values: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. | info |
| DOMAIN_NAME | DuckDNS domain (FQDN) for Caddy TLS. | - |
| DUCKDNS_TOKEN | DuckDNS token for DNS-01 TLS. | - |
| ENCRYPTION_KEY | Key used for encrypting stream URLs in case they contain sensitive information. Use a long random string. | - |
| TORRENT_STORAGE_MODE | Desired torrent storage location. Possible values: `memory`, `file`. | file |
| STREAM_MEMORY_LIMIT | Stream memory budget in bytes. Increase or decrease depending on available RAM and how many parallel streams you need. Only applies if storage mode is `memory`. | 134217728 |
| TORRENT_STORAGE_PATH | Desired torrent storage directory path. Only applies if storage mode is `file`. | /data |
| TORRENT_STATE_PATH | Directory for persistent seed state. Only applies if storage mode is `file` and seed requirements are set. | /state |
| TORRENT_KEEP_FILES | Keep downloaded content on disk after a torrent is removed from the client. Only applies if storage mode is `file`. | true |
| TORRENT_IDLE_DOWNLOAD | Keep downloading files that have been streamed to completion while the torrent is idle. Only applies if storage mode is `file`. | true |
| TORRENT_SEED_RATIO | Keep idle torrents in the client until their cumulative upload/download ratio reaches this value. Only applies if storage mode is `file`. | 1.0 |
| TORRENT_SEED_TIME | Keep idle torrents in the client until they have been loaded for this many seconds in total. Only applies if storage mode is `file`. | 172800 |
| TORRENT_SEED_TIME_INCREMENT | Additional required seed time in seconds per `TORRENT_SEED_TIME_INCREMENT_BYTES` downloaded, on top of `TORRENT_SEED_TIME`. | 1440 |
| TORRENT_SEED_TIME_INCREMENT_BYTES | The downloaded byte quantum for `TORRENT_SEED_TIME_INCREMENT`. | 1073741824 |
| TORRENT_SEED_TIME_RATIO_DISCOUNT | Scale the required seed time by how far the ratio is from `TORRENT_SEED_RATIO` (or `1` if unset), so uploading reduces the time requirement and reaching the target ratio waives it. | true |
| TORRENT_DOWNLOAD_LIMIT | Global download speed limit in bytes/sec. Use `-1` to disable throttling, `0` blocks downloads entirely. | -1 |
| TORRENT_UPLOAD_LIMIT | Global upload speed limit in bytes/sec. Use `-1` to disable throttling, `0` blocks uploads entirely. | -1 |
| TORRENT_ADD_TIMEOUT | Cancel adding torrent to the torrent client if no data is received in this many milliseconds. | 5000 |
| TORRENT_ANNOUNCE_TIMEOUT | Maximum time to wait for a final tracker update announce before removing a torrent. | 5000 |
| TORRENT_IDLE_TIMEOUT | Consider a torrent idle after no streams pulled any data in this many milliseconds. | 60000 |
| TORRENT_REMOVE_TIMEOUT | Remove idle torrents from the torrent client after this many milliseconds. | 300000 |
| WEB_REQUEST_TIMEOUT | Cancel any web requests (like fetching torrent lists) after this many milliseconds. | 5000 |
| TORRENT_PROVIDERS | Comma separated list of enabled torrent providers. Possible values: `ncore`, `insane`, `yts`, `eztv`, `rarbg`, `1337x`, `thepiratebay`, `kickasstorrents`, `torrentgalaxy`, `magnetdl`, `horriblesubs`, `nyaasi`, `tokyotosho`, `anidex`, `rutor`, `rutracker`, `comando`, `bludv`, `micoleaodublado`, `torrent9`, `ilcorsaronero`, `mejortorrent`, `wolfmax4k`, `cinecalidad`, `besttorrents`, `torrentio` (all Torrentio providers in one). | torrentio,ncore,insane |
| TORRENT_FORMATS | Comma separated list of enabled torrent formats. If a torrent matches any non-enabled format it will be excluded from the results. Possible values: `4k`, `1080p`, `720p`, `dv`, `hdr`, `uhdbluray`, `bluray`, `remux`, `web`, `dvd`, `hdtv`, `sdtv`, `screener`, `cam`, `3d`, `unknown`, `av1`, `hevc`, `avc`, `divx`, `xvid` | 1080p,720p,bluray,web,hevc,avc |
| TORRENT_LANGUAGES | Comma separated list of enabled torrent languages (use 2 letter ISO country codes). If a torrent has different primary language it will be excluded from the results. | en,hu |
| NCORE_USER | Your nCore username (if the provider is enabled). | - |
| NCORE_PASS | Your nCore password (if the provider is enabled). | - |
| INSANE_USER | Your iNSANE username (if the provider is enabled). | - |
| INSANE_PASS | Your iNSANE password. (if the provider is enabled). | - |

A torrent is removed once **either** seed requirement is met. A ratio-only
configuration can hold a torrent indefinitely when nobody is downloading, so
setting `TORRENT_SEED_TIME` as well is recommended as a cap. Seeding survives
restarts: torrent metainfo and counters are persisted under
`TORRENT_STATE_PATH`, re-added on boot, and the on-disk data is re-verified
before seeding continues. Running multiple app instances against the same
state or storage path is unsupported.

The full required seed time formula is:

```
(TORRENT_SEED_TIME + TORRENT_SEED_TIME_INCREMENT * downloaded / TORRENT_SEED_TIME_INCREMENT_BYTES) * (1 - ratio / TORRENT_SEED_RATIO, if the discount is enabled)
```

For example, a tracker rule of `(1 - ratio) * (48 + 0.4 * downloaded GiB)`
hours maps to `TORRENT_SEED_RATIO=1.0`, `TORRENT_SEED_TIME=172800`,
`TORRENT_SEED_TIME_INCREMENT=1440`,
`TORRENT_SEED_TIME_INCREMENT_BYTES=1073741824` and
`TORRENT_SEED_TIME_RATIO_DISCOUNT=true`.
