import { randomInt } from "node:crypto";

const DICE_RE = /^\/\s*(\d+)\s*[dD]\s*(\d+)\s*(?:([+-])\s*(\d+))?$/;

// Quantos resultados individuais mostramos na mensagem.
const MAX_LISTED = 100;
// Acima disso nao vale a pena rolar dado a dado: usamos uma aproximacao exata
// por soma (media * quantidade) so para casos absurdos.
const MAX_ROLLED = 200000;

function rollOnce(faces) {
  // faces pode ser BigInt (numeros gigantes)
  if (typeof faces === "bigint") {
    // gera um BigInt uniforme em [1, faces]
    const bits = faces.toString(2).length;
    const bytes = Math.ceil(bits / 8);
    while (true) {
      const buf = new Uint8Array(bytes);
      for (let i = 0; i < bytes; i++) buf[i] = randomInt(0, 256);
      let value = 0n;
      for (const b of buf) value = (value << 8n) | BigInt(b);
      value %= faces;
      return value + 1n;
    }
  }
  return randomInt(1, faces + 1);
}

export function parseCommand(text) {
  const match = DICE_RE.exec(String(text ?? "").trim());
  if (!match) return null;
  const [, qtyRaw, facesRaw, sign, modRaw] = match;

  const qty = BigInt(qtyRaw);
  const faces = BigInt(facesRaw);
  const modifier = modRaw ? (sign === "-" ? -BigInt(modRaw) : BigInt(modRaw)) : 0n;

  if (qty === 0n || faces === 0n) return null;
  return { qty, faces, modifier };
}

export function roll(text) {
  const parsed = parseCommand(text);
  if (!parsed) return null;
  const { qty, faces, modifier } = parsed;

  const bigFaces = faces > BigInt(Number.MAX_SAFE_INTEGER) ? faces : Number(faces);
  const rolls = [];
  let total = 0n;
  let truncated = false;

  if (qty > BigInt(MAX_ROLLED)) {
    // Quantidade enorme: soma estatistica exata via media, sem travar o processo.
    truncated = true;
    const avgTimes2 = faces + 1n; // media = (faces + 1) / 2
    total = (qty * avgTimes2) / 2n;
  } else {
    const n = Number(qty);
    for (let i = 0; i < n; i++) {
      const value = rollOnce(bigFaces);
      const asBig = typeof value === "bigint" ? value : BigInt(value);
      total += asBig;
      if (rolls.length < MAX_LISTED) rolls.push(asBig);
    }
    truncated = n > MAX_LISTED;
  }

  return {
    qty,
    faces,
    modifier,
    rolls,
    total,
    grandTotal: total + modifier,
    truncated,
    approximated: qty > BigInt(MAX_ROLLED),
  };
}

export function formatResult(_command, result) {
  // Resposta curta: apenas o resultado final (ja com o modificador aplicado).
  return `${result.grandTotal}`;
}
