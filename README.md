# 🎁 Amigo Oculto

Um site de amigo oculto feito para a família. O organizador cadastra os nomes e o servidor faz o sorteio. Cada pessoa pega o próprio nome criando um PIN de 4 números e pode rever o resultado quando quiser. Nem o organizador consegue ver quem tirou quem.

## O que ele faz

- **Sorteio no servidor**, com no mínimo 3 participantes e bloqueio de nomes repetidos.
- **Quem não pode tirar quem**: regras para casais, pais e filhos etc., num sentido só ou nos dois.
- **Sorteio em corrente** (opcional, já vem ligado): forma uma roda única A → B → C → … → A. Ninguém fica em par fechado, e na ceia a revelação segue em sequência.
- **Um link só para o grupo do WhatsApp**, com botão de envio pronto.
- **Pegar o nome com PIN**: no primeiro acesso a pessoa cria o PIN, e o nome fica preso a ela. Depois é só nome + PIN para rever.
- **Proteção do PIN**: ele fica guardado com bcrypt. Depois de 5 erros seguidos, o nome bloqueia por 10 minutos.
- **Painel do organizador** (num link secreto): mostra ✅ quem já pegou e ⏳ quem falta, avisa quando alguém foi bloqueado e tem o botão **Resetar PIN** para quem esqueceu. O resultado do sorteio continua o mesmo.
- **Lista de desejos com links**: cada presente tem nome, link da loja e observação, além de um campo de tamanhos e preferências. Só quem tirou a pessoa vê a lista.
- **Papelzinho que desdobra**: o resultado aparece num papel dobrado que a pessoa abre com um toque, e dá para esconder de novo se alguém estiver olhando.

## Arquivos

```
index.html          página única
styles.css          visual
app.js              telas e navegação
api.js              conversa com o Supabase (ou modo demonstração)
config.js           ← coloque aqui a URL e a chave do Supabase
fonts/              fontes Instrument Serif e Figtree (licença OFL), já incluídas
supabase/schema.sql ← cole no SQL Editor do Supabase
```

Não precisa de build nem de `npm install`. São só arquivos estáticos.

## 1. Testar agora (modo demonstração)

Abra o `index.html` no navegador. Com o `config.js` vazio, o site roda em **modo demonstração**: tudo funciona, mas os dados ficam só naquela aba. Use o botão "Preencher exemplo" na criação.

## 2. Criar o banco no Supabase (uns 5 minutos)

1. Crie uma conta em <https://supabase.com> e clique em **New project**. Sugestão de região: *South America (São Paulo)*.
2. No menu da esquerda, abra **SQL Editor → New query**, cole o conteúdo **inteiro** de `supabase/schema.sql` e clique em **Run**. Deve aparecer *Success*.
3. Em **Project Settings → API Keys**, copie:
   - a **Project URL** (algo como `https://abcdefgh.supabase.co`, que também aparece em *Data API*);
   - a **Publishable key** (`sb_publishable_...`). A chave antiga "anon" também funciona, mas o Supabase vai aposentá-la.
4. Cole as duas no `config.js`:

   ```js
   window.AMIGO_CONFIG = {
     SUPABASE_URL: 'https://abcdefgh.supabase.co',
     SUPABASE_KEY: 'sb_publishable_xxxxxxxx',
   };
   ```

   ⚠️ Nunca use a chave **secret / service_role** no site.

## 3. Publicar o site

Qualquer hospedagem de site estático serve. As opções mais simples:

- **Netlify Drop**: abra <https://app.netlify.com/drop> e arraste a pasta `amigo-oculto`. Sai um link `https://algum-nome.netlify.app` na hora.
- **Vercel**: `npx vercel` dentro da pasta, ou importe um repositório do GitHub.
- **GitHub Pages**: suba a pasta num repositório e ative *Settings → Pages*.

Depois de publicar, crie um sorteio de teste com 3 nomes para conferir se está tudo certo.

## 4. Usando com a família

1. Abra o site, clique em **Criar sorteio**, preencha e clique em **Sortear**.
2. Você cai no **painel do organizador**. **Guarde esse link** (ele tem um código secreto só seu).
3. Clique em **Enviar no WhatsApp** para mandar o link do grupo.
4. Acompanhe pelo painel quem já pegou o nome. Se alguém esquecer o PIN, use **Resetar PIN**.

## Bom saber

- **O Supabase gratuito pausa projetos parados há uma semana.** Se ninguém usar o site por 7 dias, o banco dorme. O Supabase manda um e-mail antes. Para acordar, é só abrir o projeto no painel do Supabase e clicar em *Resume / Restore project*; os dados continuam lá. Até o Natal, vale você abrir o site de vez em quando.
- **Primeiro a pegar o nome, leva.** Se alguém pegar o nome de outra pessoa, ela vai ver "Entrar com PIN" no próprio nome e vai reclamar. Aí você reseta, e a pessoa certa cria o PIN dela. Esse é o mesmo limite dos sites de sorteio que só pedem o nome. (Quem pegou o nome errado vai ter visto o resultado daquela pessoa.)
- **A lista de participantes não muda depois do sorteio.** Se faltou alguém, crie um sorteio novo.
- Qualquer pessoa com o endereço do site consegue criar sorteios. Para uso em família, isso não é problema.
- Se você já tinha rodado uma versão anterior do `schema.sql`, é só rodar o novo por cima: ele remove sozinho a parte de recados.

## Como funciona a segurança

- As tabelas ficam no esquema `amigo_oculto`, que **a API do Supabase não expõe**. O RLS também está ligado, sem nenhuma política.
- O site só chama 7 funções (`criar_evento`, `evento_publico`, `resgatar`, `entrar`, `salvar_lista`, `painel`, `resetar_pin`). Cada uma confere o PIN ou o token antes de responder.
- `evento_publico` e `painel` **nunca devolvem o resultado do sorteio**. Ele só sai por `resgatar` ou `entrar`, e só para a própria pessoa.
- O link do organizador tem um token de 144 bits, e o banco guarda só o hash SHA-256 dele.
- Os links das listas só são aceitos se começarem com `http://` ou `https://`, tanto no site quanto no banco.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Faixa amarela "Modo demonstração" no site publicado | O `config.js` está vazio, ou foi publicado o arquivo errado. |
| "O servidor respondeu com erro (… function … not found)" | Rode o `schema.sql` de novo e confira se a *Data API* está ligada em Project Settings. |
| "Não consegui falar com o servidor" | O projeto pode estar pausado (veja "Bom saber") ou a URL do `config.js` está errada. |
| "Invalid API key" | Confira a chave publishable. Não pode ter espaço sobrando. |
