import type React from "react"
import { SettingsShell } from "@/components/launcher/settings-shell"
import { WindowFrame } from "@/components/launcher/window-frame"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <WindowFrame title="Aetherion Launcher • Settings">
      <SettingsShell>{children}</SettingsShell>
    </WindowFrame>
  )
}
