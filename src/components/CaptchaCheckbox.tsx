import { useState, useCallback } from "react";
import { Check, Shield, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CaptchaCheckboxProps {
  onVerified: (verified: boolean) => void;
  verified: boolean;
}

export function CaptchaCheckbox({ onVerified, verified }: CaptchaCheckboxProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(() => {
    if (verified || loading) return;
    setLoading(true);
    // Simulate verification delay
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      setLoading(false);
      onVerified(true);
    }, delay);
  }, [verified, loading, onVerified]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-all duration-300",
        verified
          ? "border-success/50 bg-success/5"
          : "border-input bg-card hover:border-muted-foreground/30 hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="flex h-5 w-5 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : verified ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success">
            <Check className="h-3 w-3 text-success-foreground" />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 transition-colors" />
        )}
        <span className={cn("font-medium", verified ? "text-success" : "text-foreground")}>
          {loading ? "Verificando..." : verified ? "Verificado" : "Não sou um robô"}
        </span>
      </div>
      {verified ? (
        <ShieldCheck className="h-5 w-5 text-success" />
      ) : (
        <Shield className="h-5 w-5 text-muted-foreground/50" />
      )}
    </button>
  );
}
