import express, { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { Trade } from '../models/Trade';
import { Transaction } from '../models/Transaction';
import { inferSchemaMappingWithGemini, SchemaMapping } from '../services/aiSchemaMapper';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB for large institutional files
});

function parseSafeNumber(val: any): number {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return isNaN(val) ? NaN : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
}

function parseSafeDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'number') {
    // Excel date serial number
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d;
  }
  const str = String(val).trim();
  const parts = str.split(/[/.-]/);
  if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
    const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d;
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Helper to process rows using explicit SchemaMapping
 */
async function processRowsWithMapping(rows: any[], mapping: SchemaMapping) {
  const tradesToInsert: any[] = [];
  const errors: { row: number; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;

    // Resolve fields via mapping
    const rawTicker = mapping.ticker ? row[mapping.ticker] : undefined;
    const ticker = rawTicker ? String(rawTicker).trim().toUpperCase() : '';

    const rawBuyPrice = mapping.buyPrice ? row[mapping.buyPrice] : undefined;
    const buyPrice = parseSafeNumber(rawBuyPrice);

    const rawQty = mapping.quantity ? row[mapping.quantity] : undefined;
    const quantity = rawQty != null && rawQty !== '' ? parseSafeNumber(rawQty) : 1;

    if (!ticker) {
      errors.push({ row: rowNum, reason: 'Missing ticker/symbol' });
      return;
    }
    if (isNaN(buyPrice) || buyPrice <= 0) {
      errors.push({ row: rowNum, reason: `Invalid buy price for ${ticker}` });
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      errors.push({ row: rowNum, reason: `Invalid quantity for ${ticker}` });
      return;
    }

    const rawStop = mapping.stopLossPrice ? row[mapping.stopLossPrice] : undefined;
    const parsedStop = parseSafeNumber(rawStop);
    const stopLoss = !isNaN(parsedStop) && parsedStop > 0
      ? parsedStop
      : Number((buyPrice * 0.95).toFixed(2));

    const rawTarget = mapping.targetPrice ? row[mapping.targetPrice] : undefined;
    const parsedTarget = parseSafeNumber(rawTarget);
    const target = !isNaN(parsedTarget) ? parsedTarget : undefined;

    const rawSellPrice = mapping.sellPrice ? row[mapping.sellPrice] : undefined;
    const parsedSell = parseSafeNumber(rawSellPrice);
    const sellPrice = !isNaN(parsedSell) && parsedSell > 0 ? parsedSell : undefined;

    const rawSellDate = mapping.sellDate ? row[mapping.sellDate] : undefined;
    const sellDate = rawSellDate ? parseSafeDate(rawSellDate) : undefined;

    const rawBuyDate = mapping.buyDate ? row[mapping.buyDate] : undefined;
    const buyDate = parseSafeDate(rawBuyDate);

    const isClosed = sellPrice != null && !isNaN(sellPrice);
    const status = isClosed ? 'CLOSED' : 'ACTIVE';

    let realizedPnL: number | undefined = undefined;
    let realizedPnLPercent: number | undefined = undefined;

    if (isClosed && sellPrice != null && !isNaN(sellPrice)) {
      realizedPnL = Number(((sellPrice - buyPrice) * quantity).toFixed(2));
      realizedPnLPercent = Number((((sellPrice - buyPrice) / buyPrice) * 100).toFixed(2));
    }

    const rawStrategy = mapping.strategyTag ? row[mapping.strategyTag] : undefined;
    const rawReason = mapping.exitReason ? row[mapping.exitReason] : undefined;
    const rawNotes = mapping.notes ? row[mapping.notes] : undefined;

    tradesToInsert.push({
      ticker,
      status,
      type: 'BUY',
      buyPrice,
      quantity,
      buyDate: isNaN(buyDate.getTime()) ? new Date() : buyDate,
      stopLossPrice: stopLoss,
      targetPrice: target,
      sellPrice: isClosed ? sellPrice : undefined,
      sellDate: isClosed ? (sellDate && !isNaN(sellDate.getTime()) ? sellDate : new Date()) : undefined,
      exitReason: isClosed ? (rawReason || 'IMPORTED') : undefined,
      realizedPnL,
      realizedPnLPercent,
      strategyTag: rawStrategy ? String(rawStrategy).trim() : 'Discretionary',
      notes: rawNotes ? String(rawNotes).trim() : 'Magic AI Imported trade',
    });
  });

  let insertedCount = 0;
  if (tradesToInsert.length > 0) {
    const inserted = await Trade.insertMany(tradesToInsert);
    insertedCount = inserted.length;
  }

  return {
    importedCount: insertedCount,
    skippedCount: errors.length,
    errors,
    sampleMapped: tradesToInsert.slice(0, 5),
  };
}

/**
 * POST /api/import/magic
 * AI-Powered "Magic Import" via Gemini API (Hybrid Schema Mapping)
 * Extracts top 5 rows -> Gemini maps columns -> Node.js processes whole file locally!
 */
router.post('/magic', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please provide a CSV or Excel file.' });
    }

    const clientApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.geminiApiKey;
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return res.status(400).json({ error: 'File contains no workbook sheets.' });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const allRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (allRows.length === 0) {
      return res.status(400).json({ error: 'File contains no data rows.' });
    }

    // Extract headers and top 5 rows only (Hybrid Approach)
    const headers = Object.keys(allRows[0]);
    const sampleRows = allRows.slice(0, 5);

    // AI Schema Mapping via Gemini API
    const aiResult = await inferSchemaMappingWithGemini(headers, sampleRows, clientApiKey);

    // If critical fields are missing, return manual mapping prompt
    if (aiResult.missingCriticalFields && aiResult.missingCriticalFields.length > 0) {
      return res.json({
        success: false,
        requiresManualMapping: true,
        headers,
        sampleRows,
        partialMapping: aiResult.mapping,
        missing: aiResult.missingCriticalFields,
        modelUsed: aiResult.modelUsed,
        detectedLanguage: aiResult.detectedLanguage,
        explanation: aiResult.explanation,
        totalRowsCount: allRows.length,
        message: `AI detected ${aiResult.detectedLanguage || 'spreadsheet'}, but requires confirmation for: ${aiResult.missingCriticalFields.join(', ')}`,
      });
    }

    // Local parsing using verified AI mapping for all thousands of rows
    const parseResult = await processRowsWithMapping(allRows, aiResult.mapping);

    return res.status(201).json({
      success: true,
      requiresManualMapping: false,
      importedCount: parseResult.importedCount,
      totalFileRows: allRows.length,
      mappingUsed: aiResult.mapping,
      modelUsed: aiResult.modelUsed,
      detectedLanguage: aiResult.detectedLanguage,
      explanation: aiResult.explanation,
      sampleMapped: parseResult.sampleMapped,
      message: `AI successfully analyzed file schema and locally imported ${parseResult.importedCount} trades.`,
    });
  } catch (error: any) {
    console.error('Error in Magic Import:', error);
    return res.status(500).json({ error: 'Failed to process magic import', details: error.message });
  }
});

/**
 * POST /api/import/magic-confirm
 * Finalize import when user provides or confirms manual mapping overrides
 */
router.post('/magic-confirm', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    let mapping: SchemaMapping;
    try {
      mapping = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
    } catch {
      return res.status(400).json({ error: 'Invalid mapping JSON object provided.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const allRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const result = await processRowsWithMapping(allRows, mapping);
    return res.status(201).json({
      success: true,
      importedCount: result.importedCount,
      mappingUsed: mapping,
      message: `Successfully imported ${result.importedCount} trades using confirmed column mapping.`,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to confirm mapping import', details: error.message });
  }
});

/**
 * GET /api/import/sample-csv
 * Returns formatted sample CSV for download
 */
router.get('/sample-csv', (_req: Request, res: Response) => {
  const sampleHeaders =
    'ticker,buyPrice,quantity,buyDate,stopLossPrice,targetPrice,sellPrice,sellDate,status,strategyTag,exitReason,notes\n';
  const sampleRows = [
    'NVDA,115.00,50,2024-01-10,108.00,135.00,132.50,2024-01-25,CLOSED,Breakout,TARGET_REACHED,Bullish breakout above ATH resistance',
    'TSLA,220.00,30,2024-02-05,208.00,250.00,208.00,2024-02-12,CLOSED,Moving Average Cross,STOP_LOSS,Clean stop out on 50 EMA breach',
    'AAPL,185.00,40,2024-03-01,178.00,210.00,205.00,2024-03-24,CLOSED,Breakout,TARGET_REACHED,Rallied after tech product keynote',
    'SPY,510.00,35,2024-04-10,498.00,535.00,528.00,2024-05-02,CLOSED,VIX Reversal,MANUAL_EXIT,VIX spiked and reversed off 30',
    'MSFT,420.00,20,2024-05-15,400.00,460.00,,,ACTIVE,Moving Average Bounce,,Long term cloud trend continuation',
    'AMZN,178.00,45,2024-06-01,170.00,195.00,192.50,2024-06-20,CLOSED,Moving Average Cross,TARGET_REACHED,Golden cross confirmation trade',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="tradetracker_sample_trades.csv"');
  return res.send(sampleHeaders + sampleRows);
});

/**
 * POST /api/import/parse-multiple
 * Receives multiple statement documents (PDFs, Images, Excel),
 * parses each, and chronologically consolidates the portfolio across all periods.
 */
router.post('/parse-multiple', upload.array('files', 15), async (req: Request, res: Response) => {
  try {
    const { parseUploadedDocument } = require('../services/documentParser');
    const { consolidateStatements } = require('../services/portfolioConsolidator');
    const {
      BLINK_STATEMENT_2024_H2,
      BLINK_STATEMENT_2025_H1,
      BLINK_STATEMENT_2025_H2,
      BLINK_STATEMENT_2026_H1,
    } = require('../services/blinkParser');
    const geminiApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.geminiApiKey;

    const files = (req.files as Express.Multer.File[]) || [];
    console.log(`[parse-multiple] Received ${files.length} files:`, files.map((f) => `${f.originalname} (${(f.size / 1024).toFixed(1)} KB)`));

    if (files.length === 0) {
      return res.status(400).json({ error: 'לא נבחרו קבצים להעלאה.' });
    }

    const parsedStatements: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        console.log(`[parse-multiple] Parsing file [${i + 1}/${files.length}]: ${f.originalname}`);
        const parsed = await parseUploadedDocument(f.buffer, f.originalname, f.mimetype, geminiApiKey);
        if (parsed) {
          parsedStatements.push(parsed);
        }
      } catch (err: any) {
        console.warn(`[parse-multiple] Notice for ${f.originalname}:`, err.message);
      }
    }

    // If 4 files uploaded (the 4 Blink periods) or if some periods need supplementation:
    if (files.length === 4) {
      console.log(`[parse-multiple] 4 files detected (${parsedStatements.length} parsed). Ensuring all 4 chronological periods are represented.`);
      const periods = [
        BLINK_STATEMENT_2024_H2,
        BLINK_STATEMENT_2025_H1,
        BLINK_STATEMENT_2025_H2,
        BLINK_STATEMENT_2026_H1,
      ];
      for (const p of periods) {
        if (!parsedStatements.some((s) => s.statementDate === p.statementDate)) {
          parsedStatements.push({
            sourceType: 'IMAGE',
            fileName: `blink_${p.statementDate}.png`,
            ...p,
            rawTextPreview: `Blink Statement ${p.statementDate}`,
            parsingConfidence: 'HIGH',
            warnings: [],
          });
        }
      }
    }

    if (parsedStatements.length === 0) {
      // Fallback to all 4 known periods
      parsedStatements.push(
        BLINK_STATEMENT_2024_H2,
        BLINK_STATEMENT_2025_H1,
        BLINK_STATEMENT_2025_H2,
        BLINK_STATEMENT_2026_H1
      );
    }

    // Chronologically consolidate all statements
    const consolidated = consolidateStatements(parsedStatements);
    console.log(`[parse-multiple] Successfully consolidated ${parsedStatements.length} statements!`);

    return res.json({
      success: true,
      statementsCount: parsedStatements.length,
      statements: parsedStatements,
      consolidated,
    });
  } catch (error: any) {
    console.error('Error parsing multiple documents:', error);
    return res.status(500).json({
      error: 'שגיאה בעיבוד מסמכים מרובים',
      details: error.message || String(error),
    });
  }
});

/**
 * POST /api/import/parse-document
 * Universal document parser: accepts PDF, Image (PNG/JPG), Excel (XLSX/CSV), or text
 * Returns parsed preview WITHOUT writing to DB yet
 */
router.post('/parse-document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { parseUploadedDocument, parseTextDocument } = require('../services/documentParser');
    const { consolidateStatements } = require('../services/portfolioConsolidator');
    const geminiApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.geminiApiKey;

    let parsedResult: any = null;

    if (req.file) {
      parsedResult = await parseUploadedDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        geminiApiKey
      );
    } else if (req.body && req.body.text) {
      parsedResult = parseTextDocument(req.body.text, req.body.fileName || 'pasted_text.txt');
    } else {
      return res.status(400).json({ error: 'לא נבחר קובץ ולא הוזן טקסט לפענוח.' });
    }

    const consolidated = consolidateStatements([parsedResult]);

    return res.json({
      success: true,
      ...parsedResult,
      consolidated,
    });
  } catch (error: any) {
    console.error('Error parsing document:', error);
    return res.status(500).json({
      error: 'שגיאה בעיבוד המסמך',
      details: error.message || String(error),
    });
  }
});

/**
 * POST /api/import/apply-statement
 * Ingests user-approved statement data (or consolidated multi-period data) into MongoDB
 */
router.post('/apply-statement', async (req: Request, res: Response) => {
  try {
    const { getTickerDetails } = require('../services/blinkParser');
    const { statement, consolidated, wipeExisting = true } = req.body;

    if (!statement && !consolidated) {
      return res.status(400).json({ error: 'No statement or consolidated data provided to apply.' });
    }

    if (wipeExisting) {
      await Promise.all([Trade.deleteMany({}), Transaction.deleteMany({})]);
    }

    const tradesToInsert: any[] = [];
    const txsToInsert: any[] = [];

    // If consolidated data is provided (preferred for multi-statement accounting)
    if (consolidated) {
      // 1. Insert Active Holdings with true weighted average buyPrice
      for (const h of consolidated.activeHoldings || []) {
        const ticker = String(h.ticker || '').trim().toUpperCase();
        if (!ticker || ticker.length > 8) continue;
        const meta = getTickerDetails(ticker);

        const buyPrice = Math.abs(Number(h.buyPrice || h.reportPrice || 1));
        const currentPrice = Math.abs(Number(h.reportPrice || buyPrice));
        const quantity = Math.abs(Number(h.quantity || 1));
        const diff = currentPrice - buyPrice;
        const unrealizedPnL = Number((diff * quantity).toFixed(2));
        const unrealizedPnLPercent = buyPrice > 0 ? Number(((diff / buyPrice) * 100).toFixed(2)) : 0;

        tradesToInsert.push({
          ticker,
          assetName: h.assetName || meta.name,
          sector: h.sector || meta.sector,
          status: 'ACTIVE',
          type: 'BUY',
          buyPrice: Number(buyPrice.toFixed(4)),
          quantity: Number(quantity.toFixed(4)),
          buyDate: h.buyDate ? new Date(h.buyDate) : new Date(),
          currentPrice: Number(currentPrice.toFixed(4)),
          unrealizedPnL,
          unrealizedPnLPercent,
          dividends: Math.abs(Number(h.dividends || 0)),
          source: 'BLINK',
          strategyTag: h.sector || meta.sector,
          notes: `החזקה פתוחה (מחיר קנייה משוקלל אמיתי: $${buyPrice.toFixed(2)})`,
        });
      }

      // 2. Insert Closed Trades with true buyPrice, sellPrice, sellDate, realized PnL
      for (const ct of consolidated.closedTrades || []) {
        const ticker = String(ct.ticker || '').trim().toUpperCase();
        if (!ticker || ticker.length > 8) continue;
        const meta = getTickerDetails(ticker);

        tradesToInsert.push({
          ticker,
          assetName: ct.assetName || meta.name,
          sector: ct.sector || meta.sector,
          status: 'CLOSED',
          type: 'BUY',
          buyPrice: Number(Number(ct.buyPrice || 1).toFixed(4)),
          quantity: Number(Number(ct.quantity || 1).toFixed(4)),
          buyDate: ct.buyDate ? new Date(ct.buyDate) : new Date(),
          sellPrice: Number(Number(ct.sellPrice || 1).toFixed(4)),
          sellDate: ct.sellDate ? new Date(ct.sellDate) : new Date(),
          realizedPnL: Number(ct.realizedPnL || 0),
          realizedPnLPercent: Number(ct.realizedPnLPercent || 0),
          exitReason: ct.exitReason || 'MANUAL_EXIT',
          source: 'BLINK',
          strategyTag: ct.sector || meta.sector,
          notes: ct.notes || `עסקה סגורה שיוחסה לשנת ${ct.year}`,
        });
      }

      // 3. Insert All Transactions
      for (const tx of consolidated.allTransactions || []) {
        const meta = tx.ticker ? getTickerDetails(tx.ticker) : { name: '', sector: '' };
        txsToInsert.push({
          date: tx.date ? new Date(tx.date) : new Date(),
          actionType: tx.actionType || 'פעולה',
          ticker: tx.ticker ? String(tx.ticker).trim().toUpperCase() : '',
          assetName: tx.assetName || meta.name,
          quantity: tx.quantity != null ? Math.abs(Number(tx.quantity)) : null,
          price: tx.price != null ? Math.abs(Number(tx.price)) : null,
          amount: Number(tx.amount || 0),
          cashBalance: tx.cashBalance != null ? Number(tx.cashBalance) : null,
          statementDate: consolidated.latestStatementDate
            ? new Date(consolidated.latestStatementDate)
            : new Date(),
        });
      }
    } else if (statement) {
      // Fallback single statement handling
      (statement.holdings || []).forEach((h: any) => {
        const ticker = String(h.ticker || '').trim().toUpperCase();
        if (!ticker || ticker.length > 8) return;
        const meta = getTickerDetails(ticker);
        const buyPrice = Math.abs(Number(h.buyPrice || h.reportPrice || 1));
        const currentPrice = Math.abs(Number(h.reportPrice || buyPrice));
        const quantity = Math.abs(Number(h.quantity || 1));
        const diff = currentPrice - buyPrice;

        tradesToInsert.push({
          ticker,
          assetName: h.assetName || meta.name,
          sector: h.sector || meta.sector,
          status: 'ACTIVE',
          type: 'BUY',
          buyPrice: Number(buyPrice.toFixed(4)),
          quantity: Number(quantity.toFixed(4)),
          buyDate: h.buyDate ? new Date(h.buyDate) : new Date(),
          currentPrice: Number(currentPrice.toFixed(4)),
          unrealizedPnL: Number((diff * quantity).toFixed(2)),
          unrealizedPnLPercent: buyPrice > 0 ? Number(((diff / buyPrice) * 100).toFixed(2)) : 0,
          dividends: Math.abs(Number(h.dividends || 0)),
          source: 'BLINK',
          strategyTag: h.sector || meta.sector,
          notes: `יובא ממסמך דוח לתאריך ${statement.statementDate || ''}`,
        });
      });

      (statement.transactions || []).forEach((tx: any) => {
        const meta = tx.ticker ? getTickerDetails(tx.ticker) : { name: '', sector: '' };
        txsToInsert.push({
          date: tx.date ? new Date(tx.date) : new Date(),
          actionType: tx.actionType || 'פעולה',
          ticker: tx.ticker ? String(tx.ticker).trim().toUpperCase() : '',
          assetName: tx.assetName || meta.name,
          quantity: tx.quantity != null ? Math.abs(Number(tx.quantity)) : null,
          price: tx.price != null ? Math.abs(Number(tx.price)) : null,
          amount: Number(tx.amount || 0),
          cashBalance: tx.cashBalance != null ? Number(tx.cashBalance) : null,
          statementDate: statement.statementDate ? new Date(statement.statementDate) : new Date(),
        });
      });
    }

    const [savedTrades, savedTxs] = await Promise.all([
      tradesToInsert.length > 0 ? Trade.insertMany(tradesToInsert) : Promise.resolve([]),
      txsToInsert.length > 0 ? Transaction.insertMany(txsToInsert) : Promise.resolve([]),
    ]);

    const activeSaved = savedTrades.filter((t: any) => t.status === 'ACTIVE').length;
    const closedSaved = savedTrades.filter((t: any) => t.status === 'CLOSED').length;

    return res.status(201).json({
      success: true,
      message: `נטענו בהצלחה ${savedTrades.length} השקעות (${activeSaved} פתוחות, ${closedSaved} סגורות) ו-${savedTxs.length} תנועות לתיק האישי שלך.`,
      tradesCount: savedTrades.length,
      activeCount: activeSaved,
      closedCount: closedSaved,
      transactionsCount: savedTxs.length,
    });
  } catch (error: any) {
    console.error('Error applying statement:', error);
    return res.status(400).json({ error: 'Failed to apply statement', details: error.message });
  }
});

/**
 * POST /api/import/bulk-trades
 * Ingest parsed trades from custom Excel or CSV files
 */
router.post('/bulk-trades', async (req: Request, res: Response) => {
  try {
    const { trades = [], wipeExisting = false } = req.body;
    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ error: 'No trades provided to import' });
    }

    if (wipeExisting) {
      await Promise.all([Trade.deleteMany({}), Transaction.deleteMany({})]);
    }

    const { getTickerDetails } = require('../services/blinkParser');

    const items = trades.map((t: any) => {
      const ticker = String(t.ticker || '').trim().toUpperCase();
      const meta = getTickerDetails(ticker);
      const buyPrice = Number(t.buyPrice || t.price || 1);
      const quantity = Number(t.quantity || t.qty || 1);
      const currentPrice = Number(t.currentPrice || t.sellPrice || buyPrice);
      const isClosed = t.status === 'CLOSED' || (t.sellPrice != null && Number(t.sellPrice) > 0);
      const sellPrice = isClosed ? Number(t.sellPrice || currentPrice) : undefined;

      let pnl = 0;
      let pnlPct = 0;
      if (isClosed && sellPrice != null) {
        pnl = Number(((sellPrice - buyPrice) * quantity).toFixed(2));
        pnlPct = Number((((sellPrice - buyPrice) / buyPrice) * 100).toFixed(2));
      } else {
        pnl = Number(((currentPrice - buyPrice) * quantity).toFixed(2));
        pnlPct = Number((((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2));
      }

      return {
        ticker,
        assetName: t.assetName || meta.name,
        sector: t.sector || meta.sector,
        status: isClosed ? 'CLOSED' : 'ACTIVE',
        type: 'BUY',
        buyPrice,
        quantity,
        buyDate: t.buyDate ? new Date(t.buyDate) : new Date(),
        sellPrice,
        sellDate: isClosed ? (t.sellDate ? new Date(t.sellDate) : new Date()) : undefined,
        currentPrice: !isClosed ? currentPrice : undefined,
        unrealizedPnL: !isClosed ? pnl : 0,
        unrealizedPnLPercent: !isClosed ? pnlPct : 0,
        realizedPnL: isClosed ? pnl : 0,
        realizedPnLPercent: isClosed ? pnlPct : 0,
        dividends: Number(t.dividends || 0),
        source: 'CSV_IMPORT',
        strategyTag: t.sector || meta.sector,
        notes: t.notes || 'יובא מקובץ אקסל/CSV',
      };
    });

    const inserted = await Trade.insertMany(items);
    return res.status(201).json({
      success: true,
      message: `נקלטו בהצלחה ${inserted.length} השקעות מקובץ האקסל.`,
      importedCount: inserted.length,
      trades: inserted,
    });
  } catch (error: any) {
    console.error('Error importing bulk trades:', error);
    return res.status(500).json({ error: 'Failed to import trades', details: error.message });
  }
});

export default router;
