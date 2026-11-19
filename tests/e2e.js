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
  // Violação de CSP vira erro: o navegador bloqueou algo que o site tentou fazer.
  await page.addInitScript(() => {
    window.__violacoes = [];
    document.addEventListener('securitypolicyviolation', (ev) => window.__violacoes.push(`${ev.violatedDirective} ${ev.blockedURI}`));
  });
  const shot = (n, full = true) => page.screenshot({ path: `${SHOTS}/${ROTULO}-${n}.png`, fullPage: full });
  const irPara = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(60); };
  const digitarPin = async (id, pin) => { await page.click(`#${id}`); await page.keyboard.type(pin); };
  const nome = (n) => `.nome-linha:has(.nome-txt:text-is("${n}"))`;
  const textoErro = () => page.locator('.msg-erro:not(:empty)').first().textContent();

  const resp = await page.goto(BASE.endsWith('.html') ? BASE + '#/' : BASE + '/#/');
  if (BASE.startsWith('http')) {
    const csp = resp.headers()['content-security-policy'] || '';
    assert.ok(csp.includes("default-src 'self'") && !csp.includes('unsafe-inline'), 'CSP estrita no cabeçalho: ' + csp);
    assert.equal(resp.headers()['x-frame-options'], 'DENY');
  }
  await page.waitForSelector('text=Criar sorteio');
  await page.waitForTimeout(300);
  assert.ok(!(await page.textContent('#app')).includes('null'), 'sem texto null');
  assert.ok(!/recado/i.test(await page.textContent('#app')), 'sem menção a recados');
  await shot('01-inicio');
  assert.ok((await page.textContent('.hero-h')).includes('Com carinho, para a Maria Clara.'), 'dedicatória');
  await page.click('.cena-papel');
  assert.equal((await page.textContent('.cena-papel .papel-nome')).trim(), 'Maria Clara', 'easter egg do papelzinho');
  assert.equal((await page.textContent('.cena-papel .papel-rodape')).trim(), 'Eu tiraria você todo ano.');
  await page.click('.cena-papel');
  assert.equal((await page.textContent('.cena-papel .papel-nome')).trim(), 'Júlia', 'tocar de novo desfaz');
  for (let k = 0; k < 3; k++) await page.click('.marca-selo');
  await page.waitForSelector('.toast.visivel:has-text("Este site existe por sua causa, Maria Clara.")');
  console.log('✓ dedicatória e os dois easter eggs');

  // ---------- criar ----------
  await page.click('text=Criar sorteio');
  await page.waitForSelector('#f-nome');
  await page.fill('#f-org', 'Pedro');
  await page.fill('#f-valor', 'R$ 100');
  await page.fill('#f-hora', '19:30');
  await page.fill('#f-local', 'Casa da vó');
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
  assert.equal(await page.locator('#btn-painel-mim').count(), 1, 'botão de mandar o painel para si');
  console.log('✓ criou o sorteio e abriu o painel');

  // ---------- copiar sem a API de área de transferência (plano B com textarea) ----------
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: () => Promise.reject(new Error('negado no teste')) },
  }));
  await page.click('button.btn-secundario:has-text("Copiar link")');
  await page.waitForSelector('.toast.visivel');
  assert.equal(await page.locator('textarea.copia-oculta').count(), 0, 'textarea do plano B removido');
  console.log('✓ copiar pelo plano B, sem violar a CSP');

  // ---------- cada um pega o nome ----------
  const resultado = {};
  for (const [i, n] of NOMES.entries()) {
    await irPara(hashGrupo);
    await page.waitForSelector('text=Quem é você?');
    if (i === 0) {
      await shot('04-grupo');
      const convite = await page.textContent('.convite');
      assert.ok(convite.includes('às 19h30') && convite.includes('Casa da vó'), 'convite com horário e local');
    }
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
      const g = new URL(await page.getAttribute('#btn-google-agenda', 'href'));
      assert.equal(g.hostname, 'calendar.google.com');
      assert.match(g.searchParams.get('dates'), /^\d{8}T193000\/\d{8}T223000$/, 'google: 19h30 às 22h30');
      assert.equal(g.searchParams.get('location'), 'Casa da vó');
      assert.equal(g.searchParams.get('ctz'), 'America/Sao_Paulo');
      const ics = decodeURIComponent((await page.getAttribute('#btn-ics', 'href')).split(',').slice(1).join(','));
      assert.match(ics, /DTSTART:\d{8}T223000Z/, 'ics em UTC (19h30 de Brasília)');
      assert.ok(ics.includes('LOCATION:Casa da vó') && ics.includes('BEGIN:VEVENT'));
      // O nome de quem a pessoa tirou só pode aparecer tantas vezes quanto já aparece nos dados
      // públicos do evento (ex.: tirou "Pedro", que também é quem organiza).
      const vezes = (texto, s) => texto.split(s).length - 1;
      const tirou = resultado[n].tirou;
      const publico = ['Pedro', 'R$ 100', 'Casa da vó', 'Troca na ceia do dia 24, na casa da vó.\nPresente com nota para trocar.', await page.textContent('.pessoa-cab .sobre')].join('\n');
      for (const [onde, texto] of [['google', [...g.searchParams.values()].join('\n')], ['ics', ics.replace(/\r\n /g, '').replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1')]]) {
        assert.ok(vezes(texto, tirou) <= vezes(publico, tirou), `agenda (${onde}) não leva quem a pessoa tirou (${tirou})`);
      }
      console.log('✓ adicionar à agenda: Google e .ics com horário e local, sem o resultado');
    }
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
  await page.selectOption('#t-camisa', 'M');
  await page.fill('#t-calcado', '37');
  await page.fill('#t-calca', '4O');   // letra O no lugar de zero: precisa ser recusado
  await page.fill('#t-outras', 'Não gosto de perfume doce');
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
  assert.ok((await textoErro()).includes('Na calça, coloque só o número'), 'calça só com número');
  await page.fill('#t-calca', '40');
  await page.click('#btn-salvar');
  await page.waitForSelector('.toast.visivel:has-text("Lista salva")');
  // depois de salvar, os campos voltam preenchidos com o que foi gravado
  assert.equal(await page.inputValue('#t-camisa'), 'M');
  assert.equal(await page.inputValue('#t-calca'), '40');
  assert.equal(await page.inputValue('#t-outras'), 'Não gosto de perfume doce');
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
  const tamanhosAmigo = await page.textContent('.tamanhos');
  assert.ok(tamanhosAmigo.includes('Camisa M · Calça 40 · Calçado 37'), 'tamanhos: ' + tamanhosAmigo);
  assert.ok(tamanhosAmigo.includes('Não gosto de perfume doce'));
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
  if (await page.evaluate(() => window.Api.modo) !== 'demo') {
    const painel = page.locator('.meus-paineis a');
    assert.equal(await painel.count(), 1, 'home lembra do painel deste aparelho');
    assert.match(await painel.getAttribute('href'), /^#\/admin\/[0-9a-f]{10}\/[0-9a-f]{36}$/);
    console.log('✓ a página inicial lembra do painel criado neste aparelho');
  }
  await irPara(hashGrupo);
  await page.waitForSelector('text=Quem é você?');
  await shot('14-grupo-desktop', false);

  assert.deepEqual(await page.evaluate(() => window.__violacoes), [], 'sem violações de CSP');
  assert.deepEqual(erros, [], 'sem erros no console');
  await browser.close();
  console.log(`\n[${ROTULO}] TODOS OS TESTES DE NAVEGADOR PASSARAM`);
})().catch(async (e) => { console.error('FALHOU:', e); process.exit(1); });
