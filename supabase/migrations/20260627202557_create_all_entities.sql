/*
# Real Estate Admin - Full Entity Schema Migration

1. New Tables
- `blog_posts` — CMS content for blog, news, guides, and static pages
- `features` — Property amenity features with emoji icons and categories
- `languages` — Supported languages with RTL, flag, and ordering
- `leads` — Customer inquiries / CRM leads
- `locations` — Geographic hierarchy (country → city → district → neighborhood)
- `packages` — Citizenship/residency/investment property packages
- `projects` — Real estate development projects
- `properties` — Property listings with full details
- `property_types` — Taxonomy for property types and sub-types
- `site_settings` — Key/value configuration store (includes gem links, ref no rules, background images)
- `users` — Admin system users

2. Security
- Enable RLS on every table.
- All policies scoped TO anon, authenticated with USING (true) because this is a single-tenant admin CMS with no sign-in screen.
*/

-- ─── BLOG POSTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text,
  type text NOT NULL DEFAULT 'blog',
  status text NOT NULL DEFAULT 'draft',
  category text,
  author text,
  excerpt text,
  content text,
  main_image text,
  tags text[],
  published_date date,
  seo_title text,
  seo_description text,
  seo_keywords text,
  featured boolean NOT NULL DEFAULT false,
  reading_time_min integer,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_blog_posts" ON blog_posts;
CREATE POLICY "anon_select_blog_posts" ON blog_posts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_blog_posts" ON blog_posts;
CREATE POLICY "anon_insert_blog_posts" ON blog_posts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_blog_posts" ON blog_posts;
CREATE POLICY "anon_update_blog_posts" ON blog_posts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_blog_posts" ON blog_posts;
CREATE POLICY "anon_delete_blog_posts" ON blog_posts FOR DELETE TO anon, authenticated USING (true);

-- ─── FEATURES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  category text NOT NULL DEFAULT 'other',
  emoji text,
  is_active boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 99,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_features" ON features;
CREATE POLICY "anon_select_features" ON features FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_features" ON features;
CREATE POLICY "anon_insert_features" ON features FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_features" ON features;
CREATE POLICY "anon_update_features" ON features FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_features" ON features;
CREATE POLICY "anon_delete_features" ON features FOR DELETE TO anon, authenticated USING (true);

-- ─── LANGUAGES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  native_name text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  rtl boolean NOT NULL DEFAULT false,
  flag_emoji text,
  "order" integer NOT NULL DEFAULT 99,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE languages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_languages" ON languages;
CREATE POLICY "anon_select_languages" ON languages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_languages" ON languages;
CREATE POLICY "anon_insert_languages" ON languages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_languages" ON languages;
CREATE POLICY "anon_update_languages" ON languages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_languages" ON languages;
CREATE POLICY "anon_delete_languages" ON languages FOR DELETE TO anon, authenticated USING (true);

-- ─── LEADS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  nationality text,
  source text NOT NULL DEFAULT 'contact-form',
  status text NOT NULL DEFAULT 'new',
  interest text,
  budget_min numeric,
  budget_max numeric,
  preferred_city text,
  message text,
  notes text,
  assigned_agent text,
  property_ref text,
  follow_up_date date,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_leads" ON leads;
CREATE POLICY "anon_select_leads" ON leads FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
CREATE POLICY "anon_insert_leads" ON leads FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_leads" ON leads;
CREATE POLICY "anon_update_leads" ON leads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_leads" ON leads;
CREATE POLICY "anon_delete_leads" ON leads FOR DELETE TO anon, authenticated USING (true);

-- ─── LOCATIONS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL DEFAULT 'Turkey',
  city text NOT NULL,
  city_label text,
  region text,
  district text NOT NULL,
  neighborhood text,
  property_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 99,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_locations" ON locations;
CREATE POLICY "anon_select_locations" ON locations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_locations" ON locations;
CREATE POLICY "anon_insert_locations" ON locations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_locations" ON locations;
CREATE POLICY "anon_update_locations" ON locations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_locations" ON locations;
CREATE POLICY "anon_delete_locations" ON locations FOR DELETE TO anon, authenticated USING (true);

-- ─── PACKAGES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text,
  status text NOT NULL DEFAULT 'draft',
  type text NOT NULL DEFAULT 'citizenship',
  total_price numeric,
  currency text NOT NULL DEFAULT 'USD',
  property_ids text[],
  cities text[],
  description text,
  benefits text[],
  main_image text,
  images text[],
  seo_title text,
  seo_description text,
  featured boolean NOT NULL DEFAULT false,
  number_of_properties integer,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_packages" ON packages;
CREATE POLICY "anon_select_packages" ON packages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_packages" ON packages;
CREATE POLICY "anon_insert_packages" ON packages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_packages" ON packages;
CREATE POLICY "anon_update_packages" ON packages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_packages" ON packages;
CREATE POLICY "anon_delete_packages" ON packages FOR DELETE TO anon, authenticated USING (true);

-- ─── PROJECTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text,
  status text NOT NULL DEFAULT 'draft',
  city text,
  district text,
  developer text,
  completion_date date,
  min_price numeric,
  max_price numeric,
  currency text NOT NULL DEFAULT 'USD',
  total_units integer,
  available_units integer,
  description text,
  features text[],
  images text[],
  main_image text,
  citizenship_eligible boolean NOT NULL DEFAULT false,
  seo_title text,
  seo_description text,
  seo_keywords text,
  featured boolean NOT NULL DEFAULT false,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE TO anon, authenticated USING (true);

-- ─── PROPERTIES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text,
  status text NOT NULL DEFAULT 'draft',
  type text NOT NULL DEFAULT 'apartment',
  sub_type text,
  city text,
  district text,
  neighborhood text,
  price numeric,
  currency text NOT NULL DEFAULT 'USD',
  bedrooms integer,
  bathrooms integer,
  size_sqm numeric,
  sea_view boolean NOT NULL DEFAULT false,
  seafront boolean NOT NULL DEFAULT false,
  near_the_sea boolean NOT NULL DEFAULT false,
  citizenship_eligible boolean NOT NULL DEFAULT false,
  residency_eligible boolean NOT NULL DEFAULT false,
  description text,
  features text[],
  images text[],
  main_image text,
  seo_title text,
  seo_description text,
  seo_keywords text,
  property_ref text,
  agent_id text,
  featured boolean NOT NULL DEFAULT false,
  year_built integer,
  floors integer,
  floor_number integer,
  -- Step 2 fields
  project_name text,
  notes text,
  lat text,
  lng text,
  country text DEFAULT 'Turkey',
  country_visible boolean NOT NULL DEFAULT true,
  city_visible boolean NOT NULL DEFAULT true,
  district_visible boolean NOT NULL DEFAULT true,
  neighborhood_visible boolean NOT NULL DEFAULT true,
  distances jsonb DEFAULT '[]',
  translations jsonb DEFAULT '{}',
  selected_airport_name text,
  custom_id text,
  market_status text,
  balcony text,
  salon text,
  boost text,
  old_price numeric,
  commission numeric,
  total_sqm numeric,
  block_count integer,
  floor_count integer,
  developer_company text,
  list_link_1 text,
  list_link_2 text,
  payment_down integer DEFAULT 100,
  payment_under_construction integer DEFAULT 0,
  payment_delivery integer DEFAULT 0,
  payment_installment integer DEFAULT 0,
  meta_title text,
  meta_description text,
  seo_content text,
  ai_summary text,
  mulk_ozellikleri text,
  proje_ozellikleri text,
  lokasyon_avantajlari text,
  yatirim_analizi text,
  bolge_analizi text,
  emlak_uzmani_gorusu text,
  faq jsonb DEFAULT '[]',
  hizli_bilgiler jsonb DEFAULT '{}',
  json_ld_schema jsonb,
  room_types jsonb DEFAULT '[]',
  created_date timestamptz DEFAULT now()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_properties" ON properties;
CREATE POLICY "anon_select_properties" ON properties FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_properties" ON properties;
CREATE POLICY "anon_insert_properties" ON properties FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_properties" ON properties;
CREATE POLICY "anon_update_properties" ON properties FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_properties" ON properties;
CREATE POLICY "anon_delete_properties" ON properties FOR DELETE TO anon, authenticated USING (true);

-- ─── PROPERTY TYPES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  icon text,
  sub_types text[],
  is_active boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE property_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_property_types" ON property_types;
CREATE POLICY "anon_select_property_types" ON property_types FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_property_types" ON property_types;
CREATE POLICY "anon_insert_property_types" ON property_types FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_property_types" ON property_types;
CREATE POLICY "anon_update_property_types" ON property_types FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_property_types" ON property_types;
CREATE POLICY "anon_delete_property_types" ON property_types FOR DELETE TO anon, authenticated USING (true);

-- ─── SITE SETTINGS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text NOT NULL,
  label text,
  description text,
  instructions text,
  next_number integer,
  created_date timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_site_settings" ON site_settings;
CREATE POLICY "anon_select_site_settings" ON site_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_site_settings" ON site_settings;
CREATE POLICY "anon_insert_site_settings" ON site_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_site_settings" ON site_settings;
CREATE POLICY "anon_update_site_settings" ON site_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_site_settings" ON site_settings;
CREATE POLICY "anon_delete_site_settings" ON site_settings FOR DELETE TO anon, authenticated USING (true);

-- ─── USERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  created_date timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon, authenticated USING (true);
