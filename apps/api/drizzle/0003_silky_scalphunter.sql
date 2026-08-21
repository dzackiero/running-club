CREATE TABLE "meal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"items" jsonb NOT NULL,
	"total_calories" real NOT NULL,
	"total_protein_grams" real NOT NULL,
	"total_carbs_grams" real NOT NULL,
	"total_fat_grams" real NOT NULL,
	"image_reference" text,
	"source" text DEFAULT 'mcp' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_day" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"target_calories" real,
	"target_protein_grams" real,
	"target_carbs_grams" real,
	"target_fat_grams" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal" ADD CONSTRAINT "meal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_day" ADD CONSTRAINT "nutrition_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_user_occurred_at_idx" ON "meal" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "meal_user_status_occurred_at_idx" ON "meal" USING btree ("user_id","status","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_day_user_date_uid" ON "nutrition_day" USING btree ("user_id","date");