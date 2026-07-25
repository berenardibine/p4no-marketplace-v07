import { useState, useEffect } from 'react';
import { 
  SlidersHorizontal, MapPin, DollarSign, Calendar, 
  ChevronDown, X, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface ProductFilters {
  provinceId?: string;
  districtId?: string;
  sectorId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy: 'newest' | 'oldest' | 'price_low' | 'price_high' | 'random';
  category?: string;
}

interface ProductFilterBarProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  showCategoryFilter?: boolean;
  categories?: { id: string; name: string; slug: string }[];
}

const ProductFilterBar = ({ 
  filters, 
  onFiltersChange, 
  showCategoryFilter = false,
  categories = []
}: ProductFilterBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<ProductFilters>(filters);
  const {
    provinces,
    districts,
    sectors,
    selectedProvince,
    selectedDistrict,
    selectedSector,
    setSelectedProvince,
    setSelectedDistrict,
    setSelectedSector,
  } = useLocations();

  // Track filter usage
  const trackFilterUsage = async (filterType: string, filterValue: string) => {
    try {
      await supabase.from('filter_analytics').insert({
        filter_type: filterType,
        filter_value: filterValue,
        user_id: (await supabase.auth.getUser()).data.user?.id || null
      });
    } catch (err) {
      // Silent fail - analytics shouldn't block user actions
    }
  };

  // Sync local filters when prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Sync location selections
  useEffect(() => {
    if (filters.provinceId) setSelectedProvince(filters.provinceId);
    if (filters.districtId) setSelectedDistrict(filters.districtId);
    if (filters.sectorId) setSelectedSector(filters.sectorId);
  }, [filters.provinceId, filters.districtId, filters.sectorId]);

  const handleApplyFilters = () => {
    const newFilters = {
      ...localFilters,
      provinceId: selectedProvince || undefined,
      districtId: selectedDistrict || undefined,
      sectorId: selectedSector || undefined,
    };
    
    // Track filter usage
    if (newFilters.provinceId) trackFilterUsage('location', 'province');
    if (newFilters.districtId) trackFilterUsage('location', 'district');
    if (newFilters.minPrice || newFilters.maxPrice) {
      trackFilterUsage('price', `${newFilters.minPrice || 0}-${newFilters.maxPrice || 'max'}`);
    }
    if (newFilters.sortBy !== 'random') trackFilterUsage('sort', newFilters.sortBy);
    
    onFiltersChange(newFilters);
    setIsOpen(false);
    
    // Save to localStorage for guest users
    localStorage.setItem('smartmarket_filters', JSON.stringify(newFilters));
  };

  const handleClearFilters = () => {
    const defaultFilters: ProductFilters = { sortBy: 'random' };
    setLocalFilters(defaultFilters);
    setSelectedProvince('');
    setSelectedDistrict('');
    setSelectedSector('');
    onFiltersChange(defaultFilters);
    setIsOpen(false);
    localStorage.removeItem('smartmarket_filters');
  };

  const activeFilterCount = [
    filters.provinceId,
    filters.districtId,
    filters.minPrice,
    filters.maxPrice,
    filters.sortBy !== 'random' ? filters.sortBy : null,
    filters.category,
  ].filter(Boolean).length;

  const getLocationLabel = () => {
    const province = provinces.find(p => p.id === filters.provinceId);
    const district = districts.find(d => d.id === filters.districtId);
    if (district) return district.name;
    if (province) return province.name;
    return 'All Rwanda';
  };

  return (
    <div className="space-y-3">
      {/* Quick Filter Pills - Desktop */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        {/* Location Quick Select */}
        <div className="flex items-center gap-2 bg-card rounded-full px-3 py-1.5 border">
          <MapPin className="h-4 w-4 text-primary" />
          <Select
            value={filters.provinceId || 'all'}
            onValueChange={(value) => {
              const newProvinceId = value === 'all' ? undefined : value;
              setSelectedProvince(value === 'all' ? '' : value);
              onFiltersChange({ ...filters, provinceId: newProvinceId, districtId: undefined, sectorId: undefined });
            }}
          >
            <SelectTrigger className="border-0 p-0 h-auto bg-transparent focus:ring-0 min-w-[100px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="all">All Rwanda</SelectItem>
              {provinces.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price Range Quick Select */}
        <div className="flex items-center gap-2 bg-card rounded-full px-3 py-1.5 border">
          <DollarSign className="h-4 w-4 text-primary" />
          <Select
            value={`${filters.minPrice || 0}-${filters.maxPrice || 'max'}`}
            onValueChange={(value) => {
              const [min, max] = value.split('-');
              onFiltersChange({
                ...filters,
                minPrice: min === '0' ? undefined : parseInt(min),
                maxPrice: max === 'max' ? undefined : parseInt(max),
              });
            }}
          >
            <SelectTrigger className="border-0 p-0 h-auto bg-transparent focus:ring-0 min-w-[100px]">
              <SelectValue placeholder="Price" />
            </SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="0-max">Any Price</SelectItem>
              <SelectItem value="0-10000">Under 10,000 RWF</SelectItem>
              <SelectItem value="10000-50000">10,000 - 50,000 RWF</SelectItem>
              <SelectItem value="50000-100000">50,000 - 100,000 RWF</SelectItem>
              <SelectItem value="100000-500000">100,000 - 500,000 RWF</SelectItem>
              <SelectItem value="500000-max">500,000+ RWF</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Quick Select */}
        <div className="flex items-center gap-2 bg-card rounded-full px-3 py-1.5 border">
          <Calendar className="h-4 w-4 text-primary" />
          <Select
            value={filters.sortBy}
            onValueChange={(value: ProductFilters['sortBy']) => {
              onFiltersChange({ ...filters, sortBy: value });
            }}
          >
            <SelectTrigger className="border-0 p-0 h-auto bg-transparent focus:ring-0 min-w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="random">Random</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="price_low">Price: Low</SelectItem>
              <SelectItem value="price_high">Price: High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Mobile Filter Bar */}
      <div className="md:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between rounded-xl h-12 bg-card border"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>{getLocationLabel()}</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </SheetTrigger>
          
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-background">
            <SheetHeader className="pb-4">
              <SheetTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Filter Products
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-6 overflow-y-auto max-h-[calc(85vh-150px)] pb-4">
              {/* Location Filters */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  Location
                </Label>
                
                <Select
                  value={selectedProvince || "all"}
                  onValueChange={(value) => {
                    setSelectedProvince(value === "all" ? "" : value);
                    setSelectedDistrict("");
                    setSelectedSector("");
                  }}
                >
                  <SelectTrigger className="rounded-xl bg-card">
                    <SelectValue placeholder="Select Province" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="all">All Provinces</SelectItem>
                    {provinces.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedProvince && selectedProvince !== "all" && (
                  <Select
                    value={selectedDistrict || "all"}
                    onValueChange={(value) => {
                      setSelectedDistrict(value === "all" ? "" : value);
                      setSelectedSector("");
                    }}
                  >
                    <SelectTrigger className="rounded-xl bg-card">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {selectedDistrict && selectedDistrict !== "all" && (
                  <Select
                    value={selectedSector || "all"}
                    onValueChange={(value) => setSelectedSector(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="rounded-xl bg-card">
                      <SelectValue placeholder="Select Sector" />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="all">All Sectors</SelectItem>
                      {sectors.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Price Range */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Price Range (RWF)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={localFilters.minPrice || ''}
                      onChange={(e) => setLocalFilters({
                        ...localFilters,
                        minPrice: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      className="rounded-xl bg-card"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={localFilters.maxPrice || ''}
                      onChange={(e) => setLocalFilters({
                        ...localFilters,
                        maxPrice: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      className="rounded-xl bg-card"
                    />
                  </div>
                </div>
              </div>

              {/* Sort By */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Calendar className="h-4 w-4 text-primary" />
                  Sort By
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'random', label: 'Random' },
                    { value: 'newest', label: 'Newest' },
                    { value: 'oldest', label: 'Oldest' },
                    { value: 'price_low', label: 'Price: Low' },
                    { value: 'price_high', label: 'Price: High' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLocalFilters({ ...localFilters, sortBy: option.value as ProductFilters['sortBy'] })}
                      className={cn(
                        "px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        localFilters.sortBy === option.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter (if enabled) */}
              {showCategoryFilter && categories.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Category</Label>
                  <Select
                    value={localFilters.category || 'all'}
                    onValueChange={(value) => setLocalFilters({
                      ...localFilters,
                      category: value === 'all' ? undefined : value
                    })}
                  >
                    <SelectTrigger className="rounded-xl bg-card">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                className="flex-1 rounded-xl"
              >
                Clear All
              </Button>
              <Button
                type="button"
                onClick={handleApplyFilters}
                className="flex-1 rounded-xl bg-primary"
              >
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default ProductFilterBar;