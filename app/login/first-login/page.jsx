import FirstLoginForm from "@/components/auth/FirstLoginForm";
import ForceLightMode from "@/components/theme/ForceLightMode";

export default function FirstLoginPage() {
  return (
    <ForceLightMode>
      <FirstLoginForm />
    </ForceLightMode>
  );
}
