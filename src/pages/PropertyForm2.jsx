import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, Save, Loader2, ShieldCheck, LayoutGrid, Building2,
  Plus, ChevronUp, Info, Bed, Maximize2, Bath, DoorOpen, Sofa, Layers, Tag, Rocket, Wallet,
  CheckCircle2, Search, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import SeoAutoFill from '@/components/seo/SeoAutoFill';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY'];

const INITIAL_ROOM_TYPE = {
  bedrooms: '', size_sqm: '', bathrooms: '', balcony: '', salon: '', 
  floor_number: '', sub_type: '', boost: 'Default', price: '', 
  currency: 'USD', old_price: '', commission: ''
};

export default function PropertyForm2() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('specs');
  const [featureSearch, setFeatureSearch] = useState('');

  const [form, setForm] = useState({
    title: '', slug: '', type: 'apartment', sub_type: '',
    price: '', currency: 'USD', bedrooms: '', bathrooms: '', size_sqm: '',
    sea_view: false, seafront: false, citizenship_eligible: false, residency_eligible: false,
    description: '', features: [], main_image: '', featured: false,
    floor_number: '',
    market_status: 'For Sale', balcony: '', salon: '', boost: 'Default', old_price: '', commission: '',
    construction_year: '', total_sqm: '', block_count: '', floor_count: '',
    developer_company: '', list_link_1: '', list_link_2: '',
    payment_down: 100, payment_under_construction: 0, payment_delivery: 0, payment_installment: 0,
    room_types: [{ ...INITIAL_ROOM_TYPE }]
  });

  const { data: propertyData, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => base44.entities.Property.filter({ id }),
    enabled: !!id,
  });

  const { data: propertyTypes = [] } = useQuery({
    queryKey: ['property-types'],
    queryFn: () => base44.entities.PropertyType.list('order'),
  });

  const { data: allFeatures = [] } = useQuery({
    queryKey: ['all-features'],
    queryFn: () => base44.entities.Feature.list(),
  });

  useEffect(() => {
    if (propertyData?.[0]) {
      const data = propertyData[0];
      
      const room_types = data.room_types || [
        {
          bedrooms: data.bedrooms || '',
          size_sqm: data.size_sqm || '',
          bathrooms: data.bathrooms || '',
          balcony: data.balcony || '',
          salon: data.salon || '',
          floor_number: data.floor_number || '',
          sub_type: data.sub_type || '',
          boost: data.boost || 'Default',
          price: data.price || '',
          currency: data.currency || 'USD',
          old_price: data.old_price || '',
          commission: data.commission || ''
        }
      ];

      setForm(prev => ({ ...prev, ...data, room_types }));
    }
  }, [propertyData]);

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.Property.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Mülk portföy detayları başarıyla tamamlandı ve mühürlendi! ☁️');
      navigate('/properties');
    },
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleAddRoomType = () => {
    setForm(f => ({
      ...f,
      room_types: [...(f.room_types || []), { ...INITIAL_ROOM_TYPE }]
    }));
  };

  const handleRemoveRoomType = (index) => {
    setForm(f => ({
      ...f,
      room_types: f.room_types.filter((_, i) => i !== index)
    }));
  };

  const setRoomValue = (index, key, val) => {
    setForm(f => {
      const updatedRooms = [...f.room_types];
      updatedRooms[index] = { ...updatedRooms[index], [key]: val };
      return { ...f, room_types: updatedRooms };
    });
  };

  const handleConstructionYearChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 2) {
      val = val.slice(0, 2) + '/' + val.slice(2, 6);
    } else if (val.length === 2 && e.target.value.length === 2) {
      val = val + '/'; 
    }
    set('construction_year', val);
  };

  const handleToggleFeature = (featureSlug) => {
    const currentFeatures = form.features || [];
    if (currentFeatures.includes(featureSlug)) {
      set('features', currentFeatures.filter(f => f !== featureSlug));
    } else {
      set('features', [...currentFeatures, featureSlug]);
    }
  };

  const filteredFeatures = useMemo(() => {
    const searchLower = featureSearch.toLowerCase().trim();
    if (!searchLower) return allFeatures;
    return allFeatures.filter(feat => feat.name?.toLowerCase().includes(searchLower));
  }, [allFeatures, featureSearch]);

  const selectedFeaturesItems = useMemo(() => {
    return allFeatures.filter(feat => form.features?.includes(feat.slug));
  }, [allFeatures, form.features]);

  // Sadece içi dolu olan alanları liste düzeninde HTML olarak basan motor
  const handleAutoGenerateDescription = () => {
    let html = `<h2><strong>🏢 ${form.project_name || form.title || 'Gayrimenkul Tanıtım Portföyü'}</strong></h2>`;
    html += `<p>${form.property_ref ? `Ref No: <strong>${form.property_ref}</strong> | ` : ''} Durum: <strong>${form.market_status || 'For Sale'}</strong></p>`;
    
    // 1. Genel Proje ve Yapı Bilgileri
    if (form.type || form.developer_company || form.construction_year || form.total_sqm || form.block_count || form.floor_count) {
      html += `<h3>📌 Genel Proje ve Yapı Bilgileri</h3><ul>`;
      if (form.type) html += `<li><strong>Mülk Tipi:</strong> ${form.type.toUpperCase()} ${form.sub_type ? `(${form.sub_type})` : ''}</li>`;
      if (form.developer_company) html += `<li><strong>Geliştirici Şirket:</strong> ${form.developer_company}</li>`;
      if (form.construction_year) html += `<li><strong>İnşaat / Teslim Yılı:</strong> ${form.construction_year}</li>`;
      if (form.total_sqm) html += `<li><strong>Toplam Proje Alanı:</strong> ${form.total_sqm} m²</li>`;
      if (form.block_count) html += `<li><strong>Blok Sayısı:</strong> ${form.block_count}</li>`;
      if (form.floor_count) html += `<li><strong>Kat Sayısı:</strong> ${form.floor_count}</li>`;
      html += `</ul>`;
    }

    // 2. Yasal Avantajlar & Durum Kriterleri
    if (form.citizenship_eligible || form.residency_eligible || form.sea_view || form.seafront) {
      html += `<h3>⚖️ Yasal Avantajlar & Konum Özellikleri</h3><ul>`;
      if (form.citizenship_eligible) html += `<li>🇹🇷 Türk Vatandaşlığı şartlarına uygundur.</li>`;
      if (form.residency_eligible) html += `<li>🪪 İkamet izni kriterlerini karşılar.</li>`;
      if (form.sea_view) html += `<li>🌊 Kapanmaz deniz manzarasına sahiptir.</li>`;
      if (form.seafront) html += `<li>🏖️ Denize sıfır konumdadır.</li>`;
      html += `</ul>`;
    }

    // 3. Oda Tipleri & Fiyatlandırma (YENİ LİSTE FORMATI)
    if (form.room_types && form.room_types.some(room => room.bedrooms || room.price || room.size_sqm)) {
      html += `<h3>🛏️ Mevcut Oda Tipleri & Fiyatlandırma</h3>`;
      
      form.room_types.forEach((room) => {
        if (!room.bedrooms && !room.price && !room.size_sqm) return;
        
        const symbol = room.currency === 'EUR' ? '€' : room.currency === 'USD' ? '$' : room.currency === 'GBP' ? '£' : '₺';
        const currencyEmoji = room.currency === 'EUR' ? '💶' : room.currency === 'USD' ? '💵' : room.currency === 'GBP' ? '💷' : '🪙';
        const formattedPrice = room.price ? `${Number(room.price).toLocaleString('tr-TR')} ${symbol}` : 'Fiyat Bilgisi Alınız';
        
        html += `<p style="line-height: 1.6; margin-bottom: 18px;">`;
        html += `🏠 <strong>Oda Planı:</strong> ${room.bedrooms || 0}+${room.salon || 0} ${room.sub_type || ''}<br />`;
        if (room.size_sqm) html += `📐 <strong>Net Alan:</strong> ${room.size_sqm} m²<br />`;
        
        if (room.floor_number || room.bathrooms || room.balcony) {
          html += `🏗️ <strong>Yapı Detayları:</strong><br /><br />`;
          if (room.floor_number) html += `Kat: ${room.floor_number}<br />`;
          if (room.bathrooms) html += `Banyo: ${room.bathrooms}<br />`;
          if (room.balcony) html += `Balkon: ${room.balcony}<br />`;
        }
        
        html += `${currencyEmoji} <strong>Fiyat:</strong> ${formattedPrice}`;
        html += `</p>`;
      });
    }

    // 4. Ödeme Planı Yapılandırması
    if (Number(form.payment_down) > 0 || Number(form.payment_under_construction) > 0 || Number(form.payment_delivery) > 0 || Number(form.payment_installment) > 0) {
      html += `<h3>💳 Ödeme Planı Yapılandırması</h3><ul>`;
      if (Number(form.payment_down) > 0) html += `<li><strong>Peşinat Oranı:</strong> %${form.payment_down}</li>`;
      if (Number(form.payment_under_construction) > 0) html += `<li><strong>İnşaat Süreci Ara Ödeme:</strong> %${form.payment_under_construction}</li>`;
      if (Number(form.payment_delivery) > 0) html += `<li><strong>Teslimat Esnası Ödeme:</strong> %${form.payment_delivery}</li>`;
      if (Number(form.payment_installment) > 0) html += `<li><strong>Vade / Taksitlendirme İmkanı:</strong> %${form.payment_installment}</li>`;
      html += `</ul>`;
    }

    // 5. Seçilen Sosyal Donatılar
    if (selectedFeaturesItems.length > 0) {
      html += `<h3>✨ Kompleks Özellikleri ve Sosyal Donatılar</h3>`;
      html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 5px;">`;
      selectedFeaturesItems.forEach(feat => {
        html += `<span>${feat.emoji || feat.icon || '✔️'} ${feat.name}</span>`;
      });
      html += `</div>`;
    }

    set('description', html);
    toast.success('Dolu alanlar filtrelenerek yeni liste formatında aktarıldı! 🚀');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };

    if (data.room_types && data.room_types.length > 0) {
      const mainRoom = data.room_types[0];
      data.price = Number(mainRoom.price) || '';
      data.old_price = Number(mainRoom.old_price) || '';
      data.commission = Number(mainRoom.commission) || '';
      data.bedrooms = Number(mainRoom.bedrooms) || '';
      data.bathrooms = Number(mainRoom.bathrooms) || '';
      data.balcony = Number(mainRoom.balcony) || '';
      data.salon = Number(mainRoom.salon) || '';
      data.size_sqm = Number(mainRoom.size_sqm) || '';
      data.floor_number = Number(mainRoom.floor_number) || '';
      data.sub_type = mainRoom.sub_type;
      data.boost = mainRoom.boost;
      data.currency = mainRoom.currency;
    }

    if (data.room_types) {
      data.room_types = data.room_types.map(room => ({
        ...room,
        price: room.price ? Number(room.price) : '',
        old_price: room.old_price ? Number(room.old_price) : '',
        commission: room.commission ? Number(room.commission) : '',
        bedrooms: room.bedrooms ? Number(room.bedrooms) : '',
        bathrooms: room.bathrooms ? Number(room.bathrooms) : '',
        balcony: room.balcony ? Number(room.balcony) : '',
        salon: room.salon ? Number(room.salon) : '',
        size_sqm: room.size_sqm ? Number(room.size_sqm) : '',
        floor_number: room.floor_number ? Number(room.floor_number) : '',
      }));
    }

    if (data.total_sqm) data.total_sqm = Number(data.total_sqm);
    if (data.block_count) data.block_count = Number(data.block_count);
    if (data.floor_count) data.floor_count = Number(data.floor_count);
    if (data.payment_down) data.payment_down = Number(data.payment_down);
    if (data.payment_under_construction) data.payment_under_construction = Number(data.payment_under_construction);
    if (data.payment_delivery) data.payment_delivery = Number(data.payment_delivery);
    if (data.payment_installment) data.payment_installment = Number(data.payment_installment);
    
    if (!data.title) data.title = data.seo_title || data.project_name || 'Gayrimenkul Portföyü';

    mutation.mutate(data);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );

  const selectedTypeObj = propertyTypes.find(t => t.slug === form.type);
  const subTypeOptions = selectedTypeObj?.sub_types || [];

  const tabs = [
    { id: 'specs', label: '🛏️ Yapı & Fiyat' },
    { id: 'features', label: '✨ Özellik Seçimi' },
    { id: 'desc', label: '📄 Detaylı İlan Metni' },
    { id: 'seo', label: '🔍 SEO Yapılandırma' },
  ];

  const totalPayment = (Number(form.payment_down) || 0) + (Number(form.payment_under_construction) || 0) + (Number(form.payment_delivery) || 0) + (Number(form.payment_installment) || 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Üst Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <Link to={`/properties/${id}`}>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold font-jakarta text-foreground">Hızlı Portföy Ekleme - Adım 2</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ref No: <span className="font-mono font-bold text-primary">{form.property_ref || 'Atanmadı'}</span> · Proje: {form.project_name || 'Belirtilmedi'}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={mutation.isPending} className="sm:ml-auto gap-2 gradient-primary text-white border-0 hover:opacity-90 px-6 h-10 rounded-xl shadow-sm">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Portföyü Yayına Al
        </Button>
      </div>

      {/* Tab Navigasyon */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit border border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === t.id 
                ? 'bg-white text-foreground shadow-xs' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Form İçerikleri */}
      <div className="space-y-6">
        {/* TAB 1: YAPI & FİYAT */}
        {activeTab === 'specs' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                <LayoutGrid className="w-4 h-4 text-primary" /> Yapısal Sınıflandırma
              </h3>
              <div className="sm:max-w-md">
                <Label className="text-xs">Mülk Ana Tipi</Label>
                <Select value={form.type || 'apartment'} onValueChange={v => { set('type', v); set('sub_type', ''); }}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {propertyTypes.filter(t => t.is_active).map(t => (
                      <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 space-y-5">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                <Building2 className="w-4 h-4 text-primary" /> Proje Detayları
              </h3>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">📅 İNŞAAT YILI *</Label>
                  <Input 
                    type="text" 
                    value={form.construction_year || ''} 
                    onChange={handleConstructionYearChange} 
                    className="mt-1.5 border-emerald-200 focus-visible:ring-emerald-500" 
                    placeholder="06/2026"
                    maxLength={7}
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">📐 TOPLAM M²</Label>
                  <div className="relative mt-1.5">
                    <Input type="number" value={form.total_sqm || ''} onChange={e => set('total_sqm', e.target.value)} className="border-emerald-200 focus-visible:ring-emerald-500 pr-8" placeholder="3" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">m²</span>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">🏢 BLOK SAYISI *</Label>
                  <Input type="number" value={form.block_count || ''} onChange={e => set('block_count', e.target.value)} className="mt-1.5 border-emerald-200 focus-visible:ring-emerald-500" placeholder="1" />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">🏢 KAT SAYISI *</Label>
                  <Input type="number" value={form.floor_count || ''} onChange={e => set('floor_count', e.target.value)} className="mt-1.5 border-emerald-200 focus-visible:ring-emerald-500" placeholder="2" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">👷 GELİŞTİRİCİ ŞİRKET *</Label>
                  <Input type="text" value={form.developer_company || ''} onChange={e => set('developer_company', e.target.value)} className="mt-1.5 border-emerald-200 focus-visible:ring-emerald-500" placeholder="Firma Adı" />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">🔗 LİSTE LİNKİ 1 *</Label>
                  <Input type="text" value={form.list_link_1 || ''} onChange={e => set('list_link_1', e.target.value)} className="mt-1.5 border-emerald-200 focus-visible:ring-emerald-500" placeholder="1" />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">🔗 LİSTE LİNKİ 2 *</Label>
                  <Input type="text" value={form.list_link_2 || ''} onChange={e => set('list_link_2', e.target.value)} className="mt-1.5 border-emerald-200 focus-visible:ring-emerald-500" placeholder="1" />
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 mt-4 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <Label className="text-xs font-bold text-gray-800 flex items-center gap-2">💳 Ödeme Planı Yapılandırma *</Label>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${totalPayment === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    TOPLAM: %{totalPayment}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-emerald-200 text-center">
                    <Label className="text-[10px] font-bold text-emerald-600 mb-1 block">PEŞİNAT</Label>
                    <div className="flex items-center justify-center gap-1">
                      <Input type="number" min="0" max="100" value={form.payment_down ?? ''} onChange={e => set('payment_down', e.target.value)} className="w-16 h-8 text-center font-bold border-0 bg-transparent focus-visible:ring-0 shadow-none text-lg p-0" />
                      <span className="text-lg font-bold text-gray-700">%</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100 text-center hover:border-emerald-200 transition-colors">
                    <Label className="text-[10px] font-bold text-gray-400 mb-1 block">İNŞAAT ALTI</Label>
                    <div className="flex items-center justify-center gap-1">
                      <Input type="number" min="0" max="100" value={form.payment_under_construction ?? ''} onChange={e => set('payment_under_construction', e.target.value)} className="w-16 h-8 text-center font-bold border-0 bg-transparent focus-visible:ring-0 shadow-none text-lg p-0 text-gray-500" />
                      <span className="text-lg font-bold text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100 text-center hover:border-emerald-200 transition-colors">
                    <Label className="text-[10px] font-bold text-gray-400 mb-1 block">TESLİMATTA</Label>
                    <div className="flex items-center justify-center gap-1">
                      <Input type="number" min="0" max="100" value={form.payment_delivery ?? ''} onChange={e => set('payment_delivery', e.target.value)} className="w-16 h-8 text-center font-bold border-0 bg-transparent focus-visible:ring-0 shadow-none text-lg p-0 text-gray-500" />
                      <span className="text-lg font-bold text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100 text-center hover:border-emerald-200 transition-colors">
                    <Label className="text-[10px] font-bold text-gray-400 mb-1 block">VADE</Label>
                    <div className="flex items-center justify-center gap-1">
                      <Input type="number" min="0" max="100" value={form.payment_installment ?? ''} onChange={e => set('payment_installment', e.target.value)} className="w-16 h-8 text-center font-bold border-0 bg-transparent focus-visible:ring-0 shadow-none text-lg p-0 text-gray-500" />
                      <span className="text-lg font-bold text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
                    <span>DAĞILIM İLERLEMESİ</span>
                    <span className={totalPayment !== 100 ? 'text-rose-500' : 'text-emerald-600'}>%{totalPayment} / %100</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.min(form.payment_down || 0, 100)}%` }}></div>
                    <div className="h-full bg-teal-400 transition-all duration-300" style={{ width: `${Math.min(form.payment_under_construction || 0, 100)}%` }}></div>
                    <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${Math.min(form.payment_delivery || 0, 100)}%` }}></div>
                    <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${Math.min(form.payment_installment || 0, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <div className="bg-[#0f172a] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-xs">
                  06
                </div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Fiyat ve Oda Detayları
                </h3>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-inner/5 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <Info className="w-3.5 h-3.5 text-cyan-500" />
                  <span>MÜLK DURUMU (İNŞAAT / HAZIR) <span className="text-rose-500">*</span></span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Rent', 'For Sale', 'Daily Rent'].map((status, index) => {
                    const isSelected = form.market_status === status;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => set('market_status', status)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-white border-cyan-500 text-cyan-600 shadow-xs ring-1 ring-cyan-500/10 font-bold'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 font-jakarta">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>Tanımlı Oda Tipleri <span className="text-slate-400 font-normal">({form.room_types?.length || 0})</span></span>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddRoomType}
                  className="h-8 rounded-lg border-cyan-500/20 text-cyan-600 font-semibold text-xs hover:bg-cyan-50/50 gap-1"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Yeni Ekle
                </Button>
              </div>

              {(form.room_types || []).map((room, index) => (
                <div key={index} className="bg-white border-2 border-teal-500/20 rounded-2xl p-4 space-y-4 relative">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="bg-cyan-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                        {index + 1}
                      </div>
                      <span className="text-xs font-bold text-slate-800 font-jakarta">
                        {room.bedrooms ? `${room.bedrooms}+${room.salon || 0}` : 'Tanımlı Oda Tipi'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {form.room_types.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRoomType(index)}
                          className="text-rose-500 hover:text-rose-700 text-xs h-7 px-2"
                        >
                          Sil
                        </Button>
                      )}
                      <ChevronUp className="w-4 h-4 text-slate-400 cursor-pointer" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Bed className="w-3.5 h-3.5 text-slate-300" /> YATAK ODASI
                        </Label>
                        <Input type="number" value={room.bedrooms || ''} onChange={e => setRoomValue(index, 'bedrooms', e.target.value)} className="h-10 bg-slate-50/40 border-slate-200 focus-visible:ring-cyan-500" />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Maximize2 className="w-3.5 h-3.5 text-slate-300" /> M² (NET)
                        </Label>
                        <Input type="number" value={room.size_sqm || ''} onChange={e => setRoomValue(index, 'size_sqm', e.target.value)} className="h-10 bg-slate-50/40 border-slate-200 focus-visible:ring-cyan-500" />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Bath className="w-3.5 h-3.5 text-slate-300" /> BANYO
                        </Label>
                        <Input type="number" value={room.bathrooms || ''} onChange={e => setRoomValue(index, 'bathrooms', e.target.value)} className="h-10 bg-slate-50/40 border-slate-200 focus-visible:ring-cyan-500" />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <DoorOpen className="w-3.5 h-3.5 text-slate-300" /> BALKON
                        </Label>
                        <Input type="number" value={room.balcony || ''} onChange={e => setRoomValue(index, 'balcony', e.target.value)} className="h-10 bg-slate-50/40 border-slate-200 focus-visible:ring-cyan-500" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Sofa className="w-3.5 h-3.5 text-slate-300" /> SALON
                        </Label>
                        <Input type="number" value={room.salon || ''} onChange={e => setRoomValue(index, 'salon', e.target.value)} className="h-10 bg-slate-50/40 border-slate-200 focus-visible:ring-cyan-500" />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-300" /> KAT
                        </Label>
                        <Input type="number" value={room.floor_number || ''} onChange={e => setRoomValue(index, 'floor_number', e.target.value)} className="h-10 bg-slate-50/40 border-slate-200 focus-visible:ring-cyan-500" />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Tag className="w-3.5 h-3.5 text-slate-300" /> ALT TİP
                        </Label>
                        <Select value={room.sub_type || ''} onValueChange={v => setRoomValue(index, 'sub_type', v)}>
                          <SelectTrigger className="h-10 bg-slate-50/40 border-slate-200 focus:ring-cyan-500 text-slate-700 text-xs">
                            <SelectValue placeholder="Seçiniz" />
                          </SelectTrigger>
                          <SelectContent>
                            {subTypeOptions.length > 0 ? (
                              subTypeOptions.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)
                            ) : (
                              <SelectItem value="none" disabled>Seçiniz</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Rocket className="w-3.5 h-3.5 text-slate-300" /> BOOST
                        </Label>
                        <Select value={room.boost || 'Default'} onValueChange={v => setRoomValue(index, 'boost', v)}>
                          <SelectTrigger className="h-10 bg-slate-50/40 border-slate-200 focus:ring-cyan-500 text-slate-700 text-xs">
                            <SelectValue placeholder="Default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Default">Default</SelectItem>
                            <SelectItem value="Premium">Premium</SelectItem>
                            <SelectItem value="Highlighted">Highlighted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-xl p-3.5 space-y-3 bg-slate-50/30">
                      <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <Wallet className="w-4 h-4 text-teal-500" /> FİYATLANDIRMA
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">FİYAT</Label>
                          <Input type="number" value={room.price || ''} onChange={e => setRoomValue(index, 'price', e.target.value)} className="h-10 bg-white border-slate-200 focus-visible:ring-cyan-500" />
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">PARA BİRİMİ</Label>
                          <Select value={room.currency || 'EUR'} onValueChange={v => setRoomValue(index, 'currency', v)}>
                            <SelectTrigger className="h-10 bg-white border-slate-200 focus:ring-cyan-500 text-slate-700 text-xs">
                              <SelectValue placeholder="EUR (€)" />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCIES.map(c => {
                                const symbol = c === 'EUR' ? '€' : c === 'USD' ? '$' : c === 'GBP' ? '£' : '₺';
                                return <SelectItem key={c} value={c}>{c} ({symbol})</SelectItem>
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">ESKİ FİYAT (OPSİYONEL)</Label>
                          <Input type="number" value={room.old_price || ''} onChange={e => setRoomValue(index, 'old_price', e.target.value)} placeholder="€" className="h-10 bg-white border-slate-200 focus-visible:ring-cyan-500 pr-4" />
                          <span className="text-[10px] text-slate-400 mt-1.5 block font-medium">*İndirim mevcutsa girebilirsiniz</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        % ACENTE KOMİSYONU
                      </div>
                      <div className="relative max-w-xs">
                        <Input type="number" value={room.commission || ''} onChange={e => setRoomValue(index, 'commission', e.target.value)} className="h-10 bg-slate-50/40 border-slate-200 focus-visible:ring-cyan-500 pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold select-none">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: ÖZELLİK SEÇİMİ */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b pb-2.5">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Durum &amp; Regülasyon Kriterleri</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Portföyün öne çıkan yasal ve coğrafi uygunluk durumlarını aktif edin</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                <div 
                  onClick={() => set('citizenship_eligible', !form.citizenship_eligible)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    form.citizenship_eligible 
                      ? 'bg-teal-50/40 border-teal-500 ring-1 ring-teal-500/20' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🇹🇷</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Vatandaşlık</span>
                      <span className="text-[10px] text-slate-400">Türk Vatandaşlığına Uygun</span>
                    </div>
                  </div>
                  <Switch checked={!!form.citizenship_eligible} onCheckedChange={v => set('citizenship_eligible', v)} onClick={(e) => e.stopPropagation()} />
                </div>

                <div 
                  onClick={() => set('residency_eligible', !form.residency_eligible)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    form.residency_eligible 
                      ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500/20' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🪪</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">İkamet İzni</span>
                      <span className="text-[10px] text-slate-400">Oturuma Uygun</span>
                    </div>
                  </div>
                  <Switch checked={!!form.residency_eligible} onCheckedChange={v => set('residency_eligible', v)} onClick={(e) => e.stopPropagation()} />
                </div>

                <div 
                  onClick={() => set('sea_view', !form.sea_view)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    form.sea_view 
                      ? 'bg-cyan-50/40 border-cyan-500 ring-1 ring-cyan-500/20' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🌊</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Deniz Manzarası</span>
                      <span className="text-[10px] text-slate-400">Görüş Açısı Mevcut</span>
                    </div>
                  </div>
                  <Switch checked={!!form.sea_view} onCheckedChange={v => set('sea_view', v)} onClick={(e) => e.stopPropagation()} />
                </div>

                <div 
                  onClick={() => set('seafront', !form.seafront)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    form.seafront 
                      ? 'bg-sky-50/40 border-sky-500 ring-1 ring-sky-500/20' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🏖️</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Denize Sıfır</span>
                      <span className="text-[10px] text-slate-400">İlk Sahil Şeridi</span>
                    </div>
                  </div>
                  <Switch checked={!!form.seafront} onCheckedChange={v => set('seafront', v)} onClick={(e) => e.stopPropagation()} />
                </div>

                <div 
                  onClick={() => set('featured', !form.featured)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    form.featured 
                      ? 'bg-amber-50/40 border-amber-500 ring-1 ring-amber-500/20' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">⭐</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Öne Çıkarılan</span>
                      <span className="text-[10px] text-slate-400">Vitrin İlanı Yap</span>
                    </div>
                  </div>
                  <Switch checked={!!form.featured} onCheckedChange={v => set('featured', v)} onClick={(e) => e.stopPropagation()} />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 space-y-5 shadow-2xs">
              <div className="flex items-center gap-2 border-b pb-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Sosyal Donatılar ve İlan Özellikleri</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">propertiesforsaleturkey.com filtre altyapısı için listeden detaylı seçim yapın</p>
                </div>
              </div>

              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Özellik ara... (Örn: Pool, Güvenlik, Kapalı Havuz)"
                  value={featureSearch}
                  onChange={e => setFeatureSearch(e.target.value)}
                  className="pl-10 h-10 bg-white border border-border shadow-xs rounded-xl focus-visible:ring-teal-500 font-medium text-xs text-foreground"
                />
              </div>

              {selectedFeaturesItems.length > 0 && (
                <div className="bg-emerald-50/20 border border-emerald-500/10 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Seçilen Özellikler ({selectedFeaturesItems.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {selectedFeaturesItems.map(feat => (
                      <div 
                        key={`selected-${feat.slug}`}
                        onClick={() => handleToggleFeature(feat.slug)}
                        className="flex items-center justify-between p-3 rounded-xl border border-emerald-500 bg-white ring-1 ring-emerald-500/10 transition-all cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{feat.emoji || feat.icon || '✨'}</span>
                          <span className="text-xs font-bold text-slate-800">{feat.name}</span>
                        </div>
                        <Switch checked={true} onCheckedChange={() => handleToggleFeature(feat.slug)} onClick={(e) => e.stopPropagation()} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-1">
                {filteredFeatures.length > 0 ? (
                  filteredFeatures.map(feat => {
                    const isSelected = form.features?.includes(feat.slug);
                    return (
                      <div 
                        key={feat.slug}
                        onClick={() => handleToggleFeature(feat.slug)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected 
                            ? 'bg-teal-50/40 border-teal-500 ring-1 ring-teal-500/20' 
                            : 'bg-white border-slate-100 hover:border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{feat.emoji || feat.icon || '✨'}</span>
                          <span className="text-xs font-bold text-slate-700">{feat.name}</span>
                        </div>
                        <Switch 
                          checked={!!isSelected} 
                          onCheckedChange={() => handleToggleFeature(feat.slug)} 
                          onClick={(e) => e.stopPropagation()} 
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-6 text-xs text-muted-foreground font-medium">
                    Aranan kriterlere uygun ilan özelliği bulunamadı.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DETAYLI İLAN METNİ */}
        {activeTab === 'desc' && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4 max-w-5xl mx-auto">
            <div>
              <h2 className="font-semibold font-jakarta text-foreground text-sm">Detaylı Gayrimenkul Tanıtım Metni</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Zengin metin editörünü kullanarak profesyonel HTML açıklama metni hazırlayın</p>
            </div>
            
            <div className="space-y-2">
              <Label>Vitrin İlan Başlığı</Label>
              <Input value={form.title || ''} onChange={e => set('title', e.target.value)} placeholder="Örn: Luxury 2+1 Penthouse Apartment in Alanya Center" />
            </div>

            <div className="pt-1">
              <Button 
                type="button"
                variant="outline"
                onClick={handleAutoGenerateDescription}
                className="w-full sm:w-auto gap-2 border-teal-500 text-teal-700 bg-teal-50/40 hover:bg-teal-50 font-bold text-xs py-5 rounded-xl transition-all shadow-2xs"
              >
                <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" />
                Form Verilerinden Açıklama Metni Üret (Dolu Alanları Al)
              </Button>
            </div>

            <div className="min-h-[400px] border rounded-lg overflow-hidden bg-white">
              <ReactQuill
                value={form.description || ''}
                onChange={val => set('description', val)}
                className="h-72"
                theme="snow"
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link', 'clean']
                  ]
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 4: SEO YAPILANDIRMA */}
        {activeTab === 'seo' && (
          <div className="bg-card rounded-xl border border-border p-6 max-w-5xl mx-auto">
            <SeoAutoFill
              title={form.title || form.project_name}
              description={form.description?.replace(/<[^>]*>/g, '').slice(0, 150)}
              city={form.city}
              type={form.type}
              price={form.price}
              currency={form.currency}
              form={form}
              onUpdate={(updates) => setForm(f => ({ ...f, ...updates }))}
            />
            
            <div className="border-t pt-5 mt-5 space-y-4">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">🖼️ İlan Ana Görsel Kaynağı</h3>
              <div>
                <Label className="text-xs">Ana Görsel URL (VTR Resim)</Label>
                <Input value={form.main_image || ''} onChange={e => set('main_image', e.target.value)} className="mt-1.5 font-mono text-xs" placeholder="https://propertiesforsaleturkey.com/images/..." />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alt Kaydetme Butonu */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSubmit} disabled={mutation.isPending} className="gap-2 gradient-primary text-white border-0 hover:opacity-90 px-8 h-11 rounded-xl shadow-md font-bold text-sm">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Kaydet ve Sihirbazı Kapat
        </Button>
      </div>
    </div>
  );
}