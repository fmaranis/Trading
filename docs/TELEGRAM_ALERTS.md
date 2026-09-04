# Telegram alerts — Custodia

## Purpose

Send only new `GOOD_ENTRY` events and escalations to `HIGH_CONVICTION` to a private Telegram chat, reusing the existing alert engine and dedupe state. No trading thresholds or decision logic are duplicated here.

## Secrets

Server-side only:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ALERT_WEBHOOK_URL`

The existing `ALERT_ADMIN_TOKEN` protects both the scheduler endpoint and the internal Telegram relay.

## Flow

```text
cron-job.org
  -> POST /api/alerts/run-now
  -> existing opportunity engine + Firestore dedupe
  -> ALERT_WEBHOOK_URL
  -> POST /api/alerts/telegram-relay?token=<ALERT_ADMIN_TOKEN>
  -> Telegram Bot API sendMessage
```

## ALERT_WEBHOOK_URL

In production set it to the public Cloud Run service URL plus:

```text
/api/alerts/telegram-relay?token=<same ALERT_ADMIN_TOKEN>
```

Keep the full URL server-side because it contains the relay token.

## Telegram setup

1. Create a bot with `@BotFather` using `/newbot`.
2. Store the BotFather token as `TELEGRAM_BOT_TOKEN`.
3. Open the bot in Telegram and send at least one message (`Start` is enough).
4. Use Telegram Bot API `getUpdates` once to obtain the private chat `id`.
5. Store that numeric/string id as `TELEGRAM_CHAT_ID`.
6. Set `ALERT_WEBHOOK_URL` to the protected relay URL above.
7. Republish Cloud Run so the new Secrets are present.
8. `/api/alerts/status` should report both `notificationChannelConfigured: true` and `telegramConfigured: true`.

## Delivery semantics

Telegram delivery returns success only when Telegram Bot API responds successfully. Existing alert dedupe marks events delivered only after the webhook/relay responds successfully, so failed Telegram delivery remains retryable on a later execution.
