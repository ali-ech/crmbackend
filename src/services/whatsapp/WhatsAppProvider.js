import { env } from '../../config/env.js';

export class WhatsAppProvider {
  async createInstance(_label) {
    throw new Error('Not implemented');
  }

  async getQRCode(_instanceId, _token) {
    throw new Error('Not implemented');
  }

  async getInstanceStatus(_instanceId, _token) {
    throw new Error('Not implemented');
  }

  async sendMessage(_instanceId, _token, _to, _message) {
    throw new Error('Not implemented');
  }

  async sendMediaMessage(_instanceId, _token, _to, _mediaUrl, _caption) {
    throw new Error('Not implemented');
  }
}

export function getProviderName(configProvider = null) {
  return configProvider || env.whatsappProvider || 'ultramsg';
}

export async function getWhatsAppProvider(providerName = null) {
  const name = providerName || env.whatsappProvider || 'ultramsg';

  if (name === 'ultramsg') {
    const { UltraMsgProvider } = await import('./UltraMsgProvider.js');
    return new UltraMsgProvider();
  }

  if (name === 'wasender') {
    const { WasenderProvider } = await import('./WasenderProvider.js');
    return new WasenderProvider();
  }

  const err = new Error(`Unknown WhatsApp provider: ${name}`);
  err.status = 400;
  throw err;
}
