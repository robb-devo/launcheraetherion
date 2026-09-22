import { SandboxFactory } from "@/components/launcher/sandbox-factory"
import { WindowFrame } from "@/components/launcher/window-frame"

export default function SandboxPage() {
  return (
    <WindowFrame title="Aetherion Launcher • Your server">
      <SandboxFactory />
    </WindowFrame>
  )
}
