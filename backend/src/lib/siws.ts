import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "node:crypto";

export function generateSolanaNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildSiwsMessage(address: string, nonce: string, domain: string): string {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    "",
    "Sign in to Milestone to link this wallet.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
}

export function verifySiws(message: string, signatureB58: string, address: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signatureB58);
    const publicKeyBytes = bs58.decode(address);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}
