import sgMail from '@sendgrid/mail';
import { config } from '../config.js';

async function postWebhook(lead) {
  if (!config.leadWebhookUrl) return { skipped: true };
  const headers = { 'Content-Type': 'application/json' };
  if (config.leadWebhookSecret) headers['x-lead-webhook-secret'] = config.leadWebhookSecret;

  const response = await fetch(config.leadWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(lead)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Lead webhook failed: ${response.status} ${text}`);
  }

  return { ok: true, status: response.status };
}

async function sendNotificationEmail(lead) {
  if (!config.sendgridApiKey || !config.notifyEmailTo || !config.notifyEmailFrom) return { skipped: true };
  sgMail.setApiKey(config.sendgridApiKey);

  const subject = `New Sewer Center Lead: ${lead.userType || 'Unknown'} - ${lead.module || 'General'}`;
  const html = `
    <h2>New Instant Sewer & Drain Answers Lead</h2>
    <p><strong>Name:</strong> ${lead.name || ''}</p>
    <p><strong>Phone:</strong> ${lead.phone || ''}</p>
    <p><strong>Email:</strong> ${lead.email || ''}</p>
    <p><strong>Address:</strong> ${lead.propertyAddress || ''}</p>
    <p><strong>User type:</strong> ${lead.userType || ''}</p>
    <p><strong>Module:</strong> ${lead.module || ''}</p>
    <p><strong>Urgency:</strong> ${lead.urgency || ''}</p>
    <p><strong>Preferred time:</strong> ${lead.preferredAppointmentTime || ''}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap">${lead.message || ''}</pre>
    <p><strong>Uploaded file IDs:</strong> ${(lead.uploadedFileIds || []).join(', ')}</p>
  `;

  await sgMail.send({
    to: config.notifyEmailTo,
    from: config.notifyEmailFrom,
    subject,
    html
  });

  return { ok: true };
}

export async function routeLead(lead) {
  const results = { webhook: null, email: null };
  const errors = [];

  try {
    results.webhook = await postWebhook(lead);
  } catch (error) {
    errors.push(error.message);
  }

  try {
    results.email = await sendNotificationEmail(lead);
  } catch (error) {
    errors.push(error.message);
  }

  return { results, errors };
}
