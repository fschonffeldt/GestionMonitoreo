import nodemailer from "nodemailer";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ExpiringDoc {
  busNumber: string;
  docType: string;
  fileName: string;
  expiresAt: Date;
  daysLeft: number;
  driverName?: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  permiso_circulacion: "Permiso de Circulación",
  revision_tecnica: "Revisión Técnica",
  chasis: "Información de Chasis",
  licencia_conducir: "Licencia de Conducir",
  cedula_conductor: "Cédula del Conductor",
};

export async function sendExpirationAlert(docs: ExpiringDoc[], recipients: string[]): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log("⚠️ SMTP no configurado. Documentos por vencer:");
    docs.forEach(d => {
      const label = DOC_TYPE_LABELS[d.docType] || d.docType;
      const status = d.daysLeft <= 0 ? "⛔ VENCIDO" : `⚠️ ${d.daysLeft} días restantes`;
      console.log(`   Bus ${d.busNumber} — ${label}: ${d.fileName} — ${status}`);
    });
    return false;
  }

  if (recipients.length === 0) {
    console.log("⚠️ No hay destinatarios activos para alertas de vencimiento.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS, not direct SSL
    requireTLS: true,
    auth: { user, pass },
    tls: {
      minVersion: "TLSv1.2",
      ciphers: "HIGH",
    },
  });

  const expired = docs.filter(d => d.daysLeft <= 0);
  const expiring = docs.filter(d => d.daysLeft > 0);

  const thStyle = `border:1px solid #ddd;padding:10px 14px;text-align:left;font-weight:600;`;
  const tdStyle = `border:1px solid #ddd;padding:8px 14px;`;

  let html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#d32f2f,#ff5722);color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">🚨 Alerta de Documentos por Vencer</h2>
        <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">
          ${format(new Date(), "EEEE dd 'de' MMMM yyyy", { locale: es })} — ${docs.length} documento(s) requieren atención
        </p>
      </div>
      <div style="background:#fff;padding:20px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
    `;

  if (expired.length > 0) {
    html += `<h3 style="color:#d32f2f;margin-top:0;">⛔ Documentos Vencidos (${expired.length})</h3>`;
    html += `<table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <tr style="background:#fce4ec;">
            <th style="${thStyle}">N° Bus</th>
            <th style="${thStyle}">Tipo de Documento</th>
            <th style="${thStyle}">Conductor</th>
            <th style="${thStyle}">Fecha Vencimiento</th>
            <th style="${thStyle}">Estado</th>
          </tr>`;
    expired.forEach(d => {
      const label = DOC_TYPE_LABELS[d.docType] || d.docType;
      const dateStr = format(new Date(d.expiresAt), "dd/MM/yyyy");
      html += `<tr>
              <td style="${tdStyle}font-weight:600;">Bus ${d.busNumber}</td>
              <td style="${tdStyle}">${label}</td>
              <td style="${tdStyle}">${d.driverName || "—"}</td>
              <td style="${tdStyle}">${dateStr}</td>
              <td style="${tdStyle}color:#d32f2f;font-weight:600;">Vencido hace ${Math.abs(d.daysLeft)} días</td>
            </tr>`;
    });
    html += `</table>`;
  }

  if (expiring.length > 0) {
    html += `<h3 style="color:#ff9800;margin-top:0;">⚠️ Próximos a Vencer (${expiring.length})</h3>`;
    html += `<table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <tr style="background:#fff3e0;">
            <th style="${thStyle}">N° Bus</th>
            <th style="${thStyle}">Tipo de Documento</th>
            <th style="${thStyle}">Conductor</th>
            <th style="${thStyle}">Fecha Vencimiento</th>
            <th style="${thStyle}">Días Restantes</th>
          </tr>`;
    expiring.forEach(d => {
      const label = DOC_TYPE_LABELS[d.docType] || d.docType;
      const dateStr = format(new Date(d.expiresAt), "dd/MM/yyyy");
      const urgColor = d.daysLeft <= 5 ? "#d32f2f" : "#ff9800";
      html += `<tr>
              <td style="${tdStyle}font-weight:600;">Bus ${d.busNumber}</td>
              <td style="${tdStyle}">${label}</td>
              <td style="${tdStyle}">${d.driverName || "—"}</td>
              <td style="${tdStyle}">${dateStr}</td>
              <td style="${tdStyle}color:${urgColor};font-weight:600;">${d.daysLeft} días</td>
            </tr>`;
    });
    html += `</table>`;
  }

  html += `
        <p style="color:#888;font-size:12px;border-top:1px solid #eee;padding-top:12px;margin-bottom:0;">
          — Sistema de Gestión de Monitoreo, Ruta Las Galaxias S.A.
        </p>
      </div>
    </div>`;

  try {
    await transporter.sendMail({
      from: `"Alertas Bus Manager" <${user}>`,
      to: recipients.join(", "),
      subject: `🚨 ${docs.length} documento(s) por vencer o vencidos — Ruta Las Galaxias`,
      html,
    });
    console.log(`✅ Email de alerta enviado a ${recipients.join(", ")}`);
    return true;
  } catch (err) {
    console.error("❌ Error enviando email:", err);
    return false;
  }
}
