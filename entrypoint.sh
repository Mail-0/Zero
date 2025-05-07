#!/bin/sh
set -e

echo "Running database migrations..."
bun run db:migrate

echo "Starting the app..."
bun run start --host "0.0.0.0"