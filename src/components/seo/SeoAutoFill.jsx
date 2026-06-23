import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, Globe, ChevronDown, ChevronUp } from 'lucide-react';

function SerpPreview({ title, description, slug, baseUrl = 'https://propertiesforsaleturkey.com' }) {
  const displayTitle = title || 'Sayfa Başlığı';
  const displayDesc = description || 'Sayfa açıklaması burada görünecek...';
  const displayUrl = slug ? `${baseUrl}/${slug}` : baseUrl;
  const titleLen = title?.length || 0;
  const descLen = description?.length || 0;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Google SERP Önizlemesi</span>
      </div>

      {/* SERP card */}
      <div className="max-w-[600px] font-sans">
        {/* URL breadcrumb */}
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
            <Globe className="w-3 h-3 text-muted-foreground" />
          </div>
          <span className="text-xs text-[#202124]">{baseUrl.replace('https://', '')}</span>
          <span className="text-xs text-[#202124]">›</span>
          <span className="text-xs text-[#202124] truncate">{slug || 'sayfa-url'}</span>
        </div>

        {/* Title */}
        <h3 className={`text-[#1a0dab] text-xl leading-snug hover:underline cursor-pointer line-clamp-1 ${titleLen > 60 ? 'text-orange-600' : ''}`}>
          {displayTitle.length > 60 ? displayTitle.slice(0, 57) + '...' : displayTitle}
        </h3>

        {/* Description */}
        <p className="text-[#4d5156] text-sm leading-relaxed mt-1 line-clamp-2">
          {displayDesc.length > 160 ? displayDesc.slice(0, 157) + '...' : displayDesc}
        </p>
      </div>

      {/* Character counts */}
      <div className="flex gap-6 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Başlık:</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            titleLen === 0 ? 'bg-muted text-muted-foreground' :
            titleLen <= 60 ? 'bg-emerald-50 text-emerald-700' :
            'bg-rose-50 text-rose-700'
          }`}>
            {titleLen}/60
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Açıklama:</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            descLen === 0 ? 'bg-muted text-muted-foreground' :
            descLen <= 160 ? 'bg-emerald-50 text-emerald-700' :
            'bg-rose-50 text-rose-700'
          }`}>
            {descLen}/160
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SeoAutoFill({ title, description, city, type, price, currency, form, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const handleAutoFill = async () => {
    if (!title) return;
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an SEO expert for a Turkish real estate website (propertiesforsaleturkey.com).
Generate SEO metadata for the following property listing:

Title: ${title}
Description: ${description || 'N/A'}
City: ${city || 'Turkey'}
Type: ${type || 'property'}
Price: ${price ? `${currency || 'USD'} ${price}` : 'N/A'}

Return:
1. seo_title: Max 60 chars. Include property type, city, and "for sale in Turkey". No clickbait.
2. seo_description: Max 155 chars. Highlight key features, location, investment angle. Natural English.
3. slug: URL-friendly slug using hyphens, lowercase. Include city, type, and key detail. Max 60 chars.

Important: Return ONLY valid JSON, no explanations.`,
      response_json_schema: {
        type: 'object',
        properties: {
          seo_title: { type: 'string' },
          seo_description: { type: 'string' },
          slug: { type: 'string' },
        }
      }
    });
    setLoading(false);
    onUpdate(result);
  };

  return (
    <div className="space-y-5">
      {/* Auto-fill button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold font-jakarta text-foreground">SEO Ayarları</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Başlık ve açıklamadan otomatik üret</p>
        </div>
        <Button
          type="button"
          onClick={handleAutoFill}
          disabled={loading || !title}
          className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0 hover:opacity-90"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Üretiliyor...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> SEO'yu Otomatik Tamamla</>
          )}
        </Button>
      </div>

      {/* SERP Preview toggle */}
      <button
        type="button"
        onClick={() => setShowPreview(v => !v)}
        className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
      >
        {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        SERP Önizlemesi {showPreview ? 'Gizle' : 'Göster'}
      </button>

      {showPreview && (
        <SerpPreview
          title={form.seo_title}
          description={form.seo_description}
          slug={form.slug}
        />
      )}

      {/* SEO Fields */}
      <div className="space-y-4">
        <div>
          <Label>SEO Başlığı</Label>
          <Input
            value={form.seo_title || ''}
            onChange={e => onUpdate({ seo_title: e.target.value })}
            className="mt-1.5"
            placeholder="İstanbul sea view apartment for sale in Turkey"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-muted-foreground">Tavsiye: 50-60 karakter</p>
            <span className={`text-xs font-medium ${(form.seo_title?.length || 0) > 60 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {form.seo_title?.length || 0}/60
            </span>
          </div>
        </div>

        <div>
          <Label>Meta Açıklama</Label>
          <Textarea
            value={form.seo_description || ''}
            onChange={e => onUpdate({ seo_description: e.target.value })}
            className="mt-1.5 resize-none"
            rows={3}
            placeholder="Stunning sea view apartment in Istanbul Beşiktaş..."
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-muted-foreground">Tavsiye: 130-160 karakter</p>
            <span className={`text-xs font-medium ${(form.seo_description?.length || 0) > 160 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {form.seo_description?.length || 0}/160
            </span>
          </div>
        </div>

        <div>
          <Label>URL Slug</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-3 py-2 rounded-l-md border border-border border-r-0 h-9 flex items-center">/property/</span>
            <Input
              value={form.slug || ''}
              onChange={e => onUpdate({ slug: e.target.value })}
              className="rounded-l-none"
              placeholder="istanbul-besiktas-sea-view-apartment"
            />
          </div>
        </div>
      </div>
    </div>
  );
}