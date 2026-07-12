import { formatCurrency } from '@/types/invoice';
import { useInvoiceData } from '@/components/pdf/shared/invoiceData';

const accent = '#6366f1';

const styles = {
  root: {
    width: '794px',
    fontFamily: "'Inter', -apple-system, sans-serif",
    backgroundColor: '#ffffff',
    color: '#1f2937',
    boxSizing: 'border-box',
  },
  header: {
    padding: '40px 48px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    height: '48px',
    width: 'auto',
    objectFit: 'contain',
    marginBottom: '12px',
  },
  companyName: {
    fontSize: '22px',
    fontWeight: 700,
    margin: 0,
    color: '#111827',
  },
  companyMeta: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '4px 0 0',
    lineHeight: 1.5,
  },
  invoiceBadge: {
    backgroundColor: accent,
    color: '#ffffff',
    padding: '8px 20px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    display: 'inline-block',
    marginBottom: '8px',
  },
  invoiceNumber: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  divider: {
    height: '1px',
    backgroundColor: '#f3f4f6',
    margin: '0 48px',
  },
  body: {
    padding: '32px 48px 40px',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '32px',
    marginBottom: '40px',
  },
  sectionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #f3f4f6',
  },
  label: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: accent,
    margin: '0 0 8px',
  },
  value: {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
    color: '#111827',
  },
  subValue: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '4px 0 0',
    lineHeight: 1.5,
    whiteSpace: 'pre-line',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    marginBottom: '32px',
  },
  th: {
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#9ca3af',
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderBottom: `2px solid ${accent}`,
  },
  td: {
    padding: '16px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  itemName: {
    fontWeight: 600,
    margin: 0,
    color: '#111827',
  },
  itemDesc: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: '4px 0 0',
  },
  totalsWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  totalsBox: {
    width: '280px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '20px 24px',
    border: '1px solid #f3f4f6',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    padding: '6px 0',
    color: '#6b7280',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '18px',
    fontWeight: 700,
    padding: '12px 0 0',
    marginTop: '8px',
    borderTop: `2px solid ${accent}`,
    color: '#111827',
  },
  notesSection: {
    marginTop: '40px',
    padding: '24px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '1px solid #f3f4f6',
  },
  notesText: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '6px 0 0',
    lineHeight: 1.6,
    whiteSpace: 'pre-line',
  },
};

export function ModernTemplate({ invoice }) {
  const d = useInvoiceData(invoice);
  if (!d) return null;

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          {d.companyLogo && (
            <img src={d.companyLogo} alt="Logo" style={styles.logo} crossOrigin="anonymous" />
          )}
          <h1 style={styles.companyName}>{d.companyName}</h1>
          {d.companyEmail && <p style={styles.companyMeta}>{d.companyEmail}</p>}
          {d.companyPhone && <p style={styles.companyMeta}>{d.companyPhone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.invoiceBadge}>INVOICE</div>
          <p style={styles.invoiceNumber}>{d.invoiceNumber}</p>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.body}>
        <div style={styles.metaGrid}>
          <div style={styles.sectionCard}>
            <p style={styles.label}>Billed From</p>
            <p style={styles.value}>{d.companyName}</p>
            <p style={styles.subValue}>{d.companyAddress}</p>
            {d.companyGst && <p style={styles.subValue}>GST: {d.companyGst}</p>}
          </div>
          <div style={styles.sectionCard}>
            <p style={styles.label}>Billed To</p>
            <p style={styles.value}>{d.clientName}</p>
            <p style={styles.subValue}>{d.billingAddress}</p>
            {d.clientEmail && <p style={styles.subValue}>{d.clientEmail}</p>}
            {d.clientGst && <p style={styles.subValue}>GST: {d.clientGst}</p>}
          </div>
          <div style={styles.sectionCard}>
            <p style={styles.label}>Details</p>
            <p style={styles.subValue}>Issue: {d.issueDate}</p>
            <p style={styles.subValue}>Due: {d.dueDate}</p>
            <p style={{ ...styles.subValue, textTransform: 'capitalize', fontWeight: 600, color: '#111827' }}>
              Status: {d.status}
            </p>
          </div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, borderRadius: '8px 0 0 0' }}>Item</th>
              <th style={{ ...styles.th, textAlign: 'center', width: '64px' }}>Qty</th>
              <th style={{ ...styles.th, textAlign: 'center', width: '64px' }}>Unit</th>
              <th style={{ ...styles.th, textAlign: 'right', width: '96px' }}>Price</th>
              <th style={{ ...styles.th, textAlign: 'right', width: '112px', borderRadius: '0 8px 0 0' }}>Amount</th>
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
                <td style={{ ...styles.td, textAlign: 'center', textTransform: 'capitalize' }}>{item.unit || 'pcs'}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{d.itemPrice(item)}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{d.itemAmount(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={styles.totalsWrap}>
          <div style={styles.totalsBox}>
            <div style={styles.totalRow}><span>Subtotal</span><span>{d.subTotal}</span></div>
            {d.hasDiscount && (
              <div style={{ ...styles.totalRow, color: '#16a34a' }}>
                <span>Discount ({d.discountRate}%)</span><span>-{d.discountAmount}</span>
              </div>
            )}
            {d.hasTax && (
              <div style={styles.totalRow}><span>Tax ({d.taxRate}%)</span><span>+{d.taxAmount}</span></div>
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
            {d.terms && (<><p style={{ ...styles.label, marginTop: d.notes ? '16px' : 0 }}>Terms</p><p style={styles.notesText}>{d.terms}</p></>)}
          </div>
        )}
      </div>
    </div>
  );
}
