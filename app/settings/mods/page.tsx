import { SettingsPage } from "@/components/launcher/settings-shell"
import { ModsTab } from "@/components/settings/mods-tab"
import { MOCK_MANIFEST_PREVIEW } from "@/lib/launcher/mock-data"
import { Badge } from "@/components/ui/badge"

export default function ModsPage() {
  return (
    <SettingsPage
      title="Mods & Shaders"
      description="Mods and the shaderpack from the Aetherion Fabric manifest."
      actions={
        <Badge
          variant="outline"
          className="text-[10px] uppercase tracking-wider border-primary/40 text-primary"
        >
          Manifest v{MOCK_MANIFEST_PREVIEW.version}
        </Badge>
      }
    >
      <ModsTab />
    </SettingsPage>
  )
}
