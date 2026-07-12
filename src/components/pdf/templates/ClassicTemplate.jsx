import { formatCurrency } from '@/types/invoice';
import { useInvoiceData } from '@/components/pdf/shared/invoiceData';

const styles = {
  root: {
    width: '794px',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    boxSizing: 'border-box',
    padding: '40px 48px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '3px double #1a1a1a',
    paddingBottom: '24px',
    marginBottom: '28px',
  },
  companyName: {
    fontSize: '24px',
    fontWeight: 700,
    margin: 0,
    fontFamily: "'Georgia', serif",
  },
  companyMeta: {
    fontSize: '13px',
    color: '#444',
    margin: '6px 0 0',
    lineHeight: 1.6,
  },
  invoiceTitle: {
    fontSize: '28px',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '0.15em',
    fontFamily: "'Georgia', serif",
  },
  invoiceNumber: {
    fontSize: '14px',
    color: '#555',
    margin: '8px 0 0',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '24px',
    marginBottom: '28px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#555',
    margin: '0 0 6px',
    borderBottom: '1px solid #ccc',
    paddingBottom: '4px',
  },
  value: {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
  },
  subValue: {
    fontSize: '12px',
    color: '#555',
    margin: '4px 0 0',
    lineHeight: 1.5,
    whiteSpace: 'pre-line',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '24px',
    border: '1px solid #1a1a1a',
  },
  th: {
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '10px 12px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #1a1a1a',
    color: '#1a1a1a',
  },
  td: {
    padding: '10px 12px',
    border: '1px solid #ccc',
    fontSize: '13px',
    verticalAlign: 'top',
  },
  itemName: {
    fontWeight: 600,
    margin: 0,
  },
  itemDesc: {
    fontSize: '11px',
    color: '#666',
    margin: '3px 0 0',
  },
  totalsWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  totalsBox: {
    width: '280px',
    border: '1px solid #1a1a1a',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    padding: '8px 16px',
    borderBottom: '1px solid #ddd',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '16px',
    fontWeight: 700,
    padding: '12px 16px',
    backgroundColor: '#f5f5f5',
    borderTop: '2px solid #1a1a1a',
  },
  notesSection: {
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid #ccc',
  },
  notesText: {
    fontSize: '12px',
    color: '#444',
    margin: '6px 0 0',
    lineHeight: 1.6,
    whiteSpace: 'pre-line',
  },
};

export function ClassicTemplate({ invoice }) {
  const d = useInvoiceData(invoice);
  if (!d) return null;

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          {d.companyLogo && (
            <img src={d.companyLogo} alt="Logo" style={{ height: '52px', marginBottom: '10px' }} crossOrigin="anonymous" />
          )}
          <h1 style={styles.companyName}>{d.companyName}</h1>
          {d.companyAddress && <p style={styles.companyMeta}>{d.companyAddress}</p>}
          {d.companyEmail && <p style={styles.companyMeta}>{d.companyEmail}</p>}
          {d.companyPhone && <p style={styles.companyMeta}>{d.companyPhone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={styles.invoiceTitle}>INVOICE</h2>
          <p style={styles.invoiceNumber}>No. {d.invoiceNumber}</p>
        </div>
      </div>

      <div style={styles.metaRow}>
        <div>
          <p style={styles.label}>Bill To</p>
          <p style={styles.value}>{d.clientName}</p>
          <p style={styles.subValue}>{d.billingAddress}</p>
          {d.clientEmail && <p style={styles.subValue}>{d.clientEmail}</p>}
        </div>
        <div>
          <p style={styles.label}>From</p>
          <p style={styles.value}>{d.companyName}</p>
          {d.companyGst && <p style={styles.subValue}>GST: {d.companyGst}</p>}
        </div>
        <div>
          <p style={styles.label}>Invoice Details</p>
          <p style={styles.subValue}>Date: {d.issueDate}</p>
          <p style={styles.subValue}>Due: {d.dueDate}</p>
          <p style={{ ...styles.subValue, textTransform: 'capitalize', fontWeight: 600 }}>Status: {d.status}</p>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Description</th>
            <th style={{ ...styles.th, textAlign: 'center', width: '60px' }}>Qty</th>
            <th style={{ ...styles.th, textAlign: 'center', width: '60px' }}>Unit</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '90px' }}>Rate</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '100px' }}>Amount</th>
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
          <div style={styles.grandTotal}><span>Total Due</span><span>{d.total}</span></div>
        </div>
      </div>

      {d.hasNotes && (
        <div style={styles.notesSection}>
          {d.notes && (<><p style={styles.label}>Notes</p><p style={styles.notesText}>{d.notes}</p></>)}
          {d.terms && (<><p style={{ ...styles.label, marginTop: '12px' }}>Terms & Conditions</p><p style={styles.notesText}>{d.terms}</p></>)}
        </div>
      )}
    </div>
  );
}
