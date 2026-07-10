import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import InvoiceHistoryPage from '@/pages/InvoiceHistoryPage';
import InvoiceEditorPage from '@/pages/InvoiceEditorPage';
import InvoicePreviewPage from '@/pages/InvoicePreviewPage';
import SettingsPage from '@/pages/SettingsPage';
import BackupPage from '@/pages/BackupPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/invoices" element={<InvoiceHistoryPage />} />
        <Route path="/invoices/new" element={<InvoiceEditorPage />} />
        <Route path="/invoices/:id/edit" element={<InvoiceEditorPage />} />
        <Route path="/invoices/:id/preview" element={<InvoicePreviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/backup" element={<BackupPage />} />
      </Route>
    </Routes>
  );
}