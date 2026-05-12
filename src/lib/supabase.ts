import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bjufnywuxnvxtrzutdvi.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqdWZueXd1eG52eHRyenV0ZHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzUzMjYsImV4cCI6MjA5MjIxMTMyNn0.lVfcCkKqK7b37jJqWVlRfrHtQ2AvZALgInLCWt1z8j8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type { User, Session } from '@supabase/supabase-js'
