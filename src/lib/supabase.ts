import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lszmlbspryvsiwbbfvdq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzem1sYnNwcnl2c2l3YmJmdmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDI0NTAsImV4cCI6MjA4OTcxODQ1MH0.4e08MPVTtUQxmJIabhjFqYy_myeOj1VKO2wY-QySYHM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type { User, Session } from '@supabase/supabase-js'
