CREATE TABLE "gym_exercise" (
	"id" text PRIMARY KEY NOT NULL,
	"workout_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_set" (
	"id" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"position" integer NOT NULL,
	"reps" integer NOT NULL,
	"load_kg" real NOT NULL,
	"rpe" real
);
--> statement-breakpoint
CREATE TABLE "gym_workout" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"plan_occurrence_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_occurrence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"details" jsonb NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"overridden_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"linked_run_id" text,
	"linked_gym_workout_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_template" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"details" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gym_exercise" ADD CONSTRAINT "gym_exercise_workout_id_gym_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."gym_workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_set" ADD CONSTRAINT "gym_set_exercise_id_gym_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."gym_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_workout" ADD CONSTRAINT "gym_workout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_workout" ADD CONSTRAINT "gym_workout_plan_occurrence_id_plan_occurrence_id_fk" FOREIGN KEY ("plan_occurrence_id") REFERENCES "public"."plan_occurrence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_occurrence" ADD CONSTRAINT "plan_occurrence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_occurrence" ADD CONSTRAINT "plan_occurrence_template_id_plan_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."plan_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_occurrence" ADD CONSTRAINT "plan_occurrence_linked_run_id_run_id_fk" FOREIGN KEY ("linked_run_id") REFERENCES "public"."run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_template" ADD CONSTRAINT "plan_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gym_exercise_workout_position_uid" ON "gym_exercise" USING btree ("workout_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_set_exercise_position_uid" ON "gym_set" USING btree ("exercise_id","position");--> statement-breakpoint
CREATE INDEX "gym_workout_user_occurred_at_idx" ON "gym_workout" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "plan_occurrence_user_date_idx" ON "plan_occurrence" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_occurrence_user_template_date_uid" ON "plan_occurrence" USING btree ("user_id","template_id","date");--> statement-breakpoint
CREATE INDEX "plan_template_user_weekday_idx" ON "plan_template" USING btree ("user_id","weekday");