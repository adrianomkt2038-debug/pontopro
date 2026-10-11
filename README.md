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
    Copie `.env.example` para `.env.local` na raiz do projeto e preencha as seguintes chaves:

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

- **Administrador inicial:** a aplicação não eleva automaticamente o primeiro cadastro a administrador. Faça a atribuição pelo painel autorizado do sistema ou pelo SQL Editor do Supabase, depois de confirmar a identidade do usuário.
- **E-mails de Boas-vindas:** configure a confirmação de e-mail no painel de Authentication do Supabase conforme a política da sua organização.
- **Variáveis públicas do frontend:** use somente a URL do projeto e a chave publishable/anon. Nunca coloque a chave `service_role`, uma chave secreta ou senhas em variáveis `VITE_*`.

---

## ⏰ Automações & Cron Jobs

As Edge Functions de verificação de ausências e cálculo de banco de horas exigem autenticação válida de administrador ou chamada interna confiável. **Não agende essas funções com a chave pública anon como token de autorização.** O agendamento automático deve ser configurado com um segredo interno mantido fora do frontend e do repositório.

## 🔗 Links Úteis & Tutoriais

Preparamos alguns materiais para te ajudar na jornada:

- 📺 [Guia de Setup do Projeto](https://youtu.be/NYizwEbWlHA)
- ☁️ [Como criar seu Projeto no Supabase](https://youtu.be/12ZPw-NmhZg)
- 🚀 [Deploy Supabase via CLI (Vídeo)](https://youtu.be/YTH2m8o7XOg)
- 📑 [Guia de Deploy (Documentação)](https://deploysupabaseviacli.lovable.app)

---

## 📦 Deploy

### Vercel

1. Importe o repositório `adrianomkt2038-debug/pontopro` na sua conta Vercel.
2. Use o preset **Vite**, comando de build `npm run build` e diretório de saída `dist` (já descritos em `vercel.json`).
3. Em **Settings → Environment Variables**, configure:
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Faça o deploy em Production. O workflow do GitHub Actions verifica o build quando há push na branch `main`.

As migrações do banco e as seis Edge Functions devem ser aplicadas ao projeto Supabase de destino. Nunca configure uma chave privilegiada do Supabase no frontend ou na Vercel como variável `VITE_*`.

---

<p align="center">
  Desenvolvido por <a href="https://afcode.com.br">afcode</a> com ❤️ para facilitar a gestão de tempo.
</p>
