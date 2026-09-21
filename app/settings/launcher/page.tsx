import { SettingsPage } from "@/components/launcher/settings-shell"
import { LauncherTab } from "@/components/settings/launcher-tab"

export default function LauncherPage() {
  return (
    <SettingsPage
      title="Launcher settings"
      description="How Aetherion behaves: updates, storage, and tools."
    >
      <LauncherTab />
    </SettingsPage>
  )
}
