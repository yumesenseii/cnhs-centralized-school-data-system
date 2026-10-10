import AuthRecoveryRedirect from "@/components/auth/AuthRecoveryRedirect";
import PortalLanding from "@/components/landing/PortalLanding";
import ForceLightMode from "@/components/theme/ForceLightMode";
import { getPublicDemographics } from "@/lib/supabase/queries/publicData";

export const metadata = {
  title: "Cambaog National High School | CNHS Learn",
  description:
    "CNHS Learn — secure access for School Principals, Teachers, and Students.",
};

export default async function Home() {
  const demographics = await getPublicDemographics();

  return (
    <ForceLightMode>
      <AuthRecoveryRedirect />
      <PortalLanding demographics={demographics} />
    </ForceLightMode>
  );
}
