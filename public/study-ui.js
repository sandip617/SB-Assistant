// Study panels on the HUD: today's chapters, the exam plan dialog, the focus timer and the Classroom groups.
const studyApi = (u, b = {}) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bilashi': '1' }, body: JSON.stringify(b) }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'হয়নি'); return j; });
const attr = s => esc(String(s ?? '')).replace(/"/g, '&quot;');
const dayName = t => new Date(t).toLocaleDateString('bn-BD', { weekday: 'short', day: 'numeric', month: 'short' });
const dueText = t => new Date(t).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
let studyData = null, focusEnd = 0, focusPhase = '', focusAsked = false;

function classRow(c, late) {
  return `<div class="task${late ? ' late' : ''}"><i></i><span>${esc(c.title)}<small>${c.cls ? esc(c.cls) + ' · ' : ''}${c.due ? (late ? 'সময় ছিল ' : 'জমা ') + dueText(c.due) : 'তারিখ জানা নেই'}</small></span><button data-id="${+c.id}" aria-label="${attr(c.title)} জমা দিয়েছি">জমা দিয়েছি</button></div>`;
}
function renderClass(b) {
  if (!b) return;
  const n = b.overdue.length + b.upcoming.length;
  $('#classHead').textContent = `Classroom-এর assignment · ${n}টা বাকি${b.overdue.length ? ` · ${b.overdue.length}টা Overdue` : ''}`;
  $('#classwork').innerHTML =
    (b.overdue.length ? `<div class="subject lateHead">Overdue<small>${b.overdue.length}টা</small></div>${b.overdue.map(c => classRow(c, true)).join('')}` : '') +
    (b.upcoming.length ? `<div class="subject">সামনে<small>কাছের deadline আগে</small></div>${b.upcoming.map(c => classRow(c)).join('')}` : '') +
    (b.noDate.length ? `<details class="noDate"><summary>No date · ${b.noDate.length}টা</summary>${b.noDate.map(c => classRow(c)).join('')}</details>` : '') +
    (n || b.noDate.length ? '' : '<div class="task"><span>কিছু বাকি নেই।</span></div>');
}
function renderToday(s) {
  const d = s.today, items = d?.items || [];
  $('#studyToday').innerHTML = !s.exams.length ? '<small>এখনো পরীক্ষা যোগ করা হয়নি।</small>' :
    (d?.exams.length ? `<div class="studyNote">আজ পরীক্ষা: ${esc(d.exams.join(', '))}</div>` : '') +
    (s.carried ? `<div class="studyNote">গতকালের ${+s.carried}টা বাকি ছিল, প্ল্যান নতুন করে সাজানো হয়েছে।</div>` : '') +
    (items.map(x => x.revision ? `<div class="studyItem"><span>${esc(x.exam)}: পুরো revision</span></div>` : `<label class="studyItem"><input type="checkbox" data-ch="${+x.chapterId}"><span>${esc(x.exam)}: ${esc(x.chapter)}</span></label>`).join('') || (d?.exams.length ? '' : '<small>আজকের পড়া শেষ।</small>'));
}
function renderPlan(s) {
  $('#planExams').innerHTML = s.exams.map(e => { const done = e.chapters.filter(c => c.done).length; return `<section class="planExam"><div class="planHead"><b>${esc(e.name)}</b><small>${dayName(e.date)} · ${done}/${e.chapters.length} শেষ</small><button data-del="${+e.id}" aria-label="${attr(e.name)} পরীক্ষা মুছে দাও">মুছে দাও</button></div>${e.chapters.map(c => `<label class="studyItem"><input type="checkbox" data-ch="${+c.id}"${c.done ? ' checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</section>`; }).join('') || '<p>এখনো কোনো পরীক্ষা নেই।</p>';
  $('#planDays').innerHTML = s.plan.map(d => `<div class="planDay"><b>${dayName(d.at)}</b><span>${[...d.exams.map(x => '📝 পরীক্ষা: ' + esc(x)), ...d.items.map(x => x.revision ? esc(x.exam) + ': revision' : esc(x.exam) + ': ' + esc(x.chapter))].join('<br>') || 'ফাঁকা'}</span></div>`).join('');
}
function renderFocus(s) {
  const f = s.focus; document.body.classList.toggle('focusing', f?.phase === 'focus');
  $('#focusBar').hidden = !f; focusEnd = f?.endsAt || 0; focusPhase = f?.phase || ''; focusAsked = false;
  if (f) { $('#focusLabel').textContent = (f.phase === 'focus' ? 'Focus · ' : 'বিরতি · ') + f.subject; focusClock(); }
  $('#focusStart').hidden = !!f;
  const w = s.week; $('#focusWeek').textContent = w.minutes ? `এই সপ্তাহে ${w.sessions}টা session · ${w.minutes} মিনিট` : '';
}
function focusClock() {
  if (!focusEnd) return;
  const left = Math.max(0, Math.ceil((focusEnd - Date.now()) / 1000));
  $('#focusTime').textContent = `${String(left / 60 | 0).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  if (!left && !focusAsked) { focusAsked = true; setTimeout(() => checkDue().then(refresh), 3500); } // the server's timer moves on within 3 seconds
}
setInterval(focusClock, 1000);
window.renderStudy = j => { if (!j.study) return; studyData = j.study; renderClass(j.classBoard); renderToday(j.study); renderFocus(j.study); if ($('#planDlg').open) renderPlan(j.study); };

const tickChapter = async e => { const b = e.target.closest('[data-ch]'); if (!b) return; b.disabled = true; try { await studyApi('/api/study/toggle', { id: +b.dataset.ch }); } catch { status('টিক দিতে পারিনি'); } refresh(); };
$('#studyToday').onchange = tickChapter; $('#planExams').onchange = tickChapter;
$('#planExams').onclick = async e => { const b = e.target.closest('[data-del]'); if (!b || !confirm('এই পরীক্ষা আর তার প্ল্যান মুছে দেব?')) return; try { await studyApi('/api/study/exam/delete', { id: +b.dataset.del }); } catch { status('মুছতে পারিনি'); } refresh(); };
$('#planOpen').onclick = () => { $('#planDlg').showModal(); if (studyData) renderPlan(studyData); };
$('#planClose').onclick = () => $('#planDlg').close();
$('#planForm').onsubmit = async e => {
  e.preventDefault(); const n = $('#planNote'); n.textContent = 'প্ল্যান বানাচ্ছি…';
  try { await studyApi('/api/study/exam', { name: $('#planName').value, date: $('#planDate').value, chapters: $('#planChapters').value }); $('#planForm').reset(); n.textContent = '✅ প্ল্যান তৈরি।'; await refresh(); if (studyData) renderPlan(studyData); } catch (x) { n.textContent = '⚠ ' + x.message; }
};
$('#planFile').onchange = async e => {
  const f = e.target.files[0], n = $('#planNote'); e.target.value = ''; if (!f) return; n.textContent = 'Syllabus পড়ছি, একটু সময় লাগবে…';
  try {
    const r = await fetch('/api/fb/upload', { method: 'POST', headers: { 'x-bilashi': '1', 'x-file-name': encodeURIComponent(f.name) }, body: f }), u = await r.json(); if (!r.ok) throw new Error(u.error);
    const j = await studyApi('/api/study/syllabus', { id: u.id });
    if (j.name) $('#planName').value = j.name; if (j.date) $('#planDate').value = String(j.date).slice(0, 16); $('#planChapters').value = j.chapters.join('\n');
    n.textContent = `${j.chapters.length}টা chapter পেয়েছি। দেখে ঠিক করে "প্ল্যান বানাও" চাপো।${j.note ? ' ' + j.note : ''}`;
  } catch (x) { n.textContent = '⚠ ' + x.message; }
};
$('#focusStart').onclick = async () => { const subject = (prompt('কোন বিষয় পড়বে?', '') ?? null); if (subject === null) return; try { await studyApi('/api/study/focus', { on: true, subject }); } catch { status('Timer শুরু করতে পারিনি'); } refresh(); };
$('#focusStop').onclick = async () => { try { await studyApi('/api/study/focus', { on: false }); } catch { status('Timer থামাতে পারিনি'); } refresh(); };
refresh();
