import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Download, Printer, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceTemplate } from '@/components/pdf/InvoiceTemplate';
import { downloadInvoicePdf, printInvoicePdf } from '@/services/pdf';
import { getInvoice } from '@/services/db';

export default function InvoicePreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const inv = await getInvoice(parseInt(id, 10));
        if (inv) {
          setInvoice(inv);
        } else {
          toast.error('Invoice not found');
          navigate('/invoices');
        }
      } catch {
        toast.error('Failed to load invoice');
        navigate('/invoices');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice);
      toast.success('PDF downloaded successfully');
    } catch (e) {
      toast.error(`Failed to download PDF: ${e.message || e}`);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printInvoicePdf(invoice);
    } catch (e) {
      toast.error(`Failed to print invoice: ${e.message || e}`);
    } finally {
      setPrinting(false);
    }
  };

  const handleFullscreen = () => {
    const el = document.getElementById('invoicePreviewRoot');
    if (el && el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Invoice Preview</h1>
            <p className="text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleFullscreen}>
            <Maximize2 className="h-3.5 w-3.5" /> Full Screen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={handlePrint}
            disabled={printing}
          >
            <Printer className="h-3.5 w-3.5" />
            {printing ? 'Generating...' : 'Print'}
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleDownload} disabled={downloading}>
            <Download className="h-3.5 w-3.5" />
            {downloading ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <div className="bg-muted/30 rounded-xl p-4 sm:p-8">
        <div
          id="invoicePreviewRoot"
          className="shadow-xl rounded-lg overflow-hidden border border-border mx-auto"
          style={{ width: 'fit-content' }}
        >
          <InvoiceTemplate invoice={invoice} />
        </div>
      </div>
    </motion.div>
  );
}
