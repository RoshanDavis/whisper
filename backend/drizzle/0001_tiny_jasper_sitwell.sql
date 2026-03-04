CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" uuid NOT NULL,
	"user2_id" uuid NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_pair_unique" UNIQUE("user1_id","user2_id"),
	CONSTRAINT "user1_lt_user2" CHECK ("conversations"."user1_id" < "conversations"."user2_id")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "contacts_owner_idx" ON "contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "messages_sender_receiver_idx" ON "messages" USING btree ("sender_id","receiver_id");--> statement-breakpoint
CREATE INDEX "messages_receiver_created_idx" ON "messages" USING btree ("receiver_id","created_at");