import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { supabase } from '../lib/supabase'
import { enqueueUpsert } from '../lib/sync'
import { makeId } from '../lib/makeId'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { Icons } from '../components/ui/Icons'
import type { Screen, Workspace } from '../types'
import { useNav } from '../lib/navContext'

interface Props { navigate?: (s: Screen) => void; back?: () => void }

export function WorkspaceSettingsScreen({ back: backProp }: Props) {
  const { back: ctxBack } = useNav()
  const back = backProp ?? ctxBack

  const workspaces = useLiveQuery(() => db.workspaces.toArray(), []) ?? []

  const [newName,  setNewName]  = useState('')
  const [creating, setCreating] = useState(false)

  const [inviteEmail,     setInviteEmail]     = useState('')
  const [inviteWsId,      setInviteWsId]      = useState<string | null>(null)
  const [inviting,        setInviting]        = useState(false)
  const [inviteError,     setInviteError]     = useState('')
  const [inviteSuccess,   setInviteSuccess]   = useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ws: Workspace = {
        id:        makeId(),
        name:      newName.trim(),
        ownerId:   user.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.workspaces.put(ws)
      enqueueUpsert('workspaces', ws.id, ws)
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteWsId) return
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('workspace_members').upsert({
        workspace_id:   inviteWsId,
        user_id:        user.id,           // placeholder until they sign up
        role:           'member',
        invited_email:  inviteEmail.trim().toLowerCase(),
        joined_at:      null,
      }, { onConflict: 'workspace_id,user_id' })
      if (error) throw error
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : 'Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleDelete(ws: Workspace) {
    await db.workspaces.delete(ws.id)
    enqueueUpsert('workspaces', ws.id, { ...ws, deletedAt: Date.now() })
  }

  return (
    <div className="screen">
      <ScreenHeader title="Workspaces" back={back} icon={<Icons.users size={22} />} />

      <div className="screen-scroll" style={{ padding: '20px' }}>

        {/* Create workspace */}
        <div style={{
          padding: '16px', borderRadius: 14,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          marginBottom: 20,
        }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>New workspace</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Family tasks"
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 14,
                border: '1px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink)',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              style={{
                padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'var(--ink)', color: 'var(--paper)',
                opacity: creating || !newName.trim() ? 0.5 : 1,
              }}
            >
              {creating ? '…' : 'Create'}
            </button>
          </div>
        </div>

        {/* Workspace list */}
        {workspaces.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {workspaces.map(ws => (
              <div key={ws.id} style={{
                padding: '14px 16px', borderRadius: 14,
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{ws.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>
                      {ws.id.slice(0, 8)}…
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(ws)}
                    style={{ color: 'var(--destructive-fg)', padding: 4 }}
                  >
                    <Icons.close size={14} />
                  </button>
                </div>

                {/* Invite section */}
                <div className="eyebrow" style={{ marginBottom: 8 }}>Invite by email</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={inviteWsId === ws.id ? inviteEmail : ''}
                    onFocus={() => setInviteWsId(ws.id)}
                    onChange={e => { setInviteWsId(ws.id); setInviteEmail(e.target.value); setInviteError(''); setInviteSuccess('') }}
                    onKeyDown={e => e.key === 'Enter' && inviteWsId === ws.id && handleInvite()}
                    placeholder="colleague@example.com"
                    type="email"
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13,
                      border: '1px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink)',
                    }}
                  />
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim() || inviteWsId !== ws.id}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'var(--accent)', color: 'white',
                      opacity: inviting || !inviteEmail.trim() || inviteWsId !== ws.id ? 0.5 : 1,
                    }}
                  >
                    {inviting && inviteWsId === ws.id ? '…' : 'Invite'}
                  </button>
                </div>
                {inviteWsId === ws.id && inviteError && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--destructive-fg)', marginTop: 6 }}>
                    {inviteError}
                  </div>
                )}
                {inviteWsId === ws.id && inviteSuccess && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--positive-fg)', marginTop: 6 }}>
                    {inviteSuccess}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {workspaces.length === 0 && (
          <div style={{
            textAlign: 'center', paddingTop: 32,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.06em',
          }}>
            No workspaces yet. Create one above to share tasks with others.
          </div>
        )}
      </div>
    </div>
  )
}
