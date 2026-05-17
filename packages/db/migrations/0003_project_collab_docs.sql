CREATE TABLE "project_collab_docs" (
  "project_id" uuid PRIMARY KEY NOT NULL,
  "yjs_state" text NOT NULL,
  "version" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "project_collab_docs" ADD CONSTRAINT "project_collab_docs_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
