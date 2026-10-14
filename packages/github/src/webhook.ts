import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhook(secret: string, raw: string, signatureHeader: string): boolean {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const sig = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
}
