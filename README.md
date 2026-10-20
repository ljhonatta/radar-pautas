# Radar de Pautas (automático no GitHub)

Coleta notícias às 7h, 13h e 19h (Brasília), todos os dias, e publica o painel no GitHub Pages. Roda sem o Claude: usa o GitHub Actions (grátis em repositório público) e a API da OpenAI.

## Como ativar (uns 10 minutos)

1. **Criar o repositório**: no GitHub, clique em **New repository**, dê o nome `radar-pautas` e marque **Public**. Para usar o Pages de graça, o repositório precisa ser público. Clique em **Create repository**.
2. **Subir os arquivos**: na página do repositório, clique em **uploading an existing file**. Descompacte o ZIP no computador e arraste **o conteúdo** da pasta `radar-pautas` (as pastas `.github`, `coletor`, `docs` e o `README.md`). Depois clique em **Commit changes**.
   - A pasta `.github` começa com ponto e fica oculta. No Mac, aperte `Cmd + Shift + .` no Finder para ver. No Windows, ative "Itens ocultos" no Explorador.
3. **Colocar a chave da OpenAI**: vá em **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `OPENAI_API_KEY`
   - Secret: cole a sua chave (começa com `sk-`). Ela fica guardada e oculta no GitHub. Nunca cole a chave em chat ou em arquivo.
4. **Permitir que o robô salve**: em **Settings → Actions → General → Workflow permissions**, marque **Read and write permissions** e clique em **Save**.
5. **Ligar o painel**: em **Settings → Pages**, em "Source" escolha **Deploy from a branch**. Depois escolha a branch **main** e a pasta **/docs** e clique em **Save**. Em 1 a 2 minutos o painel fica em `https://SEU-USUARIO.github.io/radar-pautas/`.
6. **Testar agora**: vá em **Actions → Coleta de pautas → Run workflow**. Em 2 a 5 minutos aparece um commit "Coleta …" e o painel mostra as pautas novas.

## No dia a dia

- **Atualizar fora do horário**: no painel, o botão **Atualizar agora** abre o GitHub. Lá, clique em **Run workflow**.
- **Mudar fontes ou buscas**: edite `coletor/fontes.json` direto no GitHub.
- **Mudar horários**: edite as linhas `cron` em `.github/workflows/coleta.yml`. O GitHub usa o horário UTC, que é Brasília + 3h.
- **Trocar o modelo da OpenAI**: o padrão é `gpt-4o-mini`, barato (fica em centavos por mês). Para usar outro, crie em **Settings → Secrets and variables → Actions → Variables** uma variável `OPENAI_MODEL` com o nome do modelo. Se a coleta der erro "model not found", é só criar essa variável com um modelo atual da sua conta.
- **Se der erro**: o painel mostra a mensagem em vermelho. Os detalhes ficam em **Actions**, clicando na execução que falhou.

## Limites que você deve saber

- O robô lê os feeds RSS e as buscas do Google Notícias. Ele não navega como uma pessoa. Sites que bloqueiam leitura entram com um link de busca do Google ("Buscar notícia"), e a pauta fica com menos fatos.
- A IA só escreve com o texto que o robô conseguiu baixar da matéria. Mesmo assim, confira os números na fonte antes de postar.
- O GitHub pode atrasar os horários agendados em alguns minutos.
