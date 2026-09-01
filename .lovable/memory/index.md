# Project Memory

## Core
Static-first delivery: Browser Cache → IndexedDB → Static JSON → CDN → Database. Public reads must never hit PostgREST directly.
Static generation is trigger-driven only — never add polling or cron for regeneration or live monitoring.
Product Likes are permanently retired from the data-delivery and static-generation pipeline. Do not re-add.
Live telemetry uses the Supabase Broadcast channel `p4no:traffic-monitor`, never database polling.

## Memories
- [Static generation trigger contract](mem://static-pipeline) — Required DB triggers per content table, counter columns to exclude, how to verify the pipeline is alive
