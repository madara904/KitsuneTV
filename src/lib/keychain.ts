/**
 * Secure storage for Xtream credentials - react-native-keychain with DB fallback.
 * On emulator Keychain often fails; credentials are then stored in Settings table.
 */
import * as Keychain from 'react-native-keychain';
import { settingsRepo } from '../db/repositories/settingsRepo';

const SERVICE_PREFIX = 'kitsune:provider:';
const FALLBACK_PREFIX = 'kitsune_cred_fallback:';

function serviceKey(providerId: string): string {
  return `${SERVICE_PREFIX}${providerId}`;
}

function fallbackKey(providerId: string): string {
  return `${FALLBACK_PREFIX}${providerId}`;
}

export async function setProviderCredentials(
  providerId: string,
  username: string,
  password: string
): Promise<void> {
  try {
    await Keychain.setGenericPassword(username, password, { service: serviceKey(providerId) });
    await settingsRepo.delete(fallbackKey(providerId));
  } catch {
    await settingsRepo.set(
      fallbackKey(providerId),
      JSON.stringify({ username, password })
    );
  }
}

export async function getProviderCredentials(
  providerId: string
): Promise<{ username: string; password: string } | null> {
  const creds = await Keychain.getGenericPassword({ service: serviceKey(providerId) }) as { username: string; password: string } | false | null;
  if (creds && typeof creds === 'object' && creds.username != null && creds.password != null) {
    return { username: creds.username, password: creds.password };
  }
  const raw = await settingsRepo.get(fallbackKey(providerId));
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { username?: string; password?: string };
    if (o?.username != null && o?.password != null) {
      return { username: o.username, password: o.password };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function deleteProviderCredentials(providerId: string): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: serviceKey(providerId) });
  } catch {
    // ignore
  }
  await settingsRepo.delete(fallbackKey(providerId));
}
