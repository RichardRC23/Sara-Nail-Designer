# Colocar o site da Sara no ar

Este projeto é um site estático. A preparação para publicação usa o Netlify conectado ao repositório GitHub `RichardRC23/Sara-Nail-Designer`; cada atualização enviada para `main` pode gerar uma nova publicação.

## 1. Atualizar o Supabase

1. Abra o projeto Supabase da Sara e entre em **SQL Editor**.
2. Abra `supabase/schema.sql` neste projeto, copie todo o conteúdo e execute.
3. Confirme que a consulta terminou sem erro. Ela prepara a tabela de agendamentos, os dados de contato que a Sara verá, as permissões por cliente e administradora e o armazenamento privado das fotos de perfil.

## 2. Preparar a autenticação antes de publicar

Enquanto o site estava em testes, a confirmação de email foi desligada. Antes do lançamento:

1. Em **Authentication → Sign In / Providers → Email**, ative **Confirm email**.
2. Depois que o Netlify fornecer o endereço do site, em **Authentication → URL Configuration**, use esse endereço em **Site URL**.
3. Inclua `https://SEU-ENDERECO.netlify.app/agendamento.html` em **Redirect URLs**. Substitua pelo endereço real do site.

Isso faz os links de confirmação e recuperação de senha retornarem à página correta. Faça um cadastro de teste e confirme que o link recebido abre o site publicado.

## 3. Dar acesso administrativo à Sara

O painel de gestão fica na mesma página de agendamento. Ele só aparece para contas que tenham a função `admin` em `app_metadata`; clientes não podem atribuir essa função a si mesmas.

1. Peça para a Sara criar uma conta usando o email que ela vai manter para administrar o site.
2. No SQL Editor do Supabase, execute o comando abaixo substituindo o email entre aspas:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = lower('EMAIL-DA-SARA');
```

3. Confira que uma linha foi atualizada. A Sara deve sair da conta e entrar novamente para receber a permissão.
4. No menu do site, ela abre **Área da cliente**. Como administradora, verá os pedidos, nome e email da cliente e poderá mudar o status para aguardando, confirmado ou cancelado.

Para retirar a permissão, execute no Supabase:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
where lower(email) = lower('EMAIL-DA-SARA');
```

## 4. Publicar pelo Netlify

1. Entre ou crie uma conta em Netlify e escolha **Add new project → Import an existing project**.
2. Conecte o GitHub e selecione `RichardRC23/Sara-Nail-Designer`.
3. Deixe a branch de produção como `main`. O `netlify.toml` já define o comando de preparação e a pasta publicada (`dist`).
4. Clique em **Deploy**. Quando concluir, anote o endereço terminado em `.netlify.app` e configure-o no Supabase conforme a etapa 2.

O site é preparado pelo `build.mjs`; só páginas, estilos, scripts de navegador e imagens entram em `dist`. O SQL e este guia ficam fora da pasta publicada.

## 5. Conferência antes de divulgar

- Abra o site pelo endereço do Netlify no celular e no computador.
- Crie uma conta de teste, confirme o email e entre.
- Envie um pedido usando um serviço e preço da lista atual.
- Entre com a conta administrativa da Sara, atualize o pedido e confirme que o status aparece para a cliente ao atualizar a área dela.
- Teste a troca de senha e o envio/ajuste de foto de perfil.
- Confirme que a confirmação de email está ativa e que nenhuma página exibe um endereço de atendimento antes da Sara decidir a localização.

## 6. Ativar avisos de novos pedidos por email

O código do aviso fica em `supabase/functions/appointment-notification/index.ts`. Ele envia um email quando um novo pedido é inserido em `public.appointments`. A função valida um segredo compartilhado e mantém a chave do serviço de email fora do navegador. O endereço de destino da Sara pode ser adicionado depois, quando ela informar qual quer usar.

1. Crie uma conta no [Resend](https://resend.com/) e cadastre/verifique um domínio de envio que você controla. O endereço configurado como remetente precisa pertencer a esse domínio verificado.
2. Instale a CLI do Supabase no computador, abra o terminal na pasta do projeto e vincule a pasta ao projeto Supabase `jnukdqupsupdosbxbniw`:

   ```sh
   supabase login
   supabase link --project-ref jnukdqupsupdosbxbniw
   supabase functions deploy appointment-notification
   ```

3. No painel Supabase, abra **Edge Functions → Secrets** e adicione estes segredos. Use valores reais; não os coloque neste repositório nem no código do site:
   - `RESEND_API_KEY`: chave criada no Resend.
   - `RESEND_FROM_EMAIL`: remetente no domínio que foi verificado no Resend, por exemplo `Sara Nail Designer <avisos@seudominio.com>`.
   - `APPOINTMENT_WEBHOOK_SECRET`: uma senha longa e aleatória. O mesmo valor será usado no cabeçalho do webhook.
   - `SARA_NOTIFICATION_EMAIL`: email de destino da Sara. Pode ser adicionado quando ela decidir qual endereço usar.
   - `SITE_URL`: endereço público do site, por exemplo `https://seu-site.netlify.app`, para incluir um botão que abre o painel.
4. No Supabase, abra **Database → Webhooks** e crie um webhook com método **POST**, tabela `public.appointments` e evento **INSERT**. Use como URL `https://jnukdqupsupdosbxbniw.supabase.co/functions/v1/appointment-notification` e adicione o cabeçalho `x-webhook-secret` com o mesmo valor de `APPOINTMENT_WEBHOOK_SECRET`.
5. Faça um pedido de teste com uma conta de cliente. Confirme que o pedido aparece no painel e que o email chega ao endereço configurado para a Sara.

O envio só fica ativo depois de a função estar publicada, os segredos preenchidos e o webhook criado. Se o Resend não aceitar a mensagem, confira a verificação do domínio e os logs em **Edge Functions → appointment-notification → Logs**.

## Como os pedidos funcionam

A cliente entra ou cria uma conta, escolhe um serviço e preço, informa a data e o horário que prefere e envia o pedido. O Supabase salva a solicitação ligada à conta da cliente; o pedido fica **aguardando confirmação**, sem cobrança ou pagamento.

A Sara entra com a conta administrativa para consultar nome, email, serviço, data, horário e observação. Ela confirma ou cancela o pedido no painel. A cliente vê o status atualizado na área de agendamentos. Depois de concluir a configuração da etapa 6, Sara também recebe um email quando chega um novo pedido; a confirmação ou cancelamento continuam sendo feitos no painel.

Os preços continuam visíveis no site. Não há pagamento nem localização publicados. Assinaturas permanecem como área futura, sem cobrança ativa.
