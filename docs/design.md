# Diretrizes de design

O visual atual foi aprovado e não muda sem pedido. Este documento vale para o que for criado ou alterado daqui para a frente, e lista onde o site atual se afasta das referências, para o Pedro decidir caso a caso (itens D-xx do [backlog](backlog.md)).

## Referências

Indicadas pelo Pedro e pelo Matheus em 19/11/2026. O resumo abaixo é nosso, com as palavras nossas; os textos originais pertencem aos autores.

| Referência | O que é | Quanto se aplica aqui |
|---|---|---|
| [You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations), Emil Kowalski | Artigo sobre quando animar | Muito: propósito, frequência de uso e velocidade |
| [unslop](https://github.com/heydamir/unslop), Damir Sokolovsky (CC BY 4.0) | Regras para tirar a "cara de IA" de uma interface, com valores exatos | Muito. Ela mesma manda não redesenhar tela boa: só polir |
| [Design System Checklist](https://www.designsystemchecklist.com/pt) | Checklist para montar um design system | Em parte: fundamentos e estados dos componentes. Marca, grid, tema escuro e governança não se aplicam |
| [transitions.dev](https://transitions.dev/) | Biblioteca de transições, com escala de durações e curva padrão | Em parte: os tokens de movimento |
| [revenue-centric-design](https://github.com/heliocosta-dev/revenue-centric-design), Helio Costa | Princípios de conversão e retenção para SaaS | Pouco: o site não vende nada. Aproveita-se a parte de formulários |
| [beautifului.dev](https://www.beautifului.dev/) | Galeria de componentes para interfaces de agentes de IA | Quase nada: só referência visual, sem regra escrita |

Três dessas fontes trazem instruções para agentes instalarem plugins, skills ou servidores. Nada disso foi instalado; foram lidas só como texto.

## Diretrizes que adotamos

Cada uma é verificável. Entre parênteses, de onde veio.

**Tokens**
1. Cor, espaço, raio, tipografia e duração ficam em variáveis no `:root`; nenhum valor solto no meio do CSS. (checklist, transitions.dev)
2. Cores de erro, sucesso e aviso são separadas da cor de destaque. (checklist, unslop)
3. Espaços e alturas em múltiplos de 4 px. (unslop, checklist)
4. Raio de 8 a 10 px em controles e de 12 a 16 px em cartões. (unslop)
5. Pesos de fonte entre 400 e 600; serifada só em títulos grandes. (unslop)

**Contraste e acessibilidade**
6. Texto com contraste de pelo menos 4,5:1, inclusive o texto apagado; bordas de campo e anel de foco com pelo menos 3:1. (checklist, unslop)
7. Foco visível em todo controle, e o foco não se perde quando a tela muda. (checklist, unslop)
8. Ícone decorativo sem nome; botão só de ícone com nome acessível. (checklist)
9. Alertas e carregamento anunciados para leitor de tela. (checklist)

**Toque e estados**
10. Alvos de toque de 44 px; a área de toque pode ser maior que o desenho. (unslop, transitions.dev)
11. Botão com estados de hover, pressionado, desabilitado e carregando, sem mudar de tamanho. (checklist)
12. Erro aparece no próprio campo, com texto e cor. (checklist)
13. Placeholder não substitui a label. (checklist)
14. Tela vazia ou de erro sempre oferece a próxima ação. (revenue-centric-design, checklist)
15. Aviso temporário fica na tela tempo suficiente para ser lido. (checklist)

**Movimento**
16. Toda animação tem propósito; ação repetida muitas vezes não anima. (Kowalski)
17. Interface responde em até 300 ms; entrada de elemento pode ir a 500 ms; nada perto de 1 s, salvo um momento raro e intencional. (Kowalski, unslop, transitions.dev)
18. Uma curva de aceleração só; `linear` para spinner. (unslop, transitions.dev)
19. Nunca `transition: all`; anima-se só cor, borda, opacidade e transform. (unslop, transitions.dev)
20. `prefers-reduced-motion` desliga tudo. (todos)

**Formulários e texto**
21. Pedir o mínimo, marcar o que é opcional, abrir o teclado certo no celular e nunca bloquear colar. (revenue-centric-design)
22. Explicar no próprio lugar quando a ação tem risco ou não tem volta. (revenue-centric-design)
23. Sem exclamação, sem emoji, sem exagero; a mesma palavra para a mesma coisa em todas as telas. (unslop, checklist)
24. Sem gradiente entre cores diferentes, brilho, sombra colorida ou efeito de vidro. (unslop)

## Como o site atual se sai

Auditoria de 19/11/2026, feita pela leitura de `src/styles.css`, `src/app.js` e das capturas do E2E. Não foi testado em aparelho nem com leitor de tela. Os números das linhas são do commit de linha de base.

**Já cumpre**
- Labels ligadas aos campos, erros com `role="alert"`, ícones decorativos escondidos do leitor de tela, botões de ícone com nome, foco visível.
- Teclado numérico no PIN, colar funciona, avisos de risco no lugar certo ("a lista de nomes não muda", "guarde este link").
- Botões com estado de carregando e desabilitado; lista de desejos com estado vazio.
- Nenhuma `transition: all`; só cor, opacidade e transform animados; hovers de 150 ms; `prefers-reduced-motion` respeitado no CSS e no JS.
- Sem emoji, sem exclamação; gradientes só dentro da mesma cor; fontes locais com preload.
- Texto principal com contraste de 14:1 a 16:1; botões acima de 6:1.

**Desvios que não mudam o visual** (candidatos naturais a correção)
- **Alvos de toque pequenos.** A caixa "Sou {nome}", passo obrigatório, tem cerca de 23 px de altura; "Volte para a lista", cerca de 21 px; os botões pequenos (Sair, Esconder o nome, Ver na loja, Redefinir PIN) e os de ícone têm 36 px (`styles.css:190`, `209`, `309`, `617`). Dá para aumentar só a área de toque. Gravidade alta nos dois primeiros: o público inclui gente mais velha.
- **Foco se perde a cada mudança de tela.** `montar()` troca o conteúdo inteiro; trocar de aba ou abrir o papelzinho destrói o botão que estava em foco (`app.js:230`).
- **Erro de rede sem saída.** A mensagem diz "tente de novo", mas a tela só tem "Voltar ao início" (`app.js:260`).
- **Aviso some rápido.** O toast fica 2,4 s, inclusive o de erro (`app.js:211`).
- **Erro longe do campo** no formulário de criação: a mensagem aparece só no fim.
- **O tremor do PIN não repete** quando o erro acontece duas vezes seguidas na criação do PIN.
- **Cerca de 40 cores fora do `:root`**, e não há variáveis de espaço, raio nem duração.
- **Abas sem navegação por setas.**

**Desvios que mudam o visual, ainda que pouco** (só com o seu aval)
- **Texto apagado com pouco contraste.** `--tinta-3` (`#78827d`) dá 3,97:1 no branco e menos no fundo papel; o mínimo é 4,5:1. Atinge a instrução "Toque no seu nome" e o rodapé. Um cinza um pouco mais escuro resolve. Gravidade alta.
- **Borda de campo e anel de foco fracos:** 1,44:1 e cerca de 2:1, contra o mínimo de 3:1.
- **Placeholder** a 2,6:1.
- **A cor cranberry** serve de destaque e de erro ao mesmo tempo.
- **Sombra colorida** no botão principal e efeito de vidro numa pílula no desktop.
- **Medidas fora da grade de 4 px** (alturas de 46, 54 e 42 px).
- **Ícones em sete tamanhos**, com traço 1,75.

**Exceções que recomendamos manter**
- **A abertura do papelzinho** (0,9 s, mais 0,7 s do nome). Passa do limite, mas é o momento do produto, cada pessoa vê poucas vezes, e o artigo do Kowalski defende exatamente esse caso.
- **Rótulos em maiúsculas com espaçamento** e o **itálico serifado** de destaque. A unslop os trata como sinais de "cara de IA", mas são traço do visual aprovado.
- **"Olá, {nome}" como título.** Tem função: confirma para a pessoa que ela entrou no nome certo.
