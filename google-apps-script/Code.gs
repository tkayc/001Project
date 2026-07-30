/**
 * Lumen Publicity — Strategy Call Booking Handler
 * ------------------------------------------------
 * Saves bookings to Google Sheet, emails the team, and sends
 * a branded confirmation to the client (with logo + business name).
 *
 * IMPORTANT: After updating this file in Apps Script, redeploy:
 * Deploy → Manage deployments → Edit → New version → Deploy
 */

var CONFIG = {
  BUSINESS_EMAIL: 'lumenpublicity2026@gmail.com',
  BUSINESS_PHONE: '+27 65 582 8853',
  BUSINESS_NAME: 'Lumen Publicity',
  SHEET_NAME: 'Strategy Call Bookings',
  /**
   * Paste either the Drive FILE ID only, or the full sharing URL.
   * File ID example: 1IQDQMQBXjcBw1hP6WH_kAWN0OAL6xGme
   */
  LOGO_FILE_ID: '1IQDQMQBXjcBw1hP6WH_kAWN0OAL6xGme'
};

function doPost(e) {
  try {
    var data = parseRequest_(e);
    validateBooking_(data);

    var timestamp = new Date();
    saveToSheet_(data, timestamp);

    var teamOk = true;
    var clientOk = true;
    var errors = [];

    try {
      sendTeamNotification_(data, timestamp);
    } catch (teamErr) {
      teamOk = false;
      errors.push('Team email: ' + String(teamErr.message || teamErr));
    }

    try {
      sendClientConfirmation_(data, timestamp);
    } catch (clientErr) {
      clientOk = false;
      errors.push('Client email: ' + String(clientErr.message || clientErr));
    }

    if (!teamOk && !clientOk) {
      throw new Error(errors.join(' | '));
    }

    return jsonResponse_({
      success: true,
      message: 'Booking received successfully.',
      teamEmailSent: teamOk,
      clientEmailSent: clientOk,
      warnings: errors
    });
  } catch (err) {
    return jsonResponse_({
      success: false,
      message: String(err.message || err)
    });
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'Lumen Publicity Booking API',
      email: CONFIG.BUSINESS_EMAIL
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ========================= Parse / validate ========================= */

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('No booking data received.');
  }

  var data = JSON.parse(e.postData.contents);

  return {
    name: String(data.name || '').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
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
  if (!data.phone) throw new Error('Phone number is required.');
  if (!data.message) throw new Error('Message is required.');
}

/* ========================= Sheet ========================= */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No spreadsheet is bound to this script. Open the script from your Google Sheet (Extensions → Apps Script).');
  }

  var headers = [
    'Timestamp',
    'Full Name',
    'Email',
    'Phone',
    'Business Name',
    'Industry',
    'Message',
    'Status'
  ];

  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setColumnWidths(1, headers.length, 150);
    sheet.setColumnWidth(7, 320);
    return sheet;
  }

  // Upgrade older sheets that are missing the Phone column
  var firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  if (String(firstRow[3] || '').toLowerCase() !== 'phone') {
    sheet.clear();
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  return sheet;
}

function saveToSheet_(data, timestamp) {
  var sheet = getSheet_();
  sheet.appendRow([
    timestamp,
    data.name,
    data.email,
    data.phone || '—',
    data.business || '—',
    data.industry || '—',
    data.message,
    'New'
  ]);
}

/* ========================= Emails ========================= */

function sendTeamNotification_(data, timestamp) {
  var subject = '[' + CONFIG.BUSINESS_NAME + '] New Strategy Call — ' + data.name;
  var brand = emailBrandHeader_();
  var html =
    '<div style="background:#f7f8fa;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;">' +
      '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6ebf2;padding:28px 24px;">' +
        brand.logoHtml +
        '<p style="margin:0 0 6px;text-align:center;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c4a574;">' +
          escapeHtml_(CONFIG.BUSINESS_NAME) +
        '</p>' +
        '<h2 style="margin:0 0 10px;text-align:center;font-weight:500;color:#1c2b48;">New consultation request</h2>' +
        '<p style="margin:0 0 20px;text-align:center;color:#5c6678;font-size:14px;">A client booked a free strategy call via the website.</p>' +
        '<table style="border-collapse:collapse;width:100%;">' +
          row_('Date', Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm')) +
          row_('Name', escapeHtml_(data.name)) +
          row_('Email', '<a href="mailto:' + escapeHtml_(data.email) + '" style="color:#1c2b48;">' + escapeHtml_(data.email) + '</a>') +
          row_('Phone', '<a href="tel:' + escapeHtml_(data.phone.replace(/\s+/g, '')) + '" style="color:#1c2b48;">' + escapeHtml_(data.phone) + '</a>') +
          row_('Business', escapeHtml_(data.business || '—')) +
          row_('Industry', escapeHtml_(data.industry || '—')) +
          row_('Message', escapeHtml_(data.message).replace(/\n/g, '<br>')) +
        '</table>' +
        emailBrandFooter_() +
      '</div>' +
    '</div>';

  // GmailApp supports inlineImages; MailApp does not
  GmailApp.sendEmail(CONFIG.BUSINESS_EMAIL, subject, plainFallback_(data), {
    htmlBody: html,
    name: CONFIG.BUSINESS_NAME,
    replyTo: data.email,
    inlineImages: brand.inlineImages
  });
}

function sendClientConfirmation_(data, timestamp) {
  var subject = 'Confirmation: Your strategy call with ' + CONFIG.BUSINESS_NAME;
  var brand = emailBrandHeader_();
  var firstName = data.name.split(/\s+/)[0] || data.name;

  var html =
    '<div style="background:#f7f8fa;padding:32px 16px;font-family:Georgia,\'Times New Roman\',serif;">' +
      '<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:40px 32px;border:1px solid #e6ebf2;">' +
        brand.logoHtml +
        '<p style="margin:0 0 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c4a574;">' +
          escapeHtml_(CONFIG.BUSINESS_NAME) +
        '</p>' +
        '<h1 style="margin:0 0 16px;text-align:center;font-size:28px;font-weight:500;color:#1c2b48;line-height:1.2;">Thank you, ' + escapeHtml_(firstName) + '</h1>' +
        '<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#5c6678;text-align:center;">' +
          'We have received your request for a free strategy call with <strong style="color:#1c2b48;">' + escapeHtml_(CONFIG.BUSINESS_NAME) + '</strong>. ' +
          'Our team will review your details and get back to you shortly to confirm a suitable time.' +
        '</p>' +
        '<div style="height:1px;background:#c4a574;width:48px;margin:0 auto 24px;"></div>' +
        '<div style="background:#f7f8fa;padding:20px 22px;margin-bottom:24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2a3344;">' +
          '<p style="margin:0 0 10px;"><strong style="color:#1c2b48;">Your booking summary</strong></p>' +
          '<p style="margin:0 0 6px;"><span style="color:#5c6678;">Submitted:</span> ' +
            Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm') +
          '</p>' +
          '<p style="margin:0 0 6px;"><span style="color:#5c6678;">Name:</span> ' + escapeHtml_(data.name) + '</p>' +
          '<p style="margin:0 0 6px;"><span style="color:#5c6678;">Email:</span> ' + escapeHtml_(data.email) + '</p>' +
          '<p style="margin:0 0 6px;"><span style="color:#5c6678;">Phone:</span> ' + escapeHtml_(data.phone) + '</p>' +
          '<p style="margin:0 0 6px;"><span style="color:#5c6678;">Business:</span> ' + escapeHtml_(data.business || '—') + '</p>' +
          '<p style="margin:0;"><span style="color:#5c6678;">Industry:</span> ' + escapeHtml_(data.industry || '—') + '</p>' +
        '</div>' +
        '<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#5c6678;text-align:center;">' +
          'Luxury hospitality marketing — elevating brands through premium strategy, creative and digital solutions.' +
        '</p>' +
        emailBrandFooter_() +
      '</div>' +
      '<p style="max-width:560px;margin:16px auto 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a93a3;">' +
        'You received this email because you booked a consultation on the ' + escapeHtml_(CONFIG.BUSINESS_NAME) + ' website.' +
      '</p>' +
    '</div>';

  GmailApp.sendEmail(data.email, subject, plainFallback_(data), {
    htmlBody: html,
    name: CONFIG.BUSINESS_NAME,
    replyTo: CONFIG.BUSINESS_EMAIL,
    inlineImages: brand.inlineImages
  });
}

function emailBrandHeader_() {
  var logoCid = 'lumenLogo';
  var inlineImages = {};
  var logoHtml =
    '<div style="text-align:center;margin:0 0 16px;">' +
      '<div style="display:inline-block;width:88px;height:88px;border-radius:50%;background:#1c2b48;color:#ffffff;' +
      'font-family:Georgia,serif;font-size:28px;line-height:88px;text-align:center;">LP</div>' +
    '</div>';

  var logoBlob = getLogoBlob_();
  if (logoBlob) {
    inlineImages[logoCid] = logoBlob;
    logoHtml =
      '<img src="cid:' + logoCid + '" alt="' + escapeHtml_(CONFIG.BUSINESS_NAME) + '" width="88" height="88" ' +
      'style="display:block;margin:0 auto 16px;border-radius:50%;border:0;" />';
  }

  return {
    logoHtml: logoHtml,
    inlineImages: inlineImages
  };
}

function emailBrandFooter_() {
  return (
    '<p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#1c2b48;text-align:center;">' +
      '<strong>' + escapeHtml_(CONFIG.BUSINESS_NAME) + '</strong><br>' +
      '<a href="mailto:' + CONFIG.BUSINESS_EMAIL + '" style="color:#1c2b48;text-decoration:none;">' + CONFIG.BUSINESS_EMAIL + '</a><br>' +
      '<a href="tel:+27655828853" style="color:#1c2b48;text-decoration:none;">' + CONFIG.BUSINESS_PHONE + '</a>' +
    '</p>'
  );
}

function plainFallback_(data) {
  return (
    CONFIG.BUSINESS_NAME + '\n\n' +
    'Strategy call booking\n' +
    'Name: ' + data.name + '\n' +
    'Email: ' + data.email + '\n' +
    'Phone: ' + data.phone + '\n' +
    'Business: ' + (data.business || '—') + '\n' +
    'Industry: ' + (data.industry || '—') + '\n' +
    'Message: ' + data.message + '\n\n' +
    CONFIG.BUSINESS_EMAIL + ' | ' + CONFIG.BUSINESS_PHONE
  );
}

/* ========================= Logo helpers ========================= */

function extractFileId_(value) {
  var raw = String(value || '').trim();
  if (!raw) return '';

  // Full Drive URL → file ID
  var match = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  match = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  // Already a bare file ID
  if (/^[a-zA-Z0-9_-]+$/.test(raw)) return raw;

  return '';
}

function getLogoBlob_() {
  var fileId = extractFileId_(CONFIG.LOGO_FILE_ID);
  if (!fileId) return null;

  try {
    return DriveApp.getFileById(fileId).getBlob().setName('lumen-logo.jpg');
  } catch (err) {
    // Logo failure must never block emails
    return null;
  }
}

/* ========================= Shared helpers ========================= */

function row_(label, value) {
  return (
    '<tr>' +
      '<td style="padding:8px 12px 8px 0;border-bottom:1px solid #e6ebf2;color:#5c6678;width:120px;vertical-align:top;font-size:14px;">' +
        label +
      '</td>' +
      '<td style="padding:8px 0;border-bottom:1px solid #e6ebf2;color:#1c2b48;vertical-align:top;font-size:14px;">' +
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
 * Run this from Apps Script to test both emails.
 * Select testBooking_ → Run → authorize Gmail + Drive if prompted.
 */
function testBooking_() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        name: 'Test Client',
        email: CONFIG.BUSINESS_EMAIL,
        phone: '+27 65 582 8853',
        business: 'Sample Boutique Hotel',
        industry: 'Boutique Hotel',
        message: 'This is a test strategy call booking from Apps Script.'
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
