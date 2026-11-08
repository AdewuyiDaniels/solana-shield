const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map<string, number>();
for (let i = 0; i < ALPHABET.length; i += 1) INDEX.set(ALPHABET[i], i);

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;

  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}

export function decodeBase58(value: string): Uint8Array | null {
  let zeros = 0;
  while (zeros < value.length && value[zeros] === "1") zeros += 1;

  const littleEndian: number[] = [];
  for (let i = zeros; i < value.length; i += 1) {
    const digit = INDEX.get(value[i]);
    if (digit === undefined) return null;
    let carry = digit;
    for (let j = 0; j < littleEndian.length; j += 1) {
      carry += littleEndian[j] * 58;
      littleEndian[j] = carry & 0xff;
      carry = Math.floor(carry / 256);
    }
    while (carry > 0) {
      littleEndian.push(carry & 0xff);
      carry = Math.floor(carry / 256);
    }
  }

  const out = new Uint8Array(zeros + littleEndian.length);
  for (let i = 0; i < littleEndian.length; i += 1) {
    out[out.length - 1 - i] = littleEndian[i];
  }
  return out;
}
