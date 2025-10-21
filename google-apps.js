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
  // Config
  var SHEET_NAME = 'Responses';

  // Autorespuesta de ejemplo
  var response = { ok: false };

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No JSON recibido' })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);

    // Validaciones mínimas
    if (!payload.contactoEmail || payload.contactoEmail.indexOf('@') === -1) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Email inválido' })).setMimeType(ContentService.MimeType.JSON);
    }
    if (!payload.clienteNombre || payload.clienteNombre.length < 3) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Nombre de cliente inválido' })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      // Crear hoja y encabezados si no existe
      sheet = ss.insertSheet(SHEET_NAME);
      var headers = Object.keys(payload);
      sheet.appendRow(headers);
    }

    // Ordenar columnas de hoja según headers existentes
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row = [];
    headers.forEach(function(h){
      var val = payload[h];
      if (Array.isArray(val)) {
        val = val.join(', ');
      }
      row.push(val || '');
    });

    sheet.appendRow(row);

    response.ok = true;
    response.message = 'Guardado en Google Sheets';
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}
