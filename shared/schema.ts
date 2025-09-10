import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contentTypeEnum = pgEnum("content_type", ["document", "image", "video"]);
export const processingStatusEnum = pgEnum("processing_status", ["pending", "processing", "completed", "failed"]);

export const contentItems = pgTable("content_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  type: contentTypeEnum("type").notNull(),
  originalFileName: text("original_file_name"),
  originalUrl: text("original_url"),
  status: processingStatusEnum("status").default("pending").notNull(),
  extractedText: text("extracted_text"),
  summary: text("summary"),
  audioUrl: text("audio_url"),
  imageDescriptions: jsonb("image_descriptions"),
  quizData: jsonb("quiz_data"),
  processingOptions: jsonb("processing_options").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contentItemsRelations = relations(contentItems, ({ one }) => ({
  user: one(users, {
    fields: [contentItems.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  contentItems: many(contentItems),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertContentItemSchema = createInsertSchema(contentItems).pick({
  title: true,
  type: true,
  originalFileName: true,
  originalUrl: true,
  processingOptions: true,
});

export const processingOptionsSchema = z.object({
  generateAudio: z.boolean().default(true),
  generateSummary: z.boolean().default(true),
  generateQuiz: z.boolean().default(false),
  voiceId: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type ProcessingOptions = z.infer<typeof processingOptionsSchema>;
