import type { CurrentOpportunityAlert } from '../src/investment/decision';

export function telegramNotificationConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

async function sendTelegramText(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
      signal: controller.signal
    });
    return response.ok;
  } finally { clearTimeout(timeout); }
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
  return sendTelegramText(formatTelegramOpportunityMessage(input));
}

const MANAGEMENT_LABEL: Record<'ADD' | 'WATCH' | 'REDUCE' | 'EXIT', string> = {
  ADD: 'AÑADIR', WATCH: 'VIGILAR', REDUCE: 'REDUCIR', EXIT: 'SALIR'
};

export async function notifyTelegramPortfolioManagement(input: {
  marketDate: string;
  actionEvents: Array<{
    key: string;
    label: string;
    tickerOrIsin: string;
    action: 'ADD' | 'WATCH' | 'REDUCE' | 'EXIT';
    reason: string;
    suggestedReductionPct: number | null;
  }>;
  rotationEvent: { sourceLabel: string; targetLabel: string; reason: string } | null;
}): Promise<boolean> {
  const lines: string[] = [
    'CUSTODIA · GESTIÓN DE CARTERA',
    `Mercado: ${input.marketDate}`,
    `Cambios nuevos: ${input.actionEvents.length + (input.rotationEvent ? 1 : 0)}`,
    ''
  ];
  for (const event of input.actionEvents) {
    const pct = event.action === 'REDUCE' && event.suggestedReductionPct != null ? ` ${event.suggestedReductionPct.toFixed(0)}%` : '';
    lines.push(`• ${MANAGEMENT_LABEL[event.action]}${pct} · ${event.label} (${event.tickerOrIsin})`);
    lines.push(`  ${event.reason.slice(0, 500)}`);
  }
  if (input.rotationEvent) {
    lines.push(`• ROTAR · ${input.rotationEvent.sourceLabel} → ${input.rotationEvent.targetLabel}`);
    lines.push(`  ${input.rotationEvent.reason.slice(0, 500)}`);
  }
  lines.push('', 'Aviso automático. Revisa Custodia antes de ejecutar cualquier operación.');
  return sendTelegramText(lines.join('\n'));
}
