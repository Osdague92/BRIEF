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
    // Configuración de CORS
    var headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Content-Type': 'application/json'
    };
    
    // Validar petición
    if (!e.postData || !e.postData.contents) {
      return sendResponse(headers, { error: 'No data received' }, 400);
    }
    
    // Parsear datos JSON
    var data = JSON.parse(e.postData.contents);
    
    // Obtener hoja de cálculo activa o crear nueva
    var ss = SpreadsheetApp.getActiveSpreadsheet() || 
             SpreadsheetApp.create('Brief Responses');
    var sheet = ss.getActiveSheet();
    
    // Configurar encabezados si es primera fila
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Fecha',
        'Cliente',
        'Contacto',
        'Email',
        'Teléfono',
        'Descripción',
        'Objetivos',
        'Audiencia',
        'Presupuesto',
        'Fecha Deseada',
        'JSON Completo'
      ]);
    }
    
    // Agregar nueva fila
    sheet.appendRow([
      new Date(),
      data.clienteNombre || '',
      data.contactoNombre || '',
      data.contactoEmail || '',
      data.contactoTel || '',
      data.descripcionProyecto || '',
      (data.objetivos || []).join(', '),
      data.audiencia || '',
      data.presupuesto || '',
      data.fechaDeseada || '',
      JSON.stringify(data)
    ]);
    
    // Enviar email si se solicitó copia
    if (data.consentCorreo && data.emailCopia) {
      MailApp.sendEmail({
        to: data.emailCopia,
        subject: 'Copia de tu brief - ' + data.clienteNombre,
        body: 'Gracias por completar el brief.\n\nResumen:\n' + 
              Object.entries(data)
                .map(([k,v]) => `${k}: ${v}`)
                .join('\n')
      });
    }
    
    return sendResponse(headers, { 
      message: 'Datos guardados correctamente'
    }, 200);
    
  } catch (error) {
    return sendResponse(headers, {
      error: error.toString()
    }, 500);
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

function sendResponse(headers, body, code) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
}
