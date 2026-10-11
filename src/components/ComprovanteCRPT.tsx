import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, Timer, ShieldCheck } from "lucide-react";

export interface CRPTData {
  nsr: number;
  data: string;
  hora: string;
  funcionario: string;
  matricula: string;
  terminal: string;
  acao: string;
  hash: string;
}

interface ComprovanteCRPTProps {
  crpt: CRPTData;
  onClose?: () => void;
}

export function ComprovanteCRPT({ crpt, onClose }: ComprovanteCRPTProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>CRPT - NSR ${crpt.nsr}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 16px; }
            .title { font-size: 18px; font-weight: bold; }
            .subtitle { font-size: 11px; color: #666; }
            .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 13px; }
            .label { color: #666; }
            .value { font-weight: bold; }
            .hash { font-size: 9px; word-break: break-all; color: #999; margin-top: 8px; }
            .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #999; }
            .nsr { font-size: 24px; font-weight: bold; text-align: center; margin: 8px 0; }
            .shield { text-align: center; margin: 8px 0; font-size: 11px; color: #22c55e; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">⏱ Ponto Pro</div>
            <div class="subtitle">COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR</div>
          </div>
          <div class="divider"></div>
          <div class="nsr">NSR: ${String(crpt.nsr).padStart(8, "0")}</div>
          <div class="shield">✓ Registro autenticado digitalmente</div>
          <div class="divider"></div>
          <div class="row"><span class="label">Funcionário:</span><span class="value">${crpt.funcionario}</span></div>
          <div class="row"><span class="label">Matrícula:</span><span class="value">${crpt.matricula}</span></div>
          <div class="row"><span class="label">Data:</span><span class="value">${new Date(crpt.data).toLocaleDateString("pt-BR")}</span></div>
          <div class="row"><span class="label">Hora:</span><span class="value">${new Date(crpt.hora).toLocaleTimeString("pt-BR")}</span></div>
          <div class="row"><span class="label">Ação:</span><span class="value">${crpt.acao}</span></div>
          <div class="row"><span class="label">Terminal:</span><span class="value">${crpt.terminal}</span></div>
          <div class="divider"></div>
          <div class="hash">Hash: ${crpt.hash}</div>
          <div class="footer">
            Este comprovante atende à Portaria 671/2021 do MTP.<br/>
            Documento gerado eletronicamente.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
  };
  const formatTime = (t: string) => {
    try { return new Date(t).toLocaleTimeString("pt-BR"); } catch { return t; }
  };

  return (
    <Card className="w-full max-w-sm mx-auto border-2 border-dashed border-muted-foreground/30">
      <div ref={printRef}>
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-['Space_Grotesk']">Ponto Pro</CardTitle>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Comprovante de Registro de Ponto do Trabalhador
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          <Separator />

          <div className="text-center">
            <p className="text-xs text-muted-foreground">NSR</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-foreground">
              {String(crpt.nsr).padStart(8, "0")}
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Registro autenticado digitalmente</span>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Funcionário</span>
              <span className="font-medium text-foreground">{crpt.funcionario}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Matrícula</span>
              <span className="font-medium text-foreground">{crpt.matricula}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium text-foreground">{formatDate(crpt.data)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hora</span>
              <span className="font-medium text-foreground">{formatTime(crpt.hora)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ação</span>
              <span className="font-medium text-foreground">{crpt.acao}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Terminal</span>
              <span className="font-medium text-foreground">{crpt.terminal}</span>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-[9px] text-muted-foreground break-all font-mono">
              Hash: {crpt.hash}
            </p>
          </div>

          <p className="text-[9px] text-center text-muted-foreground">
            Este comprovante atende à Portaria 671/2021 do MTP.
          </p>
        </CardContent>
      </div>

      <div className="flex gap-2 p-4 pt-0">
        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        )}
      </div>
    </Card>
  );
}
