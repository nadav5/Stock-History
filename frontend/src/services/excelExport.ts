import * as XLSX from 'xlsx';
import { Trade, BlinkTransaction, AnalyticsSummary } from '../types/trade';

export function exportPortfolioToExcel(
  trades: Trade[],
  transactions: BlinkTransaction[],
  analytics: AnalyticsSummary | null,
  filename = 'דוח_תיק_השקעות_בלינק.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Investments & Holdings
  const tradesData = trades.map((t) => {
    const cost = Number((t.buyPrice * t.quantity).toFixed(2));
    const currentOrSell = t.status === 'CLOSED' ? (t.sellPrice || 0) : (t.currentPrice || t.buyPrice);
    const totalVal = Number((currentOrSell * t.quantity).toFixed(2));
    const pnl = t.status === 'CLOSED' ? (t.realizedPnL || 0) : (t.unrealizedPnL || 0);
    const pnlPct = t.status === 'CLOSED' ? (t.realizedPnLPercent || 0) : (t.unrealizedPnLPercent || 0);

    return {
      'טיקר (Ticker)': t.ticker,
      'שם החברה': t.assetName || t.ticker,
      'סקטור': t.sector || 'כללי',
      'סטטוס': t.status === 'ACTIVE' ? 'פוזיציה פתוחה' : 'עסקה סגורה',
      'כמות': t.quantity,
      'מחיר קנייה ($)': t.buyPrice,
      'מחיר נוכחי/מכירה ($)': currentOrSell,
      'סה״כ עלות השקעה ($)': cost,
      'שווי נוכחי / תקבול ($)': totalVal,
      'רווח/הפסד ($)': pnl,
      'תשואה באחוזים (%)': `${pnlPct > 0 ? '+' : ''}${pnlPct}%`,
      'דיבידנדים ($)': t.dividends || 0,
      'תאריך קנייה': t.buyDate ? new Date(t.buyDate).toLocaleDateString('he-IL') : '',
      'תאריך מכירה': t.sellDate ? new Date(t.sellDate).toLocaleDateString('he-IL') : '',
      'הערות': t.notes || '',
    };
  });

  const wsTrades = XLSX.utils.json_to_sheet(tradesData);
  XLSX.utils.book_append_sheet(wb, wsTrades, 'השקעות ופוזיציות');

  // 2. Sheet: Blink Transactions Ledger
  if (transactions && transactions.length > 0) {
    const txData = transactions.map((tx) => ({
      'תאריך': tx.date ? new Date(tx.date).toLocaleDateString('he-IL') : '',
      'סוג פעולה': tx.actionType,
      'שם הנייר / טיקר': tx.ticker || '',
      'כמות': tx.quantity != null ? tx.quantity : '',
      'מחיר ממוצע ($)': tx.price != null ? tx.price : '',
      'סכום הפעולה ($)': tx.amount,
      'יתרת מזומן לאחר פעולה ($)': tx.cashBalance != null ? tx.cashBalance : '',
    }));
    const wsTx = XLSX.utils.json_to_sheet(txData);
    XLSX.utils.book_append_sheet(wb, wsTx, 'פירוט תנועות בלינק');
  }

  // 3. Sheet: Summary & Breakdowns
  if (analytics) {
    const summaryRows: any[] = [
      { 'מדד תיק השקעות': 'שווי תיק כולל ($)', 'ערך': analytics.portfolioValue },
      { 'מדד תיק השקעות': 'סך הכל מושקע ($)', 'ערך': analytics.totalInvested },
      { 'מדד תיק השקעות': 'יתרת מזומן ($)', 'ערך': analytics.cashBalance },
      { 'מדד תיק השקעות': 'רווח / הפסד כולל ($)', 'ערך': analytics.totalPnL },
      { 'מדד תיק השקעות': 'תשואה כוללת (%)', 'ערך': `${analytics.totalPnLPercent}%` },
      { 'מדד תיק השקעות': 'רווח לא ממומש (החזקות פתוחות) ($)', 'ערך': analytics.totalUnrealizedPnL },
      { 'מדד תיק השקעות': 'רווח ממומש (עסקאות סגורות) ($)', 'ערך': analytics.totalRealizedPnL },
      { 'מדד תיק השקעות': 'סך דיבידנדים שהתקבלו ($)', 'ערך': analytics.totalDividends },
      { 'מדד תיק השקעות': 'אחוז הצלחה בעסקאות סגורות (%)', 'ערך': `${analytics.winRatePercent}%` },
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום תיק');

    // 4. Sheet: Sector Breakdown
    if (analytics.sectorBreakdown && analytics.sectorBreakdown.length > 0) {
      const sectorRows = analytics.sectorBreakdown.map((s) => ({
        'סקטור': s.sector,
        'שווי שוק ($)': s.value,
        'סך השקעה ($)': s.invested,
        'רווח / הפסד ($)': s.pnl,
        'תשואה (%)': `${s.pnlPercent > 0 ? '+' : ''}${s.pnlPercent}%`,
        'אחוז מהתיק (%)': `${s.percentOfPortfolio}%`,
        'מספר נכסים': s.holdingsCount,
      }));
      const wsSector = XLSX.utils.json_to_sheet(sectorRows);
      XLSX.utils.book_append_sheet(wb, wsSector, 'פילוח לפי סקטורים');
    }

    // 5. Sheet: Year Breakdown
    if (analytics.yearBreakdown && analytics.yearBreakdown.length > 0) {
      const yearRows = analytics.yearBreakdown.map((y) => ({
        'שנה': y.year,
        'סך השקעה ($)': y.invested,
        'רווח / הפסד ($)': y.totalPnL,
        'תשואה שנתית (%)': `${y.returnPercent > 0 ? '+' : ''}${y.returnPercent}%`,
        'עסקאות מורווחות': y.winCount,
        'עסקאות מופסדות': y.lossCount,
        'סך עסקאות': y.tradesCount,
      }));
      const wsYear = XLSX.utils.json_to_sheet(yearRows);
      XLSX.utils.book_append_sheet(wb, wsYear, 'פילוח לפי שנים');
    }
  }

  // Trigger Excel file download in browser
  XLSX.writeFile(wb, filename);
}
