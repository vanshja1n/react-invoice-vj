import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Download,
  Printer,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useInvoices } from '@/hooks/useInvoices';
import { useCustomers } from '@/hooks/useCustomers';
import { formatCurrency, formatDate } from '@/types/invoice';
import { createInvoice } from '@/services/db';
import { generateInvoicePDF, downloadInvoicePdf, printInvoicePdf } from '@/services/pdf';

export default function InvoiceHistoryPage() {
  const navigate = useNavigate();
  const {
    invoices,
    loading,
    refresh,
    remove,
    search,
    filterByStatus,
    filterByCustomer,
    filterByDateRange,
    sortInvoices,
  } = useInvoices();
  const { customers } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt-desc');
  const [deleteId, setDeleteId] = useState(null);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    search(q);
  }, [search]);

  const handleStatusFilterChange = useCallback((status) => {
    setStatusFilter(status);
    setSearchQuery('');
    setCustomerFilter('all');
    setDateFrom('');
    setDateTo('');
    filterByStatus(status);
  }, [filterByStatus]);

  const handleCustomerFilterChange = useCallback((customerId) => {
    setCustomerFilter(customerId);
    setSearchQuery('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    if (customerId === 'all') {
      refresh();
    } else {
      filterByCustomer(parseInt(customerId, 10));
    }
  }, [filterByCustomer, refresh]);

  const handleDateFilterChange = useCallback(() => {
    if (!dateFrom || !dateTo) return;
    setSearchQuery('');
    setStatusFilter('all');
    setCustomerFilter('all');
    
    const start = new Date(dateFrom);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    
    filterByDateRange(start, end);
  }, [dateFrom, dateTo, filterByDateRange]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setCustomerFilter('all');
    setDateFrom('');
    setDateTo('');
    refresh();
  }, [refresh]);

  const handleSortChange = useCallback((val) => {
    setSortBy(val);
    const [field, dir] = val.split('-');
    sortInvoices(field, dir);
  }, [sortInvoices]);

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await remove(deleteId);
      toast.success('Invoice deleted');
    } catch {
      toast.error('Failed to delete invoice');
    } finally {
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (inv) => {
    try {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = inv;
      const duplicate = {
        ...rest,
        invoiceNumber: `${inv.invoiceNumber}-COPY`,
        status: 'draft',
      };
      const saved = await createInvoice(duplicate);
      await refresh();
      toast.success('Invoice duplicated');
      navigate(`/invoices/${saved.id}/edit`);
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  const handleDownloadPdf = async (inv) => {
    try {
      await downloadInvoicePdf(inv);
      toast.success('PDF downloaded');
    } catch (e) {
      console.error('PDF Generation Error:', e);
      toast.error(`Failed to generate PDF: ${e.message || e}`);
    }
  };

  const handlePrint = async (inv) => {
    try {
      await printInvoicePdf(inv);
    } catch (e) {
      console.error('Print Error:', e);
      toast.error(`Failed to print invoice: ${e.message || e}`);
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const totalPages = Math.ceil(invoices.length / perPage);
  const paginated = invoices.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div>
      <PageHeader
        title="Invoice History"
        description={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
      >
        <Button
          onClick={() => navigate('/invoices/new')}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search by invoice number, client, product..."
            className="flex-1"
          />
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="h-9 w-full sm:w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt-desc">Newest First</SelectItem>
              <SelectItem value="createdAt-asc">Oldest First</SelectItem>
              <SelectItem value="total-desc">Amount (High)</SelectItem>
              <SelectItem value="total-asc">Amount (Low)</SelectItem>
              <SelectItem value="clientName-asc">Client (A-Z)</SelectItem>
              <SelectItem value="clientName-desc">Client (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 p-3 bg-muted/20 border border-border/50 rounded-lg">
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-[140px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <Select value={customerFilter} onValueChange={handleCustomerFilterChange}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              className="h-8 text-xs w-full sm:w-[130px] bg-background" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)}
              title="From Date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input 
              type="date" 
              className="h-8 text-xs w-full sm:w-[130px] bg-background" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)}
              title="To Date"
            />
            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={handleDateFilterChange}>Apply Date</Button>
          </div>
          
          {(statusFilter !== 'all' || customerFilter !== 'all' || dateFrom || dateTo || searchQuery) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs ml-auto" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton />
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={FileText}
              title={searchQuery || statusFilter !== 'all' || customerFilter !== 'all' || dateFrom ? 'No results found' : 'No invoices yet'}
              description={
                searchQuery || statusFilter !== 'all' || customerFilter !== 'all' || dateFrom
                  ? 'Try clearing or changing your filters'
                  : 'Create your first invoice to get started'
              }
              actionLabel={searchQuery || statusFilter !== 'all' || customerFilter !== 'all' || dateFrom ? 'Clear Filters' : 'Create Invoice'}
              onAction={
                searchQuery || statusFilter !== 'all' || customerFilter !== 'all' || dateFrom
                  ? handleClearFilters
                  : () => navigate('/invoices/new')
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Invoice</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Client</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Amount</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Date</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {paginated.map((inv) => (
                          <motion.tr
                            key={inv.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium">{inv.invoiceNumber || 'Draft'}</p>
                              <p className="text-xs text-muted-foreground">{inv.companyName || ''}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm">{inv.clientName || '—'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={inv.status} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-semibold">
                                {formatCurrency(inv.total, inv.currency)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</p>
                            </td>
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <InvoiceActions
                                invoice={inv}
                                onEdit={() => navigate(`/invoices/${inv.id}/edit`)}
                                onPreview={() => navigate(`/invoices/${inv.id}/preview`)}
                                onDuplicate={() => handleDuplicate(inv)}
                                onDownload={() => handleDownloadPdf(inv)}
                                onPrint={() => handlePrint(inv)}
                                onDelete={() => setDeleteId(inv.id)}
                              />
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            <AnimatePresence>
              {paginated.map((inv) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                  >
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold">{inv.invoiceNumber || 'Draft'}</p>
                          <p className="text-xs text-muted-foreground">{inv.clientName || 'No client'}</p>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <StatusBadge status={inv.status} />
                          <InvoiceActions
                            invoice={inv}
                            onEdit={() => navigate(`/invoices/${inv.id}/edit`)}
                            onPreview={() => navigate(`/invoices/${inv.id}/preview`)}
                            onDuplicate={() => handleDuplicate(inv)}
                            onDownload={() => handleDownloadPdf(inv)}
                            onPrint={() => handlePrint(inv)}
                            onDelete={() => setDeleteId(inv.id)}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</span>
                        <span className="text-sm font-bold">{formatCurrency(inv.total, inv.currency)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

    </div>
  );
}

function InvoiceActions({ onEdit, onPreview, onDuplicate, onDownload, onPrint, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Invoice actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPreview}>
          <Eye className="h-3.5 w-3.5 mr-2" /> Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDownload}>
          <Download className="h-3.5 w-3.5 mr-2" /> Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}>
          <Printer className="h-3.5 w-3.5 mr-2" /> Print
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
