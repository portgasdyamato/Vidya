-- Create default user for guest uploads
INSERT INTO users (id, username, password, created_at)
VALUES ('default-user', 'default-user', '', NOW())
ON CONFLICT (id) DO NOTHING;

-- Verify the user was created
SELECT * FROM users WHERE username = 'default-user';
