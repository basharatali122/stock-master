// Print utility for generating printable reports

/**
 * Escapes HTML special characters to prevent XSS attacks
 */
export const escapeHtml = (unsafe: string): string => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Creates a safe text node for use in print content
 * Use this for any user-provided content
 */
export const safeText = (text: string | number | null | undefined): string => {
  if (text === null || text === undefined) return '';
  return escapeHtml(String(text));
};

/**
 * Formats total boxes as cartons in decimal form (e.g. 23 boxes / 18 per carton = "1.27").
 * The fractional part is the remainder boxes divided by boxes-per-carton, truncated to 2 digits.
 * Examples: (23, 18) -> "1.27", (5, 18) -> "0.27", (48, 24) -> "2.00".
 */
export const formatCartonDecimal = (totalBoxes: number, boxesPerCarton: number = 24): string => {
  const bpc = boxesPerCarton > 0 ? boxesPerCarton : 24;
  const boxes = Math.max(0, Math.floor(totalBoxes || 0));
  const cartons = Math.floor(boxes / bpc);
  const remainder = boxes % bpc;
  const frac = Math.floor((remainder / bpc) * 100);
  return `${cartons}.${String(frac).padStart(2, '0')}`;
};

/**
 * Sums cartons across items with mixed boxes-per-carton values.
 * For each item, contributes (quantity / boxes_per_carton). Returns the total as
 * "X.YY" where X is the integer carton count and YY is the truncated fractional part.
 * Use this for aggregated rows (totals, booker summaries) where products have
 * different boxes-per-carton — a single bpc cannot represent the true carton count.
 */
export const formatCartonsMixed = (
  items: Array<{ quantity: number; boxes_per_carton?: number | null }>
): string => {
  let sum = 0;
  for (const it of items) {
    const bpc = (it.boxes_per_carton && it.boxes_per_carton > 0) ? it.boxes_per_carton : 24;
    const qty = Math.max(0, Math.floor(it.quantity || 0));
    sum += qty / bpc;
  }
  const cartons = Math.floor(sum);
  const frac = Math.floor((sum - cartons) * 100);
  return `${cartons}.${String(frac).padStart(2, '0')}`;
};

// Company information for printing
export const COMPANY_INFO = {
  name: 'ALAM TRADER',
  address: 'Hamza Town, Near Bhatti Hospital, Bypass Kasur',
  phone1: '0321-4480088',
  phone2: '',
  contactLine: 'Prop: MEHAR M. SALEEM AKBAR | Ph: 0321-4480088',
};

export const printContent = (content: string, title: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  // Escape the title to prevent XSS
  const safeTitle = escapeHtml(title);
  const generatedDate = escapeHtml(new Date().toLocaleString());

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${safeTitle}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          color: #1a1a1a;
          font-size: 12px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #333;
        }
        .header h1 {
          font-size: 24px;
          margin-bottom: 5px;
        }
        .header .company-address {
          color: #444;
          font-size: 12px;
          margin-top: 5px;
        }
        .header .company-phones {
          color: #666;
          font-size: 11px;
          margin-top: 3px;
        }
        .header p.subtitle {
          color: #666;
          font-size: 11px;
          margin-top: 8px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 20px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 5px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
        }
        .info-label {
          color: #666;
        }
        .info-value {
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          padding: 10px 8px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #333;
          color: white;
          font-weight: 600;
        }
        tr:nth-child(even) {
          background: #f9f9f9;
        }
        .summary {
          margin-top: 20px;
          padding: 15px;
          background: #f0f0f0;
          border-radius: 5px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
        }
        .summary-row.total {
          font-weight: bold;
          font-size: 14px;
          border-top: 2px solid #333;
          margin-top: 10px;
          padding-top: 10px;
        }
        .summary-row.discount {
          color: #166534;
        }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          text-align: center;
          color: #666;
          font-size: 10px;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
        }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      ${content}
      <div class="footer">
        <p>Generated on ${generatedDate} | ${escapeHtml(COMPANY_INFO.name)} Distribution System</p>
      </div>
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

export const formatCurrencyForPrint = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

export const getStatusBadgeClass = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'delivered':
    case 'approved':
    case 'paid':
      return 'badge-success';
    case 'pending':
    case 'credit':
    case 'partial':
      return 'badge-warning';
    case 'cancelled':
    case 'rejected':
      return 'badge-danger';
    default:
      return 'badge-info';
  }
};
