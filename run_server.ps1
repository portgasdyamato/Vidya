# Temporary helper script to load .env, set env vars and start the dev server
# If a `.env` file exists in the repository root, load simple KEY=VALUE lines (ignores comments).
if (Test-Path -Path ".env") {
	Get-Content .env | ForEach-Object {
		if ($_ -match '^\s*([^#=]+?)\s*=\s*(.+)$') {
			$key = $matches[1].Trim()
			$val = $matches[2].Trim().Trim('"', "'")
			$env:${key} = $val
		}
	}
}

# Ensure DATABASE_URL is set to a sensible default if not present in .env
if (-not $env:DATABASE_URL) {
	$env:DATABASE_URL = 'postgresql://neondb_owner:npg_xXeZ0I1ugwKM@ep-small-credit-ahz8phlh-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
}

if (-not $env:NODE_ENV) {
	$env:NODE_ENV = 'development'
}

# Start the server
npx tsx server/index.ts
