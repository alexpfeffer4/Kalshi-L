function alertFormat() {
  return (process.env.ALERT_WEBHOOK_FORMAT || "discord").toLowerCase();
}

export function hasAlertWebhook() {
  return Boolean(process.env.ALERT_WEBHOOK_URL);
}

function alertText(event) {
  return [
    `MAJOR KALSHI ALERT: ${event.title}`,
    `${event.summary}`,
    `${event.whyItMatters}`,
    event.sourceUrl ? `Source: ${event.sourceUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function sendMajorAlert(event) {
  if (!hasAlertWebhook()) return { sent: false, reason: "missing webhook" };

  const text = alertText(event);
  const format = alertFormat();
  const body =
    format === "slack"
      ? { text }
      : {
          content: text,
        };

  const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Alert webhook failed with ${response.status}.`);
  }

  return { sent: true };
}
