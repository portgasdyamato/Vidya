import { storage } from "./server/storage";

async function testDefaultUser() {
  try {
    console.log("Testing default user creation...");
    const user = await storage.ensureDefaultUser();
    console.log("✅ Default user exists:", user);
    
    // Try to create a test content item
    const testItem = await storage.createContentItem({
      userId: "default-user",
      title: "Test Upload",
      type: "document",
      originalFileName: "test.pdf",
      processingOptions: {
        generateAudio: true,
        generateSummary: true,
        generateQuiz: false,
      },
    });
    console.log("✅ Test content item created:", testItem.id);
    
    // Clean up
    await storage.deleteContentItem(testItem.id);
    console.log("✅ Test cleanup complete");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testDefaultUser();
