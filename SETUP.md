# 🚀 Quick Setup Guide for Vidya

This guide will help you get the Vidya project up and running quickly.

## Prerequisites

- Node.js >= 20 installed
- A Neon PostgreSQL database (free tier available at https://neon.tech)
- OpenAI API key OR Google Gemini API key (for AI features)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and fill in your credentials:

#### Required Variables:

- **DATABASE_URL**: Your Neon PostgreSQL connection string
  - Sign up at https://neon.tech
  - Create a new project
  - Copy the connection string (starts with `postgresql://`)

- **OPENAI_API_KEY** OR **GEMINI_API_KEY**: For AI features
  - OpenAI: Get your key at https://platform.openai.com/api-keys
  - Gemini: Get your key at https://ai.google.dev/

- **SESSION_SECRET**: Any random string for session encryption
  - Example: `vidya_super_secret_123456`

#### Optional Variables:

- **GOOGLE_CLIENT_ID** & **GOOGLE_CLIENT_SECRET**: For Google OAuth login
  - Create credentials at https://console.cloud.google.com/apis/credentials
  - Add authorized redirect URI: `http://localhost:5000/auth/google/callback`

### 3. Initialize Database Schema

The database schema will be automatically created when you first run the application.
Alternatively, you can run:

```bash
npm run db:push
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Common Issues

### "DATABASE_URL must be set"

Make sure you've created a `.env` file and added your Neon database connection string.

### "Google OAuth env vars missing"

This is just a warning. Google OAuth is optional. You can ignore it if you don't need Google login.

### Port already in use

If port 5000 is already in use, you can change it by setting `PORT=3000` (or any other port) in your `.env` file.

## Production Build

To create a production build:

```bash
npm run build
npm run start
```

## Features

- 📄 **Document Processing**: Upload PDF/DOCX files for AI-powered summarization and audio conversion
- 🖼️ **Image Recognition**: Analyze textbook photos, diagrams, and charts with GPT-4 Vision
- 🎥 **Video Transcription**: Convert YouTube videos to text with word-level transcripts
- 🎯 **Interactive Q&A**: Chat with your materials and generate quizzes
- 🎨 **Accessible Design**: Dark glassmorphism UI optimized for screen readers

## Need Help?

Check the main README.md for more detailed information about the project architecture and features.
