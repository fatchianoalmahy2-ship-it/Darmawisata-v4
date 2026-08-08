import { AppSettings, SchoolClass, Student } from '@/types';
import qrcode from 'qrcode';

export class WhatsAppService {
  private static instance: WhatsAppService;
  private client: any = null;
  private qrCodeBase64: string = '';
  private connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED' | 'ERROR' = 'DISCONNECTED';
  private errorMessage: string = '';

  private constructor() {}

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  public getStatus() {
    return {
      status: this.connectionStatus,
      qr: this.qrCodeBase64,
      error: this.errorMessage,
    };
  }

  /**
   * Initialize whatsapp-web.js client dynamically
   */
  public async initializeClient(settings: AppSettings) {
    if (this.client) {
      return;
    }

    this.connectionStatus = 'CONNECTING';
    this.errorMessage = '';
    this.qrCodeBase64 = '';

    try {
      // Dynamic import to prevent compilation and environment-specific start crashes
      const { Client, LocalAuth } = await import('whatsapp-web.js');

      console.log('[WhatsApp] Initializing whatsapp-web.js client...');
      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: 'darmawisata_session' }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
          ],
        },
      });

      this.client.on('qr', async (qr: string) => {
        this.connectionStatus = 'QR_READY';
        try {
          this.qrCodeBase64 = await qrcode.toDataURL(qr);
        } catch (qrErr) {
          console.error('[WhatsApp] QR Code conversion error:', qrErr);
        }
      });

      this.client.on('ready', () => {
        this.connectionStatus = 'CONNECTED';
        this.qrCodeBase64 = '';
        console.log('[WhatsApp] whatsapp-web.js Client is ready!');
      });

      this.client.on('auth_failure', (msg: string) => {
        this.connectionStatus = 'ERROR';
        this.errorMessage = `Autentikasi gagal: ${msg}`;
        this.client = null;
        console.error('[WhatsApp] Authentication failure:', msg);
      });

      this.client.on('disconnected', (reason: string) => {
        this.connectionStatus = 'DISCONNECTED';
        this.client = null;
        console.log('[WhatsApp] Client disconnected:', reason);
      });

      await this.client.initialize();
    } catch (err: any) {
      this.connectionStatus = 'ERROR';
      this.errorMessage = `Gagal memuat whatsapp-web.js. Pastikan module terinstal dan Puppeteer didukung di server Anda. Error: ${err.message || err}`;
      this.client = null;
      console.warn('[WhatsApp] whatsapp-web.js failed to load or initialize. Falling back to HTTP Gateway or Simulation mode.', err);
    }
  }

  /**
   * Terminate active whatsapp-web.js client
   */
  public async disconnectClient() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.error('[WhatsApp] Error destroying client:', err);
      }
      this.client = null;
    }
    this.connectionStatus = 'DISCONNECTED';
    this.qrCodeBase64 = '';
  }

  /**
   * Send WhatsApp message using the selected mode (WEB_JS, HTTP_GATEWAY, or SIMULATION)
   */
  public async sendMessage(
    targetPhoneOrGroup: string,
    message: string,
    settings: AppSettings
  ): Promise<{ success: boolean; method: string; detail?: string }> {
    const mode = settings.whatsappMode || 'SIMULATION';
    const cleanTarget = targetPhoneOrGroup.trim();

    if (!cleanTarget) {
      throw new Error('Target nomor telepon atau grup tidak valid / kosong');
    }

    if (mode === 'SIMULATION') {
      console.log(`[WhatsApp SIMULATION] Sending to ${cleanTarget}:\n${message}`);
      return {
        success: true,
        method: 'SIMULATION',
        detail: 'Pesan dikirim melalui mode simulasi sukses harian.',
      };
    }

    if (mode === 'HTTP_GATEWAY') {
      const url = settings.whatsappGatewayUrl;
      if (!url) {
        throw new Error('WhatsApp HTTP Gateway URL belum diisi pada pengaturan.');
      }

      console.log(`[WhatsApp HTTP_GATEWAY] Dispatching to ${url} for ${cleanTarget}...`);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(settings.whatsappGatewayToken
              ? { Authorization: `Bearer ${settings.whatsappGatewayToken}` }
              : {}),
          },
          body: JSON.stringify({
            target: cleanTarget,
            message: message,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gateway returned HTTP ${response.status}: ${errText}`);
        }

        return {
          success: true,
          method: 'HTTP_GATEWAY',
          detail: `Berhasil dikirim melalui Gateway API: ${url}`,
        };
      } catch (err: any) {
        console.error('[WhatsApp HTTP_GATEWAY] Send error:', err);
        throw new Error(`Kesalahan koneksi Gateway: ${err.message || err}`);
      }
    }

    if (mode === 'WEB_JS') {
      if (!this.client || this.connectionStatus !== 'CONNECTED') {
        throw new Error('Koneksi whatsapp-web.js belum siap atau terputus. Silakan hubungkan kembali melalui Admin Panel.');
      }

      try {
        // Send using active self-hosted whatsapp-web.js client
        // Format phone number to JID: e.g. 628123456789@c.us
        let jid = cleanTarget;
        if (!cleanTarget.endsWith('@c.us') && !cleanTarget.endsWith('@g.us')) {
          const cleanDigits = cleanTarget.replace(/[^0-9]/g, '');
          if (cleanDigits.startsWith('0')) {
            jid = `62${cleanDigits.substring(1)}@c.us`;
          } else {
            jid = `${cleanDigits}@c.us`;
          }
        }

        console.log(`[WhatsApp WEB_JS] Sending message to ${jid}...`);
        await this.client.sendMessage(jid, message);

        return {
          success: true,
          method: 'WEB_JS',
          detail: `Berhasil dikirim melalui whatsapp-web.js ke JID: ${jid}`,
        };
      } catch (err: any) {
        console.error('[WhatsApp WEB_JS] Send error:', err);
        throw new Error(`Gagal mengirim via whatsapp-web.js: ${err.message || err}`);
      }
    }

    throw new Error(`Mode WhatsApp '${mode}' tidak didukung.`);
  }
}
