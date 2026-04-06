# ⚡ Quick Start - Get Vidya Running in 5 Minutes!

## 🎯 What You Need to Do

I've set up the project structure and created all necessary configuration files. Here's what you need to do to get it running:

### Step 1: Get a Database (2 minutes)

1. Go to **https://neon.tech**
2. Sign up for a FREE account
3. Create a new project
4. Copy your connection string (looks like `postgresql://user:pass@host/database`)

### Step 2: Get an AI API Key (2 minutes)

Choose ONE of these options:

**Option A: OpenAI (Recommended)**
1. Go to **https://platform.openai.com/api-keys**
2. Sign in / Create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

**Option B: Google Gemini (Alternative)**
1. Go to **https://ai.google.dev/**
2. Click "Get API Key"
3. Copy your API key

### Step 3: Configure Environment (1 minute)

Open the `.env` file I created and fill in your credentials:

```env
# Replace with your actual database URL from Step 1
DATABASE_URL=paste_your_neon_database_url_here

# Keep this as-is (or change to any random string)
SESSION_SECRET=vidya_super_secret_session_key_change_me_in_production

# Replace with your API key from Step 2
OPENAI_API_KEY=paste_your_openai_key_here
# OR
GEMINI_API_KEY=paste_your_gemini_key_here

# Optional: Leave these blank for now
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

### Step 4: Start the Application! (\u003c1 minute)

```bash
npm run dev
```

That's it! Open your browser to **http://localhost:5000**

---

## 📁 Files I Created For You

- ✅ **`.env`** - Environment configuration (YOU NEED TO EDIT THIS!)
- ✅ **`.env.example`** - Template for environment variables
- ✅ **`SETUP.md`** - Detailed setup instructions
- ✅ **`CHECKLIST.md`** - Feature verification checklist
- ✅ **`API.md`** - Complete API documentation
- ✅ **`TROUBLESHOOTING.md`** - Solutions for common issues
- ✅ **`preflight.mjs`** - Pre-flight validation script
- ✅ **`.gitignore`** - Fixed encoding and added proper patterns
- ✅ **`client/index.html`** - Enhanced with SEO metadata

---

## 🎨 What This Application Does

**Vidya** is an AI-powered learning companion that makes education accessible for everyone, including students with disabilities.

### Core Features:

1. **📄 Document Processing**
   - Upload PDF/DOCX files
   - AI extracts and summarizes text
   - Converts to high-quality audio (TTS)
   - Perfect for visually impaired learners

2. **🖼️ Image Recognition**
   - Analyzes textbook photos, diagrams, charts
   - Generates detailed descriptions
   - Uses GPT-4 Vision for accuracy

3. **🎥 Video Transcription**
   - Paste YouTube URLs
   - Auto-generates transcripts
   - Creates SRT captions
   - Translations available

4. **🎯 Interactive Learning**
   - Chat with your study materials
   - Auto-generate quizzes
   - Create flashcards
   - Podcast-style audio discussions

5. **♿ Accessible Design**
   - Dark glassmorphism UI
   - High contrast mode
   - Full keyboard navigation
   - Screen reader optimized

---

## 🏗️ Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Express + Node.js + TypeScript
- **Database**: PostgreSQL (via Neon + Drizzle ORM)
- **AI**: OpenAI GPT-4, Whisper, TTS (or Google Gemini)
- **Auth**: Google OAuth (optional)

---

## 🔍 Testing the Application

Once running, try these features:

1. **Upload a document** - Test with a PDF or DOCX file
2. **Upload an image** - Try a textbook diagram or chart
3. **Process a video** - Paste a YouTube educational video URL
4. **Ask questions** - Chat with the AI about uploaded content
5. **Generate a quiz** - Auto-create quiz questions from content

---

## ⚠️ Important Notes

### Required Environment Variables:
- ✅ `DATABASE_URL` - MUST be set (from Neon)
- ✅ `SESSION_SECRET` - MUST be set (any random string)
- ✅ `OPENAI_API_KEY` OR `GEMINI_API_KEY` - MUST have at least one

### Optional Variables:
- `GOOGLE_CLIENT_ID` - Only if you want Google OAuth login
- `GOOGLE_CLIENT_SECRET` - Only if you want Google OAuth login
- `PORT` - Defaults to 5000 if not set
- `BASE_URL` - Defaults to localhost if not set

### Google OAuth Warning:
You'll see a warning: `"Google OAuth env vars missing – auth disabled"`

**This is NORMAL and OKAY!** Google OAuth is optional. You can ignore this warning.

---

## 🚨 Common Issues

### "DATABASE_URL must be set"
→ You forgot to add your Neon database URL to `.env`

### "Cannot connect to database"
→ Your Neon database might be asleep (free tier). Visit the Neon dashboard to wake it up.

### "API key invalid"
→ Double-check you copied the entire API key correctly

### "Port 5000 already in use"
→ Add `PORT=3000` to your `.env` file (or any other available port)

**For more solutions**, check `TROUBLESHOOTING.md`

---

## 🎯 Next Steps

After you get it running:

1. ✅ Test all features using the checklist in `CHECKLIST.md`
2. 📖 Read `API.md` to understand available endpoints
3. 🎨 Customize the UI/UX as needed
4. 🚀 Deploy to production (Vercel, Netlify, Railway, etc.)

---

## 📊 Project Status

✅ **Core Features**: Complete  
✅ **Documentation**: Complete  
✅ **Configuration**: Ready  
⚠️ **Environment Variables**: **YOU NEED TO ADD YOUR CREDENTIALS**  
⏳ **Testing**: Ready for your testing  

---

## 🎉 Ready to Go!

Edit the `.env` file with your credentials, then run:

```bash
npm run dev
```

Visit: **http://localhost:5000**

Enjoy building with Vidya! 🚀

---

**Questions?** Check these docs:
- `SETUP.md` - Detailed setup guide
- `TROUBLESHOOTING.md` - Common issues \u0026 solutions  
- `API.md` - API endpoint reference
- `CHECKLIST.md` - Feature verification
- `README.md` - Project overview

**Last Updated**: 2026-02-07 by Antigravity AI Assistant
