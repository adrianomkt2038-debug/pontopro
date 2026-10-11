import { describe, expect, it } from "vitest";
import { getBusinessDate } from "@/lib/businessDate";
import {
  canRegisterPontoAction,
  getBrowserGeolocationErrorMessage,
  type PontoRegistro,
} from "@/lib/registroPonto";

describe("getBusinessDate", () => {
  it("uses the business time zone instead of the UTC date", () => {
    expect(getBusinessDate(new Date("2026-01-01T02:30:00.000Z"))).toBe("2025-12-31");
  });

  it("returns the new local date after midnight in Bahia", () => {
    expect(getBusinessDate(new Date("2026-01-01T03:30:00.000Z"))).toBe("2026-01-01");
  });
});

describe("canRegisterPontoAction", () => {
  it("only allows entry when no daily record exists", () => {
    expect(canRegisterPontoAction("entrada", null)).toBe(true);
    expect(canRegisterPontoAction("saida", null)).toBe(false);
  });

  it("requires entry before lunch and exit", () => {
    const empty = { entrada: null, almoco_saida: null, almoco_retorno: null, saida: null };
    expect(canRegisterPontoAction("almoco_saida", empty)).toBe(false);
    expect(canRegisterPontoAction("saida", empty)).toBe(false);
  });

  it("does not allow exit before the lunch return once lunch started", () => {
    const record: PontoRegistro = {
      entrada: "2026-01-01T11:00:00.000Z",
      almoco_saida: "2026-01-01T15:00:00.000Z",
      almoco_retorno: null,
      saida: null,
    };
    expect(canRegisterPontoAction("almoco_retorno", record)).toBe(true);
    expect(canRegisterPontoAction("saida", record)).toBe(false);
  });

  it("does not allow a duplicate action or a new action after exit", () => {
    const record: PontoRegistro = {
      entrada: "2026-01-01T11:00:00.000Z",
      almoco_saida: null,
      almoco_retorno: null,
      saida: "2026-01-01T20:00:00.000Z",
    };
    expect(canRegisterPontoAction("entrada", record)).toBe(false);
    expect(canRegisterPontoAction("almoco_saida", record)).toBe(false);
    expect(canRegisterPontoAction("saida", record)).toBe(false);
  });
});

describe("getBrowserGeolocationErrorMessage", () => {
  it("gives Chrome permission instructions for denied location", () => {
    expect(getBrowserGeolocationErrorMessage(1)).toContain("Configurações do site");
    expect(getBrowserGeolocationErrorMessage(1)).toContain("Localização > Permitir");
  });

  it("distinguishes unavailable position from permission denial", () => {
    expect(getBrowserGeolocationErrorMessage(2)).toContain("não conseguiu determinar sua posição");
  });

  it("explains geolocation timeouts", () => {
    expect(getBrowserGeolocationErrorMessage(3)).toContain("15 segundos");
  });
});
