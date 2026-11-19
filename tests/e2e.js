// Teste ponta a ponta no navegador. uso: node e2e.js <url-base | arquivo.html> <rotulo>
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.argv[2];
const ROTULO = process.argv[3] || 'teste';
const SHOTS = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });

const NOMES = ['Vó Lúcia', 'Vô Antônio', 'Tia Rose', 'Tio Marcos', 'Júlia', 'Rafael', 'Camila', 'Pedro'];
const CASAIS = [['Vó Lúcia', 'Vô Antônio'], ['Tia Rose', 'Tio Marcos']];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  const shot = (n, full = true) => page.screenshot({ path: `${SHOTS}/${ROTULO}-${n}.png`, fullPage: full });
  const irPara = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(60); };
  const digitarPin = async (id, pin) => { await page.click(`#${id}`); await page.keyboard.type(pin); };
  const nome = (n) => `.nome-linha:has(.nome-txt:text-is("${n}"))`;
  const textoErro = () => page.locator('.msg-erro:not(:empty)').first().textContent();

  await page.goto(BASE.endsWith('.html') ? BASE + '#/' : BASE + '/#/');
  await page.waitForSelector('text=Criar sorteio');
  await page.waitForTimeout(300);
  assert.ok(!(await page.textContent('#app')).includes('null'), 'sem texto null');
  assert.ok(!/recado/i.test(await page.textContent('#app')), 'sem menção a recados');
  await shot('01-inicio');

  // ---------- criar ----------
  await page.click('text=Criar sorteio');
  await page.waitForSelector('#f-nome');
  await page.fill('#f-org', 'Pedro');
  await page.fill('#f-valor', 'R$ 100');
  await page.fill('#f-msg', 'Troca na ceia do dia 24, na casa da vó.\nPresente com nota para trocar.');
  await page.fill('#f-nome', NOMES.slice(0, 4).join(', '));
  await page.press('#f-nome', 'Enter');
  for (const n of NOMES.slice(4)) { await page.fill('#f-nome', n); await page.press('#f-nome', 'Enter'); }
  await page.fill('#f-nome', 'pedro'); await page.press('#f-nome', 'Enter');
  assert.ok((await textoErro()).includes('já está na lista'), 'aviso de repetido');
  assert.equal(await page.locator('.chip').count(), NOMES.length);
  for (const [a, b] of CASAIS) {
    await page.selectOption('#f-de', a); await page.selectOption('#f-para', b);
    await page.click('#btn-regra');
  }
  assert.equal(await page.locator('.regras li').count(), 2);
  assert.equal(await page.textContent('.resumo'), '8 pessoas · 2 restrições · em corrente');
  await shot('02-criar');
  await page.click('#btn-sortear');
  await page.waitForSelector('text=Sorteio feito.');
  const hashAdmin = await page.evaluate(() => location.hash);
  const linkGrupo = await page.inputValue('#link-grupo');
  const hashGrupo = '#' + linkGrupo.split('#')[1];
  assert.match(hashAdmin, /^#\/admin\/[0-9a-f]{10}\/[0-9a-f]{36}$/);
  assert.ok((await page.getAttribute('#btn-whats', 'href')).startsWith('https://wa.me/?text='));
  await shot('03-painel-novo');
  console.log('✓ criou o sorteio e abriu o painel');

  // ---------- cada um pega o nome ----------
  const resultado = {};
  for (const [i, n] of NOMES.entries()) {
    await irPara(hashGrupo);
    await page.waitForSelector('text=Quem é você?');
    if (i === 0) await shot('04-grupo');
    await page.click(nome(n));
    await page.waitForSelector('#pin1');
    const pin = String(1000 + i * 111).slice(0, 4);
    await digitarPin('pin1', pin);
    if (i === 0) {
      await digitarPin('pin2', '9999');
      await page.check('#sou-eu');
      await page.click('#btn-continuar');
      assert.ok((await textoErro()).includes('diferentes'), 'PINs diferentes');
      await page.uncheck('#sou-eu');
    }
    await digitarPin('pin2', pin);
    if (i === 0) {
      await page.click('#btn-continuar');
      assert.ok((await textoErro()).includes('Confirme'), 'pede confirmação');
      await shot('05-criar-pin');
    }
    await page.check('#sou-eu');
    await page.click('#btn-continuar');
    await page.waitForSelector('#abrir-papel');
    if (i === 0) await shot('06-papel-fechado');
    await page.click('#abrir-papel');
    await page.waitForSelector('.papelzinho.aberto .papel-nome');
    resultado[n] = { tirou: (await page.textContent('.papel-nome')).trim(), pin };
    if (i === 0) {
      await shot('07-revelado');
      await page.click('#btn-esconder');
      await page.waitForSelector('#abrir-papel');
      assert.equal((await page.textContent('.papel-nome')).trim(), '', 'esconder tira o nome da tela');
    }
    await page.click('#btn-sair');
  }
  const tirados = Object.values(resultado).map((r) => r.tirou);
  assert.equal(new Set(tirados).size, NOMES.length, 'cada um tirado uma vez');
  for (const [n, r] of Object.entries(resultado)) {
    assert.notEqual(n, r.tirou);
    for (const [a, b] of CASAIS) assert.ok(!((n === a && r.tirou === b) || (n === b && r.tirou === a)), `casal ${a}/${b}`);
  }
  let cur = NOMES[0], passos = 0;
  do { cur = resultado[cur].tirou; passos++; } while (cur !== NOMES[0] && passos < 20);
  assert.equal(passos, NOMES.length, 'corrente única');
  console.log('✓ 8 pessoas abriram o papelzinho; sorteio válido (sem casais, corrente única)');

  // ---------- rever com PIN + lista de desejos ----------
  const ana = 'Júlia';
  const quemTirouAna = Object.keys(resultado).find((n) => resultado[n].tirou === ana);
  await irPara(hashGrupo);
  await page.click(nome(ana));
  await page.waitForSelector('#pin');
  await shot('08-entrar');
  await digitarPin('pin', resultado[ana].pin);
  await page.click('#btn-continuar');
  await page.waitForSelector('#abrir-papel');
  assert.equal(await page.locator('.aba').count(), 2, 'só duas abas');
  await page.click('#aba-lista');
  await page.fill('#tamanhos', 'Camisa M, calçado 37');
  await page.fill('#d-0', 'Livro Torto Arado');
  await page.fill('#l-0', 'www.amazon.com.br/dp/8582101977');
  await page.fill('#o-0', 'Capa dura');
  await page.click('#btn-add-item');
  await page.fill('#d-1', 'Vela aromática');
  await page.click('#btn-add-item');
  await page.fill('#l-2', 'javascript:alert(1)');
  await page.fill('#d-2', 'Teste');
  await page.click('#btn-salvar');
  assert.ok((await textoErro()).includes('não parece válido'), 'bloqueia link perigoso');
  await page.click('button[aria-label="Remover presente 3"]');
  await page.click('#btn-salvar');
  await page.waitForSelector('.toast.visivel:has-text("Lista salva")');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('09-minha-lista');
  await page.click('#btn-sair');
  console.log('✓ Júlia entrou com PIN e salvou a lista com link');

  // ---------- quem tirou a Júlia vê a lista ----------
  await irPara(hashGrupo);
  await page.click(nome(quemTirouAna));
  await digitarPin('pin', resultado[quemTirouAna].pin);
  await page.click('#btn-continuar');
  await page.click('#abrir-papel');
  await page.waitForSelector('.desejos');
  assert.equal(await page.getAttribute('.desejo a', 'href'), 'https://www.amazon.com.br/dp/8582101977', 'link normalizado com https');
  assert.equal(await page.getAttribute('.desejo a', 'rel'), 'noopener noreferrer nofollow');
  assert.ok((await page.textContent('.tamanhos')).includes('calçado 37'));
  await shot('10-lista-do-amigo');
  await page.click('#btn-sair');
  console.log(`✓ ${quemTirouAna} viu a lista da Júlia com o link da loja`);

  // ---------- PIN errado + bloqueio ----------
  const alvo = 'Rafael';
  await irPara(hashGrupo);
  await page.click(nome(alvo));
  for (let k = 0; k < 5; k++) {
    await digitarPin('pin', '0000');
    await page.click('#btn-continuar');
    await page.waitForFunction((k) => {
      const t = document.querySelector('.msg-erro')?.textContent || '';
      return k < 4 ? t.includes(4 - k === 1 ? 'Resta 1' : `Restam ${4 - k}`) : t.includes('Muitas tentativas');
    }, k);
  }
  await shot('11-bloqueado');
  console.log('✓ 5 PINs errados => bloqueado');

  // ---------- painel: status + reset ----------
  await irPara(hashAdmin);
  await page.waitForSelector('text=Participantes');
  assert.ok((await page.textContent('.placar-n')).includes('8 de 8'));
  const linhaAlvo = page.locator(`.pessoa-linha:has(.pessoa-nome:text-is("${alvo}"))`);
  assert.ok((await linhaAlvo.textContent()).includes('Bloqueado'));
  assert.equal(await page.locator(`.pessoa-linha:has(.pessoa-nome:text-is("${ana}")) .com-lista`).count(), 1, 'lista pronta');
  await shot('12-painel');
  await linhaAlvo.locator('button').click();
  await linhaAlvo.locator('text=Confirmar').click();
  await page.waitForSelector(`.pessoa-linha:has(.pessoa-nome:text-is("${alvo}")):has-text("Pendente")`);
  assert.ok((await page.textContent('.placar-n')).includes('7 de 8'));
  console.log('✓ painel mostra bloqueio e redefine o PIN');

  await irPara(hashGrupo);
  await page.click(nome(alvo));
  await digitarPin('pin1', '5678'); await digitarPin('pin2', '5678'); await page.check('#sou-eu');
  await page.click('#btn-continuar');
  await page.click('#abrir-papel');
  await page.waitForSelector('.papelzinho.aberto .papel-nome');
  assert.equal((await page.textContent('.papel-nome')).trim(), resultado[alvo].tirou);
  console.log('✓ depois do reset, mesmo amigo oculto');

  // telas grandes
  await page.setViewportSize({ width: 1280, height: 860 });
  await irPara('#/');
  await page.waitForSelector('.hero');
  await page.waitForTimeout(200);
  await shot('13-inicio-desktop', false);
  await irPara(hashGrupo);
  await page.waitForSelector('text=Quem é você?');
  await shot('14-grupo-desktop', false);

  assert.deepEqual(erros, [], 'sem erros no console');
  await browser.close();
  console.log(`\n[${ROTULO}] TODOS OS TESTES DE NAVEGADOR PASSARAM`);
})().catch(async (e) => { console.error('FALHOU:', e); process.exit(1); });
