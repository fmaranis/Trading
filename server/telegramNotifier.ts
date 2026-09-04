import type { CurrentOpportunityAlert } from '../src/investment/decision';

export function telegramNotificationConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

function alertLine(alert: CurrentOpportunityAlert): string {
  const item = alert as any;
  const label = String(item.assetName || item.name || item.ticker || alert.assetId);
  const level = alert.level === 'HIGH_CONVICTION' ? 'HIGH CONVICTION' : 'GOOD ENTRY';
  const timing = item.entryTiming?.state || item.timingState || item.timing || null;
  const reason = item.reason || item.summary || item.explanation || null;
  const parts = [`• ${level} · ${label}`];
  if (timing) parts.push(`  Timing: ${String(timing)}`);
  if (reason) parts.push(`  ${String(reason).slice(0, 350)}`);
  return parts.join('\n');
}

export function formatTelegramOpportunityMessage(input: {
  marketDate: string;
  events: CurrentOpportunityAlert[];
  evidenceState: string;
}): string {
  const high = input.events.filter(event => event.level === 'HIGH_CONVICTION').length;
  const good = input.events.filter(event => event.level === 'GOOD_ENTRY').length;
  return [
    'CUSTODIA · NUEVA OPORTUNIDAD',
    `Mercado: ${input.marketDate}`,
    `Eventos nuevos: ${input.events.length} · HIGH ${high} · GOOD ${good}`,
    `Evidencia: ${input.evidenceState}`,
    '',
    ...input.events.map(alertLine),
    '',
    'Aviso automático. Revisa Custodia antes de ejecutar cualquier operación.'
  ].join('\n').slice(0, 4000);
}

export async function notifyTelegramOpportunity(input: {
  marketDate: string;
  events: CurrentOpportunityAlert[];
  evidenceState: string;
}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatTelegramOpportunityMessage(input),
        disable_web_page_preview: true
      }),
      signal: controller.signal
    });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}
