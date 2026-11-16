-- Rider contact email, collected at registration and editable from the partner profile.
-- Nullable for riders onboarded before this column existed.
alter table delivery.delivery_boys
  add column if not exists email text;

comment on column delivery.delivery_boys.email is
  'Rider contact email; collected at registration and editable via PUT /delivery/me.';
