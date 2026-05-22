import React from 'react'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { TaskPomodoro } from '../components/TaskPomodoro'
import { useNav } from '../lib/navContext'

export function PomodoroScreen() {
  const { back } = useNav()

  return (
    <div className="screen">
      <ScreenHeader title="Pomodoro" back={back} icon={<Icons.timer size={22} />} />
      <div className="screen-scroll" style={{ paddingBottom: 48 }}>
        <div style={{ padding: '16px' }}>
          <TaskPomodoro />
        </div>
      </div>
    </div>
  )
}
