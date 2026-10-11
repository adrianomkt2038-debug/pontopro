---
name: fluxo-registro-ponto
description: Documenta o fluxo completo de registro de ponto manual e facial. Use como referência ao trabalhar com funcionalidades de ponto.
---

# Registro de Ponto (Fluxo Completo)

## Fluxo Manual (`/meu-ponto`)

1. Usuário logado acessa `/meu-ponto`
2. Frontend obtém geolocalização via `navigator.geolocation`
3. Determina próxima ação baseada no registro de hoje
4. Chama Edge Function `registrar-ponto`:

```typescript
const { data } = await supabase.functions.invoke("registrar-ponto", {
  body: {
    action: "entrada",
    geo_latitude: position.coords.latitude,
    geo_longitude: position.coords.longitude,
    user_agent: navigator.userAgent,
  },
});
```

## Fluxo Facial (`/registro-ponto`)

1. Página pública (sem login)
2. Carrega modelos face-api.js (TinyFaceDetector, FaceLandmark68, FaceRecognition)
3. Detecta face e extrai descriptor 128D
4. Compara com descriptors da tabela `face_descriptors`
5. Se match (distância < threshold), chama `registrar-ponto-facial`

## Sequência de Ações

```
entrada → almoco_saida → almoco_retorno → saida
```

- Cada ação só pode ser registrada uma vez por dia
- Ordem obrigatória (não pode pular etapas)
- Na saída: status → `completo`, `saldo_minutos` calculado

## Dados Gerados

- `registros_ponto`: 4 timestamps + NSR + hash SHA-256 + saldo
- `sessoes_ponto`: IP, geo, city, country, OS, user-agent
- `banco_horas`: calculado via trigger

## Comprovante (CRPT)

```json
{
  "nsr": 42,
  "data": "2026-03-06",
  "funcionario": "João Silva",
  "matricula": "COL001",
  "acao": "Entrada",
  "hash": "a1b2c3..."
}
```
