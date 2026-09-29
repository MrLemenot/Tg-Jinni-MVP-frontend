'use strict';

const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();
try { tg?.setHeaderColor?.('#10131f'); tg?.setBackgroundColor?.('#10131f'); } catch (_) {}

const app = document.getElementById('app');
const initData = tg?.initData || '';
const apiBase = `${window.location.origin}/api/v1`;
const state = { screen: 'home', me: null, busy: false, game: null, lastToast: null };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Number(value || 0).toLocaleString('ru-RU');
const icon = {home:'⌂',tasks:'✦',game:'◈',shop:'▣',profile:'☻'};

async function api(path, options = {}) {
  if (!initData) throw new Error('Открой Mini App через Telegram, чтобы авторизоваться.');
  const headers = { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}), 'X-Telegram-Init-Data': initData };
  let response;
  try { response = await fetch(apiBase + path, {...options, headers}); }
  catch (_) { throw new Error('Не удалось связаться с сервером. Проверь подключение и попробуй снова.'); }
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {detail:raw}; }
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : detail?.message || data?.error || `Ошибка сервера (${response.status})`);
  }
  return data;
}
function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function loading(title='Загружаем') {
  app.innerHTML = `<div class="topbar"><div class="brand"><div class="brand-icon">✦</div><div><div class="brand-name">TG-Jinni</div><div class="brand-caption">Твой мир возможностей</div></div></div></div><section class="panel"><div class="loading-row"><span class="spinner"></span>${esc(title)}…</div></section>`;
}
function header() {
  const name = state.me?.first_name || 'Игрок';
  return `<header class="topbar"><div class="brand"><div class="brand-icon">✦</div><div><div class="brand-name">TG-Jinni</div><div class="brand-caption">Играй · выполняй · зарабатывай</div></div></div><div class="avatar" aria-label="Профиль">${esc(name.trim().slice(0,1).toUpperCase() || 'J')}</div></header>`;
}
function nav(active=state.screen) {
  const tabs = [['home','Главная','⌂'],['tasks','Задания','✦'],['game','Игра','◈'],['shop','Магазин','▣'],['profile','Профиль','☻']];
  return `<nav class="bottom-nav" aria-label="Основная навигация">${tabs.map(([key,label,glyph])=>`<button class="nav-item ${active===key?'active':''}" data-action="nav" data-screen="${key}" aria-label="${label}"><span class="nav-icon">${glyph}</span><span>${label}</span></button>`).join('')}</nav>`;
}
function frame(content, active=state.screen) { app.innerHTML = `${header()}<section>${content}</section>${nav(active)}`; }
function title(text, subtitle='') { return `<h1 class="page-title">${esc(text)}</h1>${subtitle?`<p class="page-subtitle">${esc(subtitle)}</p>`:''}`; }
function empty(emoji, text) { return `<div class="empty"><div class="empty-icon">${emoji}</div>${esc(text)}</div>`; }
function errorPage(error, retry='home') {
  const msg = error?.message || 'Что-то пошло не так.';
  if (!initData) {
    app.innerHTML = `${header()}<section class="panel" style="margin-top:22px;text-align:center"><div class="genie-mark" style="margin:0 auto 15px">✦</div><h1 class="page-title">Открой в Telegram</h1><p class="page-subtitle">TG-Jinni работает внутри Telegram Mini App. Нажми кнопку меню бота или команду /start.</p><div class="notice">При открытии в обычном браузере Telegram не передаёт данные авторизации.</div></section>`;
    return;
  }
  frame(`${title('Не удалось загрузить','Проверь подключение и попробуй ещё раз.')}<div class="panel"><div class="item-desc safe-text">${esc(msg)}</div><button class="btn btn-primary btn-block" data-action="nav" data-screen="${esc(retry)}" style="margin-top:14px">Повторить</button></div>`, state.screen);
}
async function home() {
  state.screen='home'; loading('Открываем главную');
  try {
    const [me,promo] = await Promise.all([api('/me'),api('/promotions/feed')]); state.me=me;
    const camp=promo?.campaign;
    frame(`${title(`Привет, ${me.first_name || 'игрок'}!`,'Твои монеты и активности — в одном месте.')}
      <div class="balance-card"><div class="eyebrow">Доступный баланс</div><div class="balance-value">${number(me.coins_available)} <span style="font-size:23px">🪙</span></div><div class="balance-note">${number(me.coins_hold)} монет на проверке</div></div>
      <div class="grid-2" style="margin-top:11px"><div class="panel"><div class="stat-icon">🎮</div><div class="stat-label">Игр сыграно</div><div class="stat-value">${number(me.games_played)}</div></div><div class="panel"><div class="stat-icon">🏆</div><div class="stat-label">Угадано</div><div class="stat-value">${number(me.games_won)}</div></div></div>
      ${camp?`<div class="section-head"><div class="section-title">Рекомендуем канал</div><span class="promo-tag">Промо</span></div><div class="panel promo-card"><div class="item-title">${esc(camp.title)}</div><div class="item-desc">Подпишись на канал и открой для себя что-то новое.</div><button class="btn btn-accent btn-block" data-action="promo" data-id="${esc(camp.id)}" data-url="${esc(camp.url)}" style="margin-top:14px">Перейти в канал <span>↗</span></button></div>`:''}
      <div class="section-head"><div class="section-title">Что будем делать?</div></div><div class="stack">
      <button class="feature" data-action="nav" data-screen="tasks"><span class="feature-icon">🎁</span><span class="feature-copy"><span class="feature-title">Выполнять задания</span><span class="feature-desc">Подписывайся на каналы и получай монеты</span></span><span class="feature-arrow">›</span></button>
      <button class="feature" data-action="nav" data-screen="game"><span class="feature-icon">🧞</span><span class="feature-copy"><span class="feature-title">Сыграть в угадайку</span><span class="feature-desc">Отвечай на вопросы и попробуй угадать</span></span><span class="feature-arrow">›</span></button>
      <button class="feature" data-action="nav" data-screen="shop"><span class="feature-icon">🛍️</span><span class="feature-copy"><span class="feature-title">Заглянуть в магазин</span><span class="feature-desc">Трать заработанные монеты</span></span><span class="feature-arrow">›</span></button>
      <button class="feature" data-action="nav" data-screen="channels"><span class="feature-icon">📣</span><span class="feature-copy"><span class="feature-title">Продвинуть свой канал</span><span class="feature-desc">Добавь канал и отправь его на модерацию</span></span><span class="feature-arrow">›</span></button></div>`, 'home');
  } catch(e) { errorPage(e,'home'); }
}
async function tasks() {
  state.screen='tasks'; loading('Ищем задания');
  try {
    const items=await api('/tasks');
    const body=items.length?`<div class="stack">${items.map(t=>{
      const done=t.user_status==='rewarded', hold=t.user_status==='on_hold';
      return `<article class="panel"><div class="row-head" style="display:flex;justify-content:space-between;gap:8px;align-items:start"><div class="item-title">${esc(t.title)}</div><span class="status ${done?'good':hold?'wait':''}">${done?'Получено':hold?'На проверке':'Доступно'}</span></div><div class="item-desc">${esc(t.description||'Подпишись на канал и подтверди подписку.')}</div><div class="item-meta"><span class="reward">+${number(t.reward_coins)} 🪙</span><span>${hold?`Проверка до ${number(t.hold_hours||48)} ч.`:'Награда после проверки'}</span></div>${t.channel_username?`<button class="btn btn-ghost btn-block" data-action="channel-open" data-username="${esc(t.channel_username)}" style="margin-top:13px">Открыть канал ↗</button>`:''}${done?'<div class="hint" style="margin-top:10px">Задание уже выполнено.</div>':hold?'<div class="hint" style="margin-top:10px">Подписка подтверждена. Монеты находятся на холде.</div>':`<button class="btn btn-primary btn-block" data-action="verify-task" data-id="${t.id}" style="margin-top:9px">Проверить подписку</button>`}</article>`;
    }).join('')}</div>`:empty('🎁','Активных заданий пока нет. Загляни позже.');
    frame(`${title('Задания','Подписывайся на каналы и получай монеты.')}${body}`, 'tasks');
  } catch(e) { errorPage(e,'tasks'); }
}
async function verifyTask(id,button) {
  if(button) button.disabled=true;
  try { const r=await api(`/tasks/${id}/verify`,{method:'POST'}); toast(r.verified?(r.status==='on_hold'?`Подписка подтверждена · награда на холде ${r.hold_hours||48} ч.`:'Награда уже получена'):'Подписка пока не подтверждена. Подпишись и попробуй снова.'); await tasks(); }
  catch(e){toast(e.message);if(button)button.disabled=false;}
}
async function shop() {
  state.screen='shop'; loading('Открываем магазин');
  try { const [items,me]=await Promise.all([api('/shop'),api('/me')]);state.me=me;
    const body=items.length?`<div class="stack">${items.map(i=>`<article class="panel"><div style="display:flex;gap:12px;align-items:center"><div class="feature-icon">${i.item_type==='boost'?'⚡':i.item_type==='cosmetic'?'✨':'🎁'}</div><div style="flex:1;min-width:0"><div class="item-title">${esc(i.title)}</div><div class="item-desc">${esc(i.description||'Особый предмет TG-Jinni')}</div></div></div><div class="item-meta"><span class="reward">${number(i.price_coins)} 🪙</span><button class="btn btn-primary btn-small" data-action="buy" data-id="${i.id}">Купить</button></div></article>`).join('')}</div>`:empty('🛍️','Магазин пока пуст. Новые товары скоро появятся.');
    frame(`${title('Магазин','Обменивай монеты на доступные предметы.')}<div class="panel-soft" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:13px"><span class="hint">Твой баланс</span><strong>${number(me.coins_available)} 🪙</strong></div>${body}`,'shop');
  }catch(e){errorPage(e,'shop');}
}
async function buy(id,button){if(button)button.disabled=true;try{await api(`/shop/${id}/buy`,{method:'POST'});toast('Покупка успешно оформлена');await shop();}catch(e){toast(e.message);if(button)button.disabled=false;}}
async function channels(){
  state.screen='channels';loading('Загружаем каналы');
  try{const cs=await api('/entities/mine');
    const cards=cs.map(c=>{const status=c.is_active?'Одобрен':'На модерации';const pct=c.impressions_total?Math.min(100,Math.round(c.impressions_used/c.impressions_total*100)):0;
      return `<article class="panel"><div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><div class="item-title">${esc(c.title)}</div><span class="status ${c.is_active?'good':'wait'}">${status}</span></div><div class="item-desc safe-text">${esc(c.username||'')}</div><div class="divider"></div><div class="item-meta"><span>${c.ownership_verified?'🟢 Владение подтверждено':'🟡 Владение не подтверждено'}</span><span>${c.is_promoted?'Продвигается':'Не продвигается'}</span></div>${c.promotion_status&&c.promotion_status!=='none'?`<div class="progress"><span style="width:${pct}%"></span></div><div class="item-meta"><span>Показы: ${number(c.impressions_used)} / ${number(c.impressions_total)}</span><span>Клики: ${number(c.clicks_total)}</span></div>`:''}<div class="inline-actions">${!c.ownership_verified?`<button class="btn btn-ghost btn-small" data-action="reverify" data-id="${c.id}">Проверить владение</button>`:''}${c.ownership_verified&&c.is_active?`<button class="btn btn-primary btn-small" data-action="promotion-buy" data-id="${c.id}">Продвижение · 180 ₽</button>`:''}</div></article>`;}).join('');
    frame(`${title('Мои каналы','Добавляй каналы, которыми управляешь, и следи за продвижением.')}${cs.length?`<div class="stack">${cards}</div>`:empty('📣','Ты ещё не добавил ни одного канала.')}<div class="panel" style="margin-top:13px"><div class="item-title">Добавить канал</div><p class="item-desc">Для проверки ты должен быть администратором канала, и бот тоже должен быть добавлен администратором.</p><form id="channel-form" class="form"><div><label class="field-label" for="channel-title">Название канала</label><input class="field" id="channel-title" name="title" maxlength="128" placeholder="Например, Новости города" required></div><div><label class="field-label" for="channel-username">Публичная ссылка или @username</label><input class="field" id="channel-username" name="username" maxlength="128" placeholder="@my_channel" required></div><button class="btn btn-primary btn-block" type="submit">Отправить на модерацию</button><div class="hint">Приватные invite-ссылки пока не поддерживаются.</div></form></div>`,'profile');
  }catch(e){errorPage(e,'channels');}
}
async function submitChannel(form){const fd=new FormData(form);const titleValue=String(fd.get('title')||'').trim(),username=String(fd.get('username')||'').trim();const btn=form.querySelector('button[type=submit]');btn.disabled=true;try{await api('/entities/propose',{method:'POST',body:JSON.stringify({title:titleValue,username})});toast('Заявка отправлена на модерацию');await channels();}catch(e){toast(e.message);btn.disabled=false;}}
async function reverify(id,button){if(button)button.disabled=true;try{const r=await api(`/entities/${id}/reverify`,{method:'POST'});toast(r.verified?'Владение подтверждено':'Не удалось подтвердить владение');await channels();}catch(e){toast(e.message);if(button)button.disabled=false;}}
async function buyPromotion(id,button){if(button)button.disabled=true;try{const d=await api('/promotions',{method:'POST',body:JSON.stringify({entity_id:Number(id)})});if(!d.invoice_url)throw new Error('Сервер не вернул ссылку на оплату');if(tg?.openInvoice){tg.openInvoice(d.invoice_url,status=>{if(status==='paid'){toast('Оплата подтверждена Telegram');channels();}else if(status==='failed')toast('Платёж не прошёл');});}else if(tg?.openLink)tg.openLink(d.invoice_url);else window.open(d.invoice_url,'_blank','noopener');}catch(e){toast(e.message);if(button)button.disabled=false;}}
async function game(){state.screen='game';loading('Готовим игру');try{const d=await api('/game/start',{method:'POST'});state.game=d;renderQuestion(d);}catch(e){errorPage(e,'game');}}
function renderQuestion(d){state.screen='game';const options=[['Да',1,'Уверенно да'],['Скорее да',.75,'Похоже на правду'],['Не знаю',.5,'Пока не уверен'],['Скорее нет',.25,'Скорее нет'],['Нет',0,'Уверенно нет']];frame(`${title('Угадайка',`Вопрос ${d.question_number} из ${d.total_questions}`)}<div class="progress" style="margin:0 0 14px"><span style="width:${Math.round((d.question_number/Math.max(1,d.total_questions))*100)}%"></span></div><div class="panel" style="padding:23px 19px;margin-bottom:13px"><div class="eyebrow" style="margin-bottom:12px">Вопрос №${d.question_number}</div><div style="font-size:20px;font-weight:800;line-height:1.35;letter-spacing:-.3px">${esc(d.question.text)}</div></div><div class="answer-list">${options.map(([label,value,desc])=>`<button class="btn btn-ghost answer-btn btn-block" data-action="answer" data-session="${esc(d.session_id)}" data-qid="${d.question.id}" data-value="${value}"><span style="text-align:left"><strong>${label}</strong><span class="hint" style="display:block;font-weight:400;margin-top:3px">${desc}</span></span><span class="answer-arrow">›</span></button>`).join('')}</div><button class="btn btn-ghost btn-block" data-action="nav" data-screen="home" style="margin-top:12px">Выйти из игры</button>`,'game');}
async function answer(session,qid,value,button){if(button)button.disabled=true;try{const d=await api(`/game/${session}/answer`,{method:'POST',body:JSON.stringify({question_id:Number(qid),answer:Number(value)})});if(d.finished){const r=await api(`/game/${session}/result`);frame(`${title('Результат','Раунд завершён!')}<div class="panel" style="text-align:center;padding:25px 18px"><div class="genie-mark" style="margin:0 auto 15px">${r.entity?'✦':'?'}</div><div class="eyebrow">${r.entity?'Моя догадка':'Не удалось угадать'}</div><div class="page-title" style="margin-top:8px">${esc(r.entity?.title||'Попробуем ещё раз?')}</div><div class="item-desc">${esc(r.entity?.username||'')}</div><div class="divider"></div><div class="stat-label">Уверенность</div><div class="stat-value">${Math.round((r.confidence||0)*100)}%</div></div><div class="stack" style="margin-top:12px"><button class="btn btn-primary btn-block" data-action="nav" data-screen="game">Играть снова</button><button class="btn btn-ghost btn-block" data-action="nav" data-screen="home">На главную</button></div>`,'game');}else{state.game=d;renderQuestion({...d,session_id:session});}}catch(e){toast(e.message);if(button)button.disabled=false;}}
async function profile(){state.screen='profile';loading('Загружаем профиль');try{const me=await api('/me');state.me=me;frame(`${title('Профиль','Твоя статистика TG-Jinni.')}<div class="panel"><div class="user-line"><div class="user-avatar">${esc((me.first_name||'J').trim().slice(0,1).toUpperCase())}</div><div style="min-width:0"><div class="item-title">${esc(me.first_name||'Игрок')}</div><div class="item-desc">${me.username?'@'+esc(me.username):'Участник TG-Jinni'}</div><div class="tiny">ID: ${number(me.telegram_id)}</div></div></div><div class="divider"></div><div class="grid-2"><div><div class="stat-label">Доступно</div><div class="stat-value">${number(me.coins_available)} 🪙</div></div><div><div class="stat-label">На проверке</div><div class="stat-value">${number(me.coins_hold)} 🪙</div></div><div><div class="stat-label">Игр сыграно</div><div class="stat-value">${number(me.games_played)}</div></div><div><div class="stat-label">Побед</div><div class="stat-value">${number(me.games_won)}</div></div></div></div><div class="stack" style="margin-top:12px"><button class="feature" data-action="nav" data-screen="channels"><span class="feature-icon">📣</span><span class="feature-copy"><span class="feature-title">Мои каналы</span><span class="feature-desc">Заявки, продвижение и статистика</span></span><span class="feature-arrow">›</span></button>${me.is_admin?'<button class="feature" data-action="nav" data-screen="admin"><span class="feature-icon">🛡️</span><span class="feature-copy"><span class="feature-title">Панель администратора</span><span class="feature-desc">Модерация заявок и статистика</span></span><span class="feature-arrow">›</span></button>':''}</div>`,'profile');}catch(e){errorPage(e,'profile');}}
async function admin(){state.screen='admin';loading('Открываем админ-панель');try{const [stats,pending]=await Promise.all([api('/admin/stats'),api('/admin/pending')]);const list=pending.length?`<div class="stack">${pending.map(p=>`<article class="panel"><div class="item-title">${esc(p.title)}</div><div class="item-desc">${esc(p.username||'')} · ID ${number(p.author_telegram_id)}</div><div class="item-meta"><span class="status ${p.ownership_verified?'good':'wait'}">${p.ownership_verified?'Владение подтверждено':'Нет подтверждения'}</span></div><div class="inline-actions"><button class="btn btn-primary btn-small" data-action="approve" data-id="${p.id}">Одобрить</button><button class="btn btn-danger btn-small" data-action="reject" data-id="${p.id}">Отклонить</button></div></article>`).join('')}</div>`:empty('🛡️','Новых заявок на модерацию нет.');frame(`${title('Админ-панель','Проверяй заявки и следи за платформой.')}<div class="grid-2"><div class="panel"><div class="stat-label">Пользователи</div><div class="stat-value">${number(stats.users)}</div></div><div class="panel"><div class="stat-label">Ожидают проверки</div><div class="stat-value">${number(stats.pending_channels)}</div></div></div><div class="section-head"><div class="section-title">Заявки каналов</div></div>${list}`,'profile');}catch(e){errorPage(e,'admin');}}
async function moderate(id,approve,button){if(button)button.disabled=true;let comment=null;if(!approve){comment=window.prompt('Причина отклонения (необязательно)')||null;}try{await api(`/admin/pending/${id}/${approve?'approve':'reject'}`,{method:'POST',body:JSON.stringify({comment})});toast(approve?'Канал одобрен':'Заявка отклонена');await admin();}catch(e){toast(e.message);if(button)button.disabled=false;}}
function openTelegram(url){if(!/^https:\/\/(t\.me|telegram\.me)\//i.test(url||'')){toast('Некорректная ссылка на Telegram');return;}if(tg?.openTelegramLink)tg.openTelegramLink(url);else if(tg?.openLink)tg.openLink(url);else window.open(url,'_blank','noopener,noreferrer');}
app.addEventListener('click',async event=>{const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const a=button.dataset.action;try{switch(a){case'nav':if(button.dataset.screen==='home')await home();else if(button.dataset.screen==='tasks')await tasks();else if(button.dataset.screen==='game')await game();else if(button.dataset.screen==='shop')await shop();else if(button.dataset.screen==='profile')await profile();else if(button.dataset.screen==='channels')await channels();else if(button.dataset.screen==='admin')await admin();break;case'channel-open':openTelegram(`https://t.me/${String(button.dataset.username||'').replace(/^@/,'')}`);break;case'verify-task':await verifyTask(button.dataset.id,button);break;case'buy':await buy(button.dataset.id,button);break;case'reverify':await reverify(button.dataset.id,button);break;case'promotion-buy':await buyPromotion(button.dataset.id,button);break;case'promo':try{await api(`/promotions/${button.dataset.id}/click`,{method:'POST'});}catch(_){}openTelegram(button.dataset.url);break;case'answer':await answer(button.dataset.session,button.dataset.qid,button.dataset.value,button);break;case'approve':await moderate(button.dataset.id,true,button);break;case'reject':await moderate(button.dataset.id,false,button);break;}}catch(e){toast(e.message||'Ошибка');}});
app.addEventListener('submit',event=>{if(event.target.id==='channel-form'){event.preventDefault();submitChannel(event.target);}});
const initial=new URLSearchParams(location.search).get('screen');
if(!initData){errorPage(new Error('No Telegram initData'));}
else if(initial==='tasks')tasks();else if(initial==='channels')channels();else if(initial==='admin')admin();else home();
