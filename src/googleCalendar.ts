export type GoogleCalendarItem = {
  id: string
  type: 'event'
  title: string
  date: string
  startTime: string
  endTime: string
  category: '仕事'
  notes: string
  done: false
  confirmed: true
  createdAt: string
  source: 'google'
  externalUrl: string
}

type TokenResponse = { access_token?: string; error?: string }
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void }

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
          }) => TokenClient
        }
      }
    }
  }
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
export const isGoogleCalendarConfigured = Boolean(clientId)
let accessToken = ''

export async function connectGoogleCalendar() {
  if (!clientId || !window.google) throw new Error('Googleカレンダー接続が設定されていません。')
  accessToken = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: (response) => response.access_token
        ? resolve(response.access_token)
        : reject(new Error(response.error || 'Googleカレンダーへ接続できませんでした。')),
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
  return loadGoogleCalendar()
}

export async function loadGoogleCalendar(): Promise<GoogleCalendarItem[]> {
  if (!accessToken) throw new Error('Googleカレンダーへ再接続してください。')
  const min = new Date()
  min.setFullYear(min.getFullYear() - 1)
  const max = new Date()
  max.setFullYear(max.getFullYear() + 2)
  const params = new URLSearchParams({
    timeMin: min.toISOString(),
    timeMax: max.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  })
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Googleカレンダーの予定を取得できませんでした。')
  const data = await response.json() as { items?: Array<Record<string, unknown>> }
  return (data.items ?? []).flatMap((raw) => {
    const start = raw.start as { date?: string; dateTime?: string } | undefined
    const end = raw.end as { date?: string; dateTime?: string } | undefined
    const date = start?.date ?? start?.dateTime?.slice(0, 10) ?? ''
    if (!date) return []
    return [{
      id: `google:${String(raw.id)}`,
      type: 'event' as const,
      title: String(raw.summary || '無題の予定'),
      date,
      startTime: start?.dateTime?.slice(11, 16) ?? '',
      endTime: end?.dateTime?.slice(11, 16) ?? '',
      category: '仕事' as const,
      notes: String(raw.description || ''),
      done: false as const,
      confirmed: true as const,
      createdAt: String(raw.created || ''),
      source: 'google' as const,
      externalUrl: String(raw.htmlLink || ''),
    }]
  })
}
