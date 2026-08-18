import Image from "next/image";
import { loginContent } from "@/lib/constants/loginContent";

export default function LoginHero() {
  const { schoolName, brandingPanelSrc } = loginContent;

  return (
    <div
      className="image-panel relative hidden min-h-[560px] overflow-hidden lg:block lg:w-[48%]"
      role="img"
      aria-label={`${schoolName} CNHS Learn branding`}
    >
      <Image
        src={brandingPanelSrc}
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="(min-width: 1024px) 48vw, 0px"
      />
    </div>
  );
}
