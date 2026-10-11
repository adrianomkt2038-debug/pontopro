---
name: sanitizacao-validacao
description: Funções de sanitização e validação de inputs para Edge Functions. Use quando precisar validar dados em funções backend.
---

# Sanitização e Validação de Inputs

Toda Edge Function deve sanitizar inputs antes de processar.

## Funções Disponíveis

```typescript
// Texto com limite de tamanho
function sanitizeText(value: unknown, maxLen: number, required = false): string | null {
  if (typeof value !== "string") {
    if (required) throw new Error("Invalid payload");
    return null;
  }
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (required && !cleaned) throw new Error("Invalid payload");
  if (!cleaned) return null;
  if (cleaned.length > maxLen) throw new Error("Invalid payload");
  return cleaned;
}

// UUID
function sanitizeUUID(value: unknown, required = true): string | null {
  if (value === null || value === undefined || value === "") {
    if (required) throw new Error("Invalid payload");
    return null;
  }
  if (typeof value !== "string") throw new Error("Invalid payload");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
  if (!isUuid) throw new Error("Invalid payload");
  return value.trim();
}

// Data ISO (YYYY-MM-DD)
function sanitizeDateISO(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid payload");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) throw new Error("Invalid payload");
  return value.trim();
}

// E-mail
function sanitizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid payload");
  const cleaned = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) || cleaned.length > 255)
    throw new Error("Invalid payload");
  return cleaned;
}

// Número com range
function sanitizeNumber(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid payload");
  const parsed = Math.floor(value);
  if (parsed < min || parsed > max) throw new Error("Invalid payload");
  return parsed;
}

// Boolean
function sanitizeBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid payload");
  return value;
}

// Hora (HH:MM ou HH:MM:SS)
function sanitizeTime(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid payload");
  const cleaned = value.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(cleaned)) throw new Error("Invalid payload");
  return cleaned.length === 5 ? `${cleaned}:00` : cleaned;
}

// Role
function sanitizeRole(value: unknown): "admin" | "gestor" | "colaborador" {
  if (value !== "admin" && value !== "gestor" && value !== "colaborador")
    throw new Error("Invalid payload");
  return value;
}

// Coordenadas GPS
function normalizeCoordinate(value: unknown, type: "lat" | "lon"): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (type === "lat" && (parsed < -90 || parsed > 90)) return null;
  if (type === "lon" && (parsed < -180 || parsed > 180)) return null;
  return Number(parsed.toFixed(6));
}
```

## Uso

```typescript
const body = await req.json();
const nome = sanitizeText(body.nome, 120, true)!;
const id = sanitizeUUID(body.id, false);
const data = sanitizeDateISO(body.data);
const nivel = sanitizeNumber(body.nivel, 1, 100);
```
