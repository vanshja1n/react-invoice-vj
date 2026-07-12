import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Users, Check } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { EmptyState } from '@/components/shared/EmptyState';

export function CustomerSelectorDialog({ open, onOpenChange, onSelect, currentCustomerId }) {
  const { customers, search } = useCustomers();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setQuery('');
      search('');
    }
  }, [open, search]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  const handleSelect = (customer) => {
    onSelect(customer);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle>Select Customer</DialogTitle>
        </DialogHeader>
        
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={handleSearch}
              placeholder="Search customers..."
              className="pl-9 h-10"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {customers.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={Users}
                title="No customers found"
                description={query ? "Try a different search term" : "Add some customers to your list first"}
              />
            </div>
          ) : (
            <div className="space-y-1">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${
                    currentCustomerId === customer.id
                      ? 'bg-primary/5 border-primary/20'
                      : 'border-transparent hover:bg-muted/50 hover:border-border'
                  }`}
                  onClick={() => handleSelect(customer)}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-medium text-sm truncate">{customer.name}</p>
                    {(customer.email || customer.phone) && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {[customer.email, customer.phone].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                  
                  <div className="shrink-0 flex items-center">
                    {currentCustomerId === customer.id ? (
                      <Check className="h-5 w-5 text-primary" />
                    ) : (
                      <Button variant="ghost" size="sm" className="h-8">
                        Select
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
