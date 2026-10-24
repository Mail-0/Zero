export type AssistantEmailPreviewData = {
  fromEmail?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  attachments?: { filename: string; size: number }[];
};

export function AssistantEmailPreview({ email }: { email: AssistantEmailPreviewData }) {
  const addresses = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value.join(', ') : value;
  return (
    <article className="space-y-4 rounded-md border p-4" aria-label="Email preview">
      <dl className="space-y-2 text-sm">
        {email.fromEmail && (
          <div>
            <dt className="text-muted-foreground">From</dt>
            <dd className="break-words">{email.fromEmail}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">To</dt>
          <dd className="break-words">{addresses(email.to)}</dd>
        </div>
        {addresses(email.cc) && (
          <div>
            <dt className="text-muted-foreground">Cc</dt>
            <dd className="break-words">{addresses(email.cc)}</dd>
          </div>
        )}
        {addresses(email.bcc) && (
          <div>
            <dt className="text-muted-foreground">Bcc</dt>
            <dd className="break-words">{addresses(email.bcc)}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Subject</dt>
          <dd className="font-medium break-words">{email.subject || '(no subject)'}</dd>
        </div>
      </dl>
      <div className="max-h-[60vh] overflow-auto border-t pt-4 text-sm break-words whitespace-pre-wrap">
        {email.body}
      </div>
      {!!email.attachments?.length && (
        <p
          aria-label="Attachments"
          className="border-t pt-4 text-sm break-words whitespace-pre-wrap"
        >
          {email.attachments
            .map((file) => `${file.filename} (${file.size.toLocaleString()} bytes)`)
            .join('\n')}
        </p>
      )}
    </article>
  );
}
