/**
 * google-apps-script.gs
 * Código de ejemplo para recibir POST JSON y guardar en Google Sheets.
 *
 * Instrucciones básicas en README.md (deploy > New deployment > Web app).
 */

/**
 * doPost: recibe peticiones POST JSON
 * e.parameter o e.postData.contents contienen la payload.
 */
function doPost(e) {
  try {
    // Validar datos recibidos
    if (!e.postData?.contents) {
      return sendError('No se recibieron datos');
    }

    // El contenido ahora viene como texto plano (text/plain) para evitar CORS preflight.
    // Lo parseamos a JSON aquí en el servidor.
    const jsonDataString = e.postData.contents;
    const data = JSON.parse(jsonDataString);
    
    // Guardar en Spreadsheet
    const sheet = getOrCreateSheet();
    saveToSheet(sheet, data);
    
    // Generar y enviar email interno (ahora devuelve resultado)
    const internalResult = sendInternalEmail(data);
    if (!internalResult.ok) {
      console.error('Error al enviar email interno:', internalResult.error);
      // opcional: devolver error o continuar según tu criterio
      return sendError('Error al enviar email interno: ' + internalResult.error);
    }

    // Enviar copia al cliente si lo solicitó
    if (data.consentCorreo && data.emailCopia) {
      const clientResult = sendClientCopy(data);
      if (!clientResult.ok) {
        console.error('Error al enviar copia al cliente:', clientResult.error);
        // seguir o devolver error según prefieras:
        return sendError('Error al enviar copia al cliente: ' + clientResult.error);
      }
    }

    return sendSuccess('Brief recibido correctamente');

  } catch (error) {
    console.error(error);
    return sendError(error.toString());
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'online',
      timestamp: new Date()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendInternalEmail(data) {
  try {
    const to = INTERNAL_RECIPIENT;
    if (!validateEmail(to)) {
      throw new Error('EMAIL_INTERNO_INVALIDO: ' + to);
    }

    const subject = `Nuevo Brief: ${data.clienteNombre || 'Sin nombre'}`;
    
    const body = `
      <h2>Nuevo Brief Recibido</h2>
      <hr>
      <h3>Datos del Cliente</h3>
      <p><strong>Cliente:</strong> ${escapeHtml(data.clienteNombre)}</p>
      <p><strong>Contacto:</strong> ${escapeHtml(data.contactoNombre)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.contactoEmail)}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(data.contactoTel)}</p>
      
      <h3>Detalles del Proyecto</h3>
      <p><strong>Descripción:</strong><br>${escapeHtml(data.descripcionProyecto)}</p>
      <p><strong>Objetivos:</strong><br>${escapeHtml((data.objetivos || []).join(', '))}</p>
      <p><strong>Audiencia:</strong><br>${escapeHtml(data.audiencia)}</p>
      
      <h3>Requerimientos Técnicos</h3>
      <p><strong>Secciones:</strong><br>${escapeHtml(data.seccionesNecesarias)}</p>
      <p><strong>Funcionalidades:</strong><br>${escapeHtml((data.funciones || []).join(', '))}</p>
      
      <h3>Presupuesto y Tiempos</h3>
      <p><strong>Presupuesto:</strong> ${escapeHtml(data.presupuesto)}</p>
      <p><strong>Fecha deseada:</strong> ${escapeHtml(data.fechaDeseada)}</p>
      
      <h3>Comentarios Adicionales</h3>
      <p>${escapeHtml(data.comentarios || 'Sin comentarios')}</p>
      
      <hr>
      <p><small>Brief recibido el ${new Date().toLocaleString()}</small></p>
    `;

    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: body,
      noReply: true
    });

    return { ok: true };
  } catch (err) {
    console.error('sendInternalEmail err:', err);
    return { ok: false, error: err.toString() };
  }
}

function sendClientCopy(data) {
  try {
    const to = data.emailCopia;
    if (!validateEmail(to)) {
      throw new Error('EMAIL_CLIENTE_INVALIDO: ' + to);
    }

    const subject = `Copia de tu Brief - ${data.clienteNombre || ''}`;
    const body = `
      <p>Hola ${escapeHtml(data.contactoNombre || '')},</p>
      <p>Gracias por enviarnos tu brief. Esta es una copia de la información proporcionada:</p>
      <hr>
      ${generateSummaryHtml(data)}
      <hr>
      <p>Nos pondremos en contacto contigo pronto.</p>
    `;

    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: body,
      noReply: true
    });

    return { ok: true };
  } catch (err) {
    console.error('sendClientCopy err:', err);
    return { ok: false, error: err.toString() };
  }
}

// utilidad simple para validar emails
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // regex simple, no perfecta pero útil
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

// función de prueba que puedes ejecutar desde el editor de Apps Script
function testSendEmails() {
  const mock = {
    clienteNombre: 'Cliente de Prueba',
    contactoNombre: 'Contacto Prueba',
    contactoEmail: 'contacto@ejemplo.com',
    contactoTel: '12345678',
    descripcionProyecto: 'Prueba de envío de email desde Apps Script',
    objetivos: ['Objetivo A', 'Objetivo B'],
    audiencia: 'Público objetivo',
    seccionesNecesarias: 'Inicio, Contacto',
    funciones: ['Formulario', 'Galería'],
    presupuesto: '$1000',
    fechaDeseada: '2025-11-01',
    comentarios: 'Sin comentarios',
    consentCorreo: true,
    emailCopia: 'cliente.copia@ejemplo.com'
  };

  Logger.log('Resultado interno: %s', JSON.stringify(sendInternalEmail(mock)));
  Logger.log('Resultado copia cliente: %s', JSON.stringify(sendClientCopy(mock)));
}
