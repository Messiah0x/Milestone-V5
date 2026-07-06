import { SiweMessage, generateNonce } from "siwe";

export { generateNonce };

export function buildSiweMessage(address: string, nonce: string, domain: string, uri: string): string {
  const message = new SiweMessage({
    domain,
    address,
    statement: "Sign in to Milestone to link this wallet.",
    uri,
    version: "1",
    chainId: 1,
    nonce,
    issuedAt: new Date().toISOString(),
  });
  return message.prepareMessage();
}

export async function verifySiwe(
  message: string,
  signature: string,
  expectedNonce: string,
): Promise<{ success: boolean; address: string | null }> {
  try {
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({ signature, nonce: expectedNonce });
    return { success: result.success, address: result.success ? siweMessage.address : null };
  } catch {
    return { success: false, address: null };
  }
}
