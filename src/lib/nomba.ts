import { NombaClient } from '@semaphore-pay/server/nomba';

let nombaSandbox: NombaClient | null = null;
let nombaLive: NombaClient | null = null;
let nombaCallbackUrl: string = '';

export function initNombaClients(env: any) {
  if (!nombaCallbackUrl)
    nombaCallbackUrl = env.NOMBA_CHECKOUT_CALLBACK_URL ?? '';
  if (!nombaSandbox && env.NOMBA_SANDBOX_CLIENT_ID) {
    nombaSandbox = new NombaClient({
      clientId: env.NOMBA_SANDBOX_CLIENT_ID,
      clientSecret: env.NOMBA_SANDBOX_CLIENT_SECRET,
      accountId: env.NOMBA_SANDBOX_ACCOUNT_ID,
      environment: 'sandbox',
    });
  }
  if (!nombaLive && env.NOMBA_LIVE_CLIENT_ID) {
    nombaLive = new NombaClient({
      clientId: env.NOMBA_LIVE_CLIENT_ID,
      clientSecret: env.NOMBA_LIVE_CLIENT_SECRET,
      accountId: env.NOMBA_LIVE_ACCOUNT_ID,
      environment: 'production',
    });
  }
}

export function getNombaClients() {
  return {
    sandbox: nombaSandbox,
    production: nombaLive,
    callbackUrl: nombaCallbackUrl,
  };
}
