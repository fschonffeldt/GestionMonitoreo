import nodemailer from "nodemailer";

interface ExpiringDoc {
    busNumber: string;
    docType: string;
    fileName: string;
    expiresAt: Date;
    daysLeft: number;
}

const DOC_TYPE_LABELS: Record<string, string> = {
    permiso_circulacion: "Permiso de Circulación",
    revision_tecnica: "Revisión Técnica",
    chasis: "Información de Chasis",
    licencia_conducir: "Licencia de Conducir",
    cedula_conductor: "Cédula del Conductor",
};

export async function sendExpirationAlert(docs: ExpiringDoc[]): Promise<boolean> {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to = process.env.ALERT_EMAIL_TO;

    if (!host || !user || !pass || !to) {
        console.log("⚠️ SMTP no configurado. Documentos por vencer:");
        docs.forEach(d => {
            const label = DOC_TYPE_LABELS[d.docType] || d.docType;
            const status = d.daysLeft <= 0 ? "⛔ VENCIDO" : `⚠️ ${d.daysLeft} días restantes`;
            console.log(`   Bus ${d.busNumber} — ${label}: ${d.fileName} — ${status}`);
        });
        return false;
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });

    const expired = docs.filter(d => d.daysLeft <= 0);
    const expiring = docs.filter(d => d.daysLeft > 0);

    let html = `<h2 style="color:#d32f2f;">🚨 Alerta de Documentos por Vencer</h2>`;
    html += `<p>Se detectaron <strong>${docs.length}</strong> documento(s) que requieren atención:</p>`;

    if (expired.length > 0) {
        html += `<h3 style="color:#d32f2f;">⛔ Documentos Vencidos (${expired.length})</h3>`;
        html += `<table style="border-collapse:collapse;width:100%;"><tr style="background:#f5f5f5;">
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Bus</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Documento</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Archivo</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Venció</th></tr>`;
        expired.forEach(d => {
            html += `<tr>
        <td style="border:1px solid #ddd;padding:8px;">Bus ${d.busNumber}</td>
        <td style="border:1px solid #ddd;padding:8px;">${DOC_TYPE_LABELS[d.docType] || d.docType}</td>
        <td style="border:1px solid #ddd;padding:8px;">${d.fileName}</td>
        <td style="border:1px solid #ddd;padding:8px;color:red;">Hace ${Math.abs(d.daysLeft)} días</td></tr>`;
        });
        html += `</table>`;
    }

    if (expiring.length > 0) {
        html += `<h3 style="color:#ff9800;">⚠️ Próximos a Vencer (${expiring.length})</h3>`;
        html += `<table style="border-collapse:collapse;width:100%;"><tr style="background:#f5f5f5;">
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Bus</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Documento</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Archivo</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Vence en</th></tr>`;
        expiring.forEach(d => {
            html += `<tr>
        <td style="border:1px solid #ddd;padding:8px;">Bus ${d.busNumber}</td>
        <td style="border:1px solid #ddd;padding:8px;">${DOC_TYPE_LABELS[d.docType] || d.docType}</td>
        <td style="border:1px solid #ddd;padding:8px;">${d.fileName}</td>
        <td style="border:1px solid #ddd;padding:8px;color:#ff9800;">${d.daysLeft} días</td></tr>`;
        });
        html += `</table>`;
    }

    html += `<p style="color:#888;font-size:12px;margin-top:20px;">— Sistema de Gestión de Monitoreo, Ruta Las Galaxias</p>`;

    try {
        await transporter.sendMail({
            from: `"Alertas Bus Manager" <${user}>`,
            to,
            subject: `🚨 ${docs.length} documento(s) por vencer o vencidos`,
            html,
        });
        console.log(`✅ Email de alerta enviado a ${to}`);
        return true;
    } catch (err) {
        console.error("❌ Error enviando email:", err);
        return false;
    }
}
