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
  -e CONFIG_PATH=/config \
  -p 3000:3000 \
  -p 443:443 \
  -v torrent_stream_caddy:/caddy \
  -v torrent_stream_config:/config \
  -v torrent_stream_data:/data \
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

## Configuration

Open `/config` in the web interface to configure storage behavior, limits,
timeouts, search filters, providers, credentials, Torrentio sources, and
seeding for private providers. The settings are saved to
`$CONFIG_PATH/config.json` and applied without restarting the application
where possible. Changing storage mode requires confirmation because it
rebuilds the torrent clients and interrupts active playback.

The application itself only reads these environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| PORT | HTTP listen port. | `3000` |
| LOG_LEVEL | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`. | `info` |
| DOMAIN_NAME | DuckDNS domain used by the bundled Caddy server. | - |
| DUCKDNS_TOKEN | DuckDNS token used for DNS-01 TLS. | - |
| ENCRYPTION_KEY | Long random key used to encrypt stream URLs. | Development fallback |
| CONFIG_PATH | Directory containing `config.json`, resumable torrent records, and torrent metainfo. | `/config` |

Use `/config` and the configured torrent storage path (default `/data`) with
persistent volumes when durable configuration or file storage is desired.
Running multiple application instances against the same paths is unsupported.
