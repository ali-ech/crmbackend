import { WhatsAppProvider } from './WhatsAppProvider.js';

export class WasenderProvider extends WhatsAppProvider {
  async createInstance() {
    const err = new Error('Wasender provider is not implemented yet');
    err.status = 501;
    throw err;
  }

  async getQRCode() {
    const err = new Error('Wasender provider is not implemented yet');
    err.status = 501;
    throw err;
  }

  async getInstanceStatus() {
    const err = new Error('Wasender provider is not implemented yet');
    err.status = 501;
    throw err;
  }

  async sendMessage() {
    const err = new Error('Wasender provider is not implemented yet');
    err.status = 501;
    throw err;
  }

  async sendMediaMessage() {
    const err = new Error('Wasender provider is not implemented yet');
    err.status = 501;
    throw err;
  }
}
