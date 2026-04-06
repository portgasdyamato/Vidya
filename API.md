# 📡 Vidya API Reference

This document provides a quick reference for all API endpoints in the Vidya application.

## Authentication Endpoints

### Google OAuth
- **GET** `/auth/google` - Initiate Google OAuth flow
- **GET** `/auth/google/callback` - OAuth callback endpoint
- **POST** `/auth/logout` - Logout current user
- **GET** `/api/auth/user` - Get current authenticated user

## Content Management

### Upload \u0026 Process Content

#### Upload Document (PDF/DOCX)
```http
POST /api/upload/document
Content-Type: multipart/form-data

file: <PDF or DOCX file>
title: string
processingOptions: {
  generateAudio: boolean (default: true)
  generateSummary: boolean (default: true)
  generateQuiz: boolean (default: false)
  voiceId?: string
}
```

#### Upload Image
```http
POST /api/upload/image
Content-Type: multipart/form-data

file: <Image file>
title: string
processingOptions: { ... }
```

#### Process Video (YouTube)
```http
POST /api/upload/video
Content-Type: application/json

{
  "url": "https://youtube.com/watch?v=...",
  "title": "Video Title",
  "processingOptions": { ... }
}
```

#### Upload Audio for Transcription
```http
POST /api/upload/audio
Content-Type: multipart/form-data

file: <Audio file (MP3, WAV, etc.)>
title: string
processingOptions: { ... }
```

### Retrieve Content

#### Get All Content Items
```http
GET /api/content
```

Returns array of all content items for the authenticated user.

#### Get Specific Content Item
```http
GET /api/content/:id
```

Returns detailed information about a specific content item.

#### Delete Content Item
```http
DELETE /api/content/:id
```

Deletes a content item and its associated files.

### File Downloads

#### Download Processed Audio
```http
GET /api/download/:id/audio
```

Downloads the generated audio file (TTS).

#### Download Podcast Audio
```http
GET /api/download/:id/podcast
```

Downloads the podcast-style audio.

#### Download Original File
```http
GET /api/download/:id/original
```

Downloads the original uploaded file.

## Interactive Features

### Chat with Content
```http
POST /api/chat/:id
Content-Type: application/json

{
  "message": "User's question about the content"
}
```

Returns AI-generated answer based on the content.

### Generate Quiz
```http
POST /api/content/:id/quiz
Content-Type: application/json

{
  "numQuestions": number (default: 5)
}
```

Generates quiz questions based on the content.

### Generate Flashcards
```http
POST /api/content/:id/flashcards
Content-Type: application/json

{
  "numCards": number (default: 10)
}
```

Generates flashcards for studying.

### Generate Podcast
```http
POST /api/content/:id/podcast
Content-Type: application/json

{
  "style": "conversational" | "educational"
}
```

Generates a podcast-style audio discussion.

## Static Assets

### GIF Assets
- **GET** `/talk.gif` - Animated GIF for podcast playing state
- **GET** `/stop.gif` - Animated GIF for podcast stopped state

### Uploaded Files
- **GET** `/uploads/:filename` - Access uploaded files

## Response Formats

### Success Response
```json
{
  "id": "uuid",
  "title": "Content Title",
  "type": "document" | "image" | "video",
  "status": "pending" | "processing" | "completed" | "failed",
  "extractedText": "...",
  "summary": "...",
  "audioUrl": "/api/download/uuid/audio",
  "quizData": [...],
  "flashcards": [...],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Error Response
```json
{
  "message": "Error description"
}
```

## Processing Status

Content items have the following status values:
- **pending**: Uploaded, waiting for processing
- **processing**: Currently being processed by AI
- **completed**: Successfully processed
- **failed**: Processing failed (check errorMessage field)

## Processing Options

```typescript
{
  generateAudio: boolean;      // Generate TTS audio
  generateSummary: boolean;    // Generate AI summary
  generateQuiz: boolean;       // Generate quiz questions
  voiceId?: string;           // Voice ID for TTS (optional)
}
```

## Content Types

- **document**: PDF or DOCX files
- **image**: JPG, PNG, or other image formats
- **video**: YouTube URLs or video files

## Rate Limits

No rate limits are currently enforced, but API usage is subject to:
- OpenAI API rate limits
- Database connection limits
- File upload size limits (configured in server)

## Error Codes

- **400**: Bad Request - Invalid input data
- **401**: Unauthorized - Authentication required
- **404**: Not Found - Resource doesn't exist
- **500**: Internal Server Error - Server-side issue

## Notes

- All authenticated endpoints require a valid session cookie
- File uploads use multipart/form-data encoding
- Large files may take several minutes to process
- Processing continues in background, check status periodically
- Audio files are served with appropriate content-type headers

---

**Last Updated**: 2026-02-07
