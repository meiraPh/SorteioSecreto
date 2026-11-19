// Testa as funções do schema.sql como o papel "anon" (igual ao site no Supabase).
// Banco: variáveis PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD (precisa ser superusuário
// para o teste conferir o sorteio direto nas tabelas). Os papéis anon/authenticated precisam existir.
const { Client } = require('pg');
const assert = require('assert');

const cfg = {};

async function anon() {
  const c = new Client(cfg);
  await c.connect();
  await c.query('set role anon');
  return c;
}
async function call(c, fn, args) {
  const keys = Object.keys(args);
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
  const vals = keys.map(k => (args[k] !== null && typeof args[k] === 'object') ? JSON.stringify(args[k]) : args[k]);
  return (await c.query(sql, vals)).rows[0].r;
}

(async () => {
  const c = await anon();
  const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi'];
  // casais: Ana<->Bruno, Carla<->Diego
  const excl = [[0, 1], [1, 0], [2, 3], [3, 2]];

  // --- permissões: tabelas inacessíveis para anon
  for (const q of ['select * from amigo_oculto.participantes', 'select * from amigo_oculto.eventos']) {
    await assert.rejects(c.query(q), /permission denied/);
  }
  await assert.rejects(c.query("select amigo_oculto.dados(gen_random_uuid())"), /permission denied/);
  console.log('✓ anon não lê tabelas nem funções internas');

  // --- validações
  assert.equal((await call(c, 'criar_evento', { p_titulo: 'X', p_participantes: ['A', 'B'] })).erro, 'minimo_3');
  assert.equal((await call(c, 'criar_evento', { p_titulo: 'X', p_participantes: ['A', 'b', 'B'] })).erro, 'nomes_repetidos');
  assert.equal((await call(c, 'criar_evento', { p_titulo: ' ', p_participantes: ['A', 'B', 'C'] })).erro, 'titulo_vazio');
  // impossível: 3 pessoas, A não pode tirar B nem C
  assert.equal((await call(c, 'criar_evento', { p_titulo: 'X', p_participantes: ['A', 'B', 'C'], p_exclusoes: [[0, 1], [0, 2]] })).erro, 'impossivel');
  console.log('✓ validações (mínimo 3, nomes repetidos, título, impossível)');

  // --- muitos sorteios: confere regras
  for (const corrente of [true, false]) {
    for (let rep = 0; rep < 40; rep++) {
      const r = await call(c, 'criar_evento', {
        p_titulo: 'Natal', p_participantes: nomes, p_exclusoes: excl,
        p_organizador: 'Pedro', p_data: '2026-12-24', p_valor: 'R$ 100', p_mensagem: 'Regras', p_corrente: corrente,
      });
      assert.ok(r.ok, JSON.stringify(r));
      // leitura do resultado só como superusuário, para verificar
      const adm = new Client(cfg); await adm.connect();
      const rows = (await adm.query(`select p.ordem-1 as i, a.ordem-1 as j from amigo_oculto.participantes p
        join amigo_oculto.eventos e on e.id=p.evento_id join amigo_oculto.participantes a on a.id=p.amigo_id where e.codigo=$1`, [r.codigo])).rows;
      await adm.end();
      assert.equal(rows.length, nomes.length);
      const recebidos = new Set(rows.map(x => x.j));
      assert.equal(recebidos.size, nomes.length, 'cada um recebe exatamente 1');
      for (const { i, j } of rows) {
        assert.notEqual(i, j, 'ninguém tira a si mesmo');
        assert.ok(!excl.some(([a, b]) => a === i && b === j), 'exclusão respeitada');
      }
      if (corrente) { // ciclo único
        const m = Object.fromEntries(rows.map(x => [x.i, x.j]));
        let cur = 0, steps = 0; do { cur = m[cur]; steps++; } while (cur !== 0 && steps < 50);
        assert.equal(steps, nomes.length, 'corrente única');
      }
    }
  }
  console.log('✓ 80 sorteios: sem auto-sorteio, exclusões ok, 1 presente por pessoa, corrente única');

  // --- fluxo completo
  const ev = await call(c, 'criar_evento', { p_titulo: 'Natal da Família', p_participantes: nomes, p_exclusoes: excl, p_organizador: 'Pedro', p_data: '2026-12-24', p_valor: 'R$ 100', p_mensagem: 'Até R$100', p_corrente: true });
  const pub = await call(c, 'evento_publico', { p_codigo: ev.codigo });
  assert.ok(pub.ok); assert.equal(pub.participantes.length, 7);
  assert.ok(!JSON.stringify(pub).includes('amigo'), 'página pública não vaza resultado');
  assert.equal((await call(c, 'evento_publico', { p_codigo: 'naoexiste' })).erro, 'evento_nao_encontrado');
  const id = Object.fromEntries(pub.participantes.map(p => [p.nome, p.id]));

  assert.equal((await call(c, 'resgatar', { p_participante: id.Ana, p_pin: '12a4' })).erro, 'pin_formato');
  const r1 = await call(c, 'resgatar', { p_participante: id.Ana, p_pin: '1234' });
  assert.ok(r1.ok); assert.equal(r1.eu.nome, 'Ana'); assert.notEqual(r1.amigo.nome, 'Ana'); assert.notEqual(r1.amigo.nome, 'Bruno');
  assert.equal((await call(c, 'resgatar', { p_participante: id.Ana, p_pin: '9999' })).erro, 'ja_resgatado');
  const r2 = await call(c, 'entrar', { p_participante: id.Ana, p_pin: '1234' });
  assert.equal(r2.amigo.nome, r1.amigo.nome, 'rever dá o mesmo resultado');
  console.log(`✓ Ana resgatou com PIN e reviu (tirou ${r1.amigo.nome})`);

  // PIN errado e bloqueio
  for (let k = 4; k >= 1; k--) {
    const e = await call(c, 'entrar', { p_participante: id.Ana, p_pin: '0000' });
    assert.equal(e.erro, 'pin_errado'); assert.equal(e.restantes, k);
  }
  assert.equal((await call(c, 'entrar', { p_participante: id.Ana, p_pin: '0000' })).erro, 'bloqueado');
  assert.equal((await call(c, 'entrar', { p_participante: id.Ana, p_pin: '1234' })).erro, 'bloqueado', 'bloqueado mesmo com PIN certo');
  console.log('✓ 5 erros => bloqueio de 10 min');

  // painel + reset
  assert.equal((await call(c, 'painel', { p_codigo: ev.codigo, p_token: 'errado' })).erro, 'acesso_negado');
  const pn = await call(c, 'painel', { p_codigo: ev.codigo, p_token: ev.token });
  assert.ok(pn.ok); const ana = pn.participantes.find(p => p.nome === 'Ana');
  assert.ok(ana.resgatado_em && ana.bloqueado);
  assert.ok(!JSON.stringify(pn).includes(r1.amigo.nome === 'Ana' ? 'zzz' : '"amigo'), 'painel não mostra resultado');
  assert.equal((await call(c, 'resetar_pin', { p_codigo: ev.codigo, p_token: 'errado', p_participante: id.Ana })).erro, 'acesso_negado');
  assert.ok((await call(c, 'resetar_pin', { p_codigo: ev.codigo, p_token: ev.token, p_participante: id.Ana })).ok);
  const r3 = await call(c, 'resgatar', { p_participante: id.Ana, p_pin: '4321' });
  assert.equal(r3.amigo.nome, r1.amigo.nome, 'reset não muda o sorteio');
  console.log('✓ painel protegido por token; reset libera o nome e mantém o sorteio');

  // lista de desejos com link + quem tirou a Ana vê
  const giverName = Object.keys(id).find(n => n !== 'Ana' && true); // descobrimos abaixo
  assert.equal((await call(c, 'salvar_lista', { p_participante: id.Ana, p_pin: '4321', p_tamanhos: 'M', p_desejos: [{ descricao: 'x', link: 'javascript:alert(1)' }] })).erro, 'link_invalido');
  assert.equal((await call(c, 'salvar_lista', { p_participante: id.Ana, p_pin: '4321', p_tamanhos: 'M', p_desejos: [{ descricao: '  ' }] })).erro, 'item_invalido');
  const sl = await call(c, 'salvar_lista', { p_participante: id.Ana, p_pin: '4321', p_tamanhos: 'Camisa M, calçado 37',
    p_desejos: [{ descricao: 'Livro Torto Arado', link: 'https://www.amazon.com.br/dp/8582101977', obs: 'capa dura' }, { descricao: 'Vela aromática' }] });
  assert.ok(sl.ok); assert.equal(sl.eu.desejos.length, 2); assert.equal(sl.eu.desejos[1].link, null);

  // resgata todo mundo e acha quem tirou a Ana
  const pins = { Ana: '4321' };
  let quemTirouAna = null;
  for (const nome of nomes.filter(n => n !== 'Ana')) {
    const r = await call(c, 'resgatar', { p_participante: id[nome], p_pin: '1111' });
    pins[nome] = '1111';
    if (r.amigo.nome === 'Ana') {
      quemTirouAna = nome;
      assert.equal(r.amigo.desejos.length, 2); assert.equal(r.amigo.tamanhos, 'Camisa M, calçado 37');
      assert.equal(r.amigo.desejos[0].link, 'https://www.amazon.com.br/dp/8582101977');
    }
  }
  assert.ok(quemTirouAna);
  console.log(`✓ lista com link salva e visível para quem tirou a Ana (${quemTirouAna})`);

  // horário e local (opcionais): vão para a página do grupo e para quem entra com PIN
  const hl = await call(c, 'criar_evento', { p_titulo: 'Com hora', p_participantes: ['A', 'B', 'C'], p_data: '2026-12-24', p_hora: '19:30', p_local: '  Casa da vó  ' });
  assert.ok(hl.ok, JSON.stringify(hl));
  const hp = await call(c, 'evento_publico', { p_codigo: hl.codigo });
  assert.equal(hp.evento.hora, '19:30'); assert.equal(hp.evento.local, 'Casa da vó');
  const hr = await call(c, 'resgatar', { p_participante: hp.participantes[0].id, p_pin: '2468' });
  assert.equal(hr.evento.hora, '19:30'); assert.equal(hr.evento.local, 'Casa da vó');
  assert.equal(pub.evento.hora, null, 'sorteio sem horário continua sem'); assert.equal(pub.evento.local, null);
  for (const ruim of ['25:00', '7:30', '19h30', '19:60']) {
    assert.equal((await call(c, 'criar_evento', { p_titulo: 'X', p_participantes: ['A', 'B', 'C'], p_hora: ruim })).erro, 'dados_invalidos', `hora ${ruim}`);
  }
  console.log('✓ horário e local opcionais e validados (página do grupo e quem entra com PIN)');

  // recados foram removidos
  await assert.rejects(c.query("select public.enviar_recado(gen_random_uuid(), '1', 'amigo', 'x')"), /does not exist/);
  console.log('✓ função de recados não existe mais');

  // painel mostra todos resgatados
  const pn2 = await call(c, 'painel', { p_codigo: ev.codigo, p_token: ev.token });
  assert.ok(pn2.participantes.every(p => p.resgatado_em));
  assert.ok(pn2.participantes.find(p => p.nome === 'Ana').lista_pronta);
  console.log('✓ painel: todos ✅');

  await c.end();
  console.log('\nTODOS OS TESTES SQL PASSARAM');
})().catch(e => { console.error('FALHOU:', e); process.exit(1); });
