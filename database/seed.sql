INSERT INTO public.restaurant_staff (restaurant_id, user_id, role)
VALUES ('default-restaurant', 'demo-user-id', 'admin')
ON CONFLICT DO NOTHING;