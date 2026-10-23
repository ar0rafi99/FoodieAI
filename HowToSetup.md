## Seed demo data (optional)
After schema.sql, run database/seed.sql in the Supabase SQL Editor.

## Which Supabase key?
NEXT_PUBLIC_SUPABASE_ANON_KEY = the "anon public" (or "publishable") key from
Project Settings -> API. Never use the service_role / secret key.

## Create the first admin
1. Open the site and sign up with your email.
2. In the Supabase SQL Editor run (replace the email):

```sql
insert into restaurant_staff (restaurant_id, user_id)
select r.id, u.id
from restaurants r, auth.users u
where r.slug = 'foodieai-kitchen' and u.email = 'your@email.com';
```

3. Sign in on the home page, then open /admin.

## Docker
```bash
cp .env.example .env      # fill in your own values
docker compose up --build -d
```
Open http://localhost:3000. The database is Supabase (not inside Docker).