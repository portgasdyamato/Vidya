import { contentItems, users, notebooks, type User, type InsertUser, type ContentItem, type InsertContentItem, type Notebook, type InsertNotebook } from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  createContentItem(contentItem: InsertContentItem & { userId: string }): Promise<ContentItem>;
  getContentItem(id: string): Promise<ContentItem | undefined>;
  updateContentItem(id: string, updates: Partial<ContentItem>): Promise<ContentItem | undefined>;
  getUserContentItems(userId: string): Promise<ContentItem[]>;
  deleteContentItem(id: string): Promise<boolean>;
  deleteContentItem(id: string): Promise<boolean>;

  createNotebook(notebook: InsertNotebook & { userId: string }): Promise<Notebook>;
  getNotebooksByUserId(userId: string): Promise<Notebook[]>;
  getNotebook(id: string): Promise<Notebook | undefined>;
  updateNotebook(id: string, updates: Partial<Notebook>): Promise<Notebook | undefined>;
  deleteNotebook(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async ensureDefaultUser(): Promise<User> {
    const existing = await this.getUserByUsername("default-user");
    if (existing) return existing;

    // create a default user with a fixed id to avoid FK issues in dev
    const [user] = await db
      .insert(users)
      .values({ id: "default-user", username: "default-user", password: "" })
      .returning();

    return user;
  }

  async createContentItem(contentItem: InsertContentItem & { userId: string }): Promise<ContentItem> {
    try {
      const [item] = await db
        .insert(contentItems)
        .values(contentItem)
        .returning();
      return item;
    } catch (error: any) {
      console.error("Error creating content item:", error);
      throw new Error(`Failed to create content item: ${error?.message || 'Unknown error'}`);
    }
  }

  async getContentItem(id: string): Promise<ContentItem | undefined> {
    const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id));
    return item || undefined;
  }

  async updateContentItem(id: string, updates: Partial<ContentItem>): Promise<ContentItem | undefined> {
    const [item] = await db
      .update(contentItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contentItems.id, id))
      .returning();
    return item || undefined;
  }

  async getUserContentItems(userId: string): Promise<ContentItem[]> {
    try {
      return await db
        .select()
        .from(contentItems)
        .where(eq(contentItems.userId, userId))
        .orderBy(desc(contentItems.createdAt));
    } catch (error: any) {
      console.error("Error fetching user content items:", error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  async deleteContentItem(id: string): Promise<boolean> {
    const [deletedItem] = await db.delete(contentItems).where(eq(contentItems.id, id)).returning();
    return !!deletedItem;
  }

  async createNotebook(notebook: InsertNotebook & { userId: string }): Promise<Notebook> {
    const [item] = await db
      .insert(notebooks)
      .values(notebook)
      .returning();
    return item;
  }

  async getNotebooksByUserId(userId: string): Promise<Notebook[]> {
    return await db
      .select()
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .orderBy(desc(notebooks.createdAt));
  }

  async getNotebook(id: string): Promise<Notebook | undefined> {
    const [item] = await db.select().from(notebooks).where(eq(notebooks.id, id));
    return item || undefined;
  }

  async updateNotebook(id: string, updates: Partial<Notebook>): Promise<Notebook | undefined> {
    const [item] = await db
      .update(notebooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notebooks.id, id))
      .returning();
    return item || undefined;
  }

  async deleteNotebook(id: string): Promise<boolean> {
    // Delete associated content items first
    await db.delete(contentItems).where(eq(contentItems.notebookId, id));
    const [deletedItem] = await db.delete(notebooks).where(eq(notebooks.id, id)).returning();
    return !!deletedItem;
  }
}

export const storage = new DatabaseStorage();
