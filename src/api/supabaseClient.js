import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to map snake_case DB columns to camelCase for frontend compatibility
function dbToFrontend(row) {
  if (!row) return row;
  const mapped = { ...row };
  // Keep both snake_case and camelCase for compatibility
  if (row.created_date) mapped.createdDate = row.created_date;
  if (row.is_active !== undefined) mapped.isActive = row.is_active;
  if (row.is_default !== undefined) mapped.isDefault = row.is_default;
  if (row.property_ref) mapped.propertyRef = row.property_ref;
  if (row.sea_view !== undefined) mapped.seaView = row.sea_view;
  if (row.main_image) mapped.mainImage = row.main_image;
  if (row.seo_title) mapped.seoTitle = row.seo_title;
  if (row.seo_description) mapped.seoDescription = row.seo_description;
  if (row.seo_keywords) mapped.seoKeywords = row.seo_keywords;
  if (row.citizenship_eligible !== undefined) mapped.citizenshipEligible = row.citizenship_eligible;
  if (row.residency_eligible !== undefined) mapped.residencyEligible = row.residency_eligible;
  if (row.year_built) mapped.yearBuilt = row.year_built;
  if (row.floor_number) mapped.floorNumber = row.floor_number;
  if (row.city_label) mapped.cityLabel = row.city_label;
  if (row.sub_types) mapped.subTypes = row.sub_types;
  if (row.full_name) mapped.fullName = row.full_name;
  if (row.native_name) mapped.nativeName = row.native_name;
  if (row.flag_emoji) mapped.flagEmoji = row.flag_emoji;
  if (row.reading_time_min) mapped.readingTimeMin = row.reading_time_min;
  if (row.published_date) mapped.publishedDate = row.published_date;
  if (row.budget_min) mapped.budgetMin = row.budget_min;
  if (row.budget_max) mapped.budgetMax = row.budget_max;
  if (row.preferred_city) mapped.preferredCity = row.preferred_city;
  if (row.assigned_agent) mapped.assignedAgent = row.assigned_agent;
  if (row.property_ids) mapped.propertyIds = row.property_ids;
  if (row.number_of_properties) mapped.numberOfProperties = row.number_of_properties;
  if (row.total_units) mapped.totalUnits = row.total_units;
  if (row.available_units) mapped.availableUnits = row.available_units;
  if (row.min_price) mapped.minPrice = row.min_price;
  if (row.max_price) mapped.maxPrice = row.max_price;
  if (row.completion_date) mapped.completionDate = row.completion_date;
  if (row.follow_up_date) mapped.followUpDate = row.follow_up_date;
  return mapped;
}

function frontendToDb(item) {
  const dbItem = { ...item };
  // Remove frontend-only fields that don't exist in DB
  delete dbItem.createdDate;
  delete dbItem.isActive;
  delete dbItem.isDefault;
  delete dbItem.propertyRef;
  delete dbItem.seaView;
  delete dbItem.mainImage;
  delete dbItem.seoTitle;
  delete dbItem.seoDescription;
  delete dbItem.seoKeywords;
  delete dbItem.citizenshipEligible;
  delete dbItem.residencyEligible;
  delete dbItem.yearBuilt;
  delete dbItem.floorNumber;
  delete dbItem.cityLabel;
  delete dbItem.subTypes;
  delete dbItem.fullName;
  delete dbItem.nativeName;
  delete dbItem.flagEmoji;
  delete dbItem.readingTimeMin;
  delete dbItem.publishedDate;
  delete dbItem.budgetMin;
  delete dbItem.budgetMax;
  delete dbItem.preferredCity;
  delete dbItem.assignedAgent;
  delete dbItem.propertyIds;
  delete dbItem.numberOfProperties;
  delete dbItem.totalUnits;
  delete dbItem.availableUnits;
  delete dbItem.minPrice;
  delete dbItem.maxPrice;
  delete dbItem.completionDate;
  delete dbItem.followUpDate;
  return dbItem;
}

const createSupabaseRepo = (tableName) => {
  return {
    list: async (order, limit) => {
      let query = supabase.from(tableName).select('*');
      if (order) {
        const isDesc = order.startsWith('-');
        const col = isDesc ? order.substring(1) : order;
        query = query.order(col, { ascending: !isDesc });
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(dbToFrontend);
    },
    filter: async (queryObj, order, limit) => {
      let query = supabase.from(tableName).select('*');
      if (queryObj && typeof queryObj === 'object') {
        Object.entries(queryObj).forEach(([k, v]) => {
          query = query.eq(k, v);
        });
      }
      if (order) {
        const isDesc = order.startsWith('-');
        const col = isDesc ? order.substring(1) : order;
        query = query.order(col, { ascending: !isDesc });
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(dbToFrontend);
    },
    create: async (item) => {
      const dbItem = frontendToDb(item);
      const { data, error } = await supabase.from(tableName).insert(dbItem).select().single();
      if (error) throw error;
      return dbToFrontend(data);
    },
    update: async (id, updates) => {
      const dbUpdates = frontendToDb(updates);
      const { data, error } = await supabase.from(tableName).update(dbUpdates).eq('id', id).select().single();
      if (error) throw error;
      return dbToFrontend(data);
    },
    delete: async (id) => {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    },
    bulkCreate: async (items) => {
      const dbItems = items.map(frontendToDb);
      const { data, error } = await supabase.from(tableName).insert(dbItems).select();
      if (error) throw error;
      return (data || []).map(dbToFrontend);
    }
  };
};

export const base44 = {
  entities: {
    BlogPost: createSupabaseRepo('blog_posts'),
    Feature: createSupabaseRepo('features'),
    Language: createSupabaseRepo('languages'),
    Lead: createSupabaseRepo('leads'),
    Location: createSupabaseRepo('locations'),
    Package: createSupabaseRepo('packages'),
    Project: createSupabaseRepo('projects'),
    Property: createSupabaseRepo('properties'),
    PropertyType: createSupabaseRepo('property_types'),
    SiteSettings: createSupabaseRepo('site_settings'),
    User: createSupabaseRepo('users')
  },
  auth: {
    me: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      // Also fetch from users table for role
      const { data } = await supabase.from('users').select('*').eq('email', user.email).maybeSingle();
      return data ? dbToFrontend(data) : { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || '', role: 'user' };
    },
    logout: async () => {
      await supabase.auth.signOut();
    },
    redirectToLogin: () => {
      window.location.href = '/login';
    }
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data, error } = await supabase.storage.from('uploads').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(data.path);
        return { file_url: publicUrl };
      },
      InvokeLLM: async ({ prompt }) => {
        console.log("AI prompt:", prompt);
        return {
          seo_title: "Luxury Real Estate for Sale in Turkey | Modern Project",
          seo_description: "Discover exclusive luxury apartments and properties for sale in Turkey. Great investment opportunity.",
          slug: "luxury-modern-property-for-sale-turkey",
          seo_keywords: "turkey property, investment turkey, buy apartment",
          title: "Premium Modern Residence Project",
          description: "<p>This exclusive real estate project offers state-of-the-art architecture combined with excellent location advantages in Turkey.</p><p>Equipped with absolute luxury amenities including private swimming pools, high-end fitness facilities, and security.</p>"
        };
      }
    }
  }
};
