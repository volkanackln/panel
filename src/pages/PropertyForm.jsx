import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, MapPin, Save, Navigation, Plus, Trash2, Search, Crosshair, Layers, Radar, Copy, ArrowRight, Hash, CheckCircle2, AlertCircle, Zap, ChevronDown } from 'lucide-react';

// 🔧 PropertyForm2 sayfasının route'u. Projenizdeki gerçek route farklıysa
// SADECE bu satırı güncellemeniz yeterli — kodun başka hiçbir yerine dokunmanıza gerek yok.
const PROPERTY_FORM_2_PATH = (propertyId) => `/properties/step2/${propertyId}`;

const BASE_CATEGORIES = ['Denize', 'Merkeze', 'Havalimanı', 'AVM / Market'];

// ─── YARDIMCI FONKSİYONLAR VE FORMATLAYICILAR ──────────────────────────────────
const slugify = (text) => {
  if (!text) return '';
  return text.toString().toLowerCase().trim()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/i̇/g, 'i')
    .replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
};

const normalizeText = (text) => {
  if (!text) return '';
  return text.toString().toLowerCase()
    .replace(/i̇/g, 'i').replace(/ı/g, 'i')
    .replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ğ/g, 'g').trim();
};

const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) / 10) * 10;
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];

async function overpassFetch(query, timeoutMs = 20000) {
  for (const base of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${base}?data=${encodeURIComponent(query)}`, {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(tid);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.elements) return data;
    } catch (_) {}
  }
  return null;
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'PropertyLocationApp/1.0 (contact@example.com)',
  'Accept-Language': 'tr,en',
};

async function nominatimSearch(query, limit = 8) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1&accept-language=tr`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error('Nominatim hata');
  return res.json();
}

async function nominatimReverse(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=tr`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error('Nominatim reverse hata');
  return res.json();
}

async function osrmRoute(fromLng, fromLat, toLng, toLat, profile = 'driving') {
  const endpoints = [
    `https://router.project-osrm.org/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`,
    `https://routing.openstreetmap.de/routed-${profile === 'driving' ? 'car' : 'foot'}/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`,
  ];
  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) continue;
      const d = await res.json();
      if (d?.routes?.[0]) return Math.round(d.routes[0].distance);
    } catch (_) {}
  }
  return null;
}

function parseElements(elements, lat, lng) {
  return elements.map(el => {
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (!elLat || !elLon) return null;
    const distance = calculateHaversine(parseFloat(lat), parseFloat(lng), elLat, elLon);
    return { ...el, _lat: elLat, _lon: elLon, distance };
  }).filter(Boolean).sort((a, b) => a.distance - b.distance);
}

// ─── AKILLI YAZILABİLİR DROPDOWN BİLEŞENİ (COMBOBOX) ──────────────────────────
function SearchableSelect({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const wrapperRef = useRef(null);

  useEffect(() => { setSearch(value || ''); }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch(value || '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const filtered = options.filter(o => normalizeText(o).includes(normalizeText(search)));

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <input
        type="text"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setIsOpen(true);
          onChange(e.target.value); 
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-teal-500 pr-8 capitalize"
      />
      <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2 pointer-events-none" />
      {isOpen && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl max-h-48 overflow-y-auto z-[9999] p-1">
          {filtered.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange(opt);
                setSearch(opt);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-md transition-colors capitalize"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const defaultForm = {
  project_name: '',
  notes: '',
  lat: '',
  lng: '',
  country: 'Türkiye',
  country_visible: true,
  city: '',
  city_visible: true,
  district: '',
  district_visible: true,
  neighborhood: '',
  neighborhood_visible: true,
  distances: [],
  status: 'draft',
  translations: {},
  property_ref: '',
  selected_airport_name: '',
};

// ─── OTOMATİK TARAMA DURUMU ───────────────────────────────────────────────────
const AUTO_SCAN_STEPS = [
  { key: 'address',   label: 'Adres Çözümleniyor',       icon: '📍' },
  { key: 'airports',  label: 'Havalimanları Aranıyor',    icon: '✈️' },
  { key: 'sea',       label: 'Deniz Mesafesi Ölçülüyor', icon: '🌊' },
  { key: 'market',    label: 'AVM / Market Aranıyor',     icon: '🛍️' },
  { key: 'hospital',  label: 'Hastane Aranıyor',           icon: '🏥' },
  { key: 'transport', label: 'Ulaşım Hatları Taranıyor',  icon: '🚇' },
  { key: 'uni',       label: 'Üniversiteler Aranıyor',    icon: '🎓' },
];

// ─── LOKASYON VARLIK KONTROLÜ (MERKEZİ FONKSİYON) ───────────────────────────
// Şehir + İlçe eşleşmesi yeterliyse true döner (mahalle farklı olsa bile çakışma sayılır)
function locationExistsInList(locationsList, country, city, district) {
  const c_country = normalizeText(country || 'Türkiye');
  const c_city    = normalizeText(city);
  const c_district = normalizeText(district);

  return locationsList.some(l =>
    normalizeText(l.country || 'Türkiye') === c_country &&
    normalizeText(l.city_label || l.city) === c_city &&
    normalizeText(l.district || '')       === c_district
  );
}

export default function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  const draftLoaded = useRef(false);

  const { data: propertyData, isLoading: loadingProperty } = useQuery({
    queryKey: ['property', id],
    queryFn: () => base44.entities.Property.filter({ id }),
    enabled: !isNew,
  });

  const { data: refNoConfigs = [] } = useQuery({
    queryKey: ['ref-no-configs-for-form'],
    queryFn: () => base44.entities.SiteSettings.filter({ key: 'ref_no_config' }),
  });

  const { data: allProperties = [] } = useQuery({
    queryKey: ['all-properties-for-validation'],
    queryFn: () => base44.entities.Property.list(),
  });

  // 🎯 LOCATIONS VERİSİ
  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.filter({}),
  });

  const locationsRef = useRef(locations);
  useEffect(() => { locationsRef.current = locations; }, [locations]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const currentId = !isNew ? id : null;
      return currentId ? base44.entities.Property.update(currentId, data) : base44.entities.Property.create(data);
    },
    onSuccess: async (res) => {
      if (isNew) {
        localStorage.removeItem('property_draft_new');
        if ((form.city || form.district) && form.property_ref) {
          const cityTarget = normalizeText(form.city);
          const districtTarget = normalizeText(form.district);
          const matchedRule = refNoConfigs.find(c => normalizeText(c.label) === districtTarget) || refNoConfigs.find(c => normalizeText(c.label) === cityTarget);
          
          if (matchedRule?.value && form.property_ref.startsWith(matchedRule.value + '-')) {
            const numPart = parseInt(form.property_ref.replace(matchedRule.value + '-', ''), 10);
            if (!isNaN(numPart) && numPart >= (matchedRule.next_number || 1)) {
              await base44.entities.SiteSettings.update(matchedRule.id, { ...matchedRule, next_number: numPart + 1 });
              queryClient.invalidateQueries({ queryKey: ['ref-no-configs'] });
              queryClient.invalidateQueries({ queryKey: ['ref-no-configs-for-form'] });
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['all-properties-for-validation'] });
      toast.success('Tüm konum verileri veritabanına mühürlendi!');
      const savedId = res?.id || res?.[0]?.id || res?.data?.id || id;
      // ⚡ Kaydet ve Sonraki Adıma Geç: PropertyForm2'ye (2. adım) yönlendir
      if (savedId && savedId !== 'new') {
        navigate(PROPERTY_FORM_2_PATH(savedId));
      } else {
        navigate('/properties');
      }
    },
  });

  const [form, setForm] = useState(defaultForm);
  const [coordsInput, setCoordsInput] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  // 🎯 KONUM SEÇENEKLERİNİ FİLTRELEYEN MOTORLAR
  const availableCountries = Array.from(new Set(locations.map(l => l.country).filter(Boolean))).sort();

  const availableCities = Array.from(new Set(locations
    .filter(l => !form.country || normalizeText(l.country) === normalizeText(form.country))
    .map(l => l.city_label || l.city)
    .filter(Boolean)
  )).sort();

  const availableDistricts = Array.from(new Set(locations
    .filter(l =>
      (!form.country || normalizeText(l.country) === normalizeText(form.country)) &&
      (!form.city || normalizeText(l.city_label || l.city) === normalizeText(form.city))
    )
    .map(l => l.district)
    .filter(Boolean)
  )).sort();

  const availableNeighborhoods = Array.from(new Set(locations
    .filter(l =>
      (!form.country || normalizeText(l.country) === normalizeText(form.country)) &&
      (!form.city || normalizeText(l.city_label || l.city) === normalizeText(form.city)) &&
      (!form.district || normalizeText(l.district) === normalizeText(form.district))
    )
    .map(l => l.neighborhood)
    .filter(Boolean)
  )).sort();

  // ─── DRAFT YÜKLEME ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isNew && !draftLoaded.current) {
      const saved = localStorage.getItem('property_draft_new');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setForm(parsed);
          if (parsed.lat && parsed.lng) setCoordsInput(`${parsed.lat}, ${parsed.lng}`);
          toast.info('Taslağınız geri yüklendi! 🚀');
        } catch (_) {}
      }
      draftLoaded.current = true;
    }
  }, [isNew]);

  useEffect(() => {
    if (isNew && draftLoaded.current) {
      localStorage.setItem('property_draft_new', JSON.stringify(form));
    }
  }, [form, isNew]);

  useEffect(() => {
    if (propertyData?.[0]) {
      const data = propertyData[0];
      setForm({ ...defaultForm, ...data });
      if (data.lat && data.lng) setCoordsInput(`${data.lat}, ${data.lng}`);
    }
  }, [propertyData]);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [mapType, setMapType] = useState('satellite');
  const [isClickSelectActive, setIsClickSelectActive] = useState(false);
  const [targetCoordsInput, setTargetCoordsInput] = useState('');

  const [crowDistance, setCrowDistance] = useState(null);
  const [roadDistance, setRoadDistance] = useState(null);
  const [roadLoading, setRoadLoading] = useState(false);
  const [measuredDistance, setMeasuredDistance] = useState(null);
  const [selectedDistanceType, setSelectedDistanceType] = useState(null);

  const [autoScanActive, setAutoScanActive] = useState(false);
  const [autoScanSteps, setAutoScanSteps] = useState({}); 

  const [radarResults, setRadarResults] = useState([]);
  const [radarLoading, setRadarLoading] = useState(false);
  const [airportResults, setAirportResults] = useState([]);
  const [airportWalkDistances, setAirportWalkDistances] = useState({});
  const [seaDistance, setSeaDistance] = useState(null);
  const [marketResult, setMarketResult] = useState(null);
  const [hospitalResults, setHospitalResults] = useState([]);
  const [transportResults, setTransportResults] = useState([]);
  const [uniResults, setUniResults] = useState([]);

  const [compiledTextOutput, setCompiledTextOutput] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [addedLabels, setAddedLabels] = useState(new Set());

  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const mainMarkerRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const isClickSelectActiveRef = useRef(isClickSelectActive);
  useEffect(() => { isClickSelectActiveRef.current = isClickSelectActive; }, [isClickSelectActive]);
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  // ─── CANLI METİN GÜNCELLEME ───────────────────────────────────────────────────
  const formatMeters = (m) => isNaN(m) ? m : (Number(m) >= 1000 ? `${(Number(m) / 1000).toFixed(2)} km` : `${m} m`);

  useEffect(() => {
    let text = '';
    if (form.project_name) text += `🏗️ Proje Adı: ${form.project_name}\n`;
    if (form.custom_id) text += `🆔 Portföy No: ${form.custom_id}\n`;
    if (form.country) text += `📍 Konum Bilgisi: ${form.country.toUpperCase()}`;
    if (form.city) text += ` / ${form.city.toUpperCase()}`;
    if (form.district) text += ` / ${form.district}`;
    if (form.neighborhood) text += ` / ${form.neighborhood}\n`;
    if (form.lat && form.lng) text += `🌐 Coğrafi Koordinatlar -> enlem : ${form.lat} , boylam : ${form.lng}\n`;
    if (form.property_ref) text += `🆔 Referans No: ${form.property_ref}\n`;
    text += `\n🚗 Ulaşım Noktaları ve Önemli Mesafeler:\n`;
    BASE_CATEGORIES.forEach(cat => {
      const m = form.distances?.find(d => d.label === cat)?.meters;
      if (m) {
        if (cat === 'Havalimanı' && form.selected_airport_name) {
          text += `• ${form.selected_airport_name}: ${formatMeters(m)}\n`;
        } else {
          text += `• ${cat}: ${formatMeters(m)}\n`;
        }
      }
    });
    form.distances?.forEach(d => {
      if (!BASE_CATEGORIES.includes(d.label)) text += `• ${d.label}: ${formatMeters(d.meters)}\n`;
    });
    setCompiledTextOutput(text);
  }, [form.project_name, form.country, form.city, form.district, form.neighborhood, form.distances, form.lat, form.lng, form.property_ref, form.selected_airport_name, form.custom_id]);

  // ─── ARAMA ÖNERİLERİ ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapSearchQuery.trim()) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await nominatimSearch(mapSearchQuery);
        setSuggestions(data || []);
      } catch (_) {}
    }, 450);
    return () => clearTimeout(t);
  }, [mapSearchQuery]);

  // ─── LEAFLET YÜKLEME ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = Object.assign(document.createElement('link'), { id: 'leaflet-css', rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = Object.assign(document.createElement('script'), { id: 'leaflet-js', src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      script.onload = () => setLeafletLoaded(true);
      document.head.appendChild(script);
    } else { setLeafletLoaded(true); }
  }, []);

  // ─── HARİTA BAŞLATMA ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletLoaded || !window.L || !document.getElementById('interactive-map')) return;
    const L = window.L;
    const centerLat = parseFloat(form.lat) || 36.5429;
    const centerLng = parseFloat(form.lng) || 32.0375;

    if (!mapRef.current) {
      mapRef.current = L.map('interactive-map', { zoomControl: true }).setView([centerLat, centerLng], 14);
    }

    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = (mapType === 'satellite'
      ? L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { attribution: '© Google' })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })
    ).addTo(mapRef.current);

    if (!mainMarkerRef.current && form.lat && form.lng) {
      mainMarkerRef.current = L.marker([parseFloat(form.lat), parseFloat(form.lng)], {
        icon: L.divIcon({ html: `<div style="width:24px;height:24px;background:#0d9488;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🏠</div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 12] }),
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    map.off('click');
    map.on('click', async (e) => {
      if (!isClickSelectActiveRef.current) return;
      const { lat: clickedLat, lng: clickedLng } = e.latlng;
      setTargetCoordsInput(`${clickedLat.toFixed(6)}, ${clickedLng.toFixed(6)}`);

      if (!targetMarkerRef.current) {
        targetMarkerRef.current = L.marker([clickedLat, clickedLng], {
          icon: L.divIcon({ html: `<div style="width:20px;height:20px;background:#4f46e5;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🎯</div>`, className: '', iconSize: [20, 20], iconAnchor: [10, 10] }),
        }).addTo(map);
      } else { targetMarkerRef.current.setLatLng([clickedLat, clickedLng]); }

      const { lat: mLat, lng: mLng } = { lat: parseFloat(formRef.current.lat), lng: parseFloat(formRef.current.lng) };
      if (mLat && mLng) {
        const pts = [[mLat, mLng], [clickedLat, clickedLng]];
        if (!polylineRef.current) polylineRef.current = L.polyline(pts, { color: '#4f46e5', weight: 3, dashArray: '5,5' }).addTo(map);
        else polylineRef.current.setLatLngs(pts);

        const crow = calculateHaversine(mLat, mLng, clickedLat, clickedLng);
        setCrowDistance(crow); setSelectedDistanceType(null); setMeasuredDistance(null);
        setRoadLoading(true);
        const road = await osrmRoute(mLng, mLat, clickedLng.toFixed(6), clickedLat.toFixed(6));
        setRoadDistance(road);
        setRoadLoading(false);
      }
    });
  }, [leafletLoaded, mapType, form.lat, form.lng]);

  // ─── ⚡ OTOMATİK VERİTABANI İŞLEYİCİ (ADRES ÇÖZÜCÜ) ───────────────────────────
  // 🔧 DÜZELTME: Artık sadece Şehir+İlçe bazlı kontrol yapılıyor (mahalle farklı olsa
  //    da tekrar kayıt önleniyor). locationsRef yerine güncel snapshot alınıyor.
  const processAndSaveNominatimData = useCallback(async (addr) => {
    const country = (addr.country || 'Türkiye').trim();
    const cityClean = (addr.province || addr.city || addr.state || '').toLowerCase().replace(' ili', '').replace('büyükşehir belediyesi', '').trim();
    const districtClean = (addr.district || addr.city_district || addr.town || addr.borough || '').trim();
    let rawMahalle = addr.neighborhood || addr.neighbourhood || addr.quarter || addr.suburb || addr.village || '';
    if (rawMahalle === districtClean) rawMahalle = '';
    const neighborhoodClean = rawMahalle.trim().replace(/\s+(Mahallesi|mahallesi|Mah\.|mah\.|Mah|mah)$/i, '');

    const capitalize = s => s ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
    const finalCountry    = capitalize(country);
    const finalCity       = capitalize(cityClean);
    const finalDistrict   = capitalize(districtClean);
    const finalNeigh      = capitalize(neighborhoodClean);

    let autoRef = '';
    if (isNew) {
      const cityTarget     = normalizeText(finalCity);
      const districtTarget = normalizeText(finalDistrict);
      const matchedRule    = refNoConfigs.find(c => normalizeText(c.label) === districtTarget) || 
                             refNoConfigs.find(c => normalizeText(c.label) === cityTarget);
      
      if (matchedRule) {
        let num = matchedRule.next_number || 1;
        let ref = `${matchedRule.value}-${String(num).padStart(2, '0')}`;
        while (allProperties.some(p => p.property_ref === ref && p.id !== id)) {
          num++;
          ref = `${matchedRule.value}-${String(num).padStart(2, '0')}`;
        }
        autoRef = ref;
      }
    }

    setForm(prev => ({ 
      ...prev, 
      country:      finalCountry,
      city:         finalCity, 
      district:     finalDistrict, 
      neighborhood: finalNeigh,
      property_ref: (isNew && autoRef) ? autoRef : prev.property_ref
    }));

    // ─── 🔧 DÜZELTME: Şehir + İlçe bazlı kontrol (mahalle farklı olsa da kaydı engelle) ───
    if (!finalCity || !finalDistrict) return; // Şehir/ilçe yoksa kaydetme

    // locationsRef.current'taki güncel listeyi kullan
    const alreadyExists = locationExistsInList(
      locationsRef.current,
      finalCountry,
      finalCity,
      finalDistrict
    );

    if (!alreadyExists) {
      try {
        await base44.entities.Location.create({
          country:    finalCountry,
          city:       slugify(finalCity),
          city_label: finalCity,
          district:   finalDistrict,
          neighborhood: finalNeigh,
        });
        queryClient.invalidateQueries({ queryKey: ['locations'] });
        toast.success(`${finalDistrict} veritabanına otomatik eklendi!`);
      } catch (e) {
        // Sessizce geç — race condition'da başka istek zaten eklemiş olabilir
      }
    }
  }, [isNew, id, refNoConfigs, allProperties, queryClient]);

  // ─── ⚡ OTOMATİK TARAMA FONKSİYONU ───────────────────────────────────────────
  const runAutoScan = useCallback(async (lat, lng) => {
    if (!lat || !lng) return;
    const latF = parseFloat(lat);
    const lngF = parseFloat(lng);
    if (isNaN(latF) || isNaN(lngF)) return;

    setAutoScanActive(true);
    setAutoScanSteps({});
    setAirportResults([]);
    setAirportWalkDistances({});
    setSeaDistance(null);
    setMarketResult(null);
    setHospitalResults([]);
    setTransportResults([]);
    setUniResults([]);

    const setStep = (key, status) =>
      setAutoScanSteps(prev => ({ ...prev, [key]: status }));

    // 1. Adres çözümleme
    setStep('address', 'loading');
    try {
      const data = await nominatimReverse(lat, lng);
      if (data?.address) {
        await processAndSaveNominatimData(data.address);
      }
      setStep('address', 'done');
    } catch (_) { setStep('address', 'error'); }

    // 2. Havalimanları 
    setStep('airports', 'loading');
    try {
      const radiusSteps = [50000, 150000, 300000];
      let rawData = null;
      for (const radius of radiusSteps) {
        const query = `[out:json][timeout:25];(nwr["aeroway"="aerodrome"]["iata"](around:${radius},${lat},${lng});); out center;`;
        rawData = await overpassFetch(query, 15000);
        if (rawData?.elements?.length) break;
      }

      if (rawData?.elements?.length) {
        const parsed = parseElements(rawData.elements, lat, lng).map(el => ({
          id: el.tags?.iata || String(el.id),
          name: el.tags?.name || el.tags?.['name:tr'] || 'Sivil Havalimanı',
          iata: el.tags?.iata || '',
          distance: el.distance,
          _lat: el._lat,
          _lon: el._lon
        })).slice(0, 3);
        
        setAirportResults(parsed);

        const walkMap = {};
        await Promise.all(
          parsed.map(async ap => {
            const d = await osrmRoute(lngF, latF, ap._lon, ap._lat, 'driving');
            if (d) walkMap[ap.id] = d;
          })
        );
        setAirportWalkDistances(walkMap);
        setStep('airports', 'done');
      } else {
        setStep('airports', 'error');
      }
    } catch (_) { setStep('airports', 'error'); }

    // 3. Deniz / plaj mesafesi
    setStep('sea', 'loading');
    try {
      const radiusSteps = [5000, 15000, 45000, 100000, 250000];
      let found = null;
      for (const radius of radiusSteps) {
        const query = `[out:json][timeout:25];(nwr["natural"="beach"](around:${radius},${lat},${lng});nwr["leisure"="marina"](around:${radius},${lat},${lng});nwr["place"~"sea|ocean"](around:${radius},${lat},${lng});nwr["water"="sea"](around:${radius},${lat},${lng});); out center;`;
        const rawData = await overpassFetch(query, 15000);
        if (!rawData?.elements?.length) continue;
        let minDist = Infinity;
        for (const el of rawData.elements) {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (elLat && elLon) {
            const d = calculateHaversine(latF, lngF, elLat, elLon);
            if (d < minDist) minDist = d;
          }
        }
        if (minDist !== Infinity) { found = minDist; break; }
      }
      if (found !== null) setSeaDistance(found);
      setStep('sea', found !== null ? 'done' : 'error');
    } catch (_) { setStep('sea', 'error'); }

    // 4. AVM / Market
    setStep('market', 'loading');
    try {
      const query = `[out:json][timeout:25];(nwr["shop"~"mall|supermarket|wholesale|convenience"](around:20000,${lat},${lng});); out center;`;
      const rawData = await overpassFetch(query, 15000);
      if (rawData?.elements?.length) {
        const parsed = parseElements(rawData.elements, lat, lng).map(el => ({
          id: el.id,
          name: el.tags?.name || el.tags?.operator || el.tags?.brand || (el.tags?.shop === 'mall' ? 'Alışveriş Merkezi' : 'Süpermarket'),
          type: el.tags?.shop === 'mall' ? 'AVM' : 'Market',
          distance: el.distance,
        }));
        if (parsed[0]) setMarketResult(parsed[0]);
        setStep('market', 'done');
      } else { setStep('market', 'error'); }
    } catch (_) { setStep('market', 'error'); }

    // 5. Hastane
    setStep('hospital', 'loading');
    try {
      const query = `[out:json][timeout:25];(nwr["amenity"~"hospital|clinic"](around:30000,${lat},${lng});nwr["healthcare"="hospital"](around:30000,${lat},${lng});); out center;`;
      const rawData = await overpassFetch(query, 15000);
      if (rawData?.elements?.length) {
        const parsed = parseElements(rawData.elements, lat, lng).map(el => {
          const nameUpper = (el.tags?.name || 'Sağlık Kuruluşu').toUpperCase();
          const type = (nameUpper.includes('DEVLET') || nameUpper.includes('ŞEHİR')) ? 'Devlet Hastanesi' : 'Sağlık Kuruluşu / Klinik';
          return { id: el.id, name: el.tags?.name || 'İsimsiz Hastane', type, distance: el.distance };
        });
        setHospitalResults(parsed.slice(0, 3));
        setStep('hospital', 'done');
      } else { setStep('hospital', 'error'); }
    } catch (_) { setStep('hospital', 'error'); }

    // 6. Toplu taşıma
    setStep('transport', 'loading');
    try {
      const query = `[out:json][timeout:25];(nwr["railway"~"station|subway_entrance|tram_stop|halt"](around:10000,${lat},${lng});nwr["public_transport"~"station|stop_position|platform"](around:5000,${lat},${lng});nwr["highway"~"bus_stop"](around:3000,${lat},${lng});nwr["amenity"="bus_station"](around:10000,${lat},${lng});); out center;`;
      const rawData = await overpassFetch(query, 15000);
      if (rawData?.elements?.length) {
        const detectType = (tags, name) => {
          const n = (name || '').toUpperCase();
          if (n.includes('METRO') || tags.station === 'subway') return { label: '🚇 Metro', priority: 1 };
          if (n.includes('TRAMVAY') || tags.railway === 'tram_stop') return { label: '🚋 Tramvay', priority: 2 };
          if (tags.railway === 'station') return { label: '🚉 Tren İstasyonu', priority: 2 };
          if (tags.amenity === 'bus_station') return { label: '🚌 Otobüs Terminali', priority: 3 };
          return { label: '🚌 Otobüs Durağı', priority: 4 };
        };
        const parsed = parseElements(rawData.elements, lat, lng).map(el => {
          const tags = el.tags || {};
          const name = tags.name || tags['name:tr'] || tags.operator || 'Ulaşım İstasyonu';
          const { label, priority } = detectType(tags, name);
          return { id: el.id, name, type: label, priority, distance: el.distance };
        });
        const bestByType = {};
        parsed.forEach(item => {
          if (!bestByType[item.type] || item.distance < bestByType[item.type].distance) bestByType[item.type] = item;
        });
        setTransportResults(Object.values(bestByType).sort((a, b) => a.priority - b.priority || a.distance - b.distance).slice(0, 6));
        setStep('transport', 'done');
      } else { setStep('transport', 'error'); }
    } catch (_) { setStep('transport', 'error'); }

    // 7. Üniversite
    setStep('uni', 'loading');
    try {
      const query = `[out:json][timeout:25];(nwr["amenity"~"university|college"](around:25000,${lat},${lng});); out center;`;
      const rawData = await overpassFetch(query, 15000);
      if (rawData?.elements?.length) {
        const parsed = parseElements(rawData.elements, lat, lng).filter(el => el.tags?.name).map(el => ({ id: el.id, name: el.tags.name, type: 'Üniversite Yerleşkesi', distance: el.distance }));
        setUniResults(parsed.slice(0, 3));
        setStep('uni', 'done');
      } else { setStep('uni', 'error'); }
    } catch (_) { setStep('uni', 'error'); }

    setAutoScanActive(false);
    toast.success('🎯 Otomatik tarama tamamlandı! Tüm sonuçlar hazır.');
  }, [processAndSaveNominatimData]);

  // ─── ⚡ KOORDİNAT DEĞİŞTİĞİNDE OTOMATİK TARAMAYI BAŞLAT ──────────────────────
  const lastScannedCoord = useRef('');
  useEffect(() => {
    const coordKey = `${form.lat},${form.lng}`;
    if (form.lat && form.lng && coordKey !== lastScannedCoord.current) {
      lastScannedCoord.current = coordKey;
      const timer = setTimeout(() => {
        runAutoScan(form.lat, form.lng);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [form.lat, form.lng, runAutoScan]);

  useEffect(() => {
    if (!isNew) return; 
    if (!form.city && !form.district) return;

    const cityTarget = normalizeText(form.city);
    const districtTarget = normalizeText(form.district);
    const matchedRule = refNoConfigs.find(c => normalizeText(c.label) === districtTarget) || refNoConfigs.find(c => normalizeText(c.label) === cityTarget);

    if (matchedRule) {
      let num = matchedRule.next_number || 1;
      let ref = `${matchedRule.value}-${String(num).padStart(2, '0')}`;
      while (allProperties.some(p => p.property_ref === ref && p.id !== id)) {
        num++;
        ref = `${matchedRule.value}-${String(num).padStart(2, '0')}`;
      }

      const currentPrefix = form.property_ref?.split('-')[0];
      if (!form.property_ref || currentPrefix !== matchedRule.value) {
        setForm(p => ({ ...p, property_ref: ref }));
      }
    }
  }, [form.city, form.district, refNoConfigs, allProperties, isNew, id]);

  // ─── FORM HELPERs ─────────────────────────────────────────────────────────────
  const savedLabels = form.distances?.map(d => d.label) || [];
  const availableCategories = BASE_CATEGORIES.filter(cat => !savedLabels.includes(cat));
  const extraDistances = form.distances?.filter(d => !BASE_CATEGORIES.includes(d.label)) || [];

  function getDistanceMeters(label) {
    return form.distances?.find(d => d.label === label)?.meters ?? '';
  }
  function getDistanceVisibility(label) {
    const found = form.distances?.find(d => d.label === label);
    return found ? found.visible !== false : true;
  }
  function handleInputChangeValue(label, value) {
    setForm(prev => {
      const arr = [...(prev.distances || [])];
      const idx = arr.findIndex(d => d.label === label);
      if (idx > -1) {
        if (value === '') arr.splice(idx, 1);
        else arr[idx] = { ...arr[idx], meters: value };
      } else if (value !== '') {
        arr.push({ label, meters: value, visible: true });
      }
      return { ...prev, distances: arr };
    });
  }
  function toggleDistanceVisibility(index) {
    setForm(prev => {
      const arr = [...(prev.distances || [])];
      if (arr[index]) arr[index] = { ...arr[index], visible: !arr[index].visible };
      return { ...prev, distances: arr };
    });
  }
  function handleToggleVisibilityByLabel(label) {
    setForm(prev => {
      const arr = [...(prev.distances || [])];
      const idx = arr.findIndex(d => d.label === label);
      if (idx > -1) arr[idx] = { ...arr[idx], visible: !arr[idx].visible };
      else arr.push({ label, meters: '', visible: false });
      return { ...prev, distances: arr };
    });
  }

  function handleSaveAirportWithCustomName(airportName, distanceMeters) {
    setForm(prev => ({ ...prev, selected_airport_name: airportName }));
    handleSelectCategoryAndSave('Havalimanı', distanceMeters);
  }

  async function handleFindNearestAirports() {
    if (!form.lat || !form.lng) { toast.error('Önce koordinatları kilitleyin!'); return; }
    await runAutoScan(form.lat, form.lng);
  }

  async function handleGoToMainCoords() {
    if (!coordsInput.trim()) { toast.error('Lütfen koordinatları girin.'); return; }
    if (!/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(coordsInput)) { toast.error('Format hatalı! Örnek: 36.542, 32.037'); return; }
    const [latStr, lngStr] = coordsInput.split(',').map(s => s.trim());
    setForm(prev => ({ ...prev, lat: latStr, lng: lngStr }));

    setGeoLoading(true);
    try {
      const data = await nominatimReverse(latStr, lngStr);
      if (data?.address) {
        await processAndSaveNominatimData(data.address);
      }
    } catch (err) { toast.error("Adres çözümlenemedi."); }
    setGeoLoading(false);

    if (mapRef.current && leafletLoaded) {
      const L = window.L;
      mapRef.current.flyTo([parseFloat(latStr), parseFloat(lngStr)], 15, { animate: true, duration: 1.2 });
      if (!mainMarkerRef.current) {
        mainMarkerRef.current = L.marker([parseFloat(latStr), parseFloat(lngStr)], {
          icon: L.divIcon({ html: `<div style="width:24px;height:24px;background:#0d9488;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🏠</div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 12] }),
        }).addTo(mapRef.current);
      } else { mainMarkerRef.current.setLatLng([parseFloat(latStr), parseFloat(lngStr)]); }
    }
  }

  async function handleProcessLocationSelection(lat, lon) {
    if (!leafletLoaded || !mapRef.current) return;
    const targetLat = parseFloat(lat), targetLng = parseFloat(lon);
    mapRef.current.flyTo([targetLat, targetLng], 15, { animate: true, duration: 1.2 });
    setTargetCoordsInput(`${targetLat.toFixed(6)}, ${targetLng.toFixed(6)}`);
    const L = window.L;
    if (!targetMarkerRef.current) {
      targetMarkerRef.current = L.marker([targetLat, targetLng], {
        icon: L.divIcon({ html: `<div style="width:20px;height:20px;background:#4f46e5;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🎯</div>`, className: '', iconSize: [20, 20], iconAnchor: [10, 10] }),
      }).addTo(mapRef.current);
    } else { targetMarkerRef.current.setLatLng([targetLat, targetLng]); }

    const mLat = parseFloat(formRef.current.lat), mLng = parseFloat(formRef.current.lng);
    if (mLat && mLng) {
      const pts = [[mLat, mLng], [targetLat, targetLng]];
      if (!polylineRef.current) polylineRef.current = L.polyline(pts, { color: '#4f46e5', weight: 3, dashArray: '5,5' }).addTo(mapRef.current);
      else polylineRef.current.setLatLngs(pts);

      const crow = calculateHaversine(mLat, mLng, targetLat, targetLng);
      setCrowDistance(crow); setSelectedDistanceType(null); setMeasuredDistance(null);
      setRoadLoading(true);
      const road = await osrmRoute(mLng, mLat, targetLng, targetLat);
      setRoadDistance(road); setRoadLoading(false);
    }
    setSuggestions([]);
  }

  async function handleManualSearchClick() {
    if (!mapSearchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const data = await nominatimSearch(mapSearchQuery, 1);
      if (data?.length) await handleProcessLocationSelection(data[0].lat, data[0].lon);
      else toast.error('Konum bulunamadı. Farklı bir arama terimi deneyin.');
    } catch (_) { toast.error('Arama başarısız.'); }
    finally { setSearchLoading(false); }
  }

  function handleSelectCategoryAndSave(chosenLabel, customMeters = null) {
    const finalMeters = customMeters ?? measuredDistance;
    if (!finalMeters) { toast.error('Mesafe değeri bulunamadı!'); return; }
    handleInputChangeValue(chosenLabel, String(finalMeters));
    setAddedLabels(prev => new Set([...prev, chosenLabel]));
    setTargetCoordsInput(''); setMeasuredDistance(null); setCrowDistance(null); setRoadDistance(null);
    setSelectedDistanceType(null); setMapSearchQuery('');
    if (targetMarkerRef.current && mapRef.current) mapRef.current.removeLayer(targetMarkerRef.current);
    if (polylineRef.current && mapRef.current) mapRef.current.removeLayer(polylineRef.current);
    targetMarkerRef.current = null; polylineRef.current = null;
    toast.success(`"${chosenLabel}" mesafesi forma eklendi!`);
  }

  function handleAutoGenerateRefNo() {
    if (!form.city && !form.district) { toast.error('Önce mülk konumunu (Şehir/İlçe) belirleyin!'); return; }
    const cityTarget = normalizeText(form.city);
    const districtTarget = normalizeText(form.district);
    const matchedRule = refNoConfigs.find(c => normalizeText(c.label) === districtTarget) || refNoConfigs.find(c => normalizeText(c.label) === cityTarget);
    
    if (!matchedRule) { toast.error(`"${form.district || form.city}" için tanımlanmış Ref No kuralı bulunamadı.`); return; }
    let num = matchedRule.next_number || 1;
    let ref = `${matchedRule.value}-${String(num).padStart(2, '0')}`;
    while (allProperties.some(p => p.property_ref === ref && p.id !== id)) {
      num++;
      ref = `${matchedRule.value}-${String(num).padStart(2, '0')}`;
    }
    setForm(p => ({ ...p, property_ref: ref }));
    toast.success(`Referans numarası ${ref} oluşturuldu!`);
  }

  function cleanDistanceStringToMeters(str) {
    if (!str) return '';
    const val = str.toLowerCase().trim();
    if (val.includes('km')) return String(Math.round(parseFloat(val) * 1000));
    if (val.includes('m')) return String(Math.round(parseFloat(val)));
    return val;
  }

  function handleProcessJsonPasteStation() {
    try {
      if (!jsonInput.trim()) { toast.error('Önce JSON yapıştırın.'); return; }
      const payload = JSON.parse(jsonInput.trim());
      let incomingLat = form.lat, incomingLng = form.lng;
      let incomingCity = form.city, incomingDistrict = form.district, incomingNeighborhood = form.neighborhood;

      if (payload.sorgulanan_koordinat) {
        const [a, b] = payload.sorgulanan_koordinat.split(',');
        if (a && b) { incomingLat = a.trim(); incomingLng = b.trim(); }
      }
      if (payload.tahmini_bolge) {
        const parts = payload.tahmini_bolge.split(',');
        if (parts.length === 3) {
          incomingNeighborhood = parts[0].replace(/\s*(mahallesi|mah\.|mah)\s*/gi, '').trim();
          incomingDistrict = parts[1].trim();
          incomingCity = parts[2].toLowerCase().replace(' ili', '').replace('büyükşehir belediyesi', '').trim();
        }
      }

      const collected = [];
      const push = (label, mesafe) => collected.push({ label, meters: cleanDistanceStringToMeters(mesafe), visible: true });

      (payload.tarihi_ve_kulturel_yerler || []).forEach(item => item.isim && push(`🏛️ Tarihi - ${item.isim}`, item.mesafe));
      (payload.ulasim?.otobus_duraklari || []).forEach(item => item.durak_adi && push(`🚌 Otobüs - ${item.durak_adi}`, item.mesafe));
      (payload.ulasim?.rayli_sistemler || []).forEach(item => {
        const tip = item.tip || 'Raylı Sistem';
        const icon = tip.toLowerCase().includes('tramvay') ? '🚋' : '🚇';
        const name = item.durak_adi || item.isim;
        if (name) push(`${icon} ${tip} - ${name}`, item.mesafe);
      });
      (payload.onemli_yerler_ve_avmler || []).forEach(item => {
        if (!item.isim) return;
        const prefix = item.kategori?.toLowerCase().includes('hastane') ? '🏥 Hastane - ' : '';
        push(`${prefix}${item.isim}`, item.mesafe);
      });

      const capitalize = s => s ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
      const finalCity     = capitalize(incomingCity);
      const finalDistrict = capitalize(incomingDistrict);
      const finalNeigh    = capitalize(incomingNeighborhood);

      // ─── 🔧 DÜZELTME: JSON paste'de de Şehir+İlçe bazlı kontrol ───
      const alreadyExists = locationExistsInList(
        locationsRef.current,
        'Türkiye',
        finalCity,
        finalDistrict
      );

      if (!alreadyExists && finalCity && finalDistrict) {
        base44.entities.Location.create({
          country:      'Türkiye',
          city:         slugify(finalCity),
          city_label:   finalCity,
          district:     finalDistrict,
          neighborhood: finalNeigh,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['locations'] });
        }).catch(() => {});
      }

      setForm(prev => {
        const arr = [...(prev.distances || [])];
        collected.forEach(inc => {
          const idx = arr.findIndex(d => d.label === inc.label);
          if (idx > -1) arr[idx] = { ...arr[idx], meters: inc.meters };
          else arr.push(inc);
          const ll = inc.label.toLowerCase();
          if ((ll.includes('avm') || ll.includes('migros') || ll.includes('market') || ll.includes('a101')) && !arr.find(d => d.label === 'AVM / Market')) arr.push({ label: 'AVM / Market', meters: inc.meters, visible: true });
          if (ll.includes('merkez') && !arr.find(d => d.label === 'Merkeze')) arr.push({ label: 'Merkeze', meters: inc.meters, visible: true });
          if (ll.includes('havalimanı') && !arr.find(d => d.label === 'Havalimanı')) arr.push({ label: 'Havalimanı', meters: inc.meters, visible: true });
          if ((ll.includes('deniz') || ll.includes('sahil') || ll.includes('plaj')) && !arr.find(d => d.label === 'Denize')) arr.push({ label: 'Denize', meters: inc.meters, visible: true });
        });

        return { ...prev, lat: String(incomingLat), lng: String(incomingLng), city: finalCity, district: finalDistrict, neighborhood: finalNeigh, distances: arr };
      });
      setCoordsInput(`${incomingLat}, ${incomingLng}`);
      setJsonInput('');
      toast.success('JSON raporu başarıyla forma aktarıldı!');
    } catch (_) { toast.error('JSON biçimi hatalı! Lütfen kontrol edin.'); }
  }

  function handleSaveAndNext() {
    if (!form.project_name?.trim()) { toast.error('Proje adı zorunludur!'); return; }
    if (!form.property_ref?.trim()) { toast.error('Referans numarası zorunludur!'); return; }
    if (allProperties.some(p => p.property_ref === form.property_ref && p.id !== id)) {
      toast.error('Bu referans numarası zaten kullanılıyor!'); return;
    }
    mutation.mutate(form);
  }

  function handleCopyToClipboardStation() {
    if (!compiledTextOutput.trim()) { toast.error('Kopyalanacak metin bulunamadı.'); return; }
    navigator.clipboard.writeText(compiledTextOutput);
    toast.success('Konum ve mesafe bilgileri panoya kopyalandı!');
  }

  if (!isNew && loadingProperty) return (
    <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
  );

  const AutoScanPanel = () => {
    if (!autoScanActive && Object.keys(autoScanSteps).length === 0) return null;
    const allDone = !autoScanActive && Object.keys(autoScanSteps).length > 0;

    return (
      <div className={`rounded-2xl border p-4 space-y-3 transition-all ${allDone ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'}`}>
        <div className="flex items-center gap-2">
          {autoScanActive
            ? <Zap className="w-4 h-4 text-indigo-600 animate-pulse" />
            : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          <span className={`text-xs font-black uppercase tracking-wider ${autoScanActive ? 'text-indigo-700' : 'text-emerald-700'}`}>
            {autoScanActive ? '⚡ Otomatik Tarama Çalışıyor...' : '✅ Tarama Tamamlandı'}
          </span>
          {autoScanActive && (
            <span className="ml-auto text-[10px] text-indigo-500 font-bold">
              {Object.values(autoScanSteps).filter(s => s === 'done').length} / {AUTO_SCAN_STEPS.length}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {AUTO_SCAN_STEPS.map(step => {
            const status = autoScanSteps[step.key];
            return (
              <div key={step.key} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                status === 'loading' ? 'bg-indigo-100 text-indigo-700' :
                status === 'done'    ? 'bg-white text-emerald-700 border border-emerald-200' :
                status === 'error'   ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                'bg-white/60 text-gray-400'
              }`}>
                {status === 'loading' ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" /> :
                 status === 'done'    ? <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-600" /> :
                 status === 'error'   ? <AlertCircle className="w-3 h-3 flex-shrink-0 text-rose-500" /> :
                 <span className="w-3 h-3 flex-shrink-0 text-center">{step.icon}</span>}
                <span className="truncate">{step.label}</span>
              </div>
            );
          })}
        </div>
        {allDone && (
          <button
            type="button"
            onClick={() => runAutoScan(form.lat, form.lng)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black py-2 rounded-xl flex items-center justify-center gap-1.5"
          >
            🔄 Yeniden Tara
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start select-none">

      {/* SOL TARAF */}
      <div className="lg:col-span-5 space-y-5">

        {/* BAŞLIK */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 text-xs font-black">01</div>
            <div>
              <h1 className="text-xs font-black text-gray-800 uppercase tracking-tight">Lokasyon & Mesafe İstasyonu</h1>
              <p className="text-[10px] text-gray-400">Koordinat gir → Tüm sorgular otomatik başlar.</p>
            </div>
          </div>
          {autoScanActive && (
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-xl">
              <Zap className="w-3 h-3 text-indigo-600 animate-pulse" />
              <span className="text-[10px] font-black text-indigo-700">Taranıyor</span>
            </div>
          )}
        </div>

        {/* PROJE ADI & NOT */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">🏗️ Proje Adı <span className="text-rose-500">*</span></label>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-teal-500 transition-all">
              <input type="text" value={form.project_name || ''} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} placeholder="Örn: Marina Residence, Akdeniz Villaları..." className="w-full bg-transparent border-0 p-0 text-xs font-bold text-gray-800 placeholder-gray-300 focus:ring-0 outline-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-gray-500 tracking-wider flex items-center gap-1.5">📝 Not</label>
            <textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Bu ilana özel hatırlatmalar..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 placeholder-gray-300 focus:bg-white focus:outline-none focus:border-teal-500 transition-all resize-none leading-relaxed" />
          </div>
        </div>

        {/* KOORDİNAT & REF NO */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-teal-600" /> Mülk Ana Koordinatları
              <span className="ml-auto text-[9px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-black">⚡ Otomatik Tarama Aktif</span>
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 focus-within:bg-white focus-within:border-teal-500 flex gap-2">
              <input
                type="text"
                value={coordsInput}
                onChange={e => setCoordsInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGoToMainCoords()}
                placeholder="Örn: 36.542849, 32.037513"
                className="w-full bg-transparent border-0 p-0 text-xs font-mono font-bold text-gray-800 placeholder-gray-300 focus:ring-0 outline-none"
              />
              {geoLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-teal-600 flex-shrink-0" />
                : <button type="button" onClick={handleGoToMainCoords} className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0">
                    <Navigation className="w-3 h-3 rotate-45" /> Kilitle & Tara
                  </button>}
            </div>
            <p className="text-[10px] text-teal-600 font-semibold">
              💡 Koordinat girip "Kilitle &amp; Tara"ya bastığında veya Enter'a basınca tüm sorgular otomatik başlar.
            </p>
          </div>

          {/* OTOMATİK TARAMA DURUM PANELİ */}
          <AutoScanPanel />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">🆔 Referans Numarası <span className="text-rose-500">*</span></label>
              <button type="button" onClick={handleAutoGenerateRefNo} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all flex items-center gap-1">🔄 Otomatik Üret</button>
            </div>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-teal-500 transition-all">
              <input type="text" value={form.property_ref || ''} onChange={e => setForm(p => ({ ...p, property_ref: e.target.value }))} placeholder="Kural eşleşmesi için butona basın veya elle girin" className="w-full bg-transparent border-0 p-0 text-xs font-mono font-bold text-gray-800 placeholder-gray-300 focus:ring-0 outline-none" />
            </div>
          </div>

          {/* SORGU SONUÇLARI PANELLERİ */}
          {form.lat && form.lng && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">📊 Tarama Sonuçları</p>
                <button
                  type="button"
                  onClick={() => runAutoScan(form.lat, form.lng)}
                  disabled={autoScanActive}
                  className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50"
                >
                  {autoScanActive ? <Loader2 className="w-3 h-3 animate-spin" /> : '🔄'} Yenile
                </button>
              </div>

              {airportResults.map(r => (
                <div key={r.id} className="text-[10px] bg-sky-50 border border-sky-100 p-2 rounded-lg flex justify-between items-center gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sky-800 truncate">✈️ {r.name} {r.iata ? `(${r.iata})` : ''}</span>
                    <span className="text-[9px] text-sky-600">
                      {formatMeters(r.distance)} kuş uçuşu
                      {airportWalkDistances[r.id] ? ` • ${formatMeters(airportWalkDistances[r.id])} sürüş` : ' • Rota hesaplanıyor...'}
                    </span>
                  </div>
                  {addedLabels.has('Havalimanı') && form.selected_airport_name === r.name
                    ? <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded flex-shrink-0">✅ Eklendi</span>
                    : <button type="button" onClick={() => handleSaveAirportWithCustomName(r.name, airportWalkDistances[r.id] ?? r.distance)} className="bg-sky-600 text-white px-2 py-1 rounded font-bold flex-shrink-0">+ Forma Ekle</button>}
                </div>
              ))}

              {seaDistance !== null && (
                <div className="text-[10px] bg-cyan-50 border border-cyan-100 p-2 rounded-lg flex justify-between items-center">
                  <span className="font-bold text-cyan-800">🌊 Plaj / Kıyı Hattı ({formatMeters(seaDistance)})</span>
                  {addedLabels.has('Denize')
                    ? <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded">✅ Eklendi</span>
                    : <button type="button" onClick={() => handleSelectCategoryAndSave('Denize', seaDistance)} className="bg-cyan-600 text-white px-2 py-1 rounded font-bold">+ Forma Ekle</button>}
                </div>
              )}

              {marketResult && (
                <div className="text-[10px] bg-emerald-50 border border-emerald-100 p-2 rounded-lg flex justify-between items-center">
                  <span className="font-bold text-emerald-800">🛍️ En Yakın {marketResult.type}: {marketResult.name} ({formatMeters(marketResult.distance)})</span>
                  {addedLabels.has('AVM / Market')
                    ? <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded">✅ Eklendi</span>
                    : <button type="button" onClick={() => handleSelectCategoryAndSave('AVM / Market', marketResult.distance)} className="bg-emerald-600 text-white px-2 py-1 rounded font-bold">+ Forma Ekle</button>}
                </div>
              )}

              {hospitalResults.map(r => (
                <div key={r.id} className="text-[10px] bg-rose-50 border border-rose-100 p-2 rounded-lg flex justify-between items-center">
                  <span className="font-bold text-rose-800">🏥 {r.name} — {r.type} ({formatMeters(r.distance)})</span>
                  {addedLabels.has(r.name)
                    ? <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded">✅ Eklendi</span>
                    : <button type="button" onClick={() => handleSelectCategoryAndSave(r.name, r.distance)} className="bg-rose-600 text-white px-2 py-1 rounded font-bold flex-shrink-0">+ Forma Ekle</button>}
                </div>
              ))}

              {transportResults.map(r => (
                <div key={r.id} className="text-[10px] bg-fuchsia-50 border border-fuchsia-100 p-2 rounded-lg flex justify-between items-center gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-fuchsia-800 truncate">{r.type} — {r.name}</span>
                    <span className="text-[9px] text-fuchsia-500">{formatMeters(r.distance)} uzaklıkta</span>
                  </div>
                  <button type="button" onClick={() => handleSelectCategoryAndSave(`${r.type} - ${r.name}`, r.distance)} className="bg-fuchsia-600 text-white px-2 py-1 rounded font-bold flex-shrink-0">+ Forma Ekle</button>
                </div>
              ))}

              {uniResults.map(r => (
                <div key={r.id} className="text-[10px] bg-indigo-50 border border-indigo-100 p-2 rounded-lg flex justify-between items-center">
                  <span className="font-bold text-indigo-800">🎓 {r.name} ({formatMeters(r.distance)})</span>
                  <button type="button" onClick={() => handleSelectCategoryAndSave(r.name, r.distance)} className="bg-indigo-600 text-white px-2 py-1 rounded font-bold flex-shrink-0">+ Forma Ekle</button>
                </div>
              ))}
            </div>
          )}

          {/* ANA MESAFE KARTLARI */}
          <div className="pt-3 border-t border-gray-100 space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">📌 Ana Kurumsal Mesafe Kartları</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Denize', icon: '🏖️', name: 'Denize Uzaklık' },
                { label: 'Merkeze', icon: '🏙️', name: 'Şehir Merkezi' },
                { label: 'Havalimanı', icon: '✈️', name: 'Havalimanı' },
                { label: 'AVM / Market', icon: '🛒', name: 'AVM / Market' },
              ].map(({ label, icon, name }) => (
                <div key={label} className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">{icon} {name}</label>
                  <div className="flex items-center bg-slate-50 border border-gray-200 rounded-xl px-2.5 py-2 focus-within:bg-white focus-within:border-teal-500">
                    <input type="text" value={getDistanceMeters(label)} onChange={e => handleInputChangeValue(label, e.target.value)} placeholder="m cinsinden" className="w-full bg-transparent border-0 p-0 text-xs font-bold text-gray-800 focus:ring-0 outline-none" />
                    <button type="button" onClick={() => handleToggleVisibilityByLabel(label)} className="ml-1">
                      {getDistanceVisibility(label) ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-rose-500" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ÜLKE / ŞEHİR / İLÇE / MAHALLE */}
          <div className="space-y-2.5 pt-2 border-t border-gray-100">
            {/* ÜLKE */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100/70">
              <span className="text-[11px] font-bold text-gray-500 w-16 pl-1">ÜLKE</span>
              <SearchableSelect
                value={form.country}
                onChange={val => setForm(p => ({ ...p, country: val, city: '', district: '', neighborhood: '' }))}
                options={availableCountries}
                placeholder="Ülke seçin veya yazın..."
              />
              <button type="button" onClick={() => setForm(p => ({ ...p, country_visible: !p.country_visible }))} className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex-shrink-0 ${form.country_visible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>{form.country_visible ? 'Göster' : 'Gizle'}</button>
            </div>

            {/* ŞEHİR */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100/70">
              <span className="text-[11px] font-bold text-gray-500 w-16 pl-1">ŞEHİR</span>
              <SearchableSelect
                value={form.city}
                onChange={val => setForm(p => ({ ...p, city: val, district: '', neighborhood: '' }))}
                options={availableCities}
                placeholder="Şehir seçin veya yazın..."
              />
              <button type="button" onClick={() => setForm(p => ({ ...p, city_visible: !p.city_visible }))} className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex-shrink-0 ${form.city_visible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>{form.city_visible ? 'Göster' : 'Gizle'}</button>
            </div>

            {/* İLÇE */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100/70">
              <span className="text-[11px] font-bold text-gray-500 w-16 pl-1">İLÇE</span>
              <SearchableSelect
                value={form.district}
                onChange={val => setForm(p => ({ ...p, district: val, neighborhood: '' }))}
                options={availableDistricts}
                placeholder="İlçe seçin veya yazın..."
              />
              <button type="button" onClick={() => setForm(p => ({ ...p, district_visible: !p.district_visible }))} className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex-shrink-0 ${form.district_visible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>{form.district_visible ? 'Göster' : 'Gizle'}</button>
            </div>

            {/* MAHALLE */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100/70">
              <span className="text-[11px] font-bold text-gray-500 w-16 pl-1">MAHALLE</span>
              <SearchableSelect
                value={form.neighborhood}
                onChange={val => setForm(p => ({ ...p, neighborhood: val }))}
                options={availableNeighborhoods}
                placeholder="Mahalle seçin veya yazın..."
              />
              <button type="button" onClick={() => setForm(p => ({ ...p, neighborhood_visible: !p.neighborhood_visible }))} className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex-shrink-0 ${form.neighborhood_visible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>{form.neighborhood_visible ? 'Göster' : 'Gizle'}</button>
            </div>
          </div>
        </div>

        {/* EKSTRA KONUMLAR */}
        {extraDistances.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">🌟 İlana Bağlanan Ekstra Konumlar</h4>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {extraDistances.map((item, idx) => (
                <div key={idx} className={`flex items-center justify-between border rounded-xl p-2.5 transition-all ${item.visible ? 'bg-white border-teal-100' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
                  <div className="flex flex-col max-w-[50%]">
                    <span className="truncate text-[11px] font-black text-gray-800" title={item.label}>📍 {item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono font-bold text-teal-600 w-16 text-right">{formatMeters(item.meters)}</span>
                    <button type="button" onClick={() => { const fullIdx = form.distances.findIndex(d => d.label === item.label); if (fullIdx > -1) toggleDistanceVisibility(fullIdx); }} className={`text-[9px] font-black px-2 py-1 rounded flex items-center gap-1 border transition-colors ${item.visible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {item.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button type="button" onClick={() => setForm(p => ({ ...p, distances: p.distances.filter(d => d.label !== item.label) }))} className="text-gray-400 hover:text-rose-500 transition-colors p-1" title="Sil">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SAĞ TARAF */}
      <div className="lg:col-span-7 space-y-4 sticky top-6">

        {/* HARİTA */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="relative">
            <div className="flex gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5 focus-within:border-teal-500 focus-within:bg-white shadow-sm">
              <input type="text" value={mapSearchQuery} onChange={e => setMapSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManualSearchClick()} placeholder="Harita üzerinde konum arayın..." className="w-full bg-transparent border-0 px-2 py-1 text-xs font-bold text-gray-700 focus:ring-0 outline-none" />
              <button type="button" onClick={() => setMapType(mapType === 'satellite' ? 'standard' : 'satellite')} className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[10px] font-black ${mapType === 'satellite' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-200'}`} title="Katman Değiştir">
                <Layers className="w-3.5 h-3.5" />{mapType === 'satellite' ? 'Uydu' : 'Standart'}
              </button>
              <button type="button" onClick={handleManualSearchClick} disabled={searchLoading} className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg flex items-center gap-1 transition-all flex-shrink-0">
                {searchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Bul
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto z-[9999] p-1 divide-y divide-gray-50">
                {suggestions.map((item, idx) => (
                  <button key={idx} type="button" onClick={() => handleProcessLocationSelection(item.lat, item.lon)} className="w-full text-left px-3 py-2.5 text-[11px] font-bold text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors rounded-lg flex items-center gap-2 truncate">
                    <span className="text-gray-400 flex-shrink-0">📍</span>
                    <span className="truncate">{item.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div id="interactive-map" className="rounded-xl border border-gray-200 shadow-inner h-[530px] w-full z-10" style={{ minHeight: '530px' }} />
        </div>

        {/* MANUEL HARİTA KONSOLU */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-indigo-600" /> Manuel Harita Konsolu
            </h3>
            <button type="button" onClick={() => setIsClickSelectActive(!isClickSelectActive)} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${isClickSelectActive ? 'bg-indigo-600 text-white border-indigo-600 animate-pulse' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>
              <Crosshair className="w-3 h-3" />{isClickSelectActive ? 'Seçim Açık' : 'Haritadan Seç'}
            </button>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs font-bold text-slate-600">
            🛰️ Hedef: {targetCoordsInput || <span className="text-gray-400 font-normal">Haritaya tıkla veya arama yap...</span>}
          </div>
          {crowDistance !== null && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className={`text-xs font-bold ${selectedDistanceType === 'road' ? 'line-through text-gray-300' : 'text-slate-700'}`}>
                  📏 Kuş Uçuşu: <span className="font-mono text-teal-600 bg-teal-50/50 px-1.5 py-0.5 rounded ml-1">{crowDistance} m</span>
                </span>
                {selectedDistanceType === null && (
                  <button type="button" onClick={() => { setSelectedDistanceType('crow'); setMeasuredDistance(crowDistance); }} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-3 py-1 rounded-md">Kullan</button>
                )}
              </div>
              <div className="flex items-center justify-between py-1">
                <span className={`text-xs font-bold ${selectedDistanceType === 'crow' ? 'line-through text-gray-300' : 'text-slate-700'}`}>
                  🚗 En Kısa Yol: {roadLoading
                    ? <span className="text-[11px] text-gray-400 italic">Hesaplanıyor...</span>
                    : <span className="font-mono text-indigo-600 bg-indigo-50/50 px-1.5 py-0.5 rounded ml-1">{roadDistance ? `${roadDistance} m` : 'Bulunamadı'}</span>}
                </span>
                {selectedDistanceType === null && !roadLoading && roadDistance && (
                  <button type="button" onClick={() => { setSelectedDistanceType('road'); setMeasuredDistance(roadDistance); }} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-3 py-1 rounded-md">Kullan</button>
                )}
              </div>
              {measuredDistance !== null && (
                <>
                  <div className="pt-2 border-t border-dashed border-gray-200">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">✍️ Seçilen Mesafeyi Düzenle</label>
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus-within:border-teal-500 focus-within:bg-white transition-all">
                      <input type="number" value={measuredDistance ?? ''} onChange={e => setMeasuredDistance(e.target.value === '' ? null : Number(e.target.value))} className="w-full bg-transparent border-0 p-0 text-xs font-bold text-gray-800 focus:ring-0 outline-none" />
                      <span className="text-xs text-gray-400 font-bold ml-1">m</span>
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-gray-100 space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">🏷️ Hangi Kategoriye Atansın?</label>
                    {availableCategories.length > 0
                      ? <div className="flex flex-wrap gap-2">{availableCategories.map(cat => <button key={cat} type="button" onClick={() => handleSelectCategoryAndSave(cat)} className="bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200">{cat}</button>)}</div>
                      : <p className="text-[11px] text-amber-600 font-semibold italic">Tüm ana kategoriler dolduruldu!</p>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* CANLI METİN */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-inner">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">✍️ Portföy İlan Metni</label>
            <button type="button" onClick={handleCopyToClipboardStation} className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 active:scale-95">
              <Copy className="w-3.5 h-3.5" /> Kopyala
            </button>
          </div>
          <textarea value={compiledTextOutput} onChange={e => setCompiledTextOutput(e.target.value)} rows={6} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-500 transition-all font-mono leading-relaxed resize-y" placeholder="Konum ekledikçe burası otomatik dolar..." />
        </div>

        {/* JSON ENTEGRASYONU */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider">⚡ Yapay Zeka (JSON) Veri Entegrasyonu</h3>
            <a href="https://gemini.google.com/gem/1gJI0wTld-4eE1YwW064Hod3IeewO-son?usp=sharing" target="_blank" rel="noopener noreferrer" className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1">🤖 Gemini Gem Analiz Odası</a>
          </div>
          <p className="text-[10px] text-gray-400 leading-normal">Gemini veya başka bir AI'dan aldığınız JSON çıktısını yapıştırarak formu otomatik doldurun.</p>
          <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-mono text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all leading-relaxed" placeholder='{ "sorgulanan_koordinat": "...", "tahmini_bolge": "...", "onemli_yerler_ve_avmler": [...] }' />
          <button type="button" onClick={handleProcessJsonPasteStation} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-98">📥 JSON Çıktısını Çözümle ve Forma Aktar</button>
        </div>

        {/* KAYDET */}
        <div className="pt-1 flex justify-end">
          <button type="button" onClick={handleSaveAndNext} disabled={mutation.isPending} className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl flex items-center gap-1.5">
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Kaydet ve Sonraki Adıma Geç <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}