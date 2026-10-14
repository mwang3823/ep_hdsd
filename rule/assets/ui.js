/* ===== Tiện ích giao diện dùng chung ===== */
(function () {
  const T = Store.T;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = { esc, ACT: {}, drawerTab: 'note' };

  UI.N = (id) => (window.NOTES[id] ? '<i class="nt" data-act="note" data-n="' + id + '" title="Xem rule">i</i>' : '');

  /* Bộ phân phối hành động: phần tử có data-act gọi UI.ACT[tên](dataset, el, event) */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) { UI.closeDropdown(); return; }
    const fn = UI.ACT[el.dataset.act];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(el.dataset, el, e); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-chg]');
    if (!el) return;
    const fn = UI.ACT[el.dataset.chg];
    if (fn) fn(el.dataset, el, e);
  });

  /* ---------- drawer ---------- */
  UI.ACT.note = (d) => UI.showNote(d.n);
  UI.showNote = (id) => {
    const n = window.NOTES[id]; if (!n) return;
    UI.drawerTab = 'note';
    UI.lastNote = id;
    document.body.classList.remove('nodrawer');
    UI.renderDrawer();
  };
  UI.renderDrawer = () => {
    const box = document.getElementById('drawer');
    const S = Store.S;
    const tabs = [['note', 'Giải thích rule'], ['log', 'Nhật ký API/DB'], ['noti', 'Thông báo đẩy']];
    let body = '';
    if (UI.drawerTab === 'note') {
      const n = window.NOTES[UI.lastNote];
      body = n ? '<div class="note-card"><h4>' + n.t + '</h4>' + n.b + (n.r ? '<div class="ref">📄 ' + esc(n.r) + '</div>' : '') + '</div>' : '';
      body += '<div class="empty-hint">Bấm vào biểu tượng <i class="nt" style="display:inline-flex">i</i> trên giao diện để xem rule của nút/field đó.<br>Mọi thao tác được ghi ở tab <b>Nhật ký API/DB</b>.</div>';
    } else if (UI.drawerTab === 'log') {
      body = S.log.length ? S.log.map((l) => '<div class="log-item ' + (l.ok ? '' : 'fail') + '"><span class="at">' + l.at + '</span><div class="api">' + esc(l.api) + '</div><div class="msg">' + (l.ok ? '✓ ' : '✗ ') + esc(l.message) + '</div>' + (l.why ? '<div class="why">Lý do: ' + esc(l.why) + '</div>' : '') + (l.db && l.db.filter(Boolean).length ? '<ul>' + l.db.filter(Boolean).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</div>').join('') : '<div class="empty-hint">Chưa có thao tác nào.</div>';
    } else {
      body = S.noti.length ? S.noti.map((n) => '<div class="noti-item"><div class="to">→ ' + esc(Engine.staffName(n.to)) + ' · ' + n.at + '</div><b>' + esc(n.title) + '</b><div>' + esc(n.message) + '</div></div>').join('') : '<div class="empty-hint">Chưa có thông báo đẩy nào.<br>Các thao tác check-in, duyệt, chấm hộ… sẽ sinh noti tại đây.</div>';
    }
    box.innerHTML = '<div class="tabs">' + tabs.map(([k, l]) => '<button class="' + (UI.drawerTab === k ? 'on' : '') + '" data-act="dtab" data-k="' + k + '">' + l + (k === 'log' && UI.newLog ? '<span class="badge">' + UI.newLog + '</span>' : '') + '</button>').join('') + '</div><div class="body">' + body + '</div>';
  };
  UI.ACT.dtab = (d) => { UI.drawerTab = d.k; if (d.k === 'log') UI.newLog = 0; UI.renderDrawer(); };
  UI.newLog = 0;
  Engine.onLog(() => { if (UI.drawerTab !== 'log') UI.newLog++; UI.renderDrawer(); });

  /* ---------- modal ---------- */
  UI.modal = ({ title, body, footer, size, note }) => {
    UI.closeModal();
    const w = document.createElement('div');
    w.className = 'overlay'; w.id = 'pmodal';
    w.innerHTML = '<div class="modal ' + (size || '') + '"><div class="modal-h"><h3>' + title + '</h3>' + (note ? UI.N(note) : '') + '<button class="x" data-act="closeModal">×</button></div><div class="modal-b">' + body + '</div>' + (footer != null ? '<div class="modal-f">' + footer + '</div>' : '') + '</div>';
    document.body.appendChild(w);
    return w;
  };
  UI.closeModal = () => { const m = document.getElementById('pmodal'); if (m) m.remove(); };
  UI.ACT.closeModal = () => UI.closeModal();

  /* ---------- swal (SweetAlert portal) ---------- */
  UI.swal = (type, title, text, why) => new Promise((res) => {
    const w = document.createElement('div');
    w.className = 'overlay'; w.style.zIndex = 400;
    const ic = { success: '✓', error: '✕', question: '?' }[type] || '!';
    w.innerHTML = '<div class="swal"><div class="ic ' + type + '">' + ic + '</div><h3>' + esc(title) + '</h3>' + (text ? '<p>' + esc(text) + '</p>' : '') + (why ? '<div class="why">💡 ' + esc(why) + '</div>' : '') + '<div class="acts">' +
      (type === 'question' ? '<button class="btn btn-default" data-r="0">Hủy</button><button class="btn btn-primary" data-r="1">Đồng ý</button>' : '<button class="btn btn-primary" data-r="1">OK</button>') + '</div></div>';
    w.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { w.remove(); res(b.dataset.r === '1'); } });
    document.body.appendChild(w);
  });
  UI.result = (r) => (r.ok ? UI.swal('success', r.message) : UI.swal('error', r.message, null, r.why));

  /* ---------- dropdown ---------- */
  UI.dropdown = (anchor, items) => {
    UI.closeDropdown();
    const dd = document.createElement('div');
    dd.className = 'dropdown'; dd.id = 'pdrop';
    dd.innerHTML = items.map((it) => {
      if (it === '-') return '<hr>';
      return '<button class="' + (it.disabled ? 'disabled' : '') + '" ' + (it.disabled ? '' : 'data-act="' + it.act + '"') + Object.entries(it.data || {}).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('') + '>' + (it.icon || '•') + ' ' + it.label + '</button>' + (it.hint ? '<div class="hint">' + it.hint + '</div>' : '');
    }).join('');
    document.body.appendChild(dd);
    const r = anchor.getBoundingClientRect();
    const top = r.bottom + window.scrollY + 4;
    let left = r.right - 230 + window.scrollX;
    if (left < 8) left = 8;
    dd.style.top = top + 'px'; dd.style.left = left + 'px';
    const h = dd.offsetHeight;
    if (r.bottom + h > window.innerHeight - 8) dd.style.top = Math.max(60, r.top + window.scrollY - h - 4) + 'px';
  };
  UI.closeDropdown = () => { const d = document.getElementById('pdrop'); if (d) d.remove(); };

  UI.avatar = (name, id) => {
    const colors = ['#5867dd', '#34bfa3', '#f4516c', '#ffb822', '#36a3f7', '#9816f4'];
    const ini = name.split(' ').slice(-1)[0][0];
    return '<div class="avatar" style="background:' + colors[id % colors.length] + '">' + ini + '</div>';
  };
  UI.opt = (list, val, vk, lk, ph) => (ph != null ? '<option value="">' + ph + '</option>' : '') + list.map((x) => '<option value="' + x[vk] + '"' + (String(x[vk]) === String(val) ? ' selected' : '') + '>' + esc(x[lk]) + '</option>').join('');
  UI.statusChip = (st) => { const s = Engine.STATUS[st] || Engine.STATUS.waiting; return '<span class="chip" style="background:' + s.color + '">' + s.label + '</span>'; };
  UI.form = (root) => { const o = {}; root.querySelectorAll('[name]').forEach((el) => { if (el.type === 'checkbox') o[el.name] = el.checked ? 1 : 0; else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else o[el.name] = el.value; }); return o; };

  window.UI = UI;
  window.esc = esc;
  void T;
})();
