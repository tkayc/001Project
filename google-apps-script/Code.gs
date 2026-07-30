/**
 * Lumen Publicity — Strategy Call Booking Handler
 * ------------------------------------------------
 * Receives bookings from the website form, saves them to a Google Sheet,
 * emails the team, and sends a branded confirmation to the client.
 *
 * Business email: lumenpublicity2026@gmail.com
 *
 * Setup steps are in SETUP.txt in this folder.
 */

var CONFIG = {
  BUSINESS_EMAIL: 'lumenpublicity2026@gmail.com',
  BUSINESS_PHONE: '+27 65 582 8853',
  BUSINESS_NAME: 'Lumen Publicity',
  SHEET_NAME: 'Strategy Call Bookings',
  /**
   * Optional: Google Drive file ID of logo.jpeg (for the confirmation email).
   * Leave blank until you upload the logo — emails still send without it.
   * Example: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ'
   */
  LOGO_FILE_ID: ''
};

/**
 * Handles POST requests from the website contact form.
 */
function doPost(e) {
  try {
    var data = parseRequest_(e);
    validateBooking_(data);

    var timestamp = new Date();
    saveToSheet_(data, timestamp);
    sendTeamNotification_(data, timestamp);
    sendClientConfirmation_(data, timestamp);

    return jsonResponse_({
      success: true,
      message: 'Booking received successfully.'
    });
  } catch (err) {
    return jsonResponse_({
      success: false,
      message: String(err.message || err)
    });
  }
}

/**
 * Simple health check — open the Web App URL in a browser to verify deploy.
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'Lumen Publicity Booking API',
      email: CONFIG.BUSINESS_EMAIL
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ========================= Helpers ========================= */

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('No booking data received.');
  }

  var data = JSON.parse(e.postData.contents);

  return {
    name: String(data.name || '').trim(),
    email: String(data.email || '').trim(),
    business: String(data.business || '').trim(),
    industry: String(data.industry || '').trim(),
    message: String(data.message || '').trim()
  };
}

function validateBooking_(data) {
  if (!data.name) throw new Error('Name is required.');
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw new Error('A valid email is required.');
  }
  if (!data.message) throw new Error('Message is required.');
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No spreadsheet is bound to this script. Open the script from your Google Sheet (Extensions → Apps Script).');
  }

  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow([
      'Timestamp',
      'Full Name',
      'Email',
      'Business Name',
      'Industry',
      'Message',
      'Status'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    sheet.setColumnWidths(1, 7, 160);
    sheet.setColumnWidth(6, 320);
  }
  return sheet;
}

function saveToSheet_(data, timestamp) {
  var sheet = getSheet_();
  sheet.appendRow([
    timestamp,
    data.name,
    data.email,
    data.business || '—',
    data.industry || '—',
    data.message,
    'New'
  ]);
}

function sendTeamNotification_(data, timestamp) {
  var subject = 'New Strategy Call Booking — ' + data.name;
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#1c2b48;line-height:1.6;">' +
      '<h2 style="margin:0 0 12px;font-weight:500;">New consultation request</h2>' +
      '<p style="margin:0 0 20px;color:#5c6678;">A client booked a free strategy call via the website.</p>' +
      '<table style="border-collapse:collapse;width:100%;max-width:560px;">' +
        row_('Date', Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm')) +
        row_('Name', escapeHtml_(data.name)) +
        row_('Email', '<a href="mailto:' + escapeHtml_(data.email) + '">' + escapeHtml_(data.email) + '</a>') +
        row_('Business', escapeHtml_(data.business || '—')) +
        row_('Industry', escapeHtml_(data.industry || '—')) +
        row_('Message', escapeHtml_(data.message).replace(/\n/g, '<br>')) +
      '</table>' +
    '</div>';

  MailApp.sendEmail({
    to: CONFIG.BUSINESS_EMAIL,
    subject: subject,
    htmlBody: html,
    replyTo: data.email,
    name: CONFIG.BUSINESS_NAME
  });
}

function sendClientConfirmation_(data, timestamp) {
  var subject = 'Your strategy call request with Lumen Publicity';
  var logoCid = 'lumenLogo';
  var inlineImages = {};
  var logoHtml = '';

  var logoBlob = getLogoBlob_();
  if (logoBlob) {
    inlineImages[logoCid] = logoBlob;
    logoHtml =
      '<img src="cid:' + logoCid + '" alt="Lumen Publicity" width="88" height="88" ' +
      'style="display:block;margin:0 auto 20px;border-radius:50%;" />';
  }

  var html =
    '<div style="background:#f7f8fa;padding:32px 16px;font-family:Georgia,\'Times New Roman\',serif;">' +
      '<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:40px 32px;border:1px solid #e6ebf2;">' +
        logoHtml +
        '<p style="margin:0 0 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c4a574;">Lumen Publicity</p>' +
        '<h1 style="margin:0 0 16px;text-align:center;font-size:28px;font-weight:500;color:#1c2b48;line-height:1.2;">Thank you, ' + escapeHtml_(data.name.split(' ')[0]) + '</h1>' +
        '<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#5c6678;text-align:center;">' +
          'We have received your request for a free strategy call. Our team will review your details and get back to you shortly to confirm a suitable time.' +
        '</p>' +
        '<div style="height:1px;background:#c4a574;width:48px;margin:0 auto 24px;"></div>' +
        '<div style="background:#f7f8fa;padding:20px 22px;margin-bottom:24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2a3344;">' +
          '<p style="margin:0 0 8px;"><strong style="color:#1c2b48;">Your booking summary</strong></p>' +
          '<p style="margin:0 0 6px;"><span style="color:#5c6678;">Submitted:</span> ' +
            Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm') +
          '</p>' +
          '<p style="margin:0 0 6px;"><span style="color:#5c6678;">Business:</span> ' + escapeHtml_(data.business || '—') + '</p>' +
          '<p style="margin:0;"><span style="color:#5c6678;">Industry:</span> ' + escapeHtml_(data.industry || '—') + '</p>' +
        '</div>' +
        '<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#5c6678;text-align:center;">' +
          'Luxury hospitality marketing — elevating brands through premium strategy, creative and digital solutions.' +
        '</p>' +
        '<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#1c2b48;text-align:center;">' +
          '<strong>Lumen Publicity</strong><br>' +
          '<a href="mailto:' + CONFIG.BUSINESS_EMAIL + '" style="color:#1c2b48;text-decoration:none;">' + CONFIG.BUSINESS_EMAIL + '</a><br>' +
          '<a href="tel:+27655828853" style="color:#1c2b48;text-decoration:none;">' + CONFIG.BUSINESS_PHONE + '</a>' +
        '</p>' +
      '</div>' +
      '<p style="max-width:560px;margin:16px auto 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a93a3;">' +
        'You received this email because you booked a consultation on the Lumen Publicity website.' +
      '</p>' +
    '</div>';

  var options = {
    to: data.email,
    subject: subject,
    htmlBody: html,
    name: CONFIG.BUSINESS_NAME,
    replyTo: CONFIG.BUSINESS_EMAIL
  };

  if (logoBlob) {
    options.inlineImages = inlineImages;
  }

  MailApp.sendEmail(options);
}

function getLogoBlob_() {
  if (!CONFIG.LOGO_FILE_ID) return null;
  try {
    return DriveApp.getFileById(CONFIG.LOGO_FILE_ID).getBlob().setName('lumen-logo.jpg');
  } catch (err) {
    return null;
  }
}

function row_(label, value) {
  return (
    '<tr>' +
      '<td style="padding:8px 12px 8px 0;border-bottom:1px solid #e6ebf2;color:#5c6678;width:120px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:14px;">' +
        label +
      '</td>' +
      '<td style="padding:8px 0;border-bottom:1px solid #e6ebf2;color:#1c2b48;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:14px;">' +
        value +
      '</td>' +
    '</tr>'
  );
}

function escapeHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Optional test from the Apps Script editor:
 * Select testBooking_ → Run (authorize when prompted).
 */
function testBooking_() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        name: 'Test Client',
        email: CONFIG.BUSINESS_EMAIL,
        business: 'Sample Boutique Hotel',
        industry: 'Boutique Hotel',
        message: 'This is a test strategy call booking from Apps Script.'
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
