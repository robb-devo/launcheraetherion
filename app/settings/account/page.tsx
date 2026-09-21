import { SettingsPage } from "@/components/launcher/settings-shell"
import { AccountTab } from "@/components/settings/account-tab"

export default function AccountPage() {
  return (
    <SettingsPage
      title="Account settings"
      description="Add, remove, or select the active account. Microsoft and offline accounts can live together."
    >
      <AccountTab />
    </SettingsPage>
  )
}
