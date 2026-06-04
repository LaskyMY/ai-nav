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
  const binaryStr = atob(encoded);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const chunks = [];
  let start = -1;

  // Find all valid UTF-8 sequences and decode them as chunks
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Start of a potential text sequence
    if ((b >= 0x20 && b < 0x7f) || (b >= 0xc0 && b <= 0xfd)) {
      if (start < 0) start = i;
    } else if (b >= 0x80 && b < 0xc0) {
      // Continuation byte - OK if we're in a sequence
      if (start < 0) continue;
    } else {
      // End of sequence - decode what we accumulated
      if (start >= 0) {
        const slice = bytes.slice(start, i);
        try {
          const text = decoder.decode(slice);
          // Only keep if it contains meaningful content
          if (isReadableText(text)) chunks.push(text);
        } catch (_) {}
        start = -1;
      }
    }
  }
  // Last chunk
  if (start >= 0) {
    try {
      const text = decoder.decode(bytes.slice(start));
      if (isReadableText(text)) chunks.push(text);
    } catch (_) {}
  }

  let text = chunks.join("\n");

  // Aggressive cleanup
  text = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "");   // Control chars
  // Remove any remaining non-printable / binary-looking characters
  text = text.split("").filter(c => {
    const code = c.charCodeAt(0);
    if (code < 0x20 && code !== 0x0a && code !== 0x0d) return false;
    if (code >= 0x7f && code < 0xa0) return false;
    if (code >= 0xd800 && code <= 0xdfff) return false; // surrogates
    return true;
  }).join("");
  text = text.replace(/HYPERLINK\s+"[^"]*"/gi, "");                    // Word hyperlinks
  text = text.replace(/https?:\/\/\S+/g, "");                           // URLs
  text = text.replace(/@[A-Za-z0-9\x80-\xff]+/g, "");                  // @font refs
  text = text.replace(/[A-Za-z0-9_\s]{20,}(?![一-鿿])/g, "");          // Long ASCII strings without CJK
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/^\s*[\d.-]+\s*$/gm, "");                         // Lines with only numbers
  text = text.replace(/\b\d{6,}\b\s*[^\n]*/g, "");                     // Long digit sequences (binary artifact: 000000...)
  text = text.replace(/\n\s*\d{5,}\s*\n/g, "\n");                       // Standalone long number lines
  text = text.replace(/(.).*?\1{10,}/g, "");                            // Repeated character garbage
  text = text.replace(/[�]/g, "");                                      // Unicode replacement char
  text = text.trim();
  return text;
}

function isReadableText(text) {
  if (text.length < 3) return false;

  // ── REJECT: Office style names, metadata, font references ──
  const officePatterns = [
    // Font families
    /Wingdings/i, /Calibri/i, /DaunPenh/i, /DokChampa/i, /Estrangelo Edessa/i,
    /Iskoola Pota/i, /Mongolian Baiti/i, /Microsoft Uighur/i, /Microsoft Yi Baiti/i,
    /Microsoft Himalaya/i, /MoolBoran/i, /Angsana/i, /Nyala/i, /Vrinda/i, /Shruti/i,
    /Tunga/i, /Raavi/i, /Euphemia/i, /Plantagenet/i, /Cordia/i, /ＭＳ/i, /DengXian/i,
    /Times New Roman/i, /等线/i,
    // Style names (Office built-in styles)
    /^heading\s/i, /^toc\s/i, /Subtitle/i, /Hyperlink/i, /Revision/i, /Table Grid/i,
    /Light (Grid|List|Shading)/i, /Medium (Grid|List|Shading)/i, /Dark List/i,
    /Book Title/i, /List Paragraph/i, /Normal Table/i, /No Spacing/i,
    /Smart Link/i, /FollowedHyperlink/i, /Intense (Quote|Reference)/i,
    /Title Char/i, /Subtitle Char/i, /Heading \d Char/i,
    // Chinese style names
    /标题\s*字符/, /副标题\s*字符/, /正文(文本)?\s*(字符)?/, /要点\s*字符/,
    /引用\s*字符/, /列出段落/, /明显参考/, /不明显参考/,
    /书籍标题/, /不明显强调/, /明显强调/, /列出\s*(字符|段落)/,
    // Technical metadata
    /ISO-8859/i, /melo-codeblock/i, /^080E/i, /Smart Link/i,
    /^[A-F0-9]{6}:?\s*$/m, /^[A-F0-9]{8}\*?\s*$/m,
    /^\d{5,7}[a-zA-Z]?\*?\s*$/m, /^[a-z0-9]+\*\s*$/im,
    /^[*:\s]{3,}$/m, /^[!()*]{3,}$/m,
    /Office\s*主题/i, /Default Paragraph Font/i,
  ];

  // If the ENTIRE text matches any office pattern, reject it
  for (const pat of officePatterns) {
    // Check if the chunk is primarily metadata (over 70% match)
    const lines = text.split(/\n/);
    let metaLines = 0;
    for (const line of lines) {
      if (pat.test(line.trim())) metaLines++;
      else if (/^[\s*:]{2,}$/.test(line.trim())) metaLines++;
    }
    if (metaLines > 0 && metaLines >= lines.length * 0.6) return false;
  }

  // Single-line metadata check
  const t = text.trim();
  if (t.length < 30) {
    for (const pat of officePatterns) {
      if (pat.test(t)) return false;
    }
  }

  // Has CJK characters = definitely readable
  if (/[一-鿿]/.test(text)) return true;
  // Has meaningful ASCII words in sentence form
  if (/[A-Za-z]{4,}\s+[A-Za-z]{3,}/.test(text) && text.length > 15) return true;
  // Has numbers with context (percentages, prices, dates)
  if (/[\d.]+\s*[%万亿年月日\$¥€]/.test(text) && text.length > 10) return true;
  return false;
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
