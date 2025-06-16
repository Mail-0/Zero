-- Create theme table
CREATE TABLE "mail0_theme" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "colors" jsonb NOT NULL,
  "fonts" jsonb NOT NULL,
  "spacing" jsonb NOT NULL,
  "shadows" jsonb NOT NULL,
  "radius" jsonb NOT NULL,
  "backgrounds" jsonb NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add theme_id column to connections
ALTER TABLE "mail0_connection" ADD COLUMN "theme_id" text;

-- Create junction table for favorite themes
CREATE TABLE "mail0_user_favorite_themes" (
  "user_id" text NOT NULL,
  "theme_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "theme_id")
);

-- Add foreign key constraints
ALTER TABLE "mail0_theme" ADD CONSTRAINT "mail0_theme_user_id_mail0_user_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "mail0_user"("id") ON DELETE CASCADE;

ALTER TABLE "mail0_connection" ADD CONSTRAINT "mail0_connection_theme_id_mail0_theme_id_fk" 
  FOREIGN KEY ("theme_id") REFERENCES "mail0_theme"("id") ON DELETE SET NULL;

ALTER TABLE "mail0_user_favorite_themes" ADD CONSTRAINT "mail0_user_favorite_themes_user_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "mail0_user"("id") ON DELETE CASCADE;

ALTER TABLE "mail0_user_favorite_themes" ADD CONSTRAINT "mail0_user_favorite_themes_theme_id_fk" 
  FOREIGN KEY ("theme_id") REFERENCES "mail0_theme"("id") ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX "mail0_theme_user_id_idx" ON "mail0_theme" ("user_id");
CREATE INDEX "mail0_theme_is_public_idx" ON "mail0_theme" ("is_public") WHERE "is_public" = true;
CREATE INDEX "mail0_connection_theme_id_idx" ON "mail0_connection" ("theme_id");
CREATE INDEX "mail0_user_favorite_themes_user_id_idx" ON "mail0_user_favorite_themes" ("user_id");
CREATE INDEX "mail0_user_favorite_themes_theme_id_idx" ON "mail0_user_favorite_themes" ("theme_id");

-- Update default settings to include theme preferences
ALTER TABLE "mail0_user_settings" ALTER COLUMN "settings" 
  SET DEFAULT '{"language":"en","timezone":"UTC","dynamicContent":false,"externalImages":true,"customPrompt":"","trustedSenders":[],"isOnboarded":false,"colorTheme":"system","themePreferences":{}}'::jsonb;

-- Create function to update theme updated_at timestamp
CREATE OR REPLACE FUNCTION update_theme_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for theme updates
CREATE TRIGGER theme_updated_at_trigger
BEFORE UPDATE ON "mail0_theme"
FOR EACH ROW
EXECUTE FUNCTION update_theme_updated_at();

-- Create function to copy a theme
CREATE OR REPLACE FUNCTION copy_theme(
  source_theme_id text,
  new_user_id text,
  new_name text
) RETURNS text AS $$
DECLARE
  new_theme_id text;
BEGIN
  new_theme_id := gen_random_uuid()::text;
  
  INSERT INTO "mail0_theme" (
    "id", "user_id", "name", 
    "colors", "fonts", "spacing", 
    "shadows", "radius", "backgrounds",
    "is_public", "is_default", "created_at", "updated_at"
  )
  SELECT 
    new_theme_id, new_user_id, new_name,
    "colors", "fonts", "spacing",
    "shadows", "radius", "backgrounds",
    false, false, now(), now()
  FROM "mail0_theme"
  WHERE "id" = source_theme_id;
  
  RETURN new_theme_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to set default theme for user
CREATE OR REPLACE FUNCTION set_user_default_theme(
  user_id_param text,
  theme_id_param text
) RETURNS void AS $$
BEGIN
  -- Reset any existing default
  UPDATE "mail0_theme"
  SET "is_default" = false
  WHERE "user_id" = user_id_param AND "is_default" = true;
  
  -- Set new default
  UPDATE "mail0_theme"
  SET "is_default" = true
  WHERE "id" = theme_id_param AND "user_id" = user_id_param;
END;
$$ LANGUAGE plpgsql;