import { env } from '../../config/env.js';
import { WhatsAppProvider } from './WhatsAppProvider.js';

export class UltraMsgProvider extends WhatsAppProvider {
  constructor() {
    super();
    this.baseUrl = env.ultramsgApiUrl || 'https://api.ultramsg.com';
    this.accountToken = env.ultramsgAccountToken || '';
  }

  async request(instanceId, token, method, path, body = null) {
    const url = `${this.baseUrl}/${instanceId}/${path}?token=${encodeURIComponent(token)}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error || data.message || `UltraMsg API error (${res.status})`);
      err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
      throw err;
    }

    return data;
  }

  async createInstance(label) {
    if (!this.accountToken) {
      const err = new Error('ULTRAMSG_ACCOUNT_TOKEN is not configured');
      err.status = 503;
      throw err;
    }

    const res = await fetch(`${this.baseUrl}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: this.accountToken, name: label }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.id) {
      const err = new Error(data.error || data.message || 'Failed to create UltraMsg instance');
      err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
      throw err;
    }

    return { instanceId: String(data.id), token: data.token };
  }

  async getQRCode(instanceId, token) {
    const data = await this.request(instanceId, token, 'GET', 'instance/qr');
    const qr = data.qr || data.qrcode || data.image || data.base64 || null;
    if (!qr) {
      const err = new Error('QR code not available from provider');
      err.status = 502;
      throw err;
    }
    const qrCode = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
    return { qrCode };
  }

  async getInstanceStatus(instanceId, token) {
    const data = await this.request(instanceId, token, 'GET', 'instance/status');
    const status = data.status?.accountStatus?.status
      || data.accountStatus?.status
      || data.status
      || data.instance?.status
      || 'unknown';

    const normalized = String(status).toLowerCase();
    const authenticated = ['authenticated', 'connected', 'ready', 'online'].includes(normalized);

    return {
      status,
      authenticated,
    };
  }

  async sendMessage(instanceId, token, to, message) {
    return this.request(instanceId, token, 'POST', 'messages/chat', { to, body: message });
  }

  async sendMediaMessage(instanceId, token, to, mediaUrl, caption = '') {
    return this.request(instanceId, token, 'POST', 'messages/image', {
      to,
      image: mediaUrl,
      caption,
    });
  }
}
