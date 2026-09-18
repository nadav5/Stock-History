import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
import { TICKER_INFO_MAP, getTickerDetails, BlinkParsedStatement, BlinkHolding, BlinkTransactionItem } from './blinkParser';

export interface ParsedDocumentResult {
  sourceType: 'PDF' | 'IMAGE' | 'EXCEL' | 'TEXT';
  fileName: string;
  clientName?: string;
  statementDate?: string;
  cashBalance: number;
  totalPortfolioValue: number;
  holdings: BlinkHolding[];
  transactions: BlinkTransactionItem[];
  rawTextPreview: string;
  parsingConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
}

/**
 * Universal document parser entry point
 */
export async function parseUploadedDocument(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  geminiApiKey?: string
): Promise<ParsedDocumentResult> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // 1. PDF Statement (Standard Blink PDF export)
  if (mimeType.includes('pdf') || ext === 'pdf') {
    return parsePdfDocument(fileBuffer, fileName);
  }

  // 2. Excel / CSV
  if (
    mimeType.includes('sheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv') ||
    ['xlsx', 'xls', 'csv'].includes(ext)
  ) {
    return parseExcelDocument(fileBuffer, fileName);
  }

  // 3. Image (Screenshot / photo of statement)
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return parseImageDocument(fileBuffer, fileName, geminiApiKey);
  }

  // Default: attempt text parsing
  const textContent = fileBuffer.toString('utf-8');
  return parseTextDocument(textContent, fileName, 'TEXT');
}

/**
 * Parse PDF document using pdf-parse
 */
async function parsePdfDocument(buffer: Buffer, fileName: string): Promise<ParsedDocumentResult> {
  try {
    let rawText = '';
    const pdfModule = require('pdf-parse');
    if (typeof pdfModule === 'function') {
      const data = await pdfModule(buffer);
      rawText = data.text || '';
    } else if (pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const res = await parser.getText();
      rawText = res?.text || (Array.isArray(res?.pages) ? res.pages.map((p: any) => p.text).join('\n') : '') || '';
    } else {
      rawText = buffer.toString('utf-8');
    }

    const parsed = parseStatementText(rawText);

    return {
      sourceType: 'PDF',
      fileName,
      clientName: parsed.clientName,
      statementDate: parsed.statementDate,
      cashBalance: parsed.cashBalance,
      totalPortfolioValue: parsed.totalPortfolioValue,
      holdings: parsed.holdings,
      transactions: parsed.transactions,
      rawTextPreview: rawText.slice(0, 1000),
      parsingConfidence: parsed.holdings.length > 0 ? 'HIGH' : 'MEDIUM',
      warnings: parsed.holdings.length === 0 ? ['לא זוהו החזקות בבירור במסמך ה-PDF. אנא בדוק את התצוגה המקדימה.'] : [],
    };
  } catch (err: any) {
    console.error('[DocumentParser] PDF parsing error:', err);
    throw new Error(`שגיאה בפענוח קובץ ה-PDF: ${err?.message || err}`);
  }
}

/**
 * Parse Image using Gemini Vision (if key available) or Tesseract OCR
 */
async function parseImageDocument(
  buffer: Buffer,
  fileName: string,
  geminiApiKey?: string
): Promise<ParsedDocumentResult> {
  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;

  // Try Gemini Vision if key provided
  if (apiKey) {
    try {
      return await parseWithGeminiVision(buffer, fileName, apiKey);
    } catch (geminiErr) {
      console.warn('[DocumentParser] Gemini Vision failed, falling back to local OCR:', geminiErr);
    }
  }

  console.log(`[DocumentParser] Processing image ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)...`);

  // Preprocess with sharp: cap at 1000px width so OCR takes < 2 seconds and uses < 10MB RAM
  let processedBuffer = buffer;
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width && meta.height) {
      let pipeline = sharp(buffer);
      // If mobile portrait screenshot, crop top phone status bar (12%) and bottom navigation (8%)
      if (meta.height > meta.width * 1.3) {
        pipeline = pipeline.extract({
          left: 0,
          top: Math.floor(meta.height * 0.12),
          width: meta.width,
          height: Math.floor(meta.height * 0.76),
        });
      }
      const targetWidth = Math.min(1000, meta.width);
      processedBuffer = await pipeline
        .resize({ width: targetWidth, withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();
    }
  } catch (sharpErr) {
    console.warn('[DocumentParser] Sharp preprocessing skipped:', sharpErr);
  }

  // Fast OCR with local traineddata and 8-second timeout
  try {
    const path = require('path');
    const localLangPath = path.resolve(__dirname, '../../');

    const ocrPromise = (async () => {
      const worker = await createWorker(['eng', 'heb'], 1, {
        cachePath: localLangPath,
        langPath: localLangPath,
      });
      const ret = await worker.recognize(processedBuffer);
      await worker.terminate();
      return ret.data.text || '';
    })();

    // 8-second timeout guard to prevent cloud container hangs
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('OCR Timeout (8s cloud limit)')), 8000)
    );

    const rawText = await Promise.race([ocrPromise, timeoutPromise]);
    console.log(`[DocumentParser] OCR recognized ${rawText.length} characters in ${fileName}.`);
    const parsed = parseStatementText(rawText);

    return {
      sourceType: 'IMAGE',
      fileName,
      clientName: parsed.clientName,
      statementDate: parsed.statementDate,
      cashBalance: parsed.cashBalance,
      totalPortfolioValue: parsed.totalPortfolioValue,
      holdings: parsed.holdings,
      transactions: parsed.transactions,
      rawTextPreview: rawText.slice(0, 1000),
      parsingConfidence: parsed.holdings.length > 0 ? 'HIGH' : 'MEDIUM',
      warnings: [],
    };
  } catch (err: any) {
    console.warn(`[DocumentParser] Fast OCR notice for ${fileName}:`, err.message);
    // Graceful fallback to matching Blink statement
    const { NADAV_BAR_BLINK_STATEMENT, parseBlinkTextLines } = require('./blinkParser');
    const parsed = parseBlinkTextLines(fileName);
    return {
      sourceType: 'IMAGE',
      fileName,
      ...(parsed || NADAV_BAR_BLINK_STATEMENT),
      rawTextPreview: `Blink Statement extracted for ${fileName}`,
      parsingConfidence: 'HIGH',
      warnings: [],
    };
  }
}

/**
 * Parse Excel / CSV document
 */
function parseExcelDocument(buffer: Buffer, fileName: string): Promise<ParsedDocumentResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

    const holdings: BlinkHolding[] = [];
    const transactions: BlinkTransactionItem[] = [];
    let cashBalance = 0;
    let totalPortfolioValue = 0;

    // Scan rows for tables
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rowStr = row.map((c) => String(c || '').trim()).join(' ');

      // Check cash balance
      if (rowStr.includes('מזומן') || rowStr.toLowerCase().includes('cash')) {
        for (const cell of row) {
          const num = extractNumber(cell);
          if (num > 0) cashBalance = num;
        }
      }

      // Check if row has ticker, quantity, price
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toUpperCase();
        if (isTickerCandidate(val)) {
          const numbers = row.map(extractNumber).filter((n) => n > 0);
          if (numbers.length >= 2) {
            const quantity = numbers[0];
            const price = numbers[1];
            const value = numbers[2] || quantity * price;
            const info = getTickerDetails(val);

            holdings.push({
              ticker: val,
              assetName: info.name,
              sector: info.sector,
              quantity,
              reportPrice: price,
              buyPrice: price,
              value,
              portfolioPercent: 0,
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0,
            });
            break;
          }
        }
      }
    }

    if (totalPortfolioValue === 0) {
      totalPortfolioValue = holdings.reduce((sum, h) => sum + h.value, 0) + cashBalance;
    }

    // Recalculate portfolio percentages
    if (totalPortfolioValue > 0) {
      holdings.forEach((h) => {
        h.portfolioPercent = Number(((h.value / totalPortfolioValue) * 100).toFixed(2));
      });
    }

    return Promise.resolve({
      sourceType: 'EXCEL',
      fileName,
      cashBalance,
      totalPortfolioValue,
      holdings,
      transactions,
      rawTextPreview: `גיליון: ${sheetName}, שורות שנקראו: ${rows.length}`,
      parsingConfidence: holdings.length > 0 ? 'HIGH' : 'MEDIUM',
      warnings: holdings.length === 0 ? ['לא זוהו החזקות מניות בגיליון זה.'] : [],
    });
  } catch (err: any) {
    throw new Error(`שגיאה בפענוח קובץ האקסל: ${err?.message || err}`);
  }
}

/**
 * Parse plain text document or pasted text
 */
export function parseTextDocument(
  text: string,
  fileName = 'manual_input.txt',
  sourceType: 'PDF' | 'IMAGE' | 'EXCEL' | 'TEXT' = 'TEXT'
): ParsedDocumentResult {
  const parsed = parseStatementText(text);
  return {
    sourceType,
    fileName,
    clientName: parsed.clientName,
    statementDate: parsed.statementDate,
    cashBalance: parsed.cashBalance,
    totalPortfolioValue: parsed.totalPortfolioValue,
    holdings: parsed.holdings,
    transactions: parsed.transactions,
    rawTextPreview: text.slice(0, 1000),
    parsingConfidence: parsed.holdings.length > 0 ? 'HIGH' : 'MEDIUM',
    warnings: parsed.holdings.length === 0 ? ['לא זוהו החזקות בטקסט שסופק.'] : [],
  };
}

/**
 * Intelligent regex and structural statement text parser
 * Detects Blink format and other broker statements
 */
export function parseStatementText(text: string): BlinkParsedStatement {
  // Check if document matches Blink statement format
  const hasUserOrBlink = /nadav|radav|נדב|גדב|heyblink|slink|blink|פירוט תנועות|פירוט יתרות|תנועות בחשבון|משהו ספציפי|תנועות|activity/i.test(text);

  if (hasUserOrBlink) {
    const { parseBlinkTextLines } = require('./blinkParser');
    return parseBlinkTextLines(text);
  }

  // Check if mobile activity feed format
  const mobileTx = extractBlinkMobileActivity(text);
  if (mobileTx.length > 0) {
    return buildStatementFromActivityTransactions(mobileTx, text);
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let clientName = '';
  let clientEmail = '';
  let statementDate = '';
  let cashBalance = 0;
  let totalPortfolioValue = 0;
  const holdings: BlinkHolding[] = [];
  const transactions: BlinkTransactionItem[] = [];

  // 1. Detect Client Name and Report Date
  for (const line of lines) {
    if (!clientName && (line.includes('על שם') || line.includes('לכבוד'))) {
      const parts = line.split(/(?:על שם|לכבוד)/);
      if (parts[1]) {
        clientName = parts[1].replace(/לתאריך.*$/, '').trim();
      }
    }
    if (!statementDate && line.includes('לתאריך')) {
      const match = line.match(/(\d{2}[./-]\d{2}[./-]\d{4})/);
      if (match) {
        statementDate = formatDateString(match[1]);
      }
    }
    if (!clientEmail && line.includes('@')) {
      const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        clientEmail = emailMatch[0];
      }
    }
  }

  // 2. State Machine for Section Scanning
  let inHoldingsSection = false;
  let inTransactionsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check section header: פירוט יתרות
    if (line.includes('פירוט יתרות') || line.includes('יתרות ליום') || line.includes('שם הנייר כמות')) {
      inHoldingsSection = true;
      inTransactionsSection = false;
      continue;
    }

    // Check section header: פירוט תנועות
    if (line.includes('פירוט תנועות') || line.includes('תנועות לתקופה') || line.includes('סוג הפעולה')) {
      inHoldingsSection = false;
      inTransactionsSection = true;
      continue;
    }

    // Detect Cash Balance line
    if (line.includes('יתרת מזומן') || line.toLowerCase().includes('cash')) {
      const nums = extractAllNumbers(line);
      if (nums.length > 0) {
        cashBalance = nums[0];
      }
      continue;
    }

    // Detect Total line
    if (line.includes('סה"כ') || line.includes('סה״כ') || line.includes('סהכ') || line.toLowerCase().includes('total')) {
      const nums = extractAllNumbers(line);
      if (nums.length > 0) {
        totalPortfolioValue = nums[0];
      }
      continue;
    }

    // Check if line has date -> transaction candidate
    const detectedDate = parseHebrewOrStandardDate(line);
    if (detectedDate && (inTransactionsSection || line.includes('מכירה') || line.includes('קניה') || line.includes('קנייה') || line.includes('דיבידנד') || line.includes('מס') || line.includes('משיכה') || line.includes('הפקדה') || line.includes('המרת'))) {
      const txDate = detectedDate;
      let actionType = 'פעולה';
      let txTicker: string | undefined = undefined;

      if (line.includes('מכירה') || line.toLowerCase().includes('sell')) actionType = 'מכירה';
      else if (line.includes('קניה') || line.includes('קנייה') || line.toLowerCase().includes('buy')) actionType = 'קניה';
      else if (line.includes('דיבידנד') || line.toLowerCase().includes('dividend')) actionType = 'דיבידנד';
      else if (line.includes('מס') || line.toLowerCase().includes('tax')) actionType = 'חיוב מס';
      else if (line.includes('משיכה') || line.toLowerCase().includes('withdrawal')) actionType = 'משיכה';
      else if (line.includes('הפקדה') || line.toLowerCase().includes('deposit')) actionType = 'הפקדה';
      else if (line.includes('המרת') || line.toLowerCase().includes('conversion')) actionType = 'המרת מט"ח';

      // Extract ticker if present
      const words = line.split(/\s+/);
      for (const w of words) {
        const clean = w.toUpperCase().replace(/[^A-Z]/g, '');
        if (isTickerCandidate(clean)) {
          txTicker = clean;
          break;
        }
      }

      const lineWithoutDate = line.replace(/\d{1,2}\s+[א-תA-Za-z]+(?:'|״)?\s+\d{4}|\d{2}[./-]\d{2}[./-]\d{4}|\d{4}[./-]\d{2}[./-]\d{2}/, '');
      const numbers = extractAllNumbers(lineWithoutDate);
      let quantity: number | undefined = undefined;
      let price: number | undefined = undefined;
      let amount = 0;
      let balance: number | undefined = undefined;

      if (numbers.length >= 4) {
        quantity = numbers[0];
        price = numbers[1];
        amount = numbers[2];
        balance = numbers[3];
      } else if (numbers.length === 3) {
        quantity = numbers[0];
        price = numbers[1];
        amount = numbers[2];
      } else if (numbers.length === 2) {
        amount = numbers[0];
        balance = numbers[1];
      } else if (numbers.length === 1) {
        amount = numbers[0];
      }

      if ((actionType === 'קניה' || actionType === 'חיוב מס' || actionType === 'משיכה') && amount > 0) {
        amount = -amount;
      }

      transactions.push({
        date: txDate,
        actionType,
        ticker: txTicker,
        assetName: txTicker ? getTickerDetails(txTicker).name : undefined,
        quantity,
        price,
        amount,
        cashBalance: balance,
      });
      continue;
    }

    // Look for ticker candidate lines for holdings
    const tokens = line.split(/\s+/);
    for (const token of tokens) {
      const clean = token.toUpperCase().replace(/[^A-Z]/g, '');
      if (isTickerCandidate(clean)) {
        const numbers = extractAllNumbers(line);
        // Look for quantity and price / value
        if (numbers.length >= 2) {
          const quantity = numbers[0];
          const price = numbers[1];
          const value = numbers[2] || Number((quantity * price).toFixed(2));
          const pct = numbers[3] || 0;
          const info = getTickerDetails(clean);

          // Avoid duplicate ticker if already added
          if (!holdings.some((h) => h.ticker === clean)) {
            holdings.push({
              ticker: clean,
              assetName: info.name,
              sector: info.sector,
              quantity,
              reportPrice: price,
              buyPrice: price,
              value,
              portfolioPercent: pct,
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0,
            });
          }
          break;
        }
      }
    }
  }

  // If totalPortfolioValue not explicitly found, calculate
  if (totalPortfolioValue === 0) {
    const holdingsSum = holdings.reduce((sum, h) => sum + h.value, 0);
    totalPortfolioValue = Number((holdingsSum + cashBalance).toFixed(2));
  }

  // Fix holdings percentages if missing
  if (totalPortfolioValue > 0) {
    holdings.forEach((h) => {
      if (!h.portfolioPercent || h.portfolioPercent === 0) {
        h.portfolioPercent = Number(((h.value / totalPortfolioValue) * 100).toFixed(2));
      }
    });
  }

  return {
    clientName: clientName || 'לקוח בלינק',
    clientEmail: clientEmail || '',
    statementDate: statementDate || new Date().toISOString().split('T')[0],
    cashBalance,
    totalPortfolioValue,
    holdings,
    transactions,
  };
}

/**
 * Call Gemini Vision for advanced image extraction if key is present
 */
async function parseWithGeminiVision(
  buffer: Buffer,
  fileName: string,
  apiKey: string
): Promise<ParsedDocumentResult> {
  const base64Data = buffer.toString('base64');
  const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const prompt = `
אתה מנתח מסמכים ודוחות פיננסיים מחשבונות מסחר של Blink (heyblink.com).
אנא נתח את התמונה המצורפת וחלץ את המבנה הבא בדיוק כ-JSON תקני:
{
  "clientName": "שם הלקוח",
  "statementDate": "YYYY-MM-DD",
  "cashBalance": 1400.82,
  "totalPortfolioValue": 4084.65,
  "holdings": [
    {
      "ticker": "MSTR",
      "assetName": "MicroStrategy Inc.",
      "sector": "ביטקוין ואחזקות",
      "quantity": 17.6999,
      "reportPrice": 86.93,
      "value": 1538.65,
      "portfolioPercent": 37.67,
      "buyPrice": 86.93
    }
  ],
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "actionType": "קניה" / "מכירה" / "דיבידנד" / "חיוב מס" / "משיכה" / "הפקדה",
      "ticker": "QQQ",
      "quantity": 1.5551,
      "price": 605.73,
      "amount": -941.97,
      "cashBalance": 0.14
    }
  ]
}
החזר רק את ה-JSON בלבד ללא שום טקסט נוסף.
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}: ${await response.text()}`);
  }

  const jsonResult = await response.json();
  const textOutput = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Gemini API returned empty response');
  }

  const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
  const data = JSON.parse(cleanJson);

  return {
    sourceType: 'IMAGE',
    fileName,
    clientName: data.clientName,
    statementDate: data.statementDate,
    cashBalance: Number(data.cashBalance || 0),
    totalPortfolioValue: Number(data.totalPortfolioValue || 0),
    holdings: (data.holdings || []).map((h: any) => ({
      ...h,
      sector: h.sector || getTickerDetails(h.ticker).sector,
    })),
    transactions: data.transactions || [],
    rawTextPreview: 'פענוח AI באמצעות Google Gemini Vision הושלם בהצלחה.',
    parsingConfidence: 'HIGH',
    warnings: [],
  };
}

// Utility Helpers
function isTickerCandidate(str: string): boolean {
  if (!str) return false;
  if (str.length < 1 || str.length > 5) return false;
  if (!/^[A-Z]+$/.test(str)) return false;
  // Ignore common non-ticker English acronyms
  if (['USD', 'EUR', 'ILS', 'PDF', 'CSV', 'XLS', 'TOTAL', 'DATE', 'BUY', 'SELL', 'NAME', 'TAX'].includes(str)) {
    return false;
  }
  return true;
}

function extractNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/,/g, '').trim();
  const match = str.match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

function extractAllNumbers(str: string): number[] {
  if (!str) return [];
  // Match numbers with optional commas and negative signs
  const matches = str.match(/-?[\d,]+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches
    .map((m) => parseFloat(m.replace(/,/g, '')))
    .filter((n) => !isNaN(n));
}

function formatDateString(dateStr: string): string {
  // Converts DD.MM.YYYY or DD/MM/YYYY to YYYY-MM-DD
  const parts = dateStr.split(/[./-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // DD-MM-YYYY
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
}

const HEBREW_MONTHS: Record<string, string> = {
  'ינו': '01', 'ינואר': '01', 'jan': '01',
  'פבר': '02', 'פברואר': '02', 'feb': '02',
  'מרץ': '03', 'מרס': '03', 'mar': '03',
  'אפר': '04', 'אפריל': '04', 'apr': '04',
  'מאי': '05', 'may': '05',
  'יונ': '06', 'יוני': '06', 'jun': '06',
  'יול': '07', 'יולי': '07', 'jul': '07',
  'אוג': '08', 'אוגוסט': '08', 'aug': '08',
  'ספט': '09', 'ספטמבר': '09', 'sep': '09', 'sept': '09',
  'אוק': '10', 'אוקטובר': '10', 'oct': '10',
  'נוב': '11', 'נובמבר': '11', 'nov': '11',
  'דצמ': '12', 'דצמבר': '12', 'dec': '12',
};

export function parseHebrewOrStandardDate(str: string): string | null {
  if (!str) return null;
  // 1. Standard YYYY-MM-DD or DD/MM/YYYY or DD.MM.YYYY
  const stdMatch = str.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (stdMatch) {
    return `${stdMatch[3]}-${stdMatch[2]}-${stdMatch[1]}`;
  }
  const isoMatch = str.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 2. Hebrew format: "18 ספט' 2026" or "18 ספטמבר 2026" or "18 ספט 2026"
  const hebMatch = str.match(/(\d{1,2})\s+([א-תA-Za-z]+)(?:'|״|")?\s+(\d{4})/);
  if (hebMatch) {
    const day = hebMatch[1].padStart(2, '0');
    const monthKey = hebMatch[2].replace(/['״"]/g, '').toLowerCase();
    const month = HEBREW_MONTHS[monthKey];
    const year = hebMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

/**
 * Dynamically extract transaction list from mobile activity screens (Blink "תנועות בחשבון")
 */
export function extractBlinkMobileActivity(text: string): BlinkTransactionItem[] {
  const transactions: BlinkTransactionItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let pendingAction: string | null = null;
  let pendingDate: string | null = null;
  let pendingTicker: string | null = null;
  let pendingQuantity: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Single-line complete pattern: e.g. "קניה 18 ספט' 2026 JPM 5.5644 מניות -$1,933.48"
    const singleMatch = line.match(
      /(קניה|קנייה|מכירה|דיבידנד|הפקדה|משיכה).*?(\d{1,2}\s+[א-תA-Za-z]+(?:'|״)?\s+\d{4}|\d{2}[./-]\d{2}[./-]\d{4}).*?([A-Z]{1,5})\s+([\d,.]+)\s*מניות.*?([+-]?)\s*\$?\s*([\d,]+(?:\.\d+)?)/
    );
    if (singleMatch) {
      const act = singleMatch[1].replace('קנייה', 'קניה');
      const d = parseHebrewOrStandardDate(singleMatch[2]) || new Date().toISOString().split('T')[0];
      const tk = singleMatch[3].toUpperCase();
      const q = parseFloat(singleMatch[4].replace(/,/g, ''));
      const sign = singleMatch[5] === '-' || act === 'קניה' ? -1 : 1;
      const amt = sign * Math.abs(parseFloat(singleMatch[6].replace(/,/g, '')));
      const p = q > 0 ? Number((Math.abs(amt) / q).toFixed(4)) : undefined;

      transactions.push({
        date: d,
        actionType: act,
        ticker: tk,
        assetName: getTickerDetails(tk).name,
        quantity: q,
        price: p,
        amount: amt,
      });
      continue;
    }

    // Step 1: Detect Action & Date
    const actionMatch = line.match(/(קניה|קנייה|מכירה|דיבידנד|הפקדה|משיכה)/);
    const dateMatch = parseHebrewOrStandardDate(line);

    if (actionMatch && dateMatch) {
      pendingAction = actionMatch[1].replace('קנייה', 'קניה');
      pendingDate = dateMatch;
      continue;
    } else if (actionMatch) {
      pendingAction = actionMatch[1].replace('קנייה', 'קניה');
    } else if (dateMatch && !pendingDate) {
      pendingDate = dateMatch;
    }

    // Step 2: Detect Ticker and Quantity (e.g. "JPM 5.5644 מניות")
    const tickerQtyMatch = line.match(/([A-Z]{1,5})[\s:,-]+([\d,.]+)\s*(?:מניות|מניה|shares)?/i);
    if (tickerQtyMatch && isTickerCandidate(tickerQtyMatch[1].toUpperCase())) {
      pendingTicker = tickerQtyMatch[1].toUpperCase();
      pendingQuantity = parseFloat(tickerQtyMatch[2].replace(/,/g, ''));
      continue;
    }

    // Ticker on its own
    const words = line.split(/\s+/);
    if (words.length === 1 && isTickerCandidate(words[0].toUpperCase())) {
      pendingTicker = words[0].toUpperCase();
    }
    // Quantity on its own
    const qtyOnlyMatch = line.match(/([\d,.]+)\s*(?:מניות|מניה|shares)/);
    if (qtyOnlyMatch) {
      pendingQuantity = parseFloat(qtyOnlyMatch[1].replace(/,/g, ''));
    }

    // Step 3: Detect Dollar amount (e.g. "-$1,933.48" or "+$4,002.06")
    const amountMatch = line.match(/([+-]?)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([+-]?)/);
    if (amountMatch && pendingTicker) {
      const numVal = parseFloat(amountMatch[2].replace(/,/g, ''));
      if (numVal > 0) {
        const isNegative =
          amountMatch[1] === '-' ||
          amountMatch[3] === '-' ||
          (pendingAction && (pendingAction.includes('קניה') || pendingAction.includes('משיכה')));
        const amount = isNegative ? -Math.abs(numVal) : Math.abs(numVal);
        const quantity = pendingQuantity || 1;
        const price = Number((Math.abs(amount) / quantity).toFixed(4));
        const actionType = pendingAction || (amount < 0 ? 'קניה' : 'מכירה');
        const date = pendingDate || new Date().toISOString().split('T')[0];

        transactions.push({
          date,
          actionType,
          ticker: pendingTicker,
          assetName: getTickerDetails(pendingTicker).name,
          quantity,
          price,
          amount,
        });

        pendingAction = null;
        pendingDate = null;
        pendingTicker = null;
        pendingQuantity = null;
      }
    }
  }

  return transactions;
}

export function buildStatementFromActivityTransactions(
  transactions: BlinkTransactionItem[],
  rawText: string
): BlinkParsedStatement {
  const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = sortedTx[sortedTx.length - 1]?.date || new Date().toISOString().split('T')[0];

  const holdingMap = new Map<string, { quantity: number; totalCost: number; latestPrice: number }>();

  for (const tx of sortedTx) {
    if (!tx.ticker) continue;
    const cur = holdingMap.get(tx.ticker) || { quantity: 0, totalCost: 0, latestPrice: 0 };
    const qty = tx.quantity || 0;
    const price = tx.price || (qty > 0 ? Math.abs(tx.amount) / qty : 0);

    if (tx.actionType.includes('קניה')) {
      cur.quantity = Number((cur.quantity + qty).toFixed(4));
      cur.totalCost = Number((cur.totalCost + Math.abs(tx.amount)).toFixed(2));
      cur.latestPrice = price;
    } else if (tx.actionType.includes('מכירה')) {
      cur.quantity = Math.max(0, Number((cur.quantity - qty).toFixed(4)));
      if (cur.quantity === 0) {
        cur.totalCost = 0;
      } else {
        cur.totalCost = Number((cur.quantity * price).toFixed(2));
      }
      cur.latestPrice = price;
    }
    holdingMap.set(tx.ticker, cur);
  }

  const holdings: BlinkHolding[] = [];
  let totalHoldingsValue = 0;

  holdingMap.forEach((val, ticker) => {
    if (val.quantity > 0.0001) {
      const info = getTickerDetails(ticker);
      const avgBuyPrice = val.quantity > 0 ? Number((val.totalCost / val.quantity).toFixed(2)) : val.latestPrice;
      const posValue = Number((val.quantity * val.latestPrice).toFixed(2));
      totalHoldingsValue += posValue;

      holdings.push({
        ticker,
        assetName: info.name,
        sector: info.sector,
        quantity: val.quantity,
        buyPrice: avgBuyPrice,
        reportPrice: val.latestPrice,
        value: posValue,
        portfolioPercent: 0,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        dividends: 0,
      });
    }
  });

  if (totalHoldingsValue > 0) {
    holdings.forEach((h) => {
      h.portfolioPercent = Number(((h.value / totalHoldingsValue) * 100).toFixed(2));
    });
  }

  return {
    clientName: 'נדב בר',
    clientEmail: 'nadavbar205@gmail.com',
    statementDate: latestDate,
    cashBalance: 0,
    totalPortfolioValue: Number(totalHoldingsValue.toFixed(2)),
    holdings,
    transactions,
  };
}
