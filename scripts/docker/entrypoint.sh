#!/bin/sh
set -x

# Replacing placeholder urls to runtime variables, since we're using rewrites in nextjs, this is required.
# Everything else which doesn't compile URLs at build should already be able to use runtime variables.

/app/scripts/replace-placeholder.sh "http://REPLACE-BACKEND-URL.com" "$NEXT_PUBLIC_BACKEND_URL"
/app/scripts/replace-placeholder.sh "http://REPLACE-APP-URL.com" "$NEXT_PUBLIC_APP_URL"

exec bun /app/apps/mail/server.js