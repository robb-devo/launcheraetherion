import { InstanceLibrary } from "@/components/launcher/instance-library"
import { SettingsPage } from "@/components/launcher/settings-shell"

export default function InstancesPage() {
  return (
    <SettingsPage
      title="Packs"
      description="Install a Modrinth modpack into its own Minecraft instance. The Aetherion realm pack stays separate."
    >
      <InstanceLibrary />
    </SettingsPage>
  )
}
