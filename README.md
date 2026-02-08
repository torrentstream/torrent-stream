# Torrent Stream

Self-hosted Stremio addon for torrent streaming, with in-memory storage, and automatic TLS.

## DuckDNS Domain Setup

Stremio requires addons to be hosted behind HTTPS, Caddy with it's DuckDNS plugin provides an easy solution.

1. Create a DuckDNS account: https://www.duckdns.org
2. Create a subdomain in the DuckDNS dashboard and point it to your server's lan IP (you'll also need to disable DNS rebinding protection in your router settings if it was enabled)
3. Set these environment variables for the application:
- DUCKDNS_TOKEN: your DuckDNS token
- DOMAIN_NAME: your-subdomain.duckdns.org
4. Start the app, Caddy will request and renew TLS certificates automatically


## Quick Start

### Build Docker image from source

1. Clone the repo
```bash
git clone https://github.com/torrentstream/torrent-stream.git
```
2. Edit the `.env` file as you need
3. Start with Docker Compose:
```bash
docker compose up -d
```

### Use prebuilt Docker image

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

### Install Stremio addon
1. Open your browser at https://your-subdomain.duckdns.org (wait until Caddy resolves certificate before visiting the page). You can also use http://localhost:3000 but it will only work on the server host
2. Click the Install Stremio Addon button or right click it and copy manifest URL to install the addon into Stremio

## Environment Variables

The following env vars can be used to configure the application:

| Variable | Description | Example |
| --- | --- | --- |
| PORT | The webserver's HTTP listen port. | 3000 |
| LOG_LEVEL | Desired log level. Possible values: fatal, error, warn, info, debug, trace, silent. | info |
| DOMAIN_NAME | DuckDNS domain (FQDN) for Caddy TLS. | your-subdomain.duckdns.org |
| DUCKDNS_TOKEN | DuckDNS token for DNS-01 TLS. | - |
| ENCRYPTION_KEY | Key used for encrypting stream URLs in case they contain sensitive information. Use a long random string. | your_random_string |
| STREAM_MEMORY_LIMIT | Stream memory budget in bytes. Increase or decrease depending on available RAM and how many parallel streams you need. | 134217728 |
| TORRENT_ADD_TIMEOUT | Cancel adding torrent to the torrent client if no data is received in this many milliseconds. | 5000 |
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