begin;

create function public.preview_team_invitation(raw_token text)
returns table (
  email text,
  business_name text,
  member_role public.app_role,
  expires_at timestamptz,
  status public.team_invitation_status
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  token_digest text;
begin
  if char_length(coalesce(raw_token, '')) < 32 then
    return;
  end if;

  token_digest := encode(digest(raw_token, 'sha256'), 'hex');

  return query
  select
    i.email,
    b.name,
    i.role,
    i.expires_at,
    i.status
  from public.team_invitations i
  join public.businesses b on b.id = i.business_id
  where i.token_hash = token_digest
  limit 1;
end;
$$;

revoke all on function public.preview_team_invitation(text)
  from public, anon, authenticated;
grant execute on function public.preview_team_invitation(text)
  to anon, authenticated;

comment on function public.preview_team_invitation(text) is
  'Returns the email and workspace for a raw invite token so a new teammate can create a password before signing in. Does not accept the invite.';

commit;
