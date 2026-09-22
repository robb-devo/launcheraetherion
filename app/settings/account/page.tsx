import { SettingsPage } from "@/components/launcher/settings-shell"
import { AccountTab } from "@/components/settings/account-tab"

export default function AccountPage() {
  return (
    <SettingsPage
      title="Account settings"
      description="Sign in with Microsoft to play and to own servers."
    >
      <AccountTab />
    </SettingsPage>
  )
}
