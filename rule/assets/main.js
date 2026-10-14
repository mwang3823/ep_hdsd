/* ===== Khởi động, thanh điều khiển, đồng hồ giả lập ===== */
(function () {
  Store.load();
  const T = Store.T, A = UI.ACT;
  let MODE = 'rules';
  try { MODE = localStorage.getItem('tk-sim-mode') || 'rules'; } catch (e) { /* bỏ qua */ }

  function bar() {
    const n = Store.now();
    document.getElementById('bar').innerHTML = '<a href="../" class="tbtn" style="text-decoration:none">← HDSD</a><div class="brand">Chấm công Matthews<small>mô phỏng rule</small></div><div class="modes">' +
      [['rules', 'Rule & Luồng'], ['portal', 'Portal web'], ['app', 'App nhân viên']].map(([k, l]) => '<button class="' + (MODE === k ? 'on' : '') + '" data-act="mode" data-k="' + k + '">' + l + '</button>').join('') +
      '</div><span class="sp"></span><div class="clock"><label>Giờ giả lập</label><input type="datetime-local" id="clk" value="' + T.ymd(n) + 'T' + T.hm(n) + '" data-chg="clk"><button data-act="tick" data-m="-30">−30p</button><button data-act="tick" data-m="15">+15p</button><button data-act="tick" data-m="60">+1h</button><button data-act="tick" data-m="1440">+1 ngày</button></div>' +
      '<button class="tbtn ' + (document.body.classList.contains('nonotes') ? '' : 'on') + '" data-act="tNotes">ⓘ Chú thích</button><button class="tbtn" data-act="tDrawer">☰ Khung bên phải</button><button class="tbtn" data-act="reset">↺ Reset dữ liệu</button>';
  }
  function render() {
    bar();
    if (MODE === 'portal') Portal.render(); else if (MODE === 'app') App.render(); else Rules.render();
    UI.renderDrawer();
  }
  A.mode = (d) => Main.mode(d.k);
  A.clk = (d, el) => { if (!el.value) return; Store.S.now = new Date(el.value).getTime(); Store.save(); render(); };
  A.tick = (d) => { Store.S.now += Number(d.m) * 60000; Store.save(); render(); };
  A.tNotes = () => { document.body.classList.toggle('nonotes'); bar(); };
  A.tDrawer = () => { document.body.classList.toggle('nodrawer'); };
  A.reset = async () => {
    if (!(await UI.swal('question', 'Reset toàn bộ dữ liệu mô phỏng?', 'Dữ liệu mẫu được tạo lại theo tuần hiện tại, giờ giả lập về 07:50 hôm nay.'))) return;
    Store.reset(); App.reset(); render();
  };

  window.Main = { mode(k) { MODE = k; try { localStorage.setItem('tk-sim-mode', k); } catch (e) { /* bỏ qua */ } render(); }, render };
  UI.lastNote = 'menu-all';
  render();
})();
