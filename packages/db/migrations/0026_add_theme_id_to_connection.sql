-- Add theme_id column to mail0_connection table
ALTER TABLE "mail0_connection" ADD COLUMN "theme_id" text REFERENCES "mail0_theme"("id");
