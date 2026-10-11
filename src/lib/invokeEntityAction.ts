import { supabase } from "@/integrations/supabase/client";

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
    throw new Error(error.message || "Erro de comunicação com o backend");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Operação não permitida");
  }

  return data.data as T;
}
