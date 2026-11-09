type Appointment = {
  id?: string;
  customer_name?: string | null;
  customer_email?: string | null;
  service?: string;
  requested_date?: string;
  requested_time?: string;
  notes?: string;
};

type DatabaseWebhook = {
  type?: string;
  schema?: string;
  table?: string;
  record?: Appointment;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char] ?? char));

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("APPOINTMENT_WEBHOOK_SECRET");
  const suppliedSecret = request.headers.get("x-webhook-secret");
  if (!webhookSecret || !suppliedSecret || suppliedSecret !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let webhook: DatabaseWebhook;
  try {
    webhook = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (webhook.type !== "INSERT" || webhook.schema !== "public" || webhook.table !== "appointments") {
    return new Response("Ignored", { status: 200 });
  }

  const appointment = webhook.record;
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  const recipient = Deno.env.get("SARA_NOTIFICATION_EMAIL");
  if (!appointment || !apiKey || !from || !recipient) {
    console.error("Appointment notification is missing required server configuration.");
    return new Response("Notification is not configured", { status: 500 });
  }

  const customerName = appointment.customer_name?.trim() || "Cliente";
  const subjectName = customerName.replace(/[\r\n]+/g, " ").slice(0, 120);
  const customerEmail = appointment.customer_email?.trim() || "Não informado";
  const service = appointment.service?.trim() || "Não informado";
  const date = appointment.requested_date || "Não informada";
  const time = appointment.requested_time?.slice(0, 5) || "Não informado";
  const notes = appointment.notes?.trim() || "Sem observações";
  const siteUrl = Deno.env.get("SITE_URL")?.replace(/\/$/, "");
  const dashboardLink = siteUrl ? `${siteUrl}/agendamento.html` : undefined;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#321b23;line-height:1.6;max-width:600px;margin:auto">
      <h1 style="color:#682238;font-size:24px">Novo pedido de agendamento</h1>
      <p>Uma cliente enviou um pedido pelo site da Sara Nail Designer.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border-bottom:1px solid #ead8d7"><strong>Cliente</strong></td><td style="padding:8px;border-bottom:1px solid #ead8d7">${escapeHtml(customerName)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #ead8d7"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #ead8d7">${escapeHtml(customerEmail)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #ead8d7"><strong>Serviço</strong></td><td style="padding:8px;border-bottom:1px solid #ead8d7">${escapeHtml(service)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #ead8d7"><strong>Data desejada</strong></td><td style="padding:8px;border-bottom:1px solid #ead8d7">${escapeHtml(date)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #ead8d7"><strong>Horário desejado</strong></td><td style="padding:8px;border-bottom:1px solid #ead8d7">${escapeHtml(time)}</td></tr>
        <tr><td style="padding:8px"><strong>Observações</strong></td><td style="padding:8px">${escapeHtml(notes)}</td></tr>
      </table>
      ${dashboardLink ? `<p style="margin-top:24px"><a href="${escapeHtml(dashboardLink)}" style="display:inline-block;background:#682238;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none">Abrir painel de agendamentos</a></p>` : ""}
      <p style="color:#725f65;font-size:13px">Este pedido ainda aguarda sua confirmação no painel do site.</p>
    </div>`;

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Novo pedido de agendamento — ${subjectName}`,
      html,
      text: [
        "Novo pedido de agendamento",
        `Cliente: ${customerName}`,
        `Email: ${customerEmail}`,
        `Serviço: ${service}`,
        `Data desejada: ${date}`,
        `Horário desejado: ${time}`,
        `Observações: ${notes}`,
        dashboardLink ? `Painel: ${dashboardLink}` : "",
        "Este pedido aguarda confirmação no painel do site.",
      ].filter(Boolean).join("\n"),
    }),
  });

  if (!emailResponse.ok) {
    console.error("Email provider rejected the appointment notification.", emailResponse.status);
    return new Response("Email delivery failed", { status: 502 });
  }

  return new Response("Notification sent", { status: 200 });
});
