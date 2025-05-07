-- Add theme table for user-customizable themes
CREATE TABLE "mail0_theme" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "mail0_user"("id"),
  "name" text NOT NULL,
  "description" text,
  "config" jsonb NOT NULL,
  "is_public" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "mail0_theme_user_id_idx" ON "mail0_theme" ("user_id");
CREATE INDEX "mail0_theme_is_public_idx" ON "mail0_theme" ("is_public");
