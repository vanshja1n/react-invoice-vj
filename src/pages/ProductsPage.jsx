import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Package, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { StockBadge } from '@/components/shared/StockBadge';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/hooks/useSettings';
import { PRODUCT_CATEGORIES, getUnitShort } from '@/types/product';
import { formatCurrency, formatDate } from '@/types/invoice';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';

export default function ProductsPage() {
  const { products, loading, remove, search, filterByCategory, add, update } = useProducts();
  const { settings } = useSettings();
  const currency = settings.defaultCurrency || '₹';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const handleSearch = (q) => {
    setSearchQuery(q);
    search(q);
  };

  const handleFilterChange = (cat) => {
    setCategoryFilter(cat);
    setSearchQuery('');
    filterByCategory(cat);
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await remove(deleteId);
      toast.success('Product deleted');
    } catch {
      toast.error('Failed to delete product');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSaveProduct = async (productData) => {
    if (editingProduct) {
      await update(editingProduct.id, productData);
      toast.success('Product updated');
    } else {
      await add(productData);
      toast.success('Product created');
    }
  };

  const openAddForm = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const totalPages = Math.ceil(products.length / perPage);
  const paginated = products.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your inventory and services"
      >
        <Button onClick={openAddForm} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search products by name or SKU..."
          className="flex-1"
        />
        <Select value={categoryFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {PRODUCT_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton />
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={Package}
              title={searchQuery ? 'No products found' : 'Inventory is empty'}
              description={
                searchQuery
                  ? 'Try a different search query or category'
                  : 'Add your first product or service to start managing inventory'
              }
              actionLabel={searchQuery ? 'Clear Search' : 'Add Product'}
              onAction={
                searchQuery
                  ? () => { handleSearch(''); setCategoryFilter('all'); }
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
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Product</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Category</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Price</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Stock / Unit</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {paginated.map((product) => (
                          <motion.tr
                            key={product.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {product.category}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-semibold">
                                {formatCurrency(product.sellingPrice, currency)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {product.currentStock} {getUnitShort(product.unit)}
                            </td>
                            <td className="px-4 py-3">
                              <StockBadge product={product} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditForm(product)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDeleteId(product.id)} className="text-destructive focus:text-destructive">
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
              {paginated.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-semibold truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditForm(product)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteId(product.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{product.category}</span>
                        <StockBadge product={product} />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">
                          Stock: {product.currentStock} {getUnitShort(product.unit)}
                        </span>
                        <span className="text-sm font-bold">
                          {formatCurrency(product.sellingPrice, currency)}
                        </span>
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
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        onSave={handleSaveProduct}
      />
    </div>
  );
}
