import { api, money, ensureStaff, tokens } from './common.js';

const { token } = await ensureStaff({ minRole: 'admin', title: 'Acesso ao caixa' });
document.body.innerHTML = `
  <header class="cash-top">
    <div class="cash-brand">💳 Sistema do Bar<small>Caixa e fechamento de comandas</small></div>
    <button class="btn-sm btn-ghost" id="logout" style="color:#fff">Sair</button>
  </header>
  <main class="cash-wrap">
    <div class="cash-heading"><div><h1>Caixa</h1><p>Confira o consumo por mesa e registre o pagamento.</p></div><button class="cash-refresh" id="refresh">↻ Atualizar</button></div>
    <div class="cash-stats">
      <div class="cash-stat"><span>Mesas com consumo em aberto</span><strong id="open-count">—</strong></div>
      <div class="cash-stat"><span>Total em aberto</span><strong id="open-total">—</strong></div>
      <div class="cash-stat"><span>Recebido hoje</span><strong id="paid-total">—</strong></div>
    </div>
    <h2 class="cash-section">Contas em aberto</h2>
    <div id="tables" class="cash-tables"><div class="cash-empty">Carregando contas…</div></div>
    <h2 class="cash-section">Pagamentos recentes</h2>
    <div id="history" class="cash-history"><div class="cash-history-row">Carregando histórico…</div></div>
  </main>
  <div id="toast" class="cash-toast" role="status"></div>`;
const $ = (id) => document.getElementById(id);
let tables = [];
let payments = [];
let sessionPaid = 0;
const fmt = (n) => money(Number(n) || 0);
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.style.display = 'block';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.style.display = 'none'; }, 2800);
}
function methodName(m) {
  return ({ dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Cartão crédito', cartao_debito: 'Cartão débito' })[m] || m;
}
function dateTime(ms) {
  return new Date(ms).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function renderTables() {
  const root = $('tables'); root.innerHTML = '';
  $('open-count').textContent = tables.length;
  $('open-total').textContent = fmt(tables.reduce((sum, t) => sum + t.total, 0));
  $('paid-total').textContent = fmt(sessionPaid);
  if (!tables.length) {
    root.innerHTML = '<div class="cash-empty" style="grid-column:1/-1">Nenhuma conta em aberto. Os pedidos enviados pelos garçons aparecerão aqui.</div>';
    return;
  }
  for (const t of tables) {
    const card = document.createElement('article'); card.className = 'cash-table';
    const title = t.table_no === '0' ? 'Pedido sem mesa' : 'Mesa ' + t.table_no;
    const orderList = t.orders.map(o => `Pedido #${o.order_no ?? o.id} · ${fmt(o.total)}`).join('<br>');
    card.innerHTML = `<div class="cash-meta">CONTA EM ABERTO</div><h3>${title}</h3><div class="cash-total">${fmt(t.total)}</div><div class="cash-meta">${t.orders.length} pedido(s)</div><div class="cash-orders">${orderList}</div><div class="cash-actions"><button class="cash-pay pix" data-method="pix">Pix</button><button class="cash-pay cash" data-method="dinheiro">Dinheiro</button><button class="cash-pay" data-method="cartao_credito">Crédito</button><button class="cash-pay" data-method="cartao_debito">Débito</button></div>`;
    card.querySelectorAll('[data-method]').forEach(btn => btn.addEventListener('click', () => closeTable(t, btn.dataset.method, btn)));
    root.append(card);
  }
}
function renderHistory() {
  const root = $('history'); root.innerHTML = '';
  if (!payments.length) { root.innerHTML = '<div class="cash-history-row cash-muted">Nenhum pagamento registrado ainda.</div>'; return; }
  const header = document.createElement('div'); header.className = 'cash-history-row'; header.style.fontWeight = '800'; header.innerHTML = '<span>Mesa</span><span>Valor</span><span>Pagamento</span><span>Horário</span>'; root.append(header);
  for (const p of payments) {
    const row = document.createElement('div'); row.className = 'cash-history-row';
    row.innerHTML = `<span>${p.table_no === '0' ? 'Sem mesa' : 'Mesa ' + p.table_no}</span><strong>${fmt(p.amount)}</strong><span>${methodName(p.method)}</span><span class="cash-muted">${dateTime(p.created_at)}</span>`;
    root.append(row);
  }
}
async function refresh() {
  $('refresh').disabled = true;
  try {
    [tables, payments] = await Promise.all([
      api('/admin/cash/tables', { token }),
      api('/admin/cash/payments', { token })
    ]);
    renderTables(); renderHistory();
  } catch (e) {
    toast('Não foi possível carregar o caixa. Confira se o servidor está conectado.');
  } finally { $('refresh').disabled = false; }
}
async function closeTable(table, method, btn) {
  const label = table.table_no === '0' ? 'pedido sem mesa' : 'Mesa ' + table.table_no;
  if (!confirm(`Confirmar recebimento de ${fmt(table.total)} da ${label} por ${methodName(method)}?`)) return;
  btn.disabled = true;
  try {
    const result = await api('/admin/cash/close', { method: 'POST', token, body: { tableNo: table.table_no, method } });
    sessionPaid += result.amount;
    toast(`Pagamento registrado: ${fmt(result.amount)}`);
    await refresh();
  } catch (e) {
    toast(e.message === 'no_open_orders' ? 'Essa conta já foi fechada.' : 'Erro ao registrar pagamento. Atualize e tente novamente.');
  } finally { btn.disabled = false; }
}
$('refresh').addEventListener('click', refresh);
$('logout').addEventListener('click', () => { tokens.clearAdmin(); location.href = 'index.html'; });
await refresh();
