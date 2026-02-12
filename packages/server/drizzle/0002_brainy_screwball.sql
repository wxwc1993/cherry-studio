CREATE TABLE "lc_banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"image_url" text NOT NULL,
	"link_url" text,
	"link_type" varchar(20) DEFAULT 'external',
	"order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lc_course_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lc_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid,
	"title" varchar(300) NOT NULL,
	"description" text,
	"cover_url" text,
	"video_url" text NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"author" varchar(100),
	"order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lc_document_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid,
	"title" varchar(300) NOT NULL,
	"description" text,
	"cover_url" text,
	"link_url" text NOT NULL,
	"link_type" varchar(20) DEFAULT 'external' NOT NULL,
	"author" varchar(100),
	"order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lc_hot_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"link_url" text NOT NULL,
	"tag" varchar(10),
	"heat_value" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_image_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"image_key" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"prompt" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"presentation_id" uuid,
	"file_name" varchar(255) NOT NULL,
	"storage_key" text NOT NULL,
	"file_size" bigint NOT NULL,
	"mime_type" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presentation_id" uuid NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"outline_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description_content" jsonb,
	"generated_image_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_reference_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"storage_key" text NOT NULL,
	"markdown_content" text,
	"parse_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"file_size" bigint NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"default_text_model_id" uuid,
	"default_image_model_id" uuid,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "presentation_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "presentation_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presentation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"task_type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bullmq_job_id" varchar(200),
	"result" jsonb,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"storage_key" text NOT NULL,
	"preview_image_key" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"creation_type" varchar(20) DEFAULT 'idea' NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"source_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lc_banners" ADD CONSTRAINT "lc_banners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_course_categories" ADD CONSTRAINT "lc_course_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_courses" ADD CONSTRAINT "lc_courses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_courses" ADD CONSTRAINT "lc_courses_category_id_lc_course_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."lc_course_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_document_categories" ADD CONSTRAINT "lc_document_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_documents" ADD CONSTRAINT "lc_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_documents" ADD CONSTRAINT "lc_documents_category_id_lc_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."lc_document_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_hot_items" ADD CONSTRAINT "lc_hot_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_image_versions" ADD CONSTRAINT "presentation_image_versions_page_id_presentation_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."presentation_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_materials" ADD CONSTRAINT "presentation_materials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_materials" ADD CONSTRAINT "presentation_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_materials" ADD CONSTRAINT "presentation_materials_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_pages" ADD CONSTRAINT "presentation_pages_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_reference_files" ADD CONSTRAINT "presentation_reference_files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_reference_files" ADD CONSTRAINT "presentation_reference_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_reference_files" ADD CONSTRAINT "presentation_reference_files_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_settings" ADD CONSTRAINT "presentation_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_tasks" ADD CONSTRAINT "presentation_tasks_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_tasks" ADD CONSTRAINT "presentation_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_templates" ADD CONSTRAINT "presentation_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_templates" ADD CONSTRAINT "presentation_templates_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lc_banners_company_id_idx" ON "lc_banners" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lc_banners_company_enabled_order_idx" ON "lc_banners" USING btree ("company_id","is_enabled","order");--> statement-breakpoint
CREATE INDEX "lc_course_categories_company_id_idx" ON "lc_course_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lc_course_categories_company_enabled_order_idx" ON "lc_course_categories" USING btree ("company_id","is_enabled","order");--> statement-breakpoint
CREATE INDEX "lc_courses_company_id_idx" ON "lc_courses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lc_courses_category_id_idx" ON "lc_courses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "lc_courses_company_enabled_order_idx" ON "lc_courses" USING btree ("company_id","is_enabled","order");--> statement-breakpoint
CREATE INDEX "lc_document_categories_company_id_idx" ON "lc_document_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lc_document_categories_company_enabled_order_idx" ON "lc_document_categories" USING btree ("company_id","is_enabled","order");--> statement-breakpoint
CREATE INDEX "lc_documents_company_id_idx" ON "lc_documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lc_documents_category_id_idx" ON "lc_documents" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "lc_documents_company_enabled_order_idx" ON "lc_documents" USING btree ("company_id","is_enabled","order");--> statement-breakpoint
CREATE INDEX "lc_hot_items_company_id_idx" ON "lc_hot_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lc_hot_items_company_enabled_order_idx" ON "lc_hot_items" USING btree ("company_id","is_enabled","order");--> statement-breakpoint
CREATE INDEX "presentation_image_versions_page_id_idx" ON "presentation_image_versions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "presentation_image_versions_current_idx" ON "presentation_image_versions" USING btree ("page_id","is_current");--> statement-breakpoint
CREATE INDEX "presentation_materials_company_id_idx" ON "presentation_materials" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "presentation_materials_user_id_idx" ON "presentation_materials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presentation_materials_presentation_id_idx" ON "presentation_materials" USING btree ("presentation_id");--> statement-breakpoint
CREATE INDEX "presentation_pages_presentation_id_idx" ON "presentation_pages" USING btree ("presentation_id");--> statement-breakpoint
CREATE INDEX "presentation_pages_order_idx" ON "presentation_pages" USING btree ("presentation_id","order_index");--> statement-breakpoint
CREATE INDEX "presentation_reference_files_company_id_idx" ON "presentation_reference_files" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "presentation_reference_files_presentation_id_idx" ON "presentation_reference_files" USING btree ("presentation_id");--> statement-breakpoint
CREATE INDEX "presentation_reference_files_parse_status_idx" ON "presentation_reference_files" USING btree ("parse_status");--> statement-breakpoint
CREATE INDEX "presentation_settings_company_id_idx" ON "presentation_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "presentation_tasks_presentation_id_idx" ON "presentation_tasks" USING btree ("presentation_id");--> statement-breakpoint
CREATE INDEX "presentation_tasks_user_id_idx" ON "presentation_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presentation_tasks_status_idx" ON "presentation_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "presentation_tasks_bullmq_job_id_idx" ON "presentation_tasks" USING btree ("bullmq_job_id");--> statement-breakpoint
CREATE INDEX "presentation_templates_company_id_idx" ON "presentation_templates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "presentation_templates_company_public_idx" ON "presentation_templates" USING btree ("company_id","is_public");--> statement-breakpoint
CREATE INDEX "presentations_company_id_idx" ON "presentations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "presentations_user_id_idx" ON "presentations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presentations_company_user_idx" ON "presentations" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "presentations_status_idx" ON "presentations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "usage_logs_company_created_conversation_idx" ON "usage_logs" USING btree ("company_id","created_at","conversation_id");