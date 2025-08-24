export function clientLoader() {
  return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/mail/inbox`);
}
