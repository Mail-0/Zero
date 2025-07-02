CREATE TABLE "mail0_organization_domain" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"domain" text NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail0_organization_domain" ADD CONSTRAINT "mail0_organization_domain_organizationId_mail0_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mail0_organization"("id") ON DELETE cascade ON UPDATE no action;