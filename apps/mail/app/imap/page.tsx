import { useEffect, useRef, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { TRPCProvider, trpcClient, useTRPC } from '@/providers/query-provider';

const field = 'w-full rounded-md border bg-background px-3 py-2 text-sm';
const button = 'rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请检查连接。';
const recipients = (value: string) => value.split(/[,;，；]/).map((email) => email.trim()).filter(Boolean).map((email) => ({ email }));

// Use a private, memory-only cache: the upstream QueryProvider persists mail queries to IndexedDB.
export default function ImapWorkspace() {
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 },
  } }));
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}>
    <TRPCProvider trpcClient={trpcClient} queryClient={client}><ImapWorkspaceContent /></TRPCProvider>
  </QueryClientProvider>;
}

function ImapWorkspaceContent() {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const accounts = useQuery({ ...trpc.imap.accounts.queryOptions(), retry: false });
  const aiSettings = useQuery({ ...trpc.imap.aiSettings.queryOptions(), retry: false });
  const [accountId, setAccountId] = useState('');
  const [folder, setFolder] = useState('INBOX');
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [replyHeaders, setReplyHeaders] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const operationId = useRef<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [aiText, setAiText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [destination, setDestination] = useState('');
  const [files, setFiles] = useState<{ name: string; type: string; size: number; lastModified: number; base64: string }[]>([]);

  useEffect(() => {
    if (!accounts.data?.some((a) => a.id === accountId)) setAccountId(accounts.data?.[0]?.id || '');
  }, [accounts.data, accountId]);
  useEffect(() => {
    setFolder('INBOX'); setCursor(undefined); setSelectedId(''); setComposeOpen(false);
    setAttempted(false); operationId.current = null; setAiText(''); setConsent(false);
  }, [accountId]);
  useEffect(() => { setSelectedId(''); setAiText(''); }, [folder, cursor, query]);

  const folders = useQuery({ ...trpc.imap.folders.queryOptions({ accountId }), enabled: !!accountId, retry: false });
  const list = useQuery({ ...trpc.imap.list.queryOptions({ accountId, folder, query, pageToken: cursor }),
    enabled: !!accountId, retry: false, refetchInterval: 60000, refetchIntervalInBackground: false });
  const thread = useQuery({ ...trpc.imap.get.queryOptions({ accountId, id: selectedId }),
    enabled: !!accountId && !!selectedId, retry: false });
  const message = thread.data?.latest || thread.data?.messages[0];
  const add = useMutation({ ...trpc.imap.addAccount.mutationOptions(), retry: false });
  const remove = useMutation({ ...trpc.imap.removeAccount.mutationOptions(), retry: false });
  const configure = useMutation({ ...trpc.imap.configureAi.mutationOptions(), retry: false });
  const forgetAi = useMutation({ ...trpc.imap.removeAi.mutationOptions(), retry: false });
  const modify = useMutation({ ...trpc.imap.modify.mutationOptions(), retry: false });
  const move = useMutation({ ...trpc.imap.move.mutationOptions(), retry: false });
  const send = useMutation({ ...trpc.imap.send.mutationOptions(), retry: false });
  const generate = useMutation({ ...trpc.imap.generate.mutationOptions(), retry: false });
  const busy = send.isPending || modify.isPending || move.isPending || generate.isPending;

  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: trpc.imap.list.queryKey() });
    if (selectedId) await cache.invalidateQueries({ queryKey: trpc.imap.get.queryKey() });
  };
  const run = async (task: () => Promise<unknown>, success: string) => {
    setStatus('');
    try { await task(); setStatus(success); } catch (error) { setStatus(errorText(error)); }
  };
  const newDraft = (reply = false) => {
    if (attempted && !window.confirm('上一次发送可能已经成功。请先检查已发送文件夹；确认要创建一个新的发送操作吗？')) return;
    setTo(reply && message ? message.replyTo || message.sender.email : '');
    setSubject(reply && message ? (/^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`) : '');
    setBody(''); setFiles([]); setAttempted(false); operationId.current = crypto.randomUUID();
    setReplyHeaders(reply && message?.messageId ? { 'In-Reply-To': message.messageId,
      References: [message.references, message.messageId].filter(Boolean).join(' ') } : {});
    setComposeOpen(true);
  };
  const download = (name: string, mime: string, encoded: string) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const link = document.createElement('a'); link.href = url; link.download = name.replace(/[\/\\]/g, '_');
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <main className="bg-background text-foreground h-dvh w-full overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-xl font-semibold">Zero · IMAP 邮箱</h1>
            <p className="text-muted-foreground text-sm">实验性自托管工作区 · 前台刷新 · 不会自动发送或删除邮件</p></div>
          <nav className="flex gap-2"><Link to="/mail" className={button}>原收件箱</Link>
            <button className={button} onClick={() => setSettingsOpen(!settingsOpen)}>邮箱与 AI 设置</button></nav>
        </header>
        {accounts.error && <p role="alert" className="rounded-md border p-3">{errorText(accounts.error)} <Link to="/login" className="underline">登录 Zero</Link></p>}
        {status && <p role="status" className="whitespace-pre-wrap rounded-md border p-3 text-sm">{status}</p>}
        {(settingsOpen || accounts.data?.length === 0) && <section className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <form className="space-y-3" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
            void run(async () => {
              await add.mutateAsync({ preset: data.get('preset') as 'qq' | '163' | '126' | 'icloud' | 'custom',
                email: String(data.get('email')), name: String(data.get('name')), password: String(data.get('password')),
                imapHost: String(data.get('imapHost') || '') || undefined, smtpHost: String(data.get('smtpHost') || '') || undefined,
                smtpPort: Number(data.get('smtpPort')) as 465 | 587, saveSent: data.get('saveSent') === 'on' });
              form.reset(); await accounts.refetch();
            }, '邮箱连接成功。授权码已保存在服务器的加密存储中。');
          }}>
            <h2 className="font-medium">添加 IMAP / SMTP 邮箱</h2>
            <label className="block text-sm">服务商<select name="preset" className={field}><option value="qq">QQ</option><option value="163">163</option><option value="126">126</option><option value="icloud">iCloud</option><option value="custom">自定义（需管理员允许主机）</option></select></label>
            <label className="block text-sm">邮箱地址<input name="email" type="email" required className={field} autoComplete="email" /></label>
            <label className="block text-sm">发件人名称<input name="name" className={field} maxLength={128} /></label>
            <label className="block text-sm">客户端授权码<input name="password" type="password" required className={field} autoComplete="new-password" /></label>
            <details className="text-sm"><summary className="cursor-pointer">自定义服务器 / 已发送副本</summary>
              <label className="mt-2 block">IMAP 主机（固定 TLS 993）<input name="imapHost" className={field} placeholder="imap.example.com" /></label>
              <label className="block">SMTP 主机<input name="smtpHost" className={field} placeholder="smtp.example.com" /></label>
              <label className="block">SMTP 端口<select name="smtpPort" className={field}><option value="465">465 / TLS</option><option value="587">587 / STARTTLS</option></select></label>
              <label className="mt-2 flex gap-2"><input name="saveSent" type="checkbox" />由客户端保存已发送副本（服务商自动保存时不要开启，否则可能重复）</label>
            </details>
            <button className={button} disabled={add.isPending}>{add.isPending ? '验证 IMAP 和 SMTP…' : '验证并添加'}</button>
            <p className="text-muted-foreground text-xs">不是邮箱登录密码。需先在服务商设置里开启 IMAP/SMTP。此处绑定邮箱，不新增 Zero 登录方式。</p>
          </form>
          <form className="space-y-3" key={`${aiSettings.data?.baseUrl}-${aiSettings.data?.model}`} onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
            void run(async () => {
              const apiKey = String(data.get('apiKey'));
              await configure.mutateAsync({ baseUrl: String(data.get('baseUrl')), model: String(data.get('model')),
                ...(apiKey ? { apiKey } : {}) });
              (form.elements.namedItem('apiKey') as HTMLInputElement).value = '';
              await aiSettings.refetch();
            }, 'AI 配置已加密保存。计费来自你配置的 API 服务商。');
          }}>
            <h2 className="font-medium">AI / 自定义兼容 API</h2>
            <p className="text-muted-foreground text-sm">支持 Chat Completions 兼容端点，包括经管理员允许的本地模型。不共享 Zero 云端会员额度。</p>
            {aiSettings.error && <p role="alert">{errorText(aiSettings.error)}</p>}
            <label className="block text-sm">Base URL<input name="baseUrl" type="url" required className={field} defaultValue={aiSettings.data?.baseUrl} placeholder="https://api.example.com/v1" /></label>
            <label className="block text-sm">模型名称<input name="model" required className={field} defaultValue={aiSettings.data?.model} /></label>
            <label className="block text-sm">API Key<input name="apiKey" type="password" className={field} autoComplete="new-password" placeholder={aiSettings.data?.hasKey ? '已保存；留空保持原 Key' : '无鉴权本地服务可留空'} /></label>
            <p className="break-all text-xs">允许的服务地址：{aiSettings.data?.allowedOrigins.join('，') || '管理员尚未配置 BRIDGE_ALLOWED_AI_ORIGINS'}</p>
            <div className="flex gap-2"><button className={button} disabled={configure.isPending}>保存配置</button>
              <button type="button" className={button} disabled={forgetAi.isPending} onClick={() => void run(async () => { await forgetAi.mutateAsync(); await aiSettings.refetch(); }, 'AI 配置已删除。')}>删除 Key 和配置</button></div>
            <p className="text-muted-foreground text-xs">此配置只作用于本 IMAP 工作区；尚未替换上游的全局 AI Agent。</p>
          </form>
        </section>}
        {!!accounts.data?.length && <>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="当前邮箱" className={`${field} max-w-xs`} value={accountId} disabled={busy} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.data.map((a) => <option key={a.id} value={a.id}>{a.name || a.email} · {a.email}</option>)}
            </select>
            <select aria-label="文件夹" className={`${field} max-w-xs`} value={folder} onChange={(event) => { setFolder(event.target.value); setCursor(undefined); }}>
              <option value="INBOX">INBOX</option>{folders.data?.filter((f) => f.id !== 'INBOX').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className={button} disabled={list.isFetching} onClick={() => { setCursor(undefined); void refresh(); }}>刷新</button>
            <button className={button} disabled={busy} onClick={() => newDraft()}>写邮件</button>
            <button className={button} disabled={remove.isPending || busy} onClick={() => {
              if (window.confirm('断开此邮箱并删除服务器保存的授权码？不会删除服务商邮件。')) void run(async () => { await remove.mutateAsync({ accountId }); await accounts.refetch(); }, '已断开邮箱。');
            }}>断开邮箱</button>
          </div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search); setCursor(undefined); }}>
            <input aria-label="搜索当前文件夹" className={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="当前文件夹全文检索（普通文本，不是 Gmail 查询语法）" maxLength={512} />
            <button className={button}>搜索</button>
          </form>
          {(folders.error || list.error || thread.error) && <p role="alert" className="rounded-md border p-3 text-sm">{errorText(folders.error || list.error || thread.error)}</p>}
          <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
            <section className="rounded-lg border p-2">
              {list.isFetching && <p className="p-2 text-sm">读取中…</p>}
              {list.data?.threads.length === 0 && <p className="p-3 text-sm">当前文件夹没有匹配邮件。</p>}
              {list.data?.threads.map((item) => <button key={item.id} className={`hover:bg-muted block w-full rounded-md p-3 text-left ${selectedId === item.id ? 'bg-muted' : ''}`} onClick={() => { setSelectedId(item.id); setAiText(''); }}>
                <div className={item.$raw.unread ? 'font-semibold' : ''}>{item.$raw.starred ? '★ ' : ''}{item.$raw.subject || '（无主题）'}</div>
                <div className="text-muted-foreground truncate text-xs">{item.$raw.sender}</div>
                <time className="text-muted-foreground text-xs">{new Date(item.$raw.receivedOn).toLocaleString()}</time>
              </button>)}
              <div className="flex gap-2 p-2"><button className={button} disabled={!cursor} onClick={() => setCursor(undefined)}>首页</button>
                <button className={button} disabled={!list.data?.nextPageToken || list.isFetching} onClick={() => setCursor(list.data?.nextPageToken || undefined)}>下一页</button></div>
            </section>
            <section className="min-w-0 space-y-3 rounded-lg border p-4">
              {!message && <p className="text-muted-foreground text-sm">选择一封邮件。HTML 已清理，远程图片不会加载。</p>}
              {message && <>
                <h2 className="break-words text-lg font-semibold">{message.subject || '（无主题）'}</h2>
                <p className="break-all text-sm">{message.sender.name} &lt;{message.sender.email}&gt; → {message.to.map((a) => a.email).join(', ')}</p>
                <div className="flex flex-wrap gap-2">
                  <button className={button} disabled={busy} onClick={() => newDraft(true)}>回复</button>
                  <button className={button} disabled={busy} onClick={() => void run(async () => { await modify.mutateAsync({ accountId, ids: [selectedId], addLabels: message.unread ? [] : ['UNREAD'], removeLabels: message.unread ? ['UNREAD'] : [] }); await refresh(); }, '已更新已读状态。')}>{message.unread ? '标为已读' : '标为未读'}</button>
                  <button className={button} disabled={busy} onClick={() => void run(async () => { const starred = message.tags.some((t) => t.id === 'STARRED'); await modify.mutateAsync({ accountId, ids: [selectedId], addLabels: starred ? [] : ['STARRED'], removeLabels: starred ? ['STARRED'] : [] }); await refresh(); }, '星标已更新。')}>切换星标</button>
                </div>
                <div className="flex gap-2"><select aria-label="移动目标文件夹" className={field} value={destination} onChange={(e) => setDestination(e.target.value)}><option value="">选择移动目标（垃圾箱也是文件夹）</option>{folders.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                  <button className={button} disabled={!destination || busy} onClick={() => {
                    if (window.confirm('确认将这封邮件移动到所选文件夹？')) void run(async () => { await move.mutateAsync({ accountId, id: selectedId, destination }); setSelectedId(''); await refresh(); }, '已移动邮件。');
                  }}>移动</button></div>
                <iframe title="邮件正文" sandbox="" referrerPolicy="no-referrer" className="h-[50vh] w-full rounded-md border bg-white" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body{font:15px/1.6 system-ui;padding:12px;overflow-wrap:anywhere}table{max-width:100%}</style></head><body>${message.processedHtml}</body></html>`} />
                {!!message.attachments?.length && <div className="flex flex-wrap gap-2">{message.attachments.map((a) => <button className={button} key={a.attachmentId} onClick={() => download(a.filename, a.mimeType, a.body)}>{a.filename} · {Math.ceil(a.size / 1024)} KB ↓</button>)}</div>}
                <div className="space-y-2 border-t pt-3">
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />允许把所选邮件的发件人、主题和最多 16,000 字符正文发送给我配置的 AI 服务商。</label>
                  <input aria-label="AI 补充要求" className={field} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="补充要求，例如翻译为英文、回复语气简短…" maxLength={8000} />
                  <div className="flex gap-2">{(['summarize', 'reply', 'translate'] as const).map((task) => <button key={task} className={button} disabled={!consent || busy} onClick={() => void run(async () => { const result = await generate.mutateAsync({ accountId, id: selectedId, task, instructions, consent: true }); setAiText(result.text); }, 'AI 输出仅供审核，未发送任何邮件。')}>{task === 'summarize' ? '摘要' : task === 'reply' ? '起草回复' : '翻译'}</button>)}</div>
                  {aiText && <pre className="bg-muted whitespace-pre-wrap rounded-md p-3 text-sm">{aiText}</pre>}
                </div>
              </>}
            </section>
          </div>
          {composeOpen && <form className="space-y-3 rounded-lg border p-4" onSubmit={(event) => {
            event.preventDefault(); if (!window.confirm(`确认立即发送给 ${to}？这不是定时发送，也不能撤回。`)) return;
            operationId.current ||= crypto.randomUUID(); setAttempted(true);
            void run(async () => {
              const result = await send.mutateAsync({ accountId, operationId: operationId.current!, to: recipients(to), subject,
                message: `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`, headers: replyHeaders, attachments: files });
              setComposeOpen(false); await refresh();
              if (result.rejected.length || result.sentCopySaved === false) throw new Error(`SMTP 已接受发送；不要整封重发。拒收地址：${result.rejected.join(', ') || '无'}。已发送副本保存失败：${result.sentCopySaved === false}。`);
            }, 'SMTP 已接受邮件。发送被接收不等于对方已阅读。');
          }}>
            <h2 className="font-medium">写邮件 · 立即发送</h2>
            <label className="block text-sm">收件人（逗号分隔）<input required className={field} value={to} disabled={attempted} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="block text-sm">主题<input className={field} value={subject} maxLength={998} disabled={attempted} onChange={(e) => setSubject(e.target.value)} /></label>
            <label className="block text-sm">正文<textarea className={`${field} min-h-48`} value={body} disabled={attempted} onChange={(e) => setBody(e.target.value)} /></label>
            {aiText && <button type="button" className={button} disabled={attempted} onClick={() => setBody(aiText)}>把 AI 输出填入正文（仍需手动发送）</button>}
            <label className="block text-sm">附件（合计 ≤ 8 MiB）<input type="file" multiple disabled={attempted} onChange={async (e) => {
              const input = e.currentTarget;
              try {
                const selected = Array.from(input.files || []);
                if (selected.length > 20 || selected.reduce((sum, f) => sum + f.size, 0) > 8 * 1024 * 1024) throw Error('附件超出数量或大小限制。');
                const encoded = await Promise.all(selected.map((file) => new Promise<{ name: string; type: string; size: number; lastModified: number; base64: string }>((resolve, reject) => {
                  const reader = new FileReader(); reader.onerror = () => reject(Error('附件读取失败'));
                  reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, base64: String(reader.result).split(',')[1] || '' }); reader.readAsDataURL(file);
                })));
                setFiles(encoded);
              } catch (error) { input.value = ''; setFiles([]); setStatus(errorText(error)); }
            }} /></label>
            {attempted && <p className="text-sm">保留同一个发送操作 ID 防止重复。发生超时或 SEND_UNCERTAIN 时先检查“已发送”；不要直接新建操作重发。草稿仅在当前页面内存中。</p>}
            <button className={button} disabled={send.isPending}>{send.isPending ? '正在发送…' : attempted ? '查询同一发送操作的结果 / 重试同一 ID' : '审核后发送'}</button>
          </form>}
        </>}
        <footer className="text-muted-foreground text-xs">第一版：IMAP 账号暂不合并进上游 Gmail/Outlook 的分片收件箱；无后台推送、离线正文缓存、会话聚合、定时发信或永久删除。刷新会同步服务商当前状态。</footer>
      </div>
    </main>
  );
}
