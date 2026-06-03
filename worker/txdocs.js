// 腾讯文档抓取器 — 自动获取文档内容并存入PostgreSQL
const DOCS = [
  { id: "DU0FHbUFkbHNUbndZ", type: "morning", title: "金融早间简报" },
  { id: "DU0h3ck9qdXZpR25D", type: "evening", title: "金融晚间简报" },
];

async function fetchDoc(id) {
  const url = `https://docs.qq.com/dop-api/opendoc?u=&id=${id}&normal=1&outformat=1&noEscape=1&commandsFormat=1&doc_chunk_version=3&preview_token=&doc_chunk_flag=1`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Referer": `https://docs.qq.com/doc/${id}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();

  const start = text.indexOf("{");
  const data = JSON.parse(text.slice(start));
  const ccv = data?.clientVars?.collab_client_vars;
  if (!ccv?.initialAttributedText?.text?.[0]) throw new Error("No text content");
  return ccv.initialAttributedText.text[0];
}

function decodeDocText(encoded) {
  // Decode base64 → Uint8Array
  const binaryStr = atob(encoded);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  // Extract readable text from protobuf-encoded data
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let text = "";
  const seq = [];

  const flush = () => {
    if (seq.length < 3) { seq.length = 0; return; }
    try {
      const chunk = decoder.decode(new Uint8Array(seq), { stream: true });
      if (/[一-鿿]/.test(chunk) || chunk.length > 5) text += chunk;
    } catch (_) {}
    seq.length = 0;
  };

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x0a || b === 0x0d || (b >= 0x20 && b < 0x7f)) {
      seq.push(b);
    } else if (b >= 0xc0 && b <= 0xfd) {
      seq.push(b);
    } else if (b >= 0x80 && b < 0xc0) {
      if (seq.length > 0) seq.push(b);
    } else {
      flush();
    }
  }
  flush();

  // Clean up
  text = text.replace(/HYPERLINK\s+"[^"]*"/g, "");
  text = text.replace(/https?:\/\/\S+/g, "");
  // Remove Office/font metadata garbage
  text = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  text = text.replace(/(?:Calibri|MS |ＭＳ|맑은 고딕|微软雅黑|新細明體|Times New Roman|Angsana|Nyala|Vrinda|Shruti|MoolBoran|Tunga|Raavi|Euphemia|Plantagenet|Microsoft Yi|Microsoft Himalaya|Wingdings|Office)[^\n]*/g, "");
  text = text.replace(/[A-F0-9]{6,}(?![a-z])[A-F0-9]*/g, ""); // Hex color codes
  text = text.replace(/@[A-Za-z0-9]+/g, ""); // @font references
  text = text.replace(/\*[A-Za-z0-9]+\*/g, ""); // *Wingdings* etc
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/ {2,}/g, " ");
  text = text.replace(/^\s*[\d.]+$/gm, ""); // Lines that are just numbers
  return text.trim();
}

// Deno-compatible atob
function atob(s) {
  try {
    // Use Deno's native base64 decode
    const decoded = Deno.core?.ops?.op_base64_decode?.(s);
    if (decoded) return typeof decoded === "string" ? decoded : new TextDecoder().decode(new Uint8Array(decoded));
  } catch (_) {}
  // Fallback: pure JS base64
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  s = s.replace(/=+$/, "");
  let result = "";
  for (let i = 0; i < s.length; i += 4) {
    const a = chars.indexOf(s[i]||"A"), b = chars.indexOf(s[i+1]||"A"), c = chars.indexOf(s[i+2]||"A"), d = chars.indexOf(s[i+3]||"A");
    result += String.fromCharCode((a << 2) | (b >> 4));
    if (c >= 0) result += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d >= 0) result += String.fromCharCode(((c & 3) << 6) | d);
  }
  return result;
}

export async function fetchAllDocs() {
  const results = [];
  for (const doc of DOCS) {
    try {
      const encoded = await fetchDoc(doc.id);
      const text = decodeDocText(encoded);
      results.push({ ...doc, text });
      console.log(`[txdocs] Fetched ${doc.type}: ${text.length} chars`);
    } catch (e) {
      console.log(`[txdocs] Failed ${doc.type}: ${e.message}`);
    }
  }
  return results;
}

// CLI: deno run --allow-net worker/txdocs.js
if (import.meta.main) {
  const docs = await fetchAllDocs();
  for (const d of docs) {
    console.log(`\n=== ${d.title} (${d.text.length} chars) ===`);
    console.log(d.text.slice(0, 500));
  }
}
