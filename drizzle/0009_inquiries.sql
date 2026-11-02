CREATE TABLE "inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gallery_name" varchar(200) NOT NULL,
  "contact_person" varchar(200) NOT NULL,
  "contact" varchar(320) NOT NULL,
  "message" text NOT NULL,
  "lang" varchar(8) NOT NULL,
  "consent_at" timestamp with time zone NOT NULL,
  "consent_text_version" varchar(40) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paperclip_issue_id" varchar(80),
  "paperclip_issue_identifier" varchar(80),
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "inquiries_pending_idx" ON "inquiries" ("next_attempt_at") WHERE "paperclip_issue_id" IS NULL;
CREATE INDEX "inquiries_created_idx" ON "inquiries" ("created_at");
