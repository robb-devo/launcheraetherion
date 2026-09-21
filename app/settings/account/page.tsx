import { SettingsPage } from "@/components/launcher/settings-shell"
import { AccountTab } from "@/components/settings/account-tab"

export default function AccountPage() {
  return (
    <SettingsPage
      title="Account settings"
      description="Add a player name, or choose which one is active."
    >
      <AccountTab />
    </SettingsPage>
  )
}
