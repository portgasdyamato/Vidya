import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notebooks = pgTable("notebooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contentTypeEnum = pgEnum("content_type", ["document", "image", "video"]);
export const processingStatusEnum = pgEnum("processing_status", ["pending", "processing", "completed", "failed"]);

export const contentItems = pgTable("content_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  notebookId: varchar("notebook_id").references(() => notebooks.id),
  title: text("title").notNull(),
  type: contentTypeEnum("type").notNull(),
  originalFileName: text("original_file_name"),
  originalUrl: text("original_url"),
  status: processingStatusEnum("status").default("pending").notNull(),
  extractedText: text("extracted_text"),
  summary: text("summary"),
  audioUrl: text("audio_url"),
  podcastScript: text("podcast_script"),
  podcastAudioUrl: text("podcast_audio_url"),
  imageDescriptions: jsonb("image_descriptions"),
  quizData: jsonb("quiz_data"),
  flashcards: jsonb("flashcards"),
  processingOptions: jsonb("processing_options").notNull(),
  errorMessage: text("error_message"),
  mindMap: jsonb("mind_map"),
  chatHistory: jsonb("chat_history").default('[]'),
  stats: jsonb("stats").default('{"pagesRead": [], "highlightsCount": 0, "quizScores": [], "flashcardsConfidence": {}}'),
  progress: integer("progress").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contentItemsRelations = relations(contentItems, ({ one }) => ({
  user: one(users, {
    fields: [contentItems.userId],
    references: [users.id],
  }),
  notebook: one(notebooks, {
    fields: [contentItems.notebookId],
    references: [notebooks.id],
  }),
}));

export const notebooksRelations = relations(notebooks, ({ one, many }) => ({
  user: one(users, {
    fields: [notebooks.userId],
    references: [users.id],
  }),
  contentItems: many(contentItems),
}));

export const usersRelations = relations(users, ({ many }) => ({
  contentItems: many(contentItems),
  notebooks: many(notebooks),
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
  notebookId: true,
});

export const processingOptionsSchema = z.object({
  generateAudio: z.boolean().default(true),
  generateSummary: z.boolean().default(true),
  generateMindMap: z.boolean().default(true),
  generateQuiz: z.boolean().default(false),
  voiceId: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type ProcessingOptions = z.infer<typeof processingOptionsSchema>;
export type Notebook = typeof notebooks.$inferSelect;
export type InsertNotebook = typeof notebooks.$inferInsert;
