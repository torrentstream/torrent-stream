#!/bin/sh
set -eu

SUPERVISORD_TEMPLATE=/etc/supervisord.conf.template
SUPERVISORD_CONF=/etc/supervisord.conf

if [ -n "${DOMAIN_NAME:-}" ] && [ -n "${DUCKDNS_TOKEN:-}" ]; then
  cp "$SUPERVISORD_TEMPLATE" "$SUPERVISORD_CONF"
else
  awk 'BEGIN{skip=0}
       /^\[program:caddy\]/{skip=1; next}
       /^\[program:/{if(skip==1){skip=0}}
       {if(skip==0) print $0}' "$SUPERVISORD_TEMPLATE" > "$SUPERVISORD_CONF"
fi

exec /usr/bin/supervisord -c "$SUPERVISORD_CONF"
