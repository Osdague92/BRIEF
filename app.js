// app.js - Módulo ES (vanilla JS)
// Configuración: cambia SUBMIT_URL por la URL de tu backend o Web App de Google Apps Script
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbza8NpIDe0nHmVFB7WcySIr-RkV-zCv1J9Ys9dEFuXUggwS2zpNyzct9Dw0hqznkU69Hw/exec'; // <-- Cambia esto antes de desplegar (ej: "https://script.google.com/macros/s/XXX/exec")
const STORAGE_KEY = 'brief_form_v1';
const AUTO_SAVE_DELAY = 600; // ms

/* Utility functions */
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* Validadores simples */
function isValidEmail(email) {
  // HTML5 built-in will be used; esto es una comprobación adicional simple
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}
function isValidPhone(phone) {
  return phone.trim() === '' || /^[0-9+()\-.\s]{6,25}$/.test(phone);
}

/* Form field list (all names) - usado para serializar y validar mínimos */
const FIELD_NAMES = [
  'clienteNombre','contactoNombre','contactoEmail','contactoTel','sitioActual',
  'descripcionProyecto','historia','objetivos','kpi','audiencia','personas',
  'contenidoIncluido','seccionesNecesarias','idiomas','estilo','referencias','logoUpload',
  'funciones','prioridadFunc','hosting','plataformaPref','seguridad','fechaDeseada','presupuesto',
  'flexibilidad','soporteNecesario','actualizaciones','comentarios','consentCorreo','emailCopia'
];

/* Marshaling: lee el formulario y devuelve objeto */
function readForm(form) {
  const fd = new FormData(form);
  const obj = {};

  // múltiples inputs: checkboxes y radios
  // objetivos (checkboxes)
  obj.objetivos = qsa('input[name="objetivos"]:checked').map(i => i.value);
  obj.funciones = qsa('input[name="funciones"]:checked').map(i => i.value);
  obj.estilo = qsa('input[name="estilo"]:checked').map(i => i.value);

  // campos simples
  for (const el of form.elements) {
    if (!el.name) continue;
    if (['objetivos','funciones','estilo'].includes(el.name)) continue;
    if (el.type === 'checkbox') {
      // skip single checkbox (we use checked group handling)
      continue;
    }
    if (el.type === 'radio') {
      if (el.checked) obj[el.name] = el.value;
      continue;
    }
    obj[el.name] = fd.get(el.name);
  }

  // ensure fields exist
  FIELD_NAMES.forEach(k => { if (!(k in obj)) obj[k] = ''; });
  return obj;
}

/* Render summary to modal (accessible) */
function renderSummary(data) {
  const container = qs('#summaryContent');
  container.innerHTML = ''; // reset

  const makeRow = (k, v) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'summary-row';
    const key = document.createElement('strong');
    key.textContent = k + ': ';
    wrapper.appendChild(key);
    const val = document.createElement('span');
    val.textContent = (Array.isArray(v) ? v.join(', ') : (v || '—'));
    wrapper.appendChild(val);
    return wrapper;
  };

  container.appendChild(makeRow('Cliente', data.clienteNombre));
  container.appendChild(makeRow('Contacto', data.contactoNombre));
  container.appendChild(makeRow('Email', data.contactoEmail));
  container.appendChild(makeRow('Teléfono', data.contactoTel || '—'));
  container.appendChild(makeRow('Descripción', data.descripcionProyecto));
  container.appendChild(makeRow('Objetivos', data.objetivos && data.objetivos.length ? data.objetivos.join(', ') : '—'));
  container.appendChild(makeRow('Público', data.audiencia));
  container.appendChild(makeRow('Secciones', data.seccionesNecesarias));
  container.appendChild(makeRow('Funciones', data.funciones && data.funciones.length ? data.funciones.join(', ') : '—'));
  container.appendChild(makeRow('Presupuesto', data.presupuesto));
  container.appendChild(makeRow('Fecha deseada', data.fechaDeseada || '—'));
  container.appendChild(makeRow('Comentarios', data.comentarios || '—'));
}

/* Validation: returns { ok: boolean, errors: {field: message} } */
function validateData(data) {
  const errors = {};
  if (!data.clienteNombre || data.clienteNombre.trim().length < 3) {
    errors.clienteNombre = 'Nombre del cliente requerido (mínimo 3 caracteres).';
  }
  if (!data.contactoNombre || data.contactoNombre.trim().length < 3) {
    errors.contactoNombre = 'Nombre de la persona de contacto es obligatorio.';
  }
  if (!data.contactoEmail || !isValidEmail(data.contactoEmail)) {
    errors.contactoEmail = 'Ingrese un correo electrónico válido.';
  }
  if (!data.descripcionProyecto || data.descripcionProyecto.trim().length < 20) {
    errors.descripcionProyecto = 'Descripción breve obligatoria (mínimo 20 caracteres).';
  }
  if (!data.audiencia || data.audiencia.trim().length < 10) {
    errors.audiencia = 'Describe el público objetivo (mínimo 10 caracteres).';
  }
  if (!isValidPhone(data.contactoTel || '')) {
    errors.contactoTel = 'Número de teléfono inválido.';
  }
  if (data.emailCopia && !isValidEmail(data.emailCopia)) {
    errors.emailCopia = 'El correo para la copia no parece válido.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/* Apply validation UI */
function showValidationErrors(form, errors) {
  // Clear previous
  qsa('.error', form).forEach(el => el.classList.remove('error'));
  const messages = [];
  for (const [field, msg] of Object.entries(errors)) {
    const el = qs(`[name="${field}"]`, form);
    if (el) {
      el.classList.add('error');
      el.setAttribute('aria-invalid', 'true');
    }
    messages.push(msg);
  }
  const status = qs('#formMessages');
  status.innerHTML = '';
  const ul = document.createElement('ul');
  ul.className = 'error-list';
  messages.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m;
    ul.appendChild(li);
  });
  status.appendChild(ul);
  status.focus();
}

/* Clear form */
function clearForm(form) {
  form.reset();
  localStorage.removeItem(STORAGE_KEY);
  qs('#formMessages').innerHTML = '<div class="muted">Formulario limpiado.</div>';
}

/* Autosave to localStorage (debounced) */
function attachAutosave(form) {
  let timer = null;
  const save = () => {
    const data = readForm(form);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // show subtle message
      qs('#formMessages').innerHTML = '<div class="muted">Guardado localmente.</div>';
    } catch (e) {
      console.error('Error guardando en localStorage', e);
    }
  };
  form.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(save, AUTO_SAVE_DELAY);
  });
}

/* Load from localStorage */
function loadFromStorage(form) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    for (const [k, v] of Object.entries(data)) {
      const els = qsa(`[name="${k}"]`, form);
      if (!els.length) continue;
      if (els[0].type === 'radio') {
        const radio = qs(`[name="${k}"][value="${v}"]`, form);
        if (radio) radio.checked = true;
        continue;
      }
      if (els[0].type === 'checkbox') {
        // group of checkboxes: v expected array
        if (Array.isArray(v)) {
          els.forEach(ch => { ch.checked = v.includes(ch.value); });
        }
        continue;
      }
      // multiple selects or normal inputs
      els.forEach(el => { el.value = v; });
    }
    qs('#formMessages').innerHTML = '<div class="muted">Restaurado desde guardado local.</div>';
  } catch (e) {
    console.warn('No se pudo parsear localStorage', e);
  }
}

/* Download helpers */
function download(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* Convert form data object to CSV (simple) */
function objectToCSV(obj) {
  const headers = Object.keys(obj);
  const values = headers.map(h => {
    let v = obj[h];
    if (Array.isArray(v)) v = v.join('; ');
    return `"${String(v || '').replace(/"/g, '""')}"`;
  });
  return headers.join(',') + '\n' + values.join(',');
}

/* Submit flow: show modal summary, then confirm triggers network send */
function setupSubmission(form) {
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = readForm(form);
    const { ok, errors } = validateData(data);
    if (!ok) {
      showValidationErrors(form, errors);
      return;
    }
    // render and open modal
    renderSummary(data);
    mostrarResumen();
  });

  // Modal buttons
  // Buttons will be wired after DOMContentLoaded via IDs btnEditar / btnConfirmar
}

/* Modal control functions */
function mostrarResumen() {
  const modal = qs('#modalResumen');
  const overlay = qs('#overlay');
  if (!modal) return;
  modal.classList.add('visible');
  if (overlay) overlay.classList.add('active');
  // disable background scroll
  document.body.style.overflow = 'hidden';
  // move focus into modal for accessibility
  const editable = modal.querySelector('#btnEditar') || modal.querySelector('button');
  if (editable) editable.focus();
}

function cerrarModal() {
  const modal = qs('#modalResumen');
  const overlay = qs('#overlay');
  if (!modal) return;
  modal.classList.remove('visible');
  if (overlay) overlay.classList.remove('active');
  // restore scroll
  document.body.style.overflow = '';
  // return focus to first form control
  const first = qs('#clienteNombre');
  if (first) first.focus();
}

/* Wire modal buttons, overlay and keyboard after DOM ready */
document.addEventListener('DOMContentLoaded', () => {
  const btnEditar = qs('#btnEditar');
  const btnConfirmar = qs('#btnConfirmar');
  const overlay = qs('#overlay');

  if (btnEditar) btnEditar.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarModal();
  });

  if (btnConfirmar) btnConfirmar.addEventListener('click', async (e) => {
    e.preventDefault();
    cerrarModal();
    // after closing modal, perform the network submit
    await performSubmit();
  });

  if (overlay) overlay.addEventListener('click', () => {
    cerrarModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const modal = qs('#modalResumen');
      if (modal && modal.classList.contains('visible')) {
        cerrarModal();
      }
    }
  });
});

/* Perform network submission with states and fallback download */
async function performSubmit() {
  const form = qs('#briefForm');
  const data = readForm(form);
  const status = qs('#formMessages');
  status.innerHTML = '<div class="muted">Enviando…</div>';
  qs('#submitBtn').disabled = true;

  try {
    // POST JSON
    const res = await fetch(SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      // handle non-2xx
      const text = await res.text().catch(() => '');
      status.innerHTML = `<div class="muted">Error del servidor: ${res.status}. Respuesta: ${text || 'sin detalle'}</div>`;
      // fallback: download JSON
      download('brief-fallback.json', JSON.stringify(data, null, 2));
    } else {
      const json = await res.json().catch(() => ({}));
      status.innerHTML = `<div class="muted">Enviado correctamente. ${json.message ? json.message : ''}</div>`;
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.error('Network error', err);
    status.innerHTML = '<div class="muted">Error de red al enviar. Se descargará un JSON como respaldo.</div>';
    download('brief-offline.json', JSON.stringify(data, null, 2));
  } finally {
    qs('#submitBtn').disabled = false;
  }
}

/* Setup download buttons */
function setupDownloads(form) {
  qs('#downloadJsonBtn').addEventListener('click', () => {
    const data = readForm(form);
    download('brief.json', JSON.stringify(data, null, 2));
  });
  qs('#downloadCsvBtn').addEventListener('click', () => {
    const data = readForm(form);
    const csv = objectToCSV(data);
    download('brief.csv', csv);
  });
  qs('#printBtn').addEventListener('click', () => {
    window.print();
  });
}

/* Attach clear button */
function setupClear(form) {
  qs('#clearBtn').addEventListener('click', () => {
    if (!confirm('¿Deseas limpiar todo el formulario? Esta acción no se puede deshacer.')) return;
    clearForm(form);
  });
}

/* Basic network error test (prueba de validación de red) */
async function networkTest() {
  try {
    const res = await fetch(SUBMIT_URL, { method: 'HEAD' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* Initialize */
document.addEventListener('DOMContentLoaded', async () => {
  const form = qs('#briefForm');

  attachAutosave(form);
  loadFromStorage(form);
  setupSubmission(form);
  setupDownloads(form);
  setupClear(form);

  // show network availability at load (non-blocking)
  const online = await networkTest();
  const status = qs('#formMessages');
  status.innerHTML = online ? '<div class="muted">Servicio de envío disponible.</div>' : '<div class="muted">Servicio de envío no accesible — las respuestas podrán descargarse localmente o enviarse cuando esté disponible.</div>';

  // Accessibility: close modal with Esc
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const modal = qs('#confirmModal');
      if (modal && !modal.hidden) modal.hidden = true;
    }
  });

  // Example: show a basic validation test button (for developer)
  console.debug('Brief form initialized. SUBMIT_URL=', SUBMIT_URL);
});
