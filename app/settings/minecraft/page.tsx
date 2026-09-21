import { SettingsPage } from "@/components/launcher/settings-shell"
import { MinecraftTab } from "@/components/settings/minecraft-tab"

export default function MinecraftPage() {
  return (
    <SettingsPage
      title="Minecraft settings"
      description="Options for how the game starts."
    >
      <MinecraftTab />
    </SettingsPage>
  )
}
