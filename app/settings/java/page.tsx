import { SettingsPage } from "@/components/launcher/settings-shell"
import { JavaTab } from "@/components/settings/java-tab"

export default function JavaPage() {
  return (
    <SettingsPage
      title="Java settings"
      description="Manage memory, the executable, and JVM arguments. The launcher picks the right version for each instance."
    >
      <JavaTab />
    </SettingsPage>
  )
}
