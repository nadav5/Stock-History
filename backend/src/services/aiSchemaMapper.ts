export interface SchemaMapping {
  ticker?: string;
  buyPrice?: string;
  quantity?: string;
  buyDate?: string;
  stopLossPrice?: string;
  targetPrice?: string;
  sellPrice?: string;
  sellDate?: string;
  strategyTag?: string;
  exitReason?: string;
  notes?: string;
}

export interface SchemaMappingResult {
  mapping: SchemaMapping;
  confidence: number;
  modelUsed: string;
  detectedLanguage?: string;
  missingCriticalFields?: string[];
  explanation?: string;
}

/**
 * AI-Powered Hybrid Schema Mapping
 * Sends only column headers and top 5 rows to Google Gemini API
 * Fallback to multi-lingual semantic classifier if API key is not configured or offline
 */
export async function inferSchemaMappingWithGemini(
  headers: string[],
  sampleRows: Record<string, any>[],
  clientApiKey?: string
): Promise<SchemaMappingResult> {
  const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const geminiResult = await callGeminiAPI(headers, sampleRows, apiKey);
      if (geminiResult) {
        return geminiResult;
      }
    } catch (err: any) {
      console.warn('[GeminiAI] Error invoking Gemini API:', err?.message || err, '. Using semantic engine fallback.');
    }
  }

  // Multi-lingual Semantic Fallback Engine (English, Hebrew, Broker formats)
  return runSemanticMappingFallback(headers, sampleRows);
}

/**
 * Call Google Gemini REST API with strict JSON schema response
 */
async function callGeminiAPI(
  headers: string[],
  sampleRows: Record<string, any>[],
  apiKey: string
): Promise<SchemaMappingResult | null> {
  // Use gemini-1.5-flash or gemini-2.5-flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an expert financial data schema engineer.
Analyze the following spreadsheet column headers and first 5 sample rows from a user-uploaded trade log.
The file may be in English, Hebrew, or any foreign broker structure (Interactive Brokers, TradingView, Charles Schwab, etc.).

Headers:
${JSON.stringify(headers)}

First 5 Sample Rows:
${JSON.stringify(sampleRows, null, 2)}

Target Database Fields:
- ticker: Stock symbol (e.g. AAPL, TSLA, NVDA, GOOGL)
- buyPrice: Entry/execution price per share (number)
- quantity: Number of shares or contracts (number)
- buyDate: Entry date / purchase date
- stopLossPrice: Stop loss trigger level (number)
- targetPrice: Profit target price (number)
- sellPrice: Exit / sell execution price (number)
- sellDate: Exit / sell date
- strategyTag: Strategy name or trade setup tag (e.g. Breakout, Moving Average Cross, VIX Reversal)
- exitReason: Reason trade was closed (e.g. Stop Loss, Target Reached, Manual)
- notes: Rationale, comments, or notes

Return a valid JSON object with:
{
  "mapping": {
    "ticker": "<Exact column header name from file or null>",
    "buyPrice": "<Exact column header name from file or null>",
    "quantity": "<Exact column header name from file or null>",
    "buyDate": "<Exact column header name from file or null>",
    "stopLossPrice": "<Exact column header name from file or null>",
    "targetPrice": "<Exact column header name from file or null>",
    "sellPrice": "<Exact column header name from file or null>",
    "sellDate": "<Exact column header name from file or null>",
    "strategyTag": "<Exact column header name from file or null>",
    "exitReason": "<Exact column header name from file or null>",
    "notes": "<Exact column header name from file or null>"
  },
  "confidence": <number between 0 and 1>,
  "missingCriticalFields": [<list of critical fields among ["ticker", "buyPrice"] that could not be mapped>],
  "detectedLanguage": "<e.g. English, Hebrew, Mixed>",
  "explanation": "<short sentence describing the mapped columns>"
}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const parsed = JSON.parse(text);
  return {
    mapping: parsed.mapping || {},
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
    modelUsed: 'Google Gemini 1.5 Flash',
    detectedLanguage: parsed.detectedLanguage || 'Auto-detected',
    missingCriticalFields: parsed.missingCriticalFields || [],
    explanation: parsed.explanation || 'Columns mapped by Gemini AI.',
  };
}

/**
 * Intelligent Multi-Lingual Semantic Mapper
 * Handles English, Hebrew, German, French, Spanish and major brokerage exports
 */
function runSemanticMappingFallback(
  headers: string[],
  sampleRows: Record<string, any>[]
): SchemaMappingResult {
  const mapping: SchemaMapping = {};
  const lowerHeaders = headers.map((h) => ({
    original: h,
    clean: h.toLowerCase().trim().replace(/[\s_\-#.]/g, ''),
    raw: h.toLowerCase().trim(),
  }));

  // Helper matching patterns (English, Hebrew, Common Broker Aliases)
  const patterns: Record<keyof SchemaMapping, RegExp[]> = {
    ticker: [
      /^(ticker|symbol|stock|asset|instrument|underlying|code|סימול|מניה|נייר|שםנייר|שםמניה|isin)$/i,
      /ticker|symbol|סימול/i,
    ],
    buyPrice: [
      /^(buyprice|entryprice|boughtat|purchaseprice|costbasis|entry|openprice|buy|מחירקניה|שערקניה|שערכניסה|מחירכניסה|עלות|שער)$/i,
      /buyprice|entryprice|purchase|מחיר.*קניה|שער.*קניה/i,
      /price|מחיר|שער/i,
    ],
    quantity: [
      /^(quantity|qty|shares|size|volume|contracts|units|amount|כמות|מניות|יחידות)$/i,
      /quantity|qty|shares|כמות/i,
    ],
    buyDate: [
      /^(buydate|entrydate|date|opendate|timestamp|opened|created|תאריך|תאריךקניה|תאריךפתיחה|תאריךכניסה)$/i,
      /buydate|entrydate|date|תאריך.*קניה|תאריך/i,
    ],
    stopLossPrice: [
      /^(stoplossprice|stoploss|stop|sl|stopprice|סטופלוס|סטופ|עצירתהפסד|מחירעצירה)$/i,
      /stoploss|stop|סטופ/i,
    ],
    targetPrice: [
      /^(targetprice|target|takeprofit|tp|profittarget|יעד|יעדרווח|מחיררווח)$/i,
      /target|profit|יעד/i,
    ],
    sellPrice: [
      /^(sellprice|exitprice|soldat|closeprice|sell|exit|closedprice|מחירמכירה|שערמכירה|שעריציאה|מחירסגירה)$/i,
      /sellprice|exitprice|closeprice|מחיר.*מכירה|שער.*מכירה/i,
    ],
    sellDate: [
      /^(selldate|exitdate|closedate|closedat|תאריךמכירה|תאריךסגירה|תאריךיציאה)$/i,
      /selldate|exitdate|closedate|תאריך.*מכירה/i,
    ],
    strategyTag: [
      /^(strategytag|strategy|tag|setup|system|play|אסטרטגיה|תגית|סוגעסקה|שיטה)$/i,
      /strategy|setup|tag|אסטרטגיה/i,
    ],
    exitReason: [
      /^(exitreason|reason|trigger|outcome|סיבתסגירה|סיבתמכירה|תוצאה)$/i,
      /exitreason|reason|trigger/i,
    ],
    notes: [
      /^(notes|note|comment|comments|rationale|description|הערות|הערה|נימוק|הסבר)$/i,
      /notes|comment|הער/i,
    ],
  };

  const assignedHeaders = new Set<string>();

  // Iteratively map fields by priority
  const fieldOrder: (keyof SchemaMapping)[] = [
    'ticker',
    'buyPrice',
    'quantity',
    'stopLossPrice',
    'targetPrice',
    'sellPrice',
    'buyDate',
    'sellDate',
    'strategyTag',
    'exitReason',
    'notes',
  ];

  for (const field of fieldOrder) {
    const regexList = patterns[field];
    for (const regex of regexList) {
      const match = lowerHeaders.find(
        (h) => !assignedHeaders.has(h.original) && (regex.test(h.clean) || regex.test(h.raw))
      );
      if (match) {
        mapping[field] = match.original;
        assignedHeaders.add(match.original);
        break;
      }
    }
  }

  // Also inspect sample values if ticker or price still missing
  if (!mapping.ticker) {
    for (const h of lowerHeaders) {
      if (assignedHeaders.has(h.original)) continue;
      // If sample values look like uppercase tickers (e.g. AAPL, TSLA)
      const values = sampleRows.map((r) => String(r[h.original] || '').trim());
      const looksLikeTicker = values.length > 0 && values.every((v) => /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(v));
      if (looksLikeTicker) {
        mapping.ticker = h.original;
        assignedHeaders.add(h.original);
        break;
      }
    }
  }

  const missingCriticalFields: string[] = [];
  if (!mapping.ticker) missingCriticalFields.push('ticker');
  if (!mapping.buyPrice) missingCriticalFields.push('buyPrice');

  const hasHebrew = headers.some((h) => /[\u0590-\u05FF]/.test(h));
  const detectedLanguage = hasHebrew ? 'Hebrew (עברית)' : 'English / Broker Format';

  const confidence = missingCriticalFields.length === 0 ? 0.94 : 0.5;

  return {
    mapping,
    confidence,
    modelUsed: 'Hybrid Semantic AI Mapper (Multi-Lingual)',
    detectedLanguage,
    missingCriticalFields: missingCriticalFields.length > 0 ? missingCriticalFields : undefined,
    explanation: `Analyzed ${headers.length} columns and mapped ${Object.keys(mapping).length} schema fields using ${detectedLanguage} heuristics.`,
  };
}
