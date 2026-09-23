import { publicAssetPath } from "@/lib/public-path"
import { cn } from "@/lib/utils"

/**
 * Crystalline A inside a purple ring. The same mark is the window and taskbar icon.
 */
export function AetherionMark({
  className,
  size = 40,
}: {
  className?: string
  size?: number
}) {
  return (
    <img
      src={publicAssetPath("/aetherion-icon.png")}
      width={size}
      height={size}
      alt="Aetherion"
      className={cn("shrink-0 object-contain", className)}
    />
  )
}
