import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  Trash2,
  Info,
  FileDown,
  FileUp,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { exportAllData, importAllData, clearAllData, getAllInvoices } from '@/services/db';
import { generateInvoicePDF, getInvoiceFilename } from '@/services/pdf';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import JSZip from 'jszip';

export default function BackupPage() {
  const { invoices, refresh: refreshInvoices } = useInvoices();
  const { refresh: refreshProducts } = useProducts();
  const { refresh: refreshCustomers } = useCustomers();
  
  const [clearOpen, setClearOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoicehub_data_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported all data successfully');
    } catch {
      toast.error('Failed to export JSON');
    }
  };

  const handleExportZip = async () => {
    if (invoices.length === 0) return;
    setExportingZip(true);
    setZipProgress(0);
    const toastId = toast.loading('Preparing ZIP export...');
    
    try {
      const zip = new JSZip();
      const allInvs = await getAllInvoices();
      
      let count = 0;
      for (const inv of allInvs) {
        const { blob } = await generateInvoicePDF(inv);
        const filename = getInvoiceFilename(inv);
        zip.file(filename, blob);
        
        count++;
        setZipProgress(Math.round((count / allInvs.length) * 100));
        toast.loading(`Generating PDFs... ${count}/${allInvs.length}`, { id: toastId });
      }

      toast.loading('Zipping files...', { id: toastId });
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('ZIP download complete!', { id: toastId });
    } catch (e) {
      console.error('ZIP Generation Error:', e);
      toast.error(`Failed to export ZIP: ${e.message || e}`, { id: toastId });
    } finally {
      setExportingZip(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importAllData(text);
      await Promise.all([refreshInvoices(), refreshProducts(), refreshCustomers()]);
      toast.success(`Imported ${result.invoices} invoices, ${result.products} products, ${result.customers} customers`);
    } catch (err) {
      console.error(err);
      toast.error('Invalid backup file');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    try {
      await clearAllData();
      await Promise.all([refreshInvoices(), refreshProducts(), refreshCustomers()]);
      toast.success('All data cleared');
    } catch {
      toast.error('Failed to clear data');
    } finally {
      setClearOpen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <PageHeader
        title="Backup & Restore"
        description="Manage your invoice and inventory data"
      />

      <div className="space-y-6">
        {/* Info Banner */}
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Local Storage
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Your data (invoices, products, customers) is stored locally in your browser using IndexedDB. It persists
                  across sessions but is tied to this device and browser. Export a backup if you
                  want to move your data to another device or browser.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export JSON */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileDown className="h-4 w-4 text-muted-foreground" />
              Export Full Backup (.json)
            </CardTitle>
            <CardDescription className="text-xs">
              Download all your invoices, products, and customers as a JSON backup file for restoring later
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExport}
              disabled={exportingZip}
              className="gap-1.5"
              size="sm"
            >
              <Download className="h-4 w-4" /> Export Backup (.json)
            </Button>
          </CardContent>
        </Card>

        {/* Export ZIP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileDown className="h-4 w-4 text-muted-foreground" />
              Export PDFs (.zip)
            </CardTitle>
            <CardDescription className="text-xs">
              Generate and download a ZIP file containing PDFs of all {invoices.length} invoice(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handleExportZip}
              disabled={invoices.length === 0 || exportingZip}
              className="gap-1.5"
              size="sm"
            >
              <Download className="h-4 w-4" /> 
              {exportingZip ? `Exporting... ${zipProgress}%` : 'Export PDFs (.zip)'}
            </Button>
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              Import Backup
            </CardTitle>
            <CardDescription className="text-xs">
              Restore invoices, products, and customers from a previously exported JSON file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-1.5"
              size="sm"
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Importing...' : 'Import Backup'}
            </Button>
          </CardContent>
        </Card>

        {/* Clear All */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-xs">
              Permanently delete all data (invoices, products, customers). This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setClearOpen(true)}
              className="gap-1.5"
              size="sm"
            >
              <Trash2 className="h-4 w-4" /> Clear All Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Clear Confirmation */}
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear All Data"
        description="This will permanently delete all your invoices, products, and customers. Export a backup first if you want to keep your data. This action cannot be undone."
        confirmLabel="Delete All"
        onConfirm={handleClear}
      />

    </motion.div>
  );
}
