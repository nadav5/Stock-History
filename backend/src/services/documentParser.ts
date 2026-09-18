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

  // Preprocess with sharp for maximum OCR fidelity on screenshots and mobile scans
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
      // Upscale to ensure at least 1600px width for clean text character recognition
      const targetWidth = Math.max(1600, meta.width * 3);
      processedBuffer = await pipeline
        .resize({ width: targetWidth, withoutEnlargement: false })
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();
    }
  } catch (sharpErr) {
    console.warn('[DocumentParser] Sharp preprocessing skipped:', sharpErr);
  }

  // Fallback: Local Tesseract OCR
  try {
    const worker = await createWorker(['eng', 'heb']);
    const ret = await worker.recognize(processedBuffer);
    await worker.terminate();

    const rawText = ret.data.text || '';
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
      warnings:
        parsed.holdings.length === 0
          ? ['התמונה עובדה ב-OCR אך לא כל השדות זוהו באופן מושלם. באפשרותך לערוך או להזין ישירות.']
          : [],
    };
  } catch (err: any) {
    console.error('[DocumentParser] Image OCR error:', err);
    throw new Error(`שגיאה בזיהוי תמונה: ${err?.message || err}`);
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
  const hasUserOrBlink = /nadav|radav|נדב|גדב|heyblink|slink|blink|פירוט תנועות|פירוט יתרות/i.test(text);

  if (hasUserOrBlink) {
    const { parseBlinkTextLines } = require('./blinkParser');
    return parseBlinkTextLines(text);
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
    const dateMatch = line.match(/(\d{2}[./-]\d{2}[./-]\d{4}|\d{4}[./-]\d{2}[./-]\d{2})/);
    if (dateMatch && (inTransactionsSection || line.includes('מכירה') || line.includes('קניה') || line.includes('קנייה') || line.includes('דיבידנד') || line.includes('מס') || line.includes('משיכה') || line.includes('הפקדה') || line.includes('המרת'))) {
      const txDate = formatDateString(dateMatch[1]);
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

      const numbers = extractAllNumbers(line.replace(dateMatch[0], ''));
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
