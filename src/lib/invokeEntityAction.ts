import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/registroPonto";

export async function invokeEntityAction<T = unknown>(
  action: string,
  payload: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("gerenciar-entidades", {
    body: {
      action,
      ...payload,
    },
  });

  if (error) {
    throw new Error(await getEdgeFunctionErrorMessage(error, "Erro de comunicação com o serviço de cadastro facial."));
  }

  if (!data?.success) {
    throw new Error(data?.error || "Operação não permitida");
  }

  return data.data as T;
}
