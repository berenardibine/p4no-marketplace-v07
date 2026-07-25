import { useState, useEffect } from "react";
import { 
  Globe, Plus, Edit, Trash2, MoreVertical, Search, 
  MapPin, ChevronRight, ChevronDown, Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Country {
  id: string;
  name: string;
  iso_code: string | null;
  level_names: string[];
  is_active: boolean;
}

interface Province {
  id: string;
  name: string;
  country_id: string | null;
}

interface District {
  id: string;
  name: string;
  province_id: string;
}

interface Sector {
  id: string;
  name: string;
  district_id: string;
}

const LocationManagement = () => {
  const { toast } = useToast();
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [expandedProvince, setExpandedProvince] = useState<string | null>(null);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  
  const [showCountryDialog, setShowCountryDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [locationForm, setLocationForm] = useState({
    type: 'province' as 'province' | 'district' | 'sector',
    parentId: '',
    name: '',
    editingId: null as string | null,
  });
  const [countryForm, setCountryForm] = useState({
    name: '',
    iso_code: '',
    level1: 'Province',
    level2: 'District',
    level3: 'Sector',
  });

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch countries (use type assertion since table may not be in types yet)
    const { data: countriesData } = await (supabase as any)
      .from('countries')
      .select('*')
      .order('name');
    
    // Fetch provinces
    const { data: provincesData } = await supabase
      .from('provinces')
      .select('*')
      .order('name');
    
    // Fetch districts
    const { data: districtsData } = await supabase
      .from('districts')
      .select('*')
      .order('name');
    
    // Fetch sectors
    const { data: sectorsData } = await supabase
      .from('sectors')
      .select('*')
      .order('name');

    if (countriesData) {
      setCountries(countriesData.map((c: any) => ({
        ...c,
        level_names: Array.isArray(c.level_names) ? c.level_names : ['Province', 'District', 'Sector']
      })));
    }
    if (provincesData) setProvinces(provincesData.map((p: any) => ({ ...p, country_id: p.country_id || null })));
    if (districtsData) setDistricts(districtsData);
    if (sectorsData) setSectors(sectorsData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCountry = async () => {
    if (!countryForm.name.trim()) {
      toast({ title: "Country name is required", variant: "destructive" });
      return;
    }

    const countryData = {
      name: countryForm.name,
      iso_code: countryForm.iso_code || null,
      level_names: [countryForm.level1, countryForm.level2, countryForm.level3],
      is_active: true,
    };

    if (editingCountry) {
      const { error } = await (supabase as any)
        .from('countries')
        .update(countryData)
        .eq('id', editingCountry.id);

      if (error) {
        toast({ title: "Failed to update country", variant: "destructive" });
      } else {
        toast({ title: "Country updated!" });
        fetchData();
      }
    } else {
      const { error } = await (supabase as any)
        .from('countries')
        .insert(countryData);

      if (error) {
        toast({ title: "Failed to add country", variant: "destructive" });
      } else {
        toast({ title: "Country added!" });
        fetchData();
      }
    }

    resetCountryForm();
  };

  const resetCountryForm = () => {
    setCountryForm({
      name: '',
      iso_code: '',
      level1: 'Province',
      level2: 'District',
      level3: 'Sector',
    });
    setEditingCountry(null);
    setShowCountryDialog(false);
  };

  const handleEditCountry = (country: Country) => {
    setEditingCountry(country);
    setCountryForm({
      name: country.name,
      iso_code: country.iso_code || '',
      level1: country.level_names[0] || 'Province',
      level2: country.level_names[1] || 'District',
      level3: country.level_names[2] || 'Sector',
    });
    setShowCountryDialog(true);
  };

  const handleDeleteCountry = async (id: string) => {
    if (!confirm('Delete this country and all its locations?')) return;
    
    const { error } = await (supabase as any).from('countries').delete().eq('id', id);
    if (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    } else {
      toast({ title: "Country deleted!" });
      fetchData();
    }
  };

  const handleAddLocation = async () => {
    if (!locationForm.name.trim()) {
      toast({ title: "Location name is required", variant: "destructive" });
      return;
    }

    let error;
    
    if (locationForm.type === 'province') {
      if (locationForm.editingId) {
        ({ error } = await supabase
          .from('provinces')
          .update({ name: locationForm.name })
          .eq('id', locationForm.editingId));
      } else {
        ({ error } = await supabase
          .from('provinces')
          .insert({ name: locationForm.name, country_id: locationForm.parentId }));
      }
    } else if (locationForm.type === 'district') {
      if (locationForm.editingId) {
        ({ error } = await supabase
          .from('districts')
          .update({ name: locationForm.name })
          .eq('id', locationForm.editingId));
      } else {
        ({ error } = await supabase
          .from('districts')
          .insert({ name: locationForm.name, province_id: locationForm.parentId }));
      }
    } else if (locationForm.type === 'sector') {
      if (locationForm.editingId) {
        ({ error } = await supabase
          .from('sectors')
          .update({ name: locationForm.name })
          .eq('id', locationForm.editingId));
      } else {
        ({ error } = await supabase
          .from('sectors')
          .insert({ name: locationForm.name, district_id: locationForm.parentId }));
      }
    }

    if (error) {
      toast({ title: "Failed to save location", variant: "destructive" });
    } else {
      toast({ title: locationForm.editingId ? "Location updated!" : "Location added!" });
      fetchData();
    }

    setLocationForm({ type: 'province', parentId: '', name: '', editingId: null });
    setShowLocationDialog(false);
  };

  const handleDeleteLocation = async (type: 'province' | 'district' | 'sector', id: string) => {
    if (!confirm('Delete this location and all sub-locations?')) return;
    
    const table = type === 'province' ? 'provinces' : type === 'district' ? 'districts' : 'sectors';
    const { error } = await supabase.from(table).delete().eq('id', id);
    
    if (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    } else {
      toast({ title: "Location deleted!" });
      fetchData();
    }
  };

  const getCountryLevelName = (countryId: string | null, level: number) => {
    const country = countries.find(c => c.id === countryId);
    if (country?.level_names) {
      return country.level_names[level] || ['Province', 'District', 'Sector'][level];
    }
    return ['Province', 'District', 'Sector'][level];
  };

  const getProvincesForCountry = (countryId: string) => 
    provinces.filter(p => p.country_id === countryId);

  const getDistrictsForProvince = (provinceId: string) => 
    districts.filter(d => d.province_id === provinceId);

  const getSectorsForDistrict = (districtId: string) => 
    sectors.filter(s => s.district_id === districtId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Location Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage countries and their location hierarchies
          </p>
        </div>
        <Button 
          onClick={() => setShowCountryDialog(true)}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Country
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Countries</span>
          </div>
          <p className="text-2xl font-bold">{countries.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <Building className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">Provinces</span>
          </div>
          <p className="text-2xl font-bold">{provinces.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium text-muted-foreground">Districts</span>
          </div>
          <p className="text-2xl font-bold">{districts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium text-muted-foreground">Sectors</span>
          </div>
          <p className="text-2xl font-bold">{sectors.length}</p>
        </div>
      </div>

      {/* Countries List */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-white">
          <h3 className="font-semibold">Location Hierarchy</h3>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-16" />
              </div>
            ))
          ) : countries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No countries added yet</p>
            </div>
          ) : (
            countries.map(country => (
              <Collapsible
                key={country.id}
                open={expandedCountry === country.id}
                onOpenChange={(open) => setExpandedCountry(open ? country.id : null)}
              >
                <div className="border-b">
                  <CollapsibleTrigger asChild>
                    <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{country.name}</p>
                            {country.iso_code && (
                              <Badge variant="outline">{country.iso_code}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Levels: {country.level_names.join(' → ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-700">
                            {getProvincesForCountry(country.id).length} {country.level_names[0]}s
                          </Badge>
                          {expandedCountry === country.id ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white">
                              <DropdownMenuItem onClick={() => {
                                setLocationForm({ type: 'province', parentId: country.id, name: '', editingId: null });
                                setShowLocationDialog(true);
                              }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add {country.level_names[0]}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditCountry(country)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Country
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteCountry(country.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="bg-gray-50 border-t">
                      {getProvincesForCountry(country.id).map(province => (
                        <Collapsible
                          key={province.id}
                          open={expandedProvince === province.id}
                          onOpenChange={(open) => setExpandedProvince(open ? province.id : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="pl-12 pr-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100">
                              <div className="flex items-center gap-3">
                                <Building className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">{province.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {getDistrictsForProvince(province.id).length} {country.level_names[1]}s
                                </Badge>
                                <div className="ml-auto flex items-center gap-2">
                                  {expandedProvince === province.id ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-white">
                                      <DropdownMenuItem onClick={() => {
                                        setLocationForm({ type: 'district', parentId: province.id, name: '', editingId: null });
                                        setShowLocationDialog(true);
                                      }}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add {country.level_names[1]}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setLocationForm({ type: 'province', parentId: country.id, name: province.name, editingId: province.id });
                                        setShowLocationDialog(true);
                                      }}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteLocation('province', province.id)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="bg-gray-100">
                              {getDistrictsForProvince(province.id).map(district => (
                                <Collapsible
                                  key={district.id}
                                  open={expandedDistrict === district.id}
                                  onOpenChange={(open) => setExpandedDistrict(open ? district.id : null)}
                                >
                                  <CollapsibleTrigger asChild>
                                    <div className="pl-20 pr-4 py-2 hover:bg-gray-200 cursor-pointer border-b border-gray-200">
                                      <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-green-500" />
                                        <span className="text-sm">{district.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {getSectorsForDistrict(district.id).length} {country.level_names[2]}s
                                        </Badge>
                                        <div className="ml-auto flex items-center gap-2">
                                          {expandedDistrict === district.id ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <MoreVertical className="h-3 w-3" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="bg-white">
                                              <DropdownMenuItem onClick={() => {
                                                setLocationForm({ type: 'sector', parentId: district.id, name: '', editingId: null });
                                                setShowLocationDialog(true);
                                              }}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add {country.level_names[2]}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => {
                                                setLocationForm({ type: 'district', parentId: province.id, name: district.name, editingId: district.id });
                                                setShowLocationDialog(true);
                                              }}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Edit
                                              </DropdownMenuItem>
                                              <DropdownMenuItem 
                                                onClick={() => handleDeleteLocation('district', district.id)}
                                                className="text-destructive"
                                              >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>
                                  
                                  <CollapsibleContent>
                                    <div className="bg-white">
                                      {getSectorsForDistrict(district.id).map(sector => (
                                        <div key={sector.id} className="pl-28 pr-4 py-2 hover:bg-gray-50 border-b border-gray-100">
                                          <div className="flex items-center gap-3">
                                            <MapPin className="h-3 w-3 text-purple-500" />
                                            <span className="text-sm text-muted-foreground">{sector.name}</span>
                                            <div className="ml-auto">
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <MoreVertical className="h-3 w-3" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="bg-white">
                                                  <DropdownMenuItem onClick={() => {
                                                    setLocationForm({ type: 'sector', parentId: district.id, name: sector.name, editingId: sector.id });
                                                    setShowLocationDialog(true);
                                                  }}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem 
                                                    onClick={() => handleDeleteLocation('sector', sector.id)}
                                                    className="text-destructive"
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </div>
      </div>

      {/* Add Country Dialog */}
      <Dialog open={showCountryDialog} onOpenChange={(open) => {
        if (!open) resetCountryForm();
        setShowCountryDialog(open);
      }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCountry ? 'Edit Country' : 'Add New Country'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Country Name *</label>
              <Input
                placeholder="e.g., Kenya"
                value={countryForm.name}
                onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">ISO Code</label>
              <Input
                placeholder="e.g., KE"
                value={countryForm.iso_code}
                onChange={(e) => setCountryForm({ ...countryForm, iso_code: e.target.value })}
                maxLength={3}
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium block">Location Level Names</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Level 1</label>
                  <Input
                    placeholder="Province"
                    value={countryForm.level1}
                    onChange={(e) => setCountryForm({ ...countryForm, level1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Level 2</label>
                  <Input
                    placeholder="District"
                    value={countryForm.level2}
                    onChange={(e) => setCountryForm({ ...countryForm, level2: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Level 3</label>
                  <Input
                    placeholder="Sector"
                    value={countryForm.level3}
                    onChange={(e) => setCountryForm({ ...countryForm, level3: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Customize level names based on country's system (e.g., County → Sub-County → Ward)
              </p>
            </div>
            <Button onClick={handleAddCountry} className="w-full">
              {editingCountry ? 'Update Country' : 'Add Country'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={(open) => {
        if (!open) setLocationForm({ type: 'province', parentId: '', name: '', editingId: null });
        setShowLocationDialog(open);
      }}>
        <DialogContent className="bg-white max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {locationForm.editingId ? 'Edit Location' : 'Add Location'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Location Name *</label>
              <Input
                placeholder="Enter name..."
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
              />
            </div>
            <Button onClick={handleAddLocation} className="w-full">
              {locationForm.editingId ? 'Update' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationManagement;