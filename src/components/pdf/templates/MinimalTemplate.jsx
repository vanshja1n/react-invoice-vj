import { formatCurrency } from '@/types/invoice';
import { useInvoiceData } from '@/components/pdf/shared/invoiceData';

const styles = {
  root: {
    width: '794px',
    fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
    backgroundColor: '#ffffff',
    color: '#000000',
    boxSizing: 'border-box',
    padding: '56px 64px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '48px',
  },
  companyName: {
    fontSize: '18px',
    fontWeight: 500,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  companyMeta: {
    fontSize: '12px',
    color: '#86868b',
    margin: '6px 0 0',
    lineHeight: 1.6,
    fontWeight: 400,
  },
  invoiceLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#86868b',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    margin: 0,
  },
  invoiceNumber: {
    fontSize: '22px',
    fontWeight: 300,
    margin: '4px 0 0',
    letterSpacing: '-0.02em',
  },
  divider: {
    height: '0.5px',
    backgroundColor: '#d2d2d7',
    margin: '0 0 40px',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '48px',
    marginBottom: '48px',
  },
  label: {
    fontSize: '10px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#86868b',
    margin: '0 0 8px',
  },
  value: {
    fontSize: '14px',
    fontWeight: 500,
    margin: 0,
  },
  subValue: {
    fontSize: '12px',
    color: '#86868b',
    margin: '4px 0 0',
    lineHeight: 1.6,
    whiteSpace: 'pre-line',
    fontWeight: 400,
  },
  dateRow: {
    display: 'flex',
    gap: '48px',
    marginBottom: '40px',
    paddingBottom: '24px',
    borderBottom: '0.5px solid #d2d2d7',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '32px',
  },
  th: {
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#86868b',
    padding: '8px 0',
    borderBottom: '0.5px solid #d2d2d7',
  },
  td: {
    padding: '14px 0',
    borderBottom: '0.5px solid #f5f5f7',
    fontSize: '14px',
    verticalAlign: 'top',
    fontWeight: 400,
  },
  itemName: {
    fontWeight: 500,
    margin: 0,
  },
  itemDesc: {
    fontSize: '12px',
    color: '#86868b',
    margin: '3px 0 0',
    fontWeight: 400,
  },
  totalsWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '16px',
  },
  totalsBox: {
    width: '240px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    padding: '6px 0',
    color: '#86868b',
    fontWeight: 400,
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '16px',
    fontWeight: 500,
    padding: '12px 0 0',
    marginTop: '8px',
    borderTop: '0.5px solid #d2d2d7',
    color: '#000000',
  },
  notesSection: {
    marginTop: '48px',
    paddingTop: '24px',
    borderTop: '0.5px solid #d2d2d7',
  },
  notesText: {
    fontSize: '12px',
    color: '#86868b',
    margin: '6px 0 0',
    lineHeight: 1.7,
    whiteSpace: 'pre-line',
    fontWeight: 400,
  },
};

export function MinimalTemplate({ invoice }) {
  const d = useInvoiceData(invoice);
  if (!d) return null;

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          {d.companyLogo && (
            <img src={d.companyLogo} alt="Logo" style={{ height: '36px', marginBottom: '12px' }} crossOrigin="anonymous" />
          )}
          <h1 style={styles.companyName}>{d.companyName}</h1>
          {d.companyEmail && <p style={styles.companyMeta}>{d.companyEmail}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={styles.invoiceLabel}>Invoice</p>
          <p style={styles.invoiceNumber}>{d.invoiceNumber}</p>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.metaRow}>
        <div>
          <p style={styles.label}>To</p>
          <p style={styles.value}>{d.clientName}</p>
          <p style={styles.subValue}>{d.billingAddress}</p>
        </div>
        <div>
          <p style={styles.label}>From</p>
          <p style={styles.value}>{d.companyName}</p>
          <p style={styles.subValue}>{d.companyAddress}</p>
        </div>
      </div>

      <div style={styles.dateRow}>
        <div>
          <p style={styles.label}>Issued</p>
          <p style={styles.value}>{d.issueDate}</p>
        </div>
        <div>
          <p style={styles.label}>Due</p>
          <p style={styles.value}>{d.dueDate}</p>
        </div>
        <div>
          <p style={styles.label}>Status</p>
          <p style={{ ...styles.value, textTransform: 'capitalize' }}>{d.status}</p>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Item</th>
            <th style={{ ...styles.th, textAlign: 'center', width: '56px' }}>Qty</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '88px' }}>Price</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '96px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((item, idx) => (
            <tr key={idx}>
              <td style={styles.td}>
                <p style={styles.itemName}>{item.name}</p>
                {item.description && <p style={styles.itemDesc}>{item.description}</p>}
              </td>
              <td style={{ ...styles.td, textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>{d.itemPrice(item)}</td>
              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>{d.itemAmount(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={styles.totalsWrap}>
        <div style={styles.totalsBox}>
          <div style={styles.totalRow}><span>Subtotal</span><span>{d.subTotal}</span></div>
          {d.hasDiscount && (
            <div style={{ ...styles.totalRow, color: '#34c759' }}>
              <span>Discount</span><span>-{d.discountAmount}</span>
            </div>
          )}
          {d.hasTax && (
            <div style={styles.totalRow}><span>Tax</span><span>+{d.taxAmount}</span></div>
          )}
          {d.hasShipping && (
            <div style={styles.totalRow}><span>Shipping</span><span>+{formatCurrency(d.shippingCharges, invoice.currency)}</span></div>
          )}
          <div style={styles.grandTotal}><span>Total</span><span>{d.total}</span></div>
        </div>
      </div>

      {d.hasNotes && (
        <div style={styles.notesSection}>
          {d.notes && (<><p style={styles.label}>Notes</p><p style={styles.notesText}>{d.notes}</p></>)}
          {d.terms && (<><p style={{ ...styles.label, marginTop: '16px' }}>Terms</p><p style={styles.notesText}>{d.terms}</p></>)}
        </div>
      )}
    </div>
  );
}
