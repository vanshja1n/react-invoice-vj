import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Users, Plus, MoreHorizontal, Pencil, Trash2, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { useCustomers } from '@/hooks/useCustomers';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';
import { formatDate } from '@/types/invoice';

export default function CustomersPage() {
  const { customers, loading, remove, search, add, update } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const handleSearch = (q) => {
    setSearchQuery(q);
    search(q);
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await remove(deleteId);
      toast.success('Customer deleted');
    } catch {
      toast.error('Failed to delete customer');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSaveCustomer = async (customerData) => {
    if (editingCustomer) {
      await update(editingCustomer.id, customerData);
      toast.success('Customer updated');
    } else {
      await add(customerData);
      toast.success('Customer created');
    }
  };

  const openAddForm = () => {
    setEditingCustomer(null);
    setFormOpen(true);
  };

  const openEditForm = (customer) => {
    setEditingCustomer(customer);
    setFormOpen(true);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const totalPages = Math.ceil(customers.length / perPage);
  const paginated = customers.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage your clients and customers"
      >
        <Button onClick={openAddForm} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 max-w-md">
        <SearchInput
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search customers by name, email, or phone..."
        />
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton />
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={Users}
              title={searchQuery ? 'No customers found' : 'No customers yet'}
              description={
                searchQuery
                  ? 'Try a different search query'
                  : 'Add your first customer to start tracking them'
              }
              actionLabel={searchQuery ? 'Clear Search' : 'Add Customer'}
              onAction={
                searchQuery
                  ? () => handleSearch('')
                  : openAddForm
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
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Customer</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Contact</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">GST/VAT</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Added On</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {paginated.map((customer) => (
                          <motion.tr
                            key={customer.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium">{customer.name}</p>
                              {customer.address && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                                  {customer.address}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {customer.email && (
                                  <p className="text-xs flex items-center gap-1.5">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    {customer.email}
                                  </p>
                                )}
                                {customer.phone && (
                                  <p className="text-xs flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {customer.phone}
                                  </p>
                                )}
                                {!customer.email && !customer.phone && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                              {customer.gstNumber || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-muted-foreground">{formatDate(customer.createdAt)}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditForm(customer)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDeleteId(customer.id)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
              {paginated.map((customer) => (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-semibold truncate">{customer.name}</p>
                          {customer.gstNumber && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">GST: {customer.gstNumber}</p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditForm(customer)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteId(customer.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="space-y-1.5 mb-3 bg-muted/30 p-2.5 rounded-lg border border-border/50">
                        {customer.email && (
                          <p className="text-xs flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{customer.email}</span>
                          </p>
                        )}
                        {customer.phone && (
                          <p className="text-xs flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {customer.phone}
                          </p>
                        )}
                        {customer.address && (
                          <p className="text-xs flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{customer.address}</span>
                          </p>
                        )}
                        {!customer.email && !customer.phone && !customer.address && (
                          <p className="text-xs text-muted-foreground italic">No contact info</p>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-medium">
                        <span>Added {formatDate(customer.createdAt)}</span>
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
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      {/* Customer Form Dialog */}
      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
      />
    </div>
  );
}
