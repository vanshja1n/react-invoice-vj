import { formatCurrency, formatDate } from '@/types/invoice';

const styles = {
  root: {
    width: '794px',
    fontFamily: "'Inter', sans-serif",
    backgroundColor: '#ffffff',
    color: '#111827',
    boxSizing: 'border-box',
  },
  header: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    padding: '24px 32px',
    display: 'flex',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    gap: '16px',
  },
  headerRight: {
    textAlign: 'right',
    flexShrink: 0,
  },
  companyName: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0,
  },
  mutedLight: {
    color: '#cbd5e1',
    fontSize: '14px',
    margin: '4px 0 0',
  },
  invoiceTitle: {
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    margin: 0,
  },
  body: {
    padding: '24px 32px',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '24px',
    marginBottom: '32px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#6b7280',
    margin: '0 0 4px',
  },
  value: {
    fontSize: '14px',
    fontWeight: 500,
    margin: 0,
  },
  subValue: {
    fontSize: '12px',
    color: '#4b5563',
    margin: '2px 0 0',
    whiteSpace: 'pre-line',
  },
  metaRight: {
    textAlign: 'right',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '24px',
    tableLayout: 'fixed',
  },
  th: {
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#6b7280',
    padding: '8px 0',
    borderBottom: '2px solid #e5e7eb',
  },
  thCenter: {
    textAlign: 'center',
    width: '64px',
  },
  thRight: {
    textAlign: 'right',
    width: '96px',
  },
  thAmount: {
    textAlign: 'right',
    width: '112px',
  },
  td: {
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'top',
  },
  itemName: {
    fontSize: '14px',
    fontWeight: 500,
    margin: 0,
  },
  itemDesc: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '2px 0 0',
  },
  totalsWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  totalsBox: {
    width: '256px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    padding: '4px 0',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '16px',
    fontWeight: 700,
    padding: '8px 0',
    marginTop: '4px',
    borderTop: '2px solid #1f2937',
  },
  notesSection: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
  },
  notesText: {
    fontSize: '12px',
    color: '#4b5563',
    margin: '4px 0 0',
    whiteSpace: 'pre-line',
  },
};

export function InvoiceTemplate({ invoice }) {
  if (!invoice) return null;

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {invoice.companyLogo && (
            <img
              src={invoice.companyLogo}
              alt="Logo"
              style={{ height: '56px', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
              crossOrigin="anonymous"
            />
          )}
          <div>
            <h1 style={styles.companyName}>{invoice.companyName || 'Your Company'}</h1>
            {invoice.companyEmail && (
              <p style={styles.mutedLight}>{invoice.companyEmail}</p>
            )}
            {invoice.companyPhone && (
              <p style={styles.mutedLight}>{invoice.companyPhone}</p>
            )}
          </div>
        </div>
        <div style={styles.headerRight}>
          <h2 style={styles.invoiceTitle}>INVOICE</h2>
          <p style={styles.mutedLight}>{invoice.invoiceNumber}</p>
        </div>
      </div>

      {/* Meta & Client Info */}
      <div style={styles.body}>
        <div style={styles.metaRow}>
          <div>
            <p style={styles.label}>Billed From</p>
            <p style={styles.value}>{invoice.companyName || ''}</p>
            <p style={styles.subValue}>{invoice.companyAddress || ''}</p>
            <p style={styles.subValue}>{invoice.companyEmail || ''}</p>
          </div>
          <div>
            <p style={styles.label}>Billed To</p>
            <p style={styles.value}>{invoice.clientName || ''}</p>
            <p style={styles.subValue}>{invoice.billingAddress || ''}</p>
            <p style={styles.subValue}>{invoice.clientEmail || ''}</p>
          </div>
          <div style={styles.metaRight}>
            <div style={{ marginBottom: '8px' }}>
              <p style={styles.label}>Issue Date</p>
              <p style={styles.value}>{formatDate(invoice.issueDate)}</p>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <p style={styles.label}>Due Date</p>
              <p style={styles.value}>{formatDate(invoice.dueDate)}</p>
            </div>
            <div>
              <p style={styles.label}>Status</p>
              <p style={{ ...styles.value, textTransform: 'capitalize' }}>{invoice.status}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Item</th>
              <th style={{ ...styles.th, ...styles.thCenter }}>Qty</th>
              <th style={{ ...styles.th, ...styles.thRight }}>Price</th>
              <th style={{ ...styles.th, ...styles.thAmount }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, idx) => (
              <tr key={idx}>
                <td style={styles.td}>
                  <p style={styles.itemName}>{item.name || 'Unnamed item'}</p>
                  {item.description && (
                    <p style={styles.itemDesc}>{item.description}</p>
                  )}
                </td>
                <td style={{ ...styles.td, textAlign: 'center', fontSize: '14px' }}>
                  {item.quantity}
                </td>
                <td style={{ ...styles.td, textAlign: 'right', fontSize: '14px' }}>
                  {invoice.currency}{parseFloat(item.price || 0).toFixed(2)}
                </td>
                <td style={{ ...styles.td, textAlign: 'right', fontSize: '14px', fontWeight: 500 }}>
                  {invoice.currency}{(parseFloat(item.price || 0) * parseInt(item.quantity || 0, 10)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={styles.totalsWrap}>
          <div style={styles.totalsBox}>
            <div style={styles.totalRow}>
              <span style={{ color: '#4b5563' }}>Subtotal</span>
              <span>{formatCurrency(invoice.subTotal, invoice.currency)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div style={{ ...styles.totalRow, color: '#16a34a' }}>
                <span>Discount ({invoice.discountRate}%)</span>
                <span>-{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
              </div>
            )}
            {invoice.taxAmount > 0 && (
              <div style={styles.totalRow}>
                <span style={{ color: '#4b5563' }}>Tax ({invoice.taxRate}%)</span>
                <span>+{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
              </div>
            )}
            {parseFloat(invoice.shippingCharges || 0) > 0 && (
              <div style={styles.totalRow}>
                <span style={{ color: '#4b5563' }}>Shipping</span>
                <span>+{formatCurrency(invoice.shippingCharges, invoice.currency)}</span>
              </div>
            )}
            <div style={styles.grandTotal}>
              <span>Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms) && (
          <div style={styles.notesSection}>
            {invoice.notes && (
              <div style={{ marginBottom: '16px' }}>
                <p style={styles.label}>Notes</p>
                <p style={styles.notesText}>{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <p style={styles.label}>Terms & Conditions</p>
                <p style={styles.notesText}>{invoice.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
