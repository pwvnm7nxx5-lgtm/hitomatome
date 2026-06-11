import { useEffect, useMemo, useState } from 'react'
import './App.css'

type ItemType = 'event' | 'task'
type Category = '仕事' | '私生活'
type View = 'today' | 'inbox' | 'tasks' | 'import' | 'help'
type Item = { id: string; type: ItemType; title: string; date: string; startTime: string; endTime: string; category: Category; notes: string; done: boolean; confirmed: boolean; createdAt: string }

const STORAGE_KEY = 'matome-schedule-items-v1'
const pad = (value: number) => String(value).padStart(2, '0')
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const today = () => localDate(new Date())

const sampleItems: Item[] = [{ id: crypto.randomUUID(), type: 'task', title: '週案を確認する', date: today(), startTime: '', endTime: '', category: '仕事', notes: '初期サンプルです。完了または削除できます。', done: false, confirmed: true, createdAt: new Date().toISOString() }]

function loadItems(): Item[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : sampleItems
  } catch { return sampleItems }
}

function parseQuickInput(text: string): Partial<Item> {
  const now = new Date()
  let date = ''
  if (text.includes('今日')) date = localDate(now)
  if (text.includes('明日')) { const next = new Date(now); next.setDate(now.getDate() + 1); date = localDate(next) }
  const slashDate = text.match(/(\d{1,2})[月/](\d{1,2})日?/)
  if (slashDate) {
    const candidate = new Date(now.getFullYear(), Number(slashDate[1]) - 1, Number(slashDate[2]))
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) candidate.setFullYear(now.getFullYear() + 1)
    date = localDate(candidate)
  }
  const time = text.match(/(\d{1,2})(?:[:時](\d{1,2})?)\s*(?:分)?/)
  const startTime = time ? `${pad(Number(time[1]))}:${pad(Number(time[2] ?? 0))}` : ''
  const title = text.replace(/今日|明日/g, '').replace(/\d{1,2}[月/]\d{1,2}日?/g, '').replace(/\d{1,2}(?:[:時]\d{0,2})\s*(?:分)?/g, '').replace(/\s+/g, ' ').trim()
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

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)), [items])
  const openItems = useMemo(() => items.filter((item) => !item.done).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)), [items])
  const todayItems = openItems.filter((item) => item.date === today())
  const inboxItems = openItems.filter((item) => !item.confirmed || !item.date)
  const taskItems = openItems.filter((item) => item.type === 'task')

  const addQuick = () => {
    if (quickText.trim()) setDraft({ ...parseQuickInput(quickText), type: 'task', category: '仕事', endTime: '', notes: '' })
  }
  const saveDraft = () => {
    if (!draft?.title?.trim()) return
    const item: Item = { id: crypto.randomUUID(), type: draft.type ?? 'task', title: draft.title.trim(), date: draft.date ?? '', startTime: draft.startTime ?? '', endTime: draft.endTime ?? '', category: draft.category ?? '仕事', notes: draft.notes ?? '', done: false, confirmed: Boolean(draft.date), createdAt: new Date().toISOString() }
    setItems((current) => editingId
      ? current.map((entry) => entry.id === editingId ? { ...entry, ...item, id: entry.id, createdAt: entry.createdAt } : entry)
      : [item, ...current])
    setQuickText(''); setDraft(null); setEditingId(null)
  }
  const editItem = (item: Item) => { setDraft(item); setEditingId(item.id) }
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { alert('このブラウザは音声入力に対応していません。'); return }
    const recognition = new SpeechRecognition(); recognition.lang = 'ja-JP'; recognition.onresult = (event) => setQuickText(event.results[0][0].transcript); recognition.start()
  }
  const importJson = () => {
    try {
      const parsed = JSON.parse(importText.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim())
      if (!Array.isArray(parsed)) throw new Error()
      const imported: Item[] = parsed.map((raw) => ({ id: crypto.randomUUID(), type: raw.type === 'event' ? 'event' : 'task', title: String(raw.title || 'タイトル未設定'), date: String(raw.date || raw.dueDate || ''), startTime: String(raw.startTime || ''), endTime: String(raw.endTime || ''), category: raw.category === '私生活' ? '私生活' : '仕事', notes: String(raw.notes || ''), done: false, confirmed: false, createdAt: new Date().toISOString() }))
      setItems((current) => [...imported, ...current]); setImportText(''); setImportMessage(`${imported.length}件を受信箱に追加しました。`); setView('inbox')
    } catch { setImportMessage('形式を読み取れませんでした。ヘルプの指示文を使って、もう一度試してください。') }
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

  const renderList = (list: Item[], empty: string) => <div className="item-list">
    {list.length === 0 && <div className="empty">{empty}</div>}
    {list.map((item) => <article className={`item-card ${item.type}`} key={item.id}>
      <button className="check" aria-label="完了にする" onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, done: true } : entry))}>✓</button>
      <div className="item-main"><div className="item-topline"><span className={`tag ${item.category === '私生活' ? 'private' : ''}`}>{item.category}</span><span className="type-label">{item.type === 'event' ? '予定' : 'タスク'}</span>{!item.confirmed && <span className="warning">要確認</span>}</div><strong>{item.title}</strong><div className="meta">{item.date || '日付未設定'} {item.startTime && `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ''}`}</div>{item.notes && <p>{item.notes}</p>}</div>
      <div className="item-actions"><button onClick={() => editItem(item)}>編集</button>{item.type === 'event' && item.date && <a href={googleCalendarUrl(item)} target="_blank">Googleへ</a>}<button className="danger" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>削除</button></div>
    </article>)}
  </div>

  return <div className="app-shell">
    <header><div><p className="eyebrow">予定もタスクも、まずここへ</p><h1>ひとまとめ</h1></div><div className="today-label">{new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</div></header>
    <section className="quick-add"><div className="quick-copy"><strong>すばやく追加</strong><span>「明日 16時 職員会議」のように入力</span></div><div className="quick-controls"><input value={quickText} onChange={(event) => setQuickText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addQuick()} placeholder="予定やタスクを入力..." /><button className="voice" onClick={startVoice}>音声</button><button className="primary" onClick={addQuick}>追加</button></div></section>
    <main><nav><button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>今日 <b>{todayItems.length}</b></button><button className={view === 'inbox' ? 'active' : ''} onClick={() => setView('inbox')}>受信箱 <b>{inboxItems.length}</b></button><button className={view === 'tasks' ? 'active' : ''} onClick={() => setView('tasks')}>タスク <b>{taskItems.length}</b></button><button className={view === 'import' ? 'active' : ''} onClick={() => setView('import')}>まとめて取込</button><button className={view === 'help' ? 'active' : ''} onClick={() => setView('help')}>使い方</button></nav>
      <section className="content">
        {view === 'today' && <><h2>今日やること</h2>{renderList(todayItems, '今日の予定・タスクはありません。')}</>}
        {view === 'inbox' && <><h2>確認待ち</h2><p className="lead">日付がないものや、まとめて取り込んだ項目を確認します。</p>{renderList(inboxItems, '確認待ちの項目はありません。')}</>}
        {view === 'tasks' && <><h2>未完了タスク</h2>{renderList(taskItems, '未完了のタスクはありません。')}</>}
        {view === 'import' && <div className="panel"><h2>ChatGPTからまとめて取り込む</h2><p className="lead">ChatGPTが出力したJSONを、そのまま貼り付けてください。登録前に受信箱で確認できます。</p><textarea rows={14} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='[{"type":"event","title":"授業参観", ...}]' />{importMessage && <p className="message">{importMessage}</p>}<button className="primary" onClick={importJson}>受信箱へ追加</button></div>}
        {view === 'help' && <div className="help"><h2>使い方</h2><section><h3>普段の追加</h3><p>画面上部へ「明日 16時 職員会議」のように入力します。候補を確認し、予定またはタスクとして保存してください。</p></section><section><h3>プリントから取り込む</h3><ol><li>プリントに児童名・住所・連絡先などがあれば、撮影前または画像編集で必ず隠します。</li><li>ChatGPTへ画像を送り、下の指示文を貼り付けます。</li><li>返ってきたJSONを「まとめて取込」に貼り付けます。</li><li>受信箱で日付や内容を確認してから使います。</li></ol><div className="prompt-box"><pre>{prompt}</pre><button onClick={copyPrompt}>{copied ? 'コピーしました' : '指示文をコピー'}</button></div></section><section className="caution"><h3>大切な注意</h3><p>ChatGPTへ送る前に、児童・保護者・職員の個人情報を必ず除いてください。日付や時刻が不明な項目は、受信箱で確認するまで確定しません。</p></section><section><h3>保存について</h3><p>現在の初版では、このブラウザ内に保存されます。スマホとPCの自動同期・Googleカレンダー予定の自動読み込みは、次の接続設定で追加します。</p></section></div>}
      </section></main>
    {draft && <div className="modal-backdrop" onClick={() => { setDraft(null); setEditingId(null) }}><form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveDraft() }}><div className="modal-title"><h2>{editingId ? '内容を編集' : '内容を確認'}</h2><button type="button" onClick={() => { setDraft(null); setEditingId(null) }}>×</button></div><label>タイトル<input required value={draft.title ?? ''} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><div className="field-row"><label>種類<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ItemType })}><option value="task">タスク</option><option value="event">予定</option></select></label><label>区分<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}><option>仕事</option><option>私生活</option></select></label></div><div className="field-row"><label>日付<input type="date" value={draft.date ?? ''} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>開始時刻<input type="time" value={draft.startTime ?? ''} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label></div>{draft.type === 'event' && <label>終了時刻<input type="time" value={draft.endTime ?? ''} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label>}<label>メモ<textarea rows={3} value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>{!draft.date && <p className="message">日付なしで保存すると、受信箱に入ります。</p>}<button className="primary wide">保存する</button></form></div>}
  </div>
}

declare global {
  interface Window {
    SpeechRecognition?: new () => { lang: string; onresult: (event: { results: { 0: { 0: { transcript: string } } } }) => void; start: () => void }
    webkitSpeechRecognition?: Window['SpeechRecognition']
  }
}
export default App
