# 🔧 Troubleshooting Guide for Vidya

Common issues and their solutions.

## Installation Issues

### Problem: `npm install` fails
**Solutions:**
1. Make sure you have Node.js \u003e= 20 installed:
   ```bash
   node --version
   ```
2. Clear npm cache and try again:
   ```bash
   npm cache clean --force
   npm install
   ```
3. Delete `node_modules` and `package-lock.json`, then reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## Environment Configuration

### Problem: "DATABASE_URL must be set"
**Solution:**
1. Create a `.env` file in the project root (copy from `.env.example`)
2. Sign up for a free Neon PostgreSQL database at https://neon.tech
3. Copy your connection string and add it to `.env`:
   ```
   DATABASE_URL=postgresql://user:password@host/database
   ```

### Problem: "OPENAI_API_KEY" or "GEMINI_API_KEY" missing
**Solution:**
You need at least one AI provider configured:

**Option 1: OpenAI**
1. Visit https://platform.openai.com/api-keys
2. Create a new API key
3. Add to `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```

**Option 2: Google Gemini**
1. Visit https://ai.google.dev/
2. Get your API key
3. Add to `.env`:
   ```
   GEMINI_API_KEY=...
   ```

### Problem: Google OAuth not working
**Solution:**
1. This is OPTIONAL - you can ignore the warning if you don't need Google login
2. To enable it:
   - Visit https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:5000/auth/google/callback`
   - Add credentials to `.env`:
     ```
     GOOGLE_CLIENT_ID=...
     GOOGLE_CLIENT_SECRET=...
     ```

## Database Issues

### Problem: Database connection fails
**Solutions:**
1. Verify your DATABASE_URL is correct
2. Check if your Neon database is active (free tier may sleep)
3. Test connection directly:
   ```bash
   npm run db:push
   ```

### Problem: "relation does not exist"
**Solution:**
Run database migrations:
```bash
npm run db:push
```

### Problem: Database schema out of sync
**Solution:**
The app auto-creates schema on startup, but you can also run:
```bash
npm run db:push
```

## Runtime Errors

### Problem: Port 5000 already in use
**Solution:**
Change the port in `.env`:
```
PORT=3000
```

### Problem: "Cannot find module"
**Solution:**
1. Make sure all dependencies are installed:
   ```bash
   npm install
   ```
2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```

### Problem: TypeScript errors
**Solution:**
Run type checking:
```bash
npm run check
```

## File Upload Issues

### Problem: File upload fails
**Solutions:**
1. Check file size (very large files may timeout)
2. Verify `uploads/` directory exists and is writable
3. Check server logs for specific error messages

### Problem: "File type not supported"
**Solution:**
Supported file types:
- Documents: `.pdf`, `.docx`
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: YouTube URLs (direct video upload support varies)
- Audio: `.mp3`, `.wav`, `.m4a`, `.ogg`

## AI Processing Issues

### Problem: Processing stuck at "pending"
**Solutions:**
1. Check server console logs for errors
2. Verify API keys are valid (OpenAI or Gemini)
3. Check API quota/credits aren't exhausted
4. Restart the server

### Problem: Poor quality transcriptions
**Solutions:**
1. Use clear audio without background noise
2. Try a different audio format
3. Check if OpenAI Whisper API is working (status.openai.com)

### Problem: AI responses are slow
**Explanation:**
This is normal - AI processing can take time:
- Document summarization: 10-30 seconds
- Image analysis: 5-15 seconds  
- Video transcription: 1-5 minutes (depends on length)
- Podcast generation: 30-60 seconds

## Build Issues

### Problem: `npm run build` fails
**Solutions:**
1. Fix TypeScript errors first:
   ```bash
   npm run check
   ```
2. Clear dist folder and rebuild:
   ```bash
   rm -rf dist
   npm run build
   ```

### Problem: Vite build errors
**Solution:**
Check for:
- Missing imports
- Incorrect file paths
- TypeScript errors
- Missing environment variables

## Performance Issues

### Problem: App is slow
**Solutions:**
1. Check database connection speed
2. Verify API response times
3. Monitor server resource usage
4. Clear browser cache
5. Check network connection

### Problem: High memory usage
**Solutions:**
1. Process smaller files at a time
2. Restart the server periodically
3. Check for memory leaks in logs
4. Increase server memory allocation if needed

## Authentication Issues

### Problem: Can't log in with Google
**Solutions:**
1. Verify OAuth credentials are correct
2. Check redirect URI matches exactly
3. Ensure session secret is set
4. Clear browser cookies and try again

### Problem: Session expires too quickly
**Solution:**
Sessions are stored in-memory by default. For production, consider:
- Using a database session store
- Configuring session timeout in `server/index.ts`

## Development Issues

### Problem: Hot Module Replacement (HMR) not working
**Solutions:**
1. Restart development server
2. Clear browser cache
3. Check Vite configuration
4. Hard refresh browser (Ctrl+Shift+R)

### Problem: Changes not reflecting
**Solutions:**
1. Restart dev server
2. Check if file is being watched
3. Hard refresh browser
4. Clear build cache:
   ```bash
   rm -rf dist node_modules/.vite
   ```

## Production Deployment

### Problem: Build works locally but fails on server
**Solutions:**
1. Verify Node.js version matches
2. Check all environment variables are set
3. Ensure build directory is writable
4. Review deployment logs

### Problem: Static files not serving
**Solution:**
Check `server/vite.ts` configuration for static file serving.

## Getting Help

If you're still stuck:

1. **Check the logs:** Server logs often contain detailed error messages
2. **Search issues:** Check GitHub issues for similar problems
3. **Create an issue:** Provide:
   - Node.js version
   - npm version
   - Error messages
   - Steps to reproduce
   - Environment (OS, deployment platform)

## Useful Commands

```bash
# Check environment configuration
npm run preflight

# Run type checking
npm run check

# Push database schema
npm run db:push

# Clear everything and start fresh
rm -rf node_modules dist .vite
npm install
npm run dev
```

---

**Last Updated**: 2026-02-07
**Need more help?** Check README.md and SETUP.md for additional documentation.
