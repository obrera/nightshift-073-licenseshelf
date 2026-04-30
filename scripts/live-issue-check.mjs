import { createKeyPairSignerFromBytes, signBytes } from '@solana/kit';
import { readFileSync } from 'node:fs';

const base = 'https://licenseshelf073.colmena.dev';
const wallet = 'obrE1BHvP4EX8PkxPxAJxYfQkgfgCmXyJadQA3yBb7G';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58(bytes) {
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = (value / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) {
    zeros += 1;
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    out += alphabet[digits[i]];
  }
  return out;
}

const keyBytes = Uint8Array.from(
  JSON.parse(
    readFileSync(
      '/home/obrera/keys/obrE1BHvP4EX8PkxPxAJxYfQkgfgCmXyJadQA3yBb7G.json',
      'utf8'
    )
  )
);
const signer = await createKeyPairSignerFromBytes(keyBytes, false);
let cookie = '';

async function api(path, init = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(init.headers || {})
    }
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    cookie = setCookie.split(';')[0];
  }
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

const nonce = await api('/api/auth/solana-auth/nonce', {
  method: 'POST',
  body: JSON.stringify({ walletAddress: wallet })
});
const message = [
  `${nonce.domain} wants you to sign in with your Solana account:`,
  wallet,
  '',
  nonce.statement,
  '',
  `URI: ${nonce.uri}`,
  'Version: 1',
  `Chain ID: ${nonce.chainId}`,
  `Nonce: ${nonce.nonce}`,
  `Issued At: ${nonce.issuedAt}`,
  `Expiration Time: ${nonce.expirationTime}`
].join('\n');
const signature = await signBytes(
  signer.keyPair.privateKey,
  new TextEncoder().encode(message)
);
await api('/api/auth/solana-auth/verify', {
  method: 'POST',
  body: JSON.stringify({
    walletAddress: wallet,
    message,
    signature: toBase58(signature)
  })
});
const bootstrap = await api('/api/bootstrap');
const edition = bootstrap.products
  .flatMap((product) =>
    product.editions.map((entry) => ({
      ...entry,
      productId: product.id,
      productName: product.name
    }))
  )
  .find((entry) => !entry.ownedBySessionWallet) ?? bootstrap.products.flatMap((product) => product.editions.map((entry) => ({...entry, productId: product.id, productName: product.name}))).at(0);
if (!edition) {
  throw new Error('No issuable edition found');
}
const issue = await api('/api/licenses/issue', {
  method: 'POST',
  body: JSON.stringify({ productId: edition.productId, editionId: edition.id })
});
console.log(JSON.stringify(issue, null, 2));
