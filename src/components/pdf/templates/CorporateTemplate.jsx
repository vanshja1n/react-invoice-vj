import { formatCurrency } from '@/types/invoice';
import { useInvoiceData } from '@/components/pdf/shared/invoiceData';

const darkBg = '#0f172a';
const gold = '#c9a227';

const styles = {
  root: {
    width: '794px',
    fontFamily: "'Inter', -apple-system, sans-serif",
    backgroundColor: '#ffffff',
    color: '#1e293b',
    boxSizing: 'border-box',
  },
  header: {
    backgroundColor: darkBg,
    color: '#ffffff',
    padding: '36px 48px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  companyName: {
    fontSize: '26px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  companyMeta: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '4px 0 0',
  },
  invoiceBlock: {
    textAlign: 'right',
  },
  invoiceTitle: {
    fontSize: '32px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '0.12em',
    color: gold,
  },
  invoiceNumber: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: '6px 0 0',
    fontWeight: 500,
  },
  goldBar: {
    height: '4px',
    background: `linear-gradient(90deg, ${gold}, #e8c547, ${gold})`,
  },
  body: {
    padding: '36px 48px 44px',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '28px',
    marginBottom: '36px',
  },
  metaBox: {
    borderLeft: `3px solid ${gold}`,
    paddingLeft: '16px',
  },
  label: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#64748b',
    margin: '0 0 8px',
  },
  value: {
    fontSize: '15px',
    fontWeight: 700,
    margin: 0,
    color: '#0f172a',
  },
  subValue: {
    fontSize: '12px',
    color: '#64748b',
    margin: '4px 0 0',
    lineHeight: 1.5,
    whiteSpace: 'pre-line',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '28px',
  },
  th: {
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '12px 14px',
    backgroundColor: darkBg,
    color: '#ffffff',
  },
  td: {
    padding: '14px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  tdAlt: {
    backgroundColor: '#f8fafc',
  },
  itemName: {
    fontWeight: 700,
    margin: 0,
    color: '#0f172a',
  },
  itemDesc: {
    fontSize: '12px',
    color: '#64748b',
    margin: '3px 0 0',
  },
  totalsWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  totalsBox: {
    width: '300px',
    backgroundColor: darkBg,
    color: '#ffffff',
    padding: '24px 28px',
    borderRadius: '4px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    padding: '6px 0',
    color: '#94a3b8',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '20px',
    fontWeight: 800,
    padding: '14px 0 0',
    marginTop: '10px',
    borderTop: `2px solid ${gold}`,
    color: gold,
  },
  notesSection: {
    marginTop: '36px',
    padding: '24px',
    backgroundColor: '#f8fafc',
    borderLeft: `4px solid ${gold}`,
  },
  notesText: {
    fontSize: '12px',
    color: '#475569',
    margin: '6px 0 0',
    lineHeight: 1.6,
    whiteSpace: 'pre-line',
  },
};

export function CorporateTemplate({ invoice }) {
  const d = useInvoiceData(invoice);
  if (!d) return null;

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {d.companyLogo && (
            <img src={d.companyLogo} alt="Logo" style={{ height: '56px', objectFit: 'contain' }} crossOrigin="anonymous" />
          )}
          <div>
            <h1 style={styles.companyName}>{d.companyName}</h1>
            {d.companyEmail && <p style={styles.companyMeta}>{d.companyEmail}</p>}
            {d.companyPhone && <p style={styles.companyMeta}>{d.companyPhone}</p>}
          </div>
        </div>
        <div style={styles.invoiceBlock}>
          <h2 style={styles.invoiceTitle}>INVOICE</h2>
          <p style={styles.invoiceNumber}>{d.invoiceNumber}</p>
        </div>
      </div>
      <div style={styles.goldBar} />

      <div style={styles.body}>
        <div style={styles.metaRow}>
          <div style={styles.metaBox}>
            <p style={styles.label}>Billed To</p>
            <p style={styles.value}>{d.clientName}</p>
            <p style={styles.subValue}>{d.billingAddress}</p>
            {d.clientGst && <p style={styles.subValue}>GST: {d.clientGst}</p>}
          </div>
          <div style={styles.metaBox}>
            <p style={styles.label}>From</p>
            <p style={styles.value}>{d.companyName}</p>
            <p style={styles.subValue}>{d.companyAddress}</p>
            {d.companyGst && <p style={styles.subValue}>GST: {d.companyGst}</p>}
          </div>
          <div style={styles.metaBox}>
            <p style={styles.label}>Invoice Details</p>
            <p style={styles.subValue}>Issued: {d.issueDate}</p>
            <p style={styles.subValue}>Due: {d.dueDate}</p>
            <p style={{ ...styles.subValue, textTransform: 'capitalize', fontWeight: 700, color: '#0f172a' }}>
              {d.status}
            </p>
          </div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Item Description</th>
              <th style={{ ...styles.th, textAlign: 'center', width: '64px' }}>Qty</th>
              <th style={{ ...styles.th, textAlign: 'center', width: '64px' }}>Unit</th>
              <th style={{ ...styles.th, textAlign: 'right', width: '96px' }}>Rate</th>
              <th style={{ ...styles.th, textAlign: 'right', width: '112px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((item, idx) => (
              <tr key={idx}>
                <td style={{ ...styles.td, ...(idx % 2 === 1 ? styles.tdAlt : {}) }}>
                  <p style={styles.itemName}>{item.name}</p>
                  {item.description && <p style={styles.itemDesc}>{item.description}</p>}
                </td>
                <td style={{ ...styles.td, textAlign: 'center', ...(idx % 2 === 1 ? styles.tdAlt : {}) }}>{item.quantity}</td>
                <td style={{ ...styles.td, textAlign: 'center', textTransform: 'capitalize', ...(idx % 2 === 1 ? styles.tdAlt : {}) }}>{item.unit || 'pcs'}</td>
                <td style={{ ...styles.td, textAlign: 'right', ...(idx % 2 === 1 ? styles.tdAlt : {}) }}>{d.itemPrice(item)}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, ...(idx % 2 === 1 ? styles.tdAlt : {}) }}>{d.itemAmount(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={styles.totalsWrap}>
          <div style={styles.totalsBox}>
            <div style={styles.totalRow}><span>Subtotal</span><span>{d.subTotal}</span></div>
            {d.hasDiscount && (
              <div style={{ ...styles.totalRow, color: '#4ade80' }}>
                <span>Discount ({d.discountRate}%)</span><span>-{d.discountAmount}</span>
              </div>
            )}
            {d.hasTax && (
              <div style={styles.totalRow}><span>Tax ({d.taxRate}%)</span><span>+{d.taxAmount}</span></div>
            )}
            {d.hasShipping && (
              <div style={styles.totalRow}><span>Shipping</span><span>+{formatCurrency(d.shippingCharges, invoice.currency)}</span></div>
            )}
            <div style={styles.grandTotal}><span>TOTAL</span><span>{d.total}</span></div>
          </div>
        </div>

        {d.hasNotes && (
          <div style={styles.notesSection}>
            {d.notes && (<><p style={styles.label}>Notes</p><p style={styles.notesText}>{d.notes}</p></>)}
            {d.terms && (<><p style={{ ...styles.label, marginTop: '12px' }}>Terms & Conditions</p><p style={styles.notesText}>{d.terms}</p></>)}
          </div>
        )}
      </div>
    </div>
  );
}
