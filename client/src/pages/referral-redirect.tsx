import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

export default function ReferralRedirect() {
  const [, setLocation] = useLocation();
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (code) {
      // Handle both formats: /r/38A10A57 or /r/BEE38A10A57
      const cleanCode = code.toUpperCase().replace(/^BEE/, "");
      const fullCode = `BEE${cleanCode}`;
      localStorage.setItem("referralCode", fullCode);
      setLocation("/");
    }
  }, [code, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Applying referral...</p>
      </div>
    </div>
  );
}
