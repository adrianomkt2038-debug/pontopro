# 🚀 Ponto Pro - Sistema de Controle de Ponto Inteligente

O **Ponto Pro** é uma solução moderna e completa para gestão de jornada de trabalho. Desenvolvida para oferecer agilidade, precisão e uma experiência de usuário excepcional, a plataforma permite que colaboradores e gestores controlem as horas trabalhadas de forma intuitiva.

---

## ✨ Funcionalidades Principais

- ⏱️ **Registro Rápido:** Marque seu ponto com apenas um clique.
- 👤 **Gestão de Usuários:** Controle centralizado de colaboradores e administradores.
- 📊 **Dashboards Intuitivos:** Visualize suas métricas de trabalho de forma clara.
- 🔒 **Segurança Supabase:** Autenticação e banco de dados robustos e escaláveis.
- 📱 **Interface Responsiva:** Use em qualquer dispositivo, do desktop ao mobile.

## 🛠️ Tecnologias Utilizadas

- **Frontend:** [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Backend/DB:** [Supabase](https://supabase.com/)
- **Build Tool:** [Vite](https://vitejs.dev/)

---

## 🚀 Como Começar (Modo Local)

Siga os passos abaixo para rodar o projeto em sua máquina:

1.  **Instale as dependências:**

    ```bash
    npm install
    ```

2.  **Configuração do Ambiente:**
    Edite o arquivo `.env` na raiz do projeto e preencha as seguintes chaves:

    ```env
    VITE_SUPABASE_PROJECT_ID=seu_project_id
    VITE_SUPABASE_PUBLISHABLE_KEY=sua_public_key
    VITE_SUPABASE_URL=sua_url_do_supabase
    ```

    _Também configure o `project_id` no arquivo `supabase/config.toml`._

3.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

---

## ⚙️ Configurações Importantes

- **Primeiro Acesso:** O primeiro usuário cadastrado no sistema receberá automaticamente permissões de **Administrador**. Os cadastros seguintes serão processados como usuários comuns.
- **E-mails de Boas-vindas:** Caso prefira não enviar o e-mail automático do Supabase, você pode desabitar essa opção no painel de controle da Auth no Supabase Dashboard.

---

## ⏰ Automações & Cron Jobs

O sistema utiliza o `pg_cron` do Supabase para automatizar tarefas diárias. Para configurar, acesse o **SQL Editor** do seu projeto Supabase e execute os comandos abaixo.

### 1. Habilitar extensões necessárias
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Agendar Verificação de Ausências e Banco de Horas
Substitua `<SUA_URL_DO_SUPABASE>` e `<SUA_ANON_KEY>` pelos valores do seu projeto:

```sql
-- Verificar ausências diariamente às 23:00 (BRT)
SELECT cron.schedule(
  'verificar-ausencias-diario',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<SUA_URL_DO_SUPABASE>/functions/v1/verificar-ausencias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUA_ANON_KEY>'
    ),
    body := jsonb_build_object('data', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))
  );
  $$
);

-- Calcular banco de horas diariamente às 23:30 (BRT)
SELECT cron.schedule(
  'calcular-banco-horas-diario',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<SUA_URL_DO_SUPABASE>/functions/v1/calcular-banco-horas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUA_ANON_KEY>'
    ),
    body := jsonb_build_object('data', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))
  );
  $$
);
```

---

## 🔗 Links Úteis & Tutoriais

Preparamos alguns materiais para te ajudar na jornada:

- 📺 [Guia de Setup do Projeto](https://youtu.be/NYizwEbWlHA)
- ☁️ [Como criar seu Projeto no Supabase](https://youtu.be/12ZPw-NmhZg)
- 🚀 [Deploy Supabase via CLI (Vídeo)](https://youtu.be/YTH2m8o7XOg)
- 📑 [Guia de Deploy (Documentação)](https://deploysupabaseviacli.lovable.app)

---

## 📦 Deploy

Para deploy em produção, recomendamos o uso do **Deploy Manager Pro** ou a integração nativa do Supabase CLI para uma experiência simplificada e segura.

---

<p align="center">
  Desenvolvido por <a href="https://afcode.com.br">afcode</a> com ❤️ para facilitar a gestão de tempo.
</p>
