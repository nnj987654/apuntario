/* =========================================================
   ESTADO Y PERSISTENCIA
   ========================================================= */
let currentSpace = null;
let data = null;
let selection = { materiaId: null, temaId: null, bloqueId: null, apunteId: null };
let saveTimeout = null;
let highlightMode = false;
let selectedColor = '#8fae95';
let esquemaBoxes = [];
let esquemaCanvas = null;

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toLocaleString('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

// Sistema de persistencia con localStorage
function getLS(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.error('Error reading localStorage:', e);
    return null;
  }
}

function setLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    return false;
  }
}

async function listSpaces() {
  return getLS('apuntario:spaces') || [];
}

async function saveSpacesList(list) {
  setLS('apuntario:spaces', list);
}

async function loadSpaceData(name) {
  const data = getLS('apuntario:data:' + name);
  return data || { materias: [] };
}

async function persist() {
  if (!currentSpace) return;
  const indicator = document.getElementById('save-indicator');
  indicator.innerHTML = '';
  indicator.append(dotEl(), document.createTextNode(' guardando...'));
  try {
    setLS('apuntario:data:' + currentSpace, data);
    indicator.innerHTML = '';
    indicator.append(dotEl(), document.createTextNode(' guardado'));
  } catch (e) {
    console.error('Error persisting data:', e);
    indicator.innerHTML = '';
    indicator.append(dotEl(), document.createTextNode(' error al guardar'));
  }
}

function dotEl() {
  const d = document.createElement('span');
  d.className = 'dot';
  return d;
}

function scheduleSave() {
  clearTimeout(saveTimeout);
  const indicator = document.getElementById('save-indicator');
  indicator.innerHTML = '';
  indicator.append(dotEl(), document.createTextNode(' sin guardar'));
  saveTimeout = setTimeout(persist, 700);
}

/* =========================================================
   MODALES
   ========================================================= */
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

function showCrearMateriaModal() {
  document.getElementById('materia-name').value = '';
  document.getElementById('materia-color-value').value = '#8fae95';
  selectedColor = '#8fae95';
  updateColorPicker();
  showModal('modal-crear-materia');
  document.getElementById('materia-name').focus();
}

function updateColorPicker() {
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('selected', opt.getAttribute('data-color') === selectedColor);
  });
}

function confirmarCrearMateria() {
  const nombre = document.getElementById('materia-name').value.trim();
  if (!nombre) {
    alert('Por favor, ingresa un nombre para la materia');
    return;
  }
  crearMateria(nombre, selectedColor);
  closeModal('modal-crear-materia');
}

function showConfirm(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-btn').onclick = () => {
    closeModal('modal-confirm');
    onConfirm();
  };
  showModal('modal-confirm');
}

function confirmarSalir() {
  showConfirm('¿Deseas salir?', '¿Deseas salir de este espacio de trabajo? Todos tus datos se guardarán.', salirEspacio);
}

// Event listeners para color picker
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      selectedColor = opt.getAttribute('data-color');
      document.getElementById('materia-color-value').value = selectedColor;
      updateColorPicker();
    });
  });
});

/* =========================================================
   LOGIN / ESPACIOS
   ========================================================= */
async function initLogin() {
  const spaces = await listSpaces();
  const list = document.getElementById('spaces-list');
  list.innerHTML = '';
  if (spaces.length) {
    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-size:11.5px;color:var(--text-faint);margin:14px 0 4px;';
    hdr.textContent = 'Tus espacios existentes';
    list.append(hdr);
  }
  spaces.forEach(name => {
    const row = document.createElement('div');
    row.className = 'space-item';
    row.innerHTML = `<span>${escapeHtml(name)}</span>`;
    const enter = document.createElement('button');
    enter.className = 'enter';
    enter.textContent = 'Entrar →';
    enter.onclick = () => enterSpace(name);
    row.append(enter);
    list.append(row);
  });
}

async function crearOEntrarEspacio() {
  const input = document.getElementById('space-name-input');
  const name = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  const spaces = await listSpaces();
  if (!spaces.includes(name)) {
    spaces.push(name);
    await saveSpacesList(spaces);
  }
  input.value = '';
  enterSpace(name);
}

async function enterSpace(name) {
  currentSpace = name;
  data = await loadSpaceData(name);
  document.getElementById('space-title').textContent = name;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('active');
  applyPrefs();
  renderTree();
  handleResize();
}

function salirEspacio() {
  currentSpace = null;
  data = null;
  selection = { materiaId: null, temaId: null, bloqueId: null, apunteId: null };
  highlightMode = false;
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-screen').style.display = 'flex';
  toggleSettings(false);
  initLogin();
}

/* =========================================================
   PREFERENCIAS (tema / tamaño letra)
   ========================================================= */
async function applyPrefs() {
  let prefs = { theme: 'dark', fontScale: 1 };
  const saved = getLS('apuntario:prefs');
  if (saved) prefs = saved;
  setTheme(prefs.theme, false);
  document.documentElement.style.setProperty('--font-scale', prefs.fontScale);
  updateFontLabel(prefs.fontScale);
}

async function savePrefs() {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const fontScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
  setLS('apuntario:prefs', { theme, fontScale });
}

function setTheme(theme, save = true) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  document.getElementById('theme-dark-btn').classList.toggle('active', theme !== 'light');
  document.getElementById('theme-light-btn').classList.toggle('active', theme === 'light');
  if (save) savePrefs();
}

function changeFontScale(delta) {
  let cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
  cur = Math.min(1.4, Math.max(0.8, +(cur + delta).toFixed(2)));
  document.documentElement.style.setProperty('--font-scale', cur);
  updateFontLabel(cur);
  savePrefs();
}

function updateFontLabel(scale) {
  document.getElementById('font-scale-label').textContent = Math.round(scale * 100) + '%';
}

function toggleSettings(open) {
  document.getElementById('settings-panel').classList.toggle('open', open);
  document.getElementById('settings-backdrop').classList.toggle('open', open);
}

/* =========================================================
   ÁRBOL: MATERIA > TEMA > BLOQUE > APUNTE
   ========================================================= */
function crearMateria(nombre, color) {
  if (!nombre || !nombre.trim()) return;
  data.materias.push({
    id: uid(),
    nombre: nombre.trim(),
    color: color || '#8fae95',
    temas: []
  });
  scheduleSave();
  renderTree();
}

function crearTema(materiaId) {
  const nombre = prompt('Nombre del nuevo tema:');
  if (!nombre || !nombre.trim()) return;
  const materia = data.materias.find(m => m.id === materiaId);
  materia.temas.push({ id: uid(), nombre: nombre.trim(), bloques: [] });
  scheduleSave();
  renderTree();
}

function crearBloque(materiaId, temaId) {
  const nombre = prompt('Nombre del nuevo bloque:');
  if (!nombre || !nombre.trim()) return;
  const tema = findTema(materiaId, temaId);
  tema.bloques.push({ id: uid(), nombre: nombre.trim(), apuntes: [] });
  scheduleSave();
  renderTree();
}

function crearApunte(materiaId, temaId, bloqueId) {
  const bloque = findBloque(materiaId, temaId, bloqueId);
  const ap = {
    id: uid(),
    titulo: 'Apunte sin título',
    contenido: '',
    tabla: null,
    esquema: null,
    archivos: [],
    actualizado: now()
  };
  bloque.apuntes.push(ap);
  scheduleSave();
  renderTree();
  selectApunte(materiaId, temaId, bloqueId, ap.id);
}

function renombrar(tipo, ids) {
  let obj;
  if (tipo === 'materia') obj = data.materias.find(m => m.id === ids.materiaId);
  if (tipo === 'tema') obj = findTema(ids.materiaId, ids.temaId);
  if (tipo === 'bloque') obj = findBloque(ids.materiaId, ids.temaId, ids.bloqueId);
  if (tipo === 'apunte') obj = findApunte(ids.materiaId, ids.temaId, ids.bloqueId, ids.apunteId);
  const key = tipo === 'apunte' ? 'titulo' : 'nombre';
  const nuevo = prompt('Nuevo nombre:', obj[key]);
  if (!nuevo || !nuevo.trim()) return;
  obj[key] = nuevo.trim();
  scheduleSave();
  renderTree();
  if (tipo === 'apunte' && selection.apunteId === ids.apunteId) loadApunteEditor();
}

function eliminar(tipo, ids) {
  showConfirm(
    'Eliminar permanentemente',
    '¿Estás seguro de que deseas eliminar esto y todo su contenido? Esta acción no se puede deshacer.',
    () => {
      if (tipo === 'materia') {
        data.materias = data.materias.filter(m => m.id !== ids.materiaId);
      } else if (tipo === 'tema') {
        const materia = data.materias.find(m => m.id === ids.materiaId);
        materia.temas = materia.temas.filter(t => t.id !== ids.temaId);
      } else if (tipo === 'bloque') {
        const tema = findTema(ids.materiaId, ids.temaId);
        tema.bloques = tema.bloques.filter(b => b.id !== ids.bloqueId);
      } else if (tipo === 'apunte') {
        const bloque = findBloque(ids.materiaId, ids.temaId, ids.bloqueId);
        bloque.apuntes = bloque.apuntes.filter(a => a.id !== ids.apunteId);
        if (selection.apunteId === ids.apunteId) clearSelection();
      }
      scheduleSave();
      renderTree();
    }
  );
}

function findTema(materiaId, temaId) {
  return data.materias.find(m => m.id === materiaId)?.temas.find(t => t.id === temaId);
}

function findBloque(materiaId, temaId, bloqueId) {
  return findTema(materiaId, temaId)?.bloques.find(b => b.id === bloqueId);
}

function findApunte(materiaId, temaId, bloqueId, apunteId) {
  return findBloque(materiaId, temaId, bloqueId)?.apuntes.find(a => a.id === apunteId);
}

/* RENDER DEL ÁRBOL */
const openState = new Set();

function renderTree() {
  const tree = document.getElementById('tree');
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  tree.innerHTML = '';

  if (data.materias.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-faint);font-size:12.5px;padding:14px 6px;line-height:1.6;';
    empty.textContent = 'Aún no tienes materias. Crea la primera con "+ Nueva materia".';
    tree.append(empty);
    return;
  }

  data.materias.forEach(materia => {
    const matchesQuery = q ? materiaMatches(materia, q) : true;
    if (q && !matchesQuery) return;

    const block = document.createElement('div');
    block.className = 'materia-block';

    const row = rowEl({
      label: materia.nombre,
      level: 'materia',
      dotColor: materia.color,
      open: openState.has('m:' + materia.id) || !!q,
      onToggle: () => toggleOpen('m:' + materia.id),
      actions: [
        ['+', () => crearTema(materia.id), 'Añadir tema'],
        ['✎', () => renombrar('materia', { materiaId: materia.id }), 'Renombrar'],
        ['✕', () => eliminar('materia', { materiaId: materia.id }), 'Eliminar']
      ]
    });
    row.classList.add('materia-row');
    block.append(row);

    const childrenWrap = document.createElement('div');
    childrenWrap.className = 'children' + ((openState.has('m:' + materia.id) || q) ? ' open' : '');

    materia.temas.forEach(tema => {
      const temaRow = rowEl({
        label: tema.nombre,
        level: 'tema',
        open: openState.has('t:' + tema.id) || !!q,
        onToggle: () => toggleOpen('t:' + tema.id),
        actions: [
          ['+', () => crearBloque(materia.id, tema.id), 'Añadir bloque'],
          ['✎', () => renombrar('tema', { materiaId: materia.id, temaId: tema.id }), 'Renombrar'],
          ['✕', () => eliminar('tema', { materiaId: materia.id, temaId: tema.id }), 'Eliminar']
        ]
      });
      temaRow.classList.add('tema-row');
      childrenWrap.append(temaRow);

      const temaChildren = document.createElement('div');
      temaChildren.className = 'children' + ((openState.has('t:' + tema.id) || q) ? ' open' : '');

      tema.bloques.forEach(bloque => {
        const bloqueRow = rowEl({
          label: bloque.nombre,
          level: 'bloque',
          open: openState.has('b:' + bloque.id) || !!q,
          onToggle: () => toggleOpen('b:' + bloque.id),
          actions: [
            ['+', () => crearApunte(materia.id, tema.id, bloque.id), 'Añadir apunte'],
            ['✎', () => renombrar('bloque', { materiaId: materia.id, temaId: tema.id, bloqueId: bloque.id }), 'Renombrar'],
            ['✕', () => eliminar('bloque', { materiaId: materia.id, temaId: tema.id, bloqueId: bloque.id }), 'Eliminar']
          ]
        });
        bloqueRow.classList.add('bloque-row');
        temaChildren.append(bloqueRow);

        const bloqueChildren = document.createElement('div');
        bloqueChildren.className = 'children' + ((openState.has('b:' + bloque.id) || q) ? ' open' : '');

        bloque.apuntes
          .filter(ap => !q || ap.titulo.toLowerCase().includes(q))
          .forEach(apunte => {
            const apRow = rowEl({
              label: apunte.titulo,
              level: 'apunte',
              actions: [
                ['✕', () => eliminar('apunte', { materiaId: materia.id, temaId: tema.id, bloqueId: bloque.id, apunteId: apunte.id }), 'Eliminar']
              ]
            });
            apRow.classList.add('apunte-row');
            if (selection.apunteId === apunte.id) apRow.classList.add('selected');
            apRow.onclick = (e) => {
              if (e.target.closest('.row-actions')) return;
              selectApunte(materia.id, tema.id, bloque.id, apunte.id);
            };
            bloqueChildren.append(apRow);
          });

        temaChildren.append(bloqueChildren);
      });
      childrenWrap.append(temaChildren);
    });
    block.append(childrenWrap);
    tree.append(block);
  });
}

function materiaMatches(materia, q) {
  if (materia.nombre.toLowerCase().includes(q)) return true;
  return materia.temas.some(t => t.nombre.toLowerCase().includes(q) ||
    t.bloques.some(b => b.nombre.toLowerCase().includes(q) || b.apuntes.some(a => a.titulo.toLowerCase().includes(q))));
}

function rowEl({ label, level, dotColor, open, onToggle, actions }) {
  const row = document.createElement('div');
  row.className = 'row' + (open ? ' open' : '');
  const hasChildren = level !== 'apunte';
  if (hasChildren) {
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = '▶';
    row.append(caret);
    row.onclick = (e) => {
      if (e.target.closest('.row-actions')) return;
      onToggle();
      renderTree();
    };
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'caret';
    spacer.textContent = '';
    row.append(spacer);
  }
  if (dotColor) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = dotColor;
    row.append(dot);
  }
  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = label;
  row.append(lbl);

  if (actions && actions.length) {
    const wrap = document.createElement('span');
    wrap.className = 'row-actions';
    actions.forEach(([icon, fn, title]) => {
      const btn = document.createElement('button');
      btn.textContent = icon;
      btn.title = title;
      btn.onclick = (e) => {
        e.stopPropagation();
        fn();
      };
      wrap.append(btn);
    });
    row.append(wrap);
  }
  return row;
}

function toggleOpen(key) {
  if (openState.has(key)) openState.delete(key);
  else openState.add(key);
}

/* =========================================================
   EDITOR DE APUNTES
   ========================================================= */
function selectApunte(materiaId, temaId, bloqueId, apunteId) {
  selection = { materiaId, temaId, bloqueId, apunteId };
  highlightMode = false;
  renderTree();
  loadApunteEditor();
  if (window.innerWidth <= 760) document.getElementById('sidebar').classList.remove('open');
}

function clearSelection() {
  selection = { materiaId: null, temaId: null, bloqueId: null, apunteId: null };
  document.getElementById('empty-state').style.display = 'flex';
  document.getElementById('editor-inner').style.display = 'none';
  document.getElementById('breadcrumb').textContent = '';
}

function loadApunteEditor() {
  const { materiaId, temaId, bloqueId, apunteId } = selection;
  const apunte = findApunte(materiaId, temaId, bloqueId, apunteId);
  if (!apunte) return clearSelection();

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('editor-inner').style.display = 'block';

  const materia = data.materias.find(m => m.id === materiaId);
  const tema = findTema(materiaId, temaId);
  const bloque = findBloque(materiaId, temaId, bloqueId);
  document.getElementById('breadcrumb').innerHTML =
    `<b>${escapeHtml(materia.nombre)}</b> / ${escapeHtml(tema.nombre)} / ${escapeHtml(bloque.nombre)}`;

  document.getElementById('note-title').value = apunte.titulo;
  document.getElementById('note-meta').textContent = 'Última edición: ' + (apunte.actualizado || '—');
  document.getElementById('note-content').innerHTML = apunte.contenido || '';
  
  // Cargar tabla si existe
  if (apunte.tabla) {
    renderTabla(apunte.tabla);
  } else {
    document.getElementById('tabla-container').innerHTML = '';
  }

  // Cargar archivos
  renderArchivos(apunte.archivos || []);

  // Inicializar esquema
  setTimeout(() => {
    esquemaCanvas = document.getElementById('esquema-canvas');
    if (esquemaCanvas) {
      esquemaBoxes = apunte.esquema ? [...apunte.esquema] : [];
      drawEsquema();
    }
  }, 100);
}

function onTitleInput() {
  const apunte = currentApunte();
  if (!apunte) return;
  apunte.titulo = document.getElementById('note-title').value.trim() || 'Apunte sin título';
  apunte.actualizado = now();
  scheduleSave();
  renderTree();
}

function onContentInput() {
  const apunte = currentApunte();
  if (!apunte) return;
  apunte.contenido = document.getElementById('note-content').innerHTML;
  apunte.actualizado = now();
  document.getElementById('note-meta').textContent = 'Última edición: ' + apunte.actualizado;
  scheduleSave();
}

function currentApunte() {
  const { materiaId, temaId, bloqueId, apunteId } = selection;
  if (!apunteId) return null;
  return findApunte(materiaId, temaId, bloqueId, apunteId);
}

/* =========================================================
   COMANDOS DE FORMATO (TEXTO)
   ========================================================= */
function cmd(command) {
  document.getElementById('note-content').focus();
  document.execCommand(command, false, null);
  onContentInput();
}

function formatBlock(tag) {
  document.getElementById('note-content').focus();
  document.execCommand('formatBlock', false, tag);
  onContentInput();
}

function toggleHighlight() {
  const contentEl = document.getElementById('note-content');
  contentEl.focus();
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) {
    highlightMode = !highlightMode;
    const btn = event.target.closest('button');
    btn.classList.toggle('active', highlightMode);
    return;
  }
  const highlightColor = getComputedStyle(document.documentElement).getPropertyValue('--highlight-soft').trim();
  document.execCommand('hiliteColor', false, highlightColor);
  onContentInput();
}

function insertImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('note-content').focus();
    document.execCommand('insertImage', false, e.target.result);
    onContentInput();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

/* =========================================================
   TABS DE CONTENIDO
   ========================================================= */
function switchContentTab(tabName) {
  // Ocultar todos los tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Mostrar tab seleccionado
  const tabContent = document.getElementById('tab-' + tabName);
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  
  if (tabContent) tabContent.classList.add('active');
  if (tabBtn) tabBtn.classList.add('active');

  // Inicializar esquema cuando se abre la pestaña
  if (tabName === 'esquema') {
    setTimeout(() => {
      esquemaCanvas = document.getElementById('esquema-canvas');
      if (esquemaCanvas && !esquemaCanvas.hasBeenInitialized) {
        esquemaCanvas.hasBeenInitialized = true;
        drawEsquema();
      }
    }, 50);
  }
}

/* =========================================================
   TABLA
   ========================================================= */
function crearTabla() {
  const filas = parseInt(document.getElementById('tabla-filas').value) || 3;
  const cols = parseInt(document.getElementById('tabla-cols').value) || 3;

  const tabla = document.createElement('table');
  tabla.className = 'tabla';

  for (let i = 0; i < filas; i++) {
    const row = document.createElement('tr');
    for (let j = 0; j < cols; j++) {
      const cell = document.createElement('td');
      cell.contentEditable = 'true';
      cell.textContent = i === 0 ? `Encabezado ${j + 1}` : `Celda ${i}-${j}`;
      row.append(cell);
    }
    tabla.append(row);
  }

  const container = document.getElementById('tabla-container');
  container.innerHTML = '';
  container.append(tabla);

  // Guardar tabla en apunte
  const apunte = currentApunte();
  if (apunte) {
    apunte.tabla = tabla.outerHTML;
    scheduleSave();
  }
}

function renderTabla(tablaHTML) {
  const container = document.getElementById('tabla-container');
  container.innerHTML = tablaHTML;

  // Hacer celdas editables
  container.querySelectorAll('td').forEach(cell => {
    cell.contentEditable = 'true';
    cell.addEventListener('blur', () => {
      const apunte = currentApunte();
      if (apunte) {
        apunte.tabla = container.innerHTML;
        scheduleSave();
      }
    });
  });
}

/* =========================================================
   ESQUEMA (CANVAS)
   ========================================================= */
function addEsquemaBox() {
  esquemaBoxes.push({
    id: uid(),
    x: 50 + Math.random() * 200,
    y: 50 + Math.random() * 200,
    width: 120,
    height: 60,
    text: 'Nueva caja',
    color: '#8fae95'
  });
  drawEsquema();
  saveEsquema();
}

function drawEsquema() {
  if (!esquemaCanvas) return;

  const ctx = esquemaCanvas.getContext('2d');
  const rect = esquemaCanvas.getBoundingClientRect();
  
  esquemaCanvas.width = rect.width;
  esquemaCanvas.height = rect.height;

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
  ctx.fillRect(0, 0, esquemaCanvas.width, esquemaCanvas.height);

  esquemaBoxes.forEach(box => {
    // Dibujar caja
    ctx.fillStyle = box.color;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Dibujar texto
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = box.text.split('\n');
    lines.forEach((line, i) => {
      const y = box.y + box.height / 2 - (lines.length - 1) * 6 + i * 12;
      ctx.fillText(line, box.x + box.width / 2, y);
    });
  });
}

function saveEsquema() {
  const apunte = currentApunte();
  if (apunte) {
    apunte.esquema = esquemaBoxes;
    scheduleSave();
  }
}

function downloadEsquema() {
  if (!esquemaCanvas) return;
  const link = document.createElement('a');
  link.href = esquemaCanvas.toDataURL('image/png');
  link.download = 'esquema.png';
  link.click();
}

function limpiarEsquema() {
  showConfirm('Limpiar esquema', '¿Deseas eliminar todos los elementos del esquema?', () => {
    esquemaBoxes = [];
    drawEsquema();
    saveEsquema();
  });
}

/* =========================================================
   ARCHIVOS
   ========================================================= */
function insertPDF(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const apunte = currentApunte();
    if (apunte) {
      apunte.archivos = apunte.archivos || [];
      apunte.archivos.push({
        id: uid(),
        nombre: file.name,
        tipo: 'pdf',
        tamano: file.size,
        data: e.target.result
      });
      scheduleSave();
      renderArchivos(apunte.archivos);
    }
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function insertFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const apunte = currentApunte();
    if (apunte) {
      apunte.archivos = apunte.archivos || [];
      apunte.archivos.push({
        id: uid(),
        nombre: file.name,
        tipo: getFileType(file.name),
        tamano: file.size,
        data: e.target.result
      });
      scheduleSave();
      renderArchivos(apunte.archivos);
    }
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function renderArchivos(archivos) {
  const list = document.getElementById('archivos-list');
  list.innerHTML = '';

  archivos.forEach(archivo => {
    const item = document.createElement('div');
    item.className = 'archivo-item';

    const icon = getFileIcon(archivo.tipo);
    const size = formatFileSize(archivo.tamano);

    item.innerHTML = `
      <div class="archivo-info">
        <div class="archivo-icon">${icon}</div>
        <div class="archivo-details">
          <div class="archivo-name">${escapeHtml(archivo.nombre)}</div>
          <div class="archivo-size">${size}</div>
        </div>
      </div>
      <div class="archivo-actions">
        <button onclick="descargarArchivo('${archivo.id}')">⬇ Descargar</button>
        <button onclick="eliminarArchivo('${archivo.id}')">✕ Eliminar</button>
      </div>
    `;
    list.append(item);
  });
}

function descargarArchivo(archivoId) {
  const apunte = currentApunte();
  if (!apunte) return;
  
  const archivo = apunte.archivos.find(a => a.id === archivoId);
  if (!archivo) return;

  const link = document.createElement('a');
  link.href = archivo.data;
  link.download = archivo.nombre;
  link.click();
}

function eliminarArchivo(archivoId) {
  const apunte = currentApunte();
  if (!apunte) return;
  
  apunte.archivos = apunte.archivos.filter(a => a.id !== archivoId);
  scheduleSave();
  renderArchivos(apunte.archivos);
}

function getFileType(nombre) {
  const ext = nombre.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
  return 'file';
}

function getFileIcon(tipo) {
  const icons = {
    'pdf': '📄',
    'doc': '📝',
    'excel': '📊',
    'ppt': '🎞',
    'image': '🖼',
    'file': '📎'
  };
  return icons[tipo] || '📎';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function handleResize() {
  document.getElementById('mobile-menu-btn').style.display = window.innerWidth <= 760 ? 'flex' : 'none';
}

window.addEventListener('resize', handleResize);

// Cerrar modales al presionar Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('modal-crear-materia');
    closeModal('modal-confirm');
  }
});

/* INIT */
initLogin();
