import AuthRecoveryRedirect from "@/components/auth/AuthRecoveryRedirect";
import PortalLanding from "@/components/landing/PortalLanding";

export const metadata = {
  title: "Cambaog National High School | CNHS Learn",
  description:
    "CNHS Learn — secure access for Head Teachers, Teachers, and Students.",
};

export default function Home() {
  return (
    <>
      <AuthRecoveryRedirect />
      <PortalLanding />
    </>
  );
}
