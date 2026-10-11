---
name: criar-componente-shadcn
description: Cria componentes usando shadcn/ui, Radix e Tailwind. Use quando precisar construir interfaces com o design system do projeto.
---

# Criar Componente com shadcn/ui

Componentes disponíveis em `src/components/ui/`: accordion, alert, alert-dialog, avatar, badge, button, calendar, card, checkbox, dialog, dropdown-menu, form, input, label, popover, select, separator, sheet, skeleton, switch, table, tabs, textarea, toast, toggle, tooltip.

## Card com Formulário

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function MeuFormulario() {
  const [nome, setNome] = useState("");

  async function handleSubmit() {
    try {
      await invokeEntityAction("minha_acao", { nome });
      toast.success("Salvo com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Título</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <Button onClick={handleSubmit}>Salvar</Button>
      </CardContent>
    </Card>
  );
}
```

## Tabela

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nome</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.nome}</TableCell>
        <TableCell>
          <Badge variant={item.status === "ativo" ? "default" : "secondary"}>
            {item.status}
          </Badge>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Ícones

```tsx
import { Plus, Trash2, Edit, Check, X, Loader2 } from "lucide-react";
<Button><Plus className="h-4 w-4 mr-2" /> Adicionar</Button>
```

## Feedback

- Sucesso: `toast.success("Mensagem")`
- Erro: `toast.error("Mensagem")`
- Loading: `<Loader2 className="h-4 w-4 animate-spin" />`
