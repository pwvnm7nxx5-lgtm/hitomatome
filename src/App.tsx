import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type ItemType = 'event' | 'task'
type Category = '仕事' | '私生活'
type View = 'today' | 'inbox' | 'all' | 'import' | 'help'
type Item = { id: string; type: ItemType; title: string; date: string; startTime: string; endTime: string; category: Category; notes: string; done: boolean; confirmed: boolean; createdAt: string }

const STORAGE_KEY = 'matome-schedule-items-v1'
const RECOVERY_KEY = `${STORAGE_KEY}-recovery`
const pad = (value: number) => String(value).padStart(2, '0')
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const today = () => localDate(new Date())
const isValidDate = (value: string) => {
  if (value === '') return true
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
}
const isValidTime = (value: string) => value === '' || (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
const isItemArray = (value: unknown): value is Item[] => Array.isArray(value) && value.every((item) => {
  if (!item || typeof item !== 'object') return false
  const entry = item as Partial<Item>
  return typeof entry.id === 'string' && (entry.type === 'event' || entry.type === 'task') &&
    typeof entry.title === 'string' && typeof entry.date === 'string' && isValidDate(entry.date) &&
    typeof entry.startTime === 'string' && isValidTime(entry.startTime) &&
    typeof entry.endTime === 'string' && isValidTime(entry.endTime) &&
    (entry.category === '仕事' || entry.category === '私生活') &&
    typeof entry.notes === 'string' && typeof entry.done === 'boolean' &&
    typeof entry.confirmed === 'boolean' && typeof entry.createdAt === 'string'
})

const sampleItems: Item[] = [{ id: crypto.randomUUID(), type: 'task', title: '週案を確認する', date: today(), startTime: '', endTime: '', category: '仕事', notes: '初期サンプルです。完了または削除できます。', done: false, confirmed: true, createdAt: new Date().toISOString() }]

function loadItems(): Item[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return sampleItems
  try {
    const parsed: unknown = JSON.parse(stored)
    if (isItemArray(parsed)) return parsed
  } catch {
    // Preserve unreadable data so it is not silently lost when the app starts.
  }
  localStorage.setItem(RECOVERY_KEY, stored)
  return sampleItems
}

function parseQuickInput(text: string): Partial<Item> {
  const now = new Date()
  let date = ''
  if (text.includes('今日')) date = localDate(now)
  if (text.includes('明日')) { const next = new Date(now); next.setDate(now.getDate() + 1); date = localDate(next) }
  const slashDate = text.match(/(\d{1,2})[月/](\d{1,2})日?/)
  if (slashDate) {
    const month = Number(slashDate[1])
    const day = Number(slashDate[2])
    const candidate = new Date(now.getFullYear(), month - 1, day)
    if (candidate.getMonth() === month - 1 && candidate.getDate() === day) {
      if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) candidate.setFullYear(now.getFullYear() + 1)
      date = localDate(candidate)
    }
  }
  const meridiemTime = text.match(/(午前|午後)\s*(\d{1,2})時(?:(\d{1,2})分?|半)?/)
  const time = text.match(/(\d{1,2})(?:[:時](\d{1,2})?)\s*(?:分|半)?/)
  let hour = Number(time?.[1] ?? 0)
  let minute = text.match(/\d{1,2}時半/) ? 30 : Number(time?.[2] ?? 0)
  if (meridiemTime) {
    hour = Number(meridiemTime[2]) % 12 + (meridiemTime[1] === '午後' ? 12 : 0)
    minute = meridiemTime[0].includes('半') ? 30 : Number(meridiemTime[3] ?? 0)
  }
  const timeCandidate = time ? `${pad(hour)}:${pad(minute)}` : ''
  const startTime = isValidTime(timeCandidate) ? timeCandidate : ''
  const title = text.replace(/今日|明日|午前|午後/g, '').replace(/\d{1,2}[月/]\d{1,2}日?/g, '').replace(/\d{1,2}(?:[:時]\d{0,2})\s*(?:分|半)?/g, '').replace(/\s+/g, ' ').trim()
  return { title: title || text.trim(), date, startTime }
}

function googleCalendarUrl(item: Item) {
  const compact = (value: string) => value.replaceAll('-', '').replaceAll(':', '')
  const start = item.startTime ? `${compact(item.date)}T${compact(item.startTime)}00` : compact(item.date)
  let end: string
  if (item.endTime) {
    end = `${compact(item.date)}T${compact(item.endTime)}00`
  } else if (item.startTime) {
    const endTime = new Date(`${item.date}T${item.startTime}:00`)
    endTime.setHours(endTime.getHours() + 1)
    end = `${compact(localDate(endTime))}T${pad(endTime.getHours())}${pad(endTime.getMinutes())}00`
  } else {
    const nextDate = new Date(`${item.date}T00:00:00`)
    nextDate.setDate(nextDate.getDate() + 1)
    end = compact(localDate(nextDate))
  }
  const params = new URLSearchParams({ action: 'TEMPLATE', text: item.title, dates: `${start}/${end}`, details: item.notes })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function App() {
  const [view, setView] = useState<View>('today')
  const [items, setItems] = useState<Item[]>(loadItems)
  const [quickText, setQuickText] = useState('')
  const [draft, setDraft] = useState<Partial<Item> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [hasRecovery, setHasRecovery] = useState(() => Boolean(localStorage.getItem(RECOVERY_KEY)))
  const titleInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLFormElement>(null)
  const wasDraftOpen = useRef(false)

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)), [items])
  const openItems = useMemo(() => items.filter((item) => !item.done).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)), [items])
  const todayItems = openItems.filter((item) => item.date === today())
  const inboxItems = openItems.filter((item) => !item.confirmed || !item.date)
  const completedItems = items.filter((item) => item.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const addQuick = () => {
    if (quickText.trim()) setDraft({ ...parseQuickInput(quickText), type: 'task', category: '仕事', endTime: '', notes: '' })
  }
  const saveDraft = () => {
    if (!draft?.title?.trim()) return
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) {
      alert('終了時刻は開始時刻より後にしてください。')
      return
    }
    const item: Item = { id: crypto.randomUUID(), type: draft.type ?? 'task', title: draft.title.trim(), date: draft.date ?? '', startTime: draft.startTime ?? '', endTime: draft.endTime ?? '', category: draft.category ?? '仕事', notes: draft.notes ?? '', done: false, confirmed: Boolean(draft.date), createdAt: new Date().toISOString() }
    setItems((current) => editingId
      ? current.map((entry) => entry.id === editingId ? { ...entry, ...item, id: entry.id, createdAt: entry.createdAt } : entry)
      : [item, ...current])
    setQuickText(''); setDraft(null); setEditingId(null)
  }
  const editItem = (item: Item) => { setDraft(item); setEditingId(item.id) }
  const closeDraft = () => {
    if (window.confirm('入力中の内容を破棄しますか？')) {
      setDraft(null)
      setEditingId(null)
    }
  }
  useEffect(() => {
    if (!draft) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDraft()
      if (event.key === 'Tab' && modalRef.current) {
        const focusable = [...modalRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea')]
          .filter((element) => !element.hasAttribute('disabled'))
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [draft])
  useEffect(() => {
    if (draft && !wasDraftOpen.current) titleInputRef.current?.focus()
    wasDraftOpen.current = Boolean(draft)
  }, [draft])
  const deleteItem = (item: Item) => {
    if (window.confirm(`「${item.title}」を完全に削除しますか？`)) {
      setItems((current) => current.filter((entry) => entry.id !== item.id))
    }
  }
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { alert('このブラウザは音声入力に対応していません。'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ja-JP'
    recognition.onresult = (event) => { setQuickText(event.results[0][0].transcript); setVoiceStatus('音声を入力しました') }
    recognition.onerror = () => setVoiceStatus('音声入力に失敗しました')
    recognition.onend = () => setVoiceStatus((current) => current === '聞き取り中…' ? '音声入力を終了しました' : current)
    setVoiceStatus('聞き取り中…')
    recognition.start()
  }
  const importJson = () => {
    try {
      const parsed: unknown = JSON.parse(importText.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim())
      if (!Array.isArray(parsed)) throw new Error()
      const imported: Item[] = parsed.map((value) => {
        if (!value || typeof value !== 'object') throw new Error()
        const raw = value as Record<string, unknown>
        const title = typeof raw.title === 'string' ? raw.title.trim() : ''
        const date = typeof raw.date === 'string' ? raw.date : typeof raw.dueDate === 'string' ? raw.dueDate : ''
        const startTime = typeof raw.startTime === 'string' ? raw.startTime : ''
        const endTime = typeof raw.endTime === 'string' ? raw.endTime : ''
        if (!title || !isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime) || (startTime && endTime && endTime <= startTime)) throw new Error()
        return { id: crypto.randomUUID(), type: raw.type === 'event' ? 'event' : 'task', title, date, startTime, endTime, category: raw.category === '私生活' ? '私生活' : '仕事', notes: typeof raw.notes === 'string' ? raw.notes : '', done: false, confirmed: false, createdAt: new Date().toISOString() }
      })
      setItems((current) => [...imported, ...current]); setImportText(''); setImportMessage(`${imported.length}件を受信箱に追加しました。`); setView('inbox')
    } catch { setImportMessage('形式、日付、時刻を読み取れませんでした。日付はYYYY-MM-DD、時刻はHH:MMで確認してください。') }
  }
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hitomatome-backup-${today()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const restoreBackup = async (file?: File) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isItemArray(parsed)) throw new Error()
      if (window.confirm(`バックアップの${parsed.length}件で、現在のデータを置き換えますか？`)) setItems(parsed)
    } catch {
      alert('このファイルは、ひとまとめのバックアップとして読み込めませんでした。')
    }
  }
  const downloadRecovery = () => {
    const recovery = localStorage.getItem(RECOVERY_KEY)
    if (!recovery) return
    const blob = new Blob([recovery], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hitomatome-recovery-${today()}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }
  const dismissRecovery = () => {
    localStorage.removeItem(RECOVERY_KEY)
    setHasRecovery(false)
  }

  const prompt = `このプリントから予定とタスクを抽出してください。
個人情報は出力しないでください。日付や時刻が不明な場合は推測せず、空文字にしてください。
説明は書かず、次の形式のJSON配列だけを出力してください。

[
  {
    "type": "event または task",
    "title": "名称",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "category": "仕事",
    "notes": "補足"
  }
]`
  const copyPrompt = async () => { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1800) }

  const renderList = (list: Item[], empty: string, completed = false) => <div className="item-list">
    {list.length === 0 && <div className="empty">{empty}</div>}
    {list.map((item) => <article className={`item-card ${item.type}`} key={item.id}>
      <button className="check" aria-label={completed ? '未完了に戻す' : '完了にする'} onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, done: !completed } : entry))}>{completed ? '↩' : '✓'}</button>
      <div className="item-main"><div className="item-topline"><span className={`tag ${item.category === '私生活' ? 'private' : ''}`}>{item.category}</span><span className="type-label">{item.type === 'event' ? '予定' : 'タスク'}</span>{!item.confirmed && <span className="warning">要確認</span>}</div><strong>{item.title}</strong><div className="meta">{item.date || '日付未設定'} {item.startTime && `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ''}`}</div>{item.notes && <p>{item.notes}</p>}</div>
      <div className="item-actions">{!completed && <button onClick={() => editItem(item)}>編集</button>}{item.type === 'event' && item.date && !completed && <a href={googleCalendarUrl(item)} target="_blank" rel="noreferrer">Googleへ</a>}<button className="danger" onClick={() => deleteItem(item)}>削除</button></div>
    </article>)}
  </div>

  return <div className="app-shell">
    <header><div><p className="eyebrow">予定もタスクも、まずここへ</p><h1>ひとまとめ</h1></div><div className="today-label">{new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</div></header>
    {hasRecovery && <section className="recovery-alert" role="alert"><div><strong>以前の保存データを読み込めませんでした</strong><span>元データを復旧用ファイルとして保存できます。</span></div><button onClick={downloadRecovery}>復旧用データを保存</button><button onClick={dismissRecovery}>閉じる</button></section>}
    <section className="quick-add"><div className="quick-copy"><strong>すばやく追加</strong><span>「明日 16時 職員会議」のように入力</span>{voiceStatus && <span aria-live="polite">{voiceStatus}</span>}</div><div className="quick-controls"><label className="sr-only" htmlFor="quick-input">予定やタスク</label><input id="quick-input" value={quickText} onChange={(event) => setQuickText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addQuick()} placeholder="予定やタスクを入力..." /><button className="voice" onClick={startVoice}>音声</button><button className="primary" onClick={addQuick}>追加</button></div></section>
    <main><nav aria-label="メインメニュー"><button aria-current={view === 'today' ? 'page' : undefined} className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>今日 <b>{todayItems.length}</b></button><button aria-current={view === 'inbox' ? 'page' : undefined} className={view === 'inbox' ? 'active' : ''} onClick={() => setView('inbox')}>受信箱 <b>{inboxItems.length}</b></button><button aria-current={view === 'all' ? 'page' : undefined} className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>すべて <b>{openItems.length}</b></button><button aria-current={view === 'import' ? 'page' : undefined} className={view === 'import' ? 'active' : ''} onClick={() => setView('import')}>まとめて取込</button><button aria-current={view === 'help' ? 'page' : undefined} className={view === 'help' ? 'active' : ''} onClick={() => setView('help')}>使い方</button></nav>
      <section className="content">
        {view === 'today' && <><h2>今日やること</h2>{renderList(todayItems, '今日の予定・タスクはありません。')}</>}
        {view === 'inbox' && <><h2>確認待ち</h2><p className="lead">日付がないものや、まとめて取り込んだ項目を確認します。</p>{renderList(inboxItems, '確認待ちの項目はありません。')}</>}
        {view === 'all' && <><h2>すべての予定・タスク</h2>{renderList(openItems, '未完了の予定・タスクはありません。')}<h2 className="section-title">完了済み</h2>{renderList(completedItems, '完了済みの項目はありません。', true)}</>}
        {view === 'import' && <div className="panel"><h2>ChatGPTからまとめて取り込む</h2><p className="lead">ChatGPTが出力したJSONを、そのまま貼り付けてください。登録前に受信箱で確認できます。</p><label htmlFor="json-import">ChatGPTが出力したJSON</label><textarea id="json-import" rows={14} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='[{"type":"event","title":"授業参観", ...}]' />{importMessage && <p className="message" aria-live="polite">{importMessage}</p>}<button className="primary" onClick={importJson}>受信箱へ追加</button></div>}
        {view === 'help' && <div className="help"><h2>使い方</h2><section><h3>普段の追加</h3><p>画面上部へ「明日 16時 職員会議」のように入力します。候補を確認し、予定またはタスクとして保存してください。</p></section><section><h3>スマホのホーム画面へ追加</h3><p>iPhoneはSafariの共有ボタンから「ホーム画面に追加」、AndroidはChromeメニューから「ホーム画面に追加」または「アプリをインストール」を選びます。</p></section><section><h3>プリントから取り込む</h3><ol><li>プリントに児童名・住所・連絡先などがあれば、撮影前または画像編集で必ず隠します。</li><li>ChatGPTへ画像を送り、下の指示文を貼り付けます。</li><li>返ってきたJSONを「まとめて取込」に貼り付けます。</li><li>受信箱で日付や内容を確認してから使います。</li></ol><div className="prompt-box"><pre>{prompt}</pre><button onClick={copyPrompt}>{copied ? 'コピーしました' : '指示文をコピー'}</button><span className="sr-only" aria-live="polite">{copied ? '指示文をコピーしました' : ''}</span></div></section><section className="caution"><h3>大切な注意</h3><p>ChatGPTへ送る前に、児童・保護者・職員の個人情報を必ず除いてください。共有PCでは、同じブラウザを使う人に予定が見える可能性があります。</p></section><section><h3>保存とバックアップ</h3><p>データは、このブラウザ内だけに保存されます。端末の紛失やブラウザデータ削除に備えて、定期的にバックアップしてください。</p><div className="backup-actions"><button onClick={exportBackup}>バックアップを保存</button><label className="file-button">バックアップを復元<input type="file" accept="application/json,.json" onChange={(event) => restoreBackup(event.target.files?.[0])} /></label></div></section></div>}
      </section></main>
    {draft && <div className="modal-backdrop"><form ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading" onSubmit={(event) => { event.preventDefault(); saveDraft() }}><div className="modal-title"><h2 id="modal-heading">{editingId ? '内容を編集' : '内容を確認'}</h2><button type="button" aria-label="閉じる" onClick={closeDraft}>×</button></div><label>タイトル<input ref={titleInputRef} required value={draft.title ?? ''} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><div className="field-row"><label>種類<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ItemType })}><option value="task">タスク</option><option value="event">予定</option></select></label><label>区分<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}><option>仕事</option><option>私生活</option></select></label></div><div className="field-row"><label>日付<input type="date" value={draft.date ?? ''} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>開始時刻<input type="time" value={draft.startTime ?? ''} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label></div>{draft.type === 'event' && <label>終了時刻<input type="time" min={draft.startTime || undefined} value={draft.endTime ?? ''} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label>}<label>メモ<textarea rows={3} value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>{!draft.date && <p className="message">日付なしで保存すると、受信箱に入ります。</p>}<button className="primary wide">保存する</button></form></div>}
  </div>
}

declare global {
  interface Window {
    SpeechRecognition?: new () => { lang: string; onresult: (event: { results: { 0: { 0: { transcript: string } } } }) => void; onerror: () => void; onend: () => void; start: () => void }
    webkitSpeechRecognition?: Window['SpeechRecognition']
  }
}
export default App
