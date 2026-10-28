import { api, money, ensureStaff, registerSW } from './common.js';
registerSW();
const $ = id => document.getElementById(id);
let activeFilter = 'all';
let tableData = [];
const fallback = Array.from({length:20},(_,i)=>({table_no:String(i+1),total:0,orders:[]}));
function render(){
 const query=$('search').value.trim();
 const visible=tableData.filter(t=>{
  const occupied=Number(t.total||0)>0 || (t.orders||[]).length>0;
  return (activeFilter==='all'||(activeFilter==='occupied'&&occupied)||(activeFilter==='free'&&!occupied)) && (!query||String(t.table_no).includes(query));
 });
 $('tables').innerHTML='';
 if(!visible.length){$('tables').innerHTML='<div class="empty">Nenhuma mesa encontrada com esse filtro.</div>';return;}
 for(const t of visible){
  const occupied=Number(t.total||0)>0||(t.orders||[]).length>0;
  const card=document.createElement('button');card.className='table-card'+(occupied?' occupied':'');
  const label=t.table_no==='0'?'Sem mesa':'Mesa '+t.table_no;
  card.innerHTML='<span class="num">'+label+'</span><span class="status">'+(occupied?'● Em uso':'● Disponível')+'</span>'+(occupied?'<span class="amount">'+money(t.total||0)+'</span>':'');
  card.addEventListener('click',()=>{const detail=(t.orders||[]).map(o=>'Pedido #'+(o.order_no??o.id)+' — '+money(o.total)).join('\n');alert(label+'\n'+(occupied?'Consumo em aberto: '+money(t.total||0):'Esta mesa está livre.')+(detail?'\n\n'+detail:'')+'\n\nA inclusão de itens na comanda exige o servidor conectado e será habilitada na próxima etapa.');});
  $('tables').append(card);
 }
}
async function load(){
 $('notice').className='notice';$('notice').textContent='Conectando ao servidor para buscar as mesas e comandas reais…';
 try{
  await ensureStaff({minRole:'admin',title:'Acesso às mesas'});
  const data=await api('/admin/cash/tables');
  tableData=fallback.map(t=>{const found=(data||[]).find(x=>String(x.table_no)===t.table_no);return found||t;});
  $('notice').className='notice good';$('notice').textContent='Conectado ao servidor. Os status e valores exibidos vêm das contas em aberto.';
 }catch(e){
  tableData=fallback;
  $('notice').textContent='Modo de visualização: o servidor ainda não está conectado ou o acesso não foi validado. As 20 mesas abaixo são apenas demonstrativas; nenhum pedido ou pagamento será gravado nesta tela ainda.';
 }
 $('total').textContent=tableData.length;
 $('available').textContent=tableData.filter(t=>!(Number(t.total||0)>0||(t.orders||[]).length)).length;
 $('occupied').textContent=tableData.length-Number($('available').textContent);
 render();
}
$('refresh').addEventListener('click',load);
$('search').addEventListener('input',render);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render();}));
load();
