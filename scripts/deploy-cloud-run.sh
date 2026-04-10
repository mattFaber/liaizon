#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-liaizon}"
REGION="${REGION:-us-central1}"
DOMAIN="${DOMAIN:-liaizon.faberdevelopment.com}"
APP_BASE_URL="https://${DOMAIN}"

echo "Deploying ${SERVICE_NAME} to Cloud Run (${REGION}) from source..."
gcloud run deploy "${SERVICE_NAME}" \
  --platform=managed \
  --region="${REGION}" \
  --source .

echo "Ensuring APP_BASE_URL is pinned to ${APP_BASE_URL}..."
gcloud run services update "${SERVICE_NAME}" \
  --platform=managed \
  --region="${REGION}" \
  --update-env-vars "APP_BASE_URL=${APP_BASE_URL}"

echo "Verifying Cloud Run domain mapping for ${DOMAIN}..."
if gcloud beta run domain-mappings describe \
  --platform=managed \
  --region="${REGION}" \
  --domain="${DOMAIN}" >/dev/null 2>&1; then
  echo "Domain mapping exists."
else
  echo "Domain mapping missing. Creating now..."
  gcloud beta run domain-mappings create \
    --platform=managed \
    --region="${REGION}" \
    --service="${SERVICE_NAME}" \
    --domain="${DOMAIN}"
fi

echo "Deployment complete. Current checks:"
echo
echo "APP_BASE_URL:"
gcloud run services describe "${SERVICE_NAME}" \
  --platform=managed \
  --region="${REGION}" \
  --format='yaml(spec.template.spec.containers[0].env)' | sed -n '/name: APP_BASE_URL/,+1p'

echo
echo "Domain mapping status:"
gcloud beta run domain-mappings describe \
  --platform=managed \
  --region="${REGION}" \
  --domain="${DOMAIN}" \
  --format='yaml(status.conditions,status.resourceRecords)'
