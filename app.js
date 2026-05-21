/* ═══════════════════════════════════════════════════════════
   Modbus RTU Inspector — app.js
   CRC-16/Modbus, frame building, scan simulation, decoder
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── CRC-16 Modbus ──────────────────────────────────────── */

function crc16(buf) {
  let crc = 0xFFFF;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xA001) : (crc >>> 1);
    }
  }
  return crc;
}

function buildModbusFrame(slave, fc, reg, val) {
  const body = [
    slave, fc,
    (reg >> 8) & 0xFF, reg & 0xFF,
    (val >> 8) & 0xFF, val & 0xFF,
  ];
  const c = crc16(body);
  return [...body, c & 0xFF, c >>> 8];
}

function fmtFrame(bytes) {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function parseHexAddr(str) {
  const clean = String(str).replace(/^0x/i, '').replace(/\s/g, '').trim();
  const n = parseInt(clean, 16);
  return isNaN(n) ? 0 : n;
}

function asInt16(v) { return v < 0x8000 ? v : v - 0x10000; }

/* ── Register name maps (per profile) ──────────────────────── */

const REGISTER_NAMES = {
  solax: {
    0x0000: 'grid_voltage',   0x0001: 'grid_current',  0x0002: 'grid_power',
    0x0003: 'pv1_voltage',    0x0004: 'pv2_voltage',   0x0005: 'pv1_current',
    0x0006: 'pv2_current',    0x0007: 'grid_frequency',0x0008: 'inv_temp',
    0x0009: 'run_mode',       0x000A: 'pv1_power',     0x000B: 'pv2_power',
    0x0014: 'bat_voltage',    0x0015: 'bat_current',   0x0016: 'bat_power',
    0x0018: 'bat_temp',       0x001A: 'grid_status',   0x001C: 'soc',
    0x0019: 'bdc_status',     0x0046: 'feedin_power',
  },
  huawei: {
    0x2003: 'grid_voltage_a', 0x2006: 'grid_current_a',0x200E: 'grid_power',
    0x2012: 'power_factor',   0x2013: 'grid_frequency',0x2015: 'inv_temp',
    0x2017: 'run_mode',       0x2027: 'pv1_voltage',   0x2028: 'pv1_current',
    0x202B: 'pv1_power',      0x2029: 'pv2_voltage',   0x202A: 'pv2_current',
    0x202D: 'pv2_power',      0x101C: 'bat_voltage',   0x101D: 'bat_current',
    0x101E: 'bat_power',      0x1020: 'bat_temp',      0x1025: 'soc',
    0x1000: 'bdc_status',
  },
  deye: {
    0x006D: 'grid_voltage_r', 0x0076: 'grid_current_r',0x0079: 'grid_power',
    0x007F: 'grid_frequency', 0x0082: 'power_factor',  0x0090: 'inv_temp',
    0x0096: 'run_mode',       0x00BA: 'pv1_voltage',   0x00BB: 'pv1_current',
    0x00BC: 'pv1_power',      0x00BD: 'pv2_voltage',   0x00BE: 'pv2_current',
    0x00BF: 'pv2_power',      0x00B8: 'bat_voltage',   0x00B9: 'bat_current',
    0x00B5: 'bat_temp',       0x00B6: 'soc',           0x00B3: 'bdc_status',
  },
  solis: {
    0x0033: 'pv1_voltage',    0x0034: 'pv1_current',   0x0035: 'pv1_power',
    0x0037: 'pv2_voltage',    0x0038: 'pv2_current',   0x0039: 'pv2_power',
    0x004A: 'inv_temp',       0x004D: 'grid_frequency',0x004E: 'grid_power',
    0x004C: 'power_factor',   0x0055: 'grid_voltage_a',0x0056: 'grid_current_a',
    0x00A0: 'bat_voltage',    0x00A1: 'bat_current',   0x00A2: 'bat_power',
    0x00A7: 'bat_temp',       0x00A9: 'soc',           0x009B: 'run_mode',
    0x00AB: 'bdc_status',
  },
  saj: {
    0x0100: 'run_mode',       0x0101: 'grid_voltage_a',0x0104: 'grid_current_a',
    0x0107: 'grid_power',     0x010B: 'power_factor',  0x010C: 'grid_frequency',
    0x0115: 'inv_temp',       0x0120: 'pv1_voltage',   0x0121: 'pv1_current',
    0x0122: 'pv1_power',      0x0124: 'pv2_voltage',   0x0125: 'pv2_current',
    0x0126: 'pv2_power',      0x0140: 'bat_voltage',   0x0141: 'bat_current',
    0x0142: 'bat_power',      0x0144: 'bat_temp',      0x0148: 'soc',
    0x0150: 'bdc_status',
  },
  fox: {
    0x0000: 'pv1_voltage',    0x0001: 'pv1_current',   0x0002: 'pv1_power',
    0x0003: 'pv2_voltage',    0x0004: 'pv2_current',   0x0005: 'pv2_power',
    0x0006: 'grid_voltage_r', 0x0009: 'grid_current_r',0x000C: 'grid_power',
    0x000E: 'grid_frequency', 0x000F: 'power_factor',  0x0010: 'inv_temp',
    0x0011: 'run_mode',       0x001A: 'bat_voltage',   0x001B: 'bat_current',
    0x001C: 'bat_power',      0x001D: 'bat_temp',      0x001E: 'soc',
    0x001F: 'bdc_status',
  },
  generic: {},
};

/* Demo words for the SolaX profile (used in scan simulation) */
const DEMO_WORDS = {
  0x0000: 2300, 0x0001:  150, 0x0002:  345, 0x0003: 3850,
  0x0004: 3720, 0x0005:   85, 0x0006:   60, 0x0007: 5001,
  0x0008:   42, 0x0009:    2, 0x000A: 3270, 0x000B: 2232,
  0x0014:  520, 0x0015:   80, 0x0016:  416, 0x0018:   28,
  0x001A:    0, 0x001C:   72, 0x0019:    1,
  0x0046: 0xFEE0, 0x0047: 0xFFFF,
};

/* ── State ──────────────────────────────────────────── */

let scanning   = false;
let scanTimer  = null;
let currentProfile = 'solax';
let scanResults = [];

/* ── Nav / Tab switching ─────────────────────────────── */

function switchNav(el, section) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');

  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));

  const panel = document.getElementById('panel-' + section);
  const tab   = document.getElementById('tab-' + section);
  if (panel) panel.classList.remove('hidden');
  if (tab)   { tab.classList.remove('hidden'); tab.classList.add('active'); }

  // Re-set active tab style (remove from others)
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (tab) tab.classList.add('active');
}

/* ── Scanner ─────────────────────────────────────────── */

function updateScanFrame() {
  const start = parseHexAddr(document.getElementById('reg-start').value);
  const end   = parseHexAddr(document.getElementById('reg-end').value);
  const count = Math.min(Math.max(1, end - start + 1), 125);
  const frame = buildModbusFrame(1, 4, start, count);
  document.getElementById('scan-frame-preview').textContent = fmtFrame(frame);
}

function setRange(s, e) {
  document.getElementById('reg-start').value = s;
  document.getElementById('reg-end').value   = e;
  updateScanFrame();
}

function onProfileChange(val) {
  currentProfile = val;
}

function startScan() {
  if (scanning) return;
  scanning    = true;
  scanResults = [];

  const start     = parseHexAddr(document.getElementById('reg-start').value);
  const end       = parseHexAddr(document.getElementById('reg-end').value);
  const chunkSize = Math.max(1, parseInt(document.getElementById('chunk-sz').value) || 20);

  if (end < start) {
    logLine('scan-log', 'End address must be >= start address', 'err');
    scanning = false;
    return;
  }

  const regs = [];
  for (let a = start; a <= end; a++) regs.push(a);
  const total = regs.length;

  document.getElementById('s-total').textContent   = total;
  document.getElementById('s-sent').textContent    = 0;
  document.getElementById('s-resp').textContent    = 0;
  document.getElementById('s-noresp').textContent  = 0;
  document.getElementById('scan-progress').style.width = '0%';
  document.getElementById('scan-table').innerHTML  =
    '<tr><td colspan="8" class="empty-row">Scanning…</td></tr>';
  document.getElementById('scan-log').innerHTML    = '';
  document.getElementById('scan-status').textContent = 'Scanning...';

  const nameMap = REGISTER_NAMES[currentProfile] || {};
  let ptr = 0, sent = 0, resp = 0, noresp = 0;
  const tbody = document.getElementById('scan-table');
  tbody.innerHTML = '';

  logLine('scan-log',
    `Scan 0x${start.toString(16).toUpperCase().padStart(4,'0')} -> ` +
    `0x${end.toString(16).toUpperCase().padStart(4,'0')} ` +
    `(${total} regs, chunk ${chunkSize})`, 'info');

  function step() {
    if (!scanning || ptr >= regs.length) {
      scanning = false;
      document.getElementById('scan-status').textContent = scanning ? '' : 'Complete';
      document.getElementById('scan-progress').style.width = '100%';
      logLine('scan-log', `Done — ${resp} responded, ${noresp} no response`, 'ok');
      return;
    }

    const batch = regs.slice(ptr, ptr + chunkSize);
    ptr  += chunkSize;
    sent += batch.length;
    document.getElementById('s-sent').textContent = sent;
    document.getElementById('scan-progress').style.width =
      Math.round(Math.min(ptr, regs.length) / regs.length * 100) + '%';

    batch.forEach(addr => {
      const w = DEMO_WORDS[addr];
      if (w !== undefined) {
        resp++;
        document.getElementById('s-resp').textContent = resp;

        const name   = nameMap[addr] || '';
        const scaled = name ? (w * 0.1).toFixed(1) : '';
        const row    = document.createElement('tr');
        row.innerHTML =
          `<td>0x${addr.toString(16).toUpperCase().padStart(4,'0')}</td>` +
          `<td>${w}</td>` +
          `<td>${asInt16(w)}</td>` +
          `<td>0x${w.toString(16).toUpperCase().padStart(4,'0')}</td>` +
          `<td>${(w * 0.1).toFixed(1)}</td>` +
          `<td>${(w * 0.01).toFixed(2)}</td>` +
          `<td class="${name ? 'name-cell' : ''}">${name}</td>` +
          `<td>${scaled}</td>`;
        tbody.appendChild(row);
        scanResults.push({ addr, w, name, scaled });
      } else {
        noresp++;
        document.getElementById('s-noresp').textContent = noresp;
      }
    });

    scanTimer = setTimeout(step, 200);
  }

  step();
}

function stopScan() {
  scanning = false;
  clearTimeout(scanTimer);
  document.getElementById('scan-status').textContent = 'Stopped';
  logLine('scan-log', 'Scan stopped by user', 'err');
}

function clearScan() {
  stopScan();
  scanResults = [];
  document.getElementById('scan-table').innerHTML =
    '<tr><td colspan="8" class="empty-row">Run a scan to see results</td></tr>';
  document.getElementById('scan-log').innerHTML = '';
  document.getElementById('scan-status').textContent = '';
  ['s-total','s-sent','s-resp','s-noresp'].forEach(id => {
    document.getElementById(id).textContent = '0';
  });
  document.getElementById('scan-progress').style.width = '0%';
}

function exportCSV() {
  if (!scanResults.length) {
    logLine('scan-log', 'No results to export — run a scan first', 'err');
    return;
  }
  const header = 'Address,uint16,int16,Hex,x0.1,x0.01,Name,Scaled\n';
  const rows   = scanResults.map(r =>
    `0x${r.addr.toString(16).toUpperCase().padStart(4,'0')},` +
    `${r.w},${asInt16(r.w)},` +
    `0x${r.w.toString(16).toUpperCase().padStart(4,'0')},` +
    `${(r.w * 0.1).toFixed(1)},${(r.w * 0.01).toFixed(2)},` +
    `${r.name},${r.scaled}`
  ).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'modbus_scan.csv';
  a.click();
  URL.revokeObjectURL(url);
  logLine('scan-log', 'Exported modbus_scan.csv', 'ok');
}

/* ── Frame Builder ─────────────────────────────────────── */

function buildFrame() {
  const fc    = parseInt(document.getElementById('fb-fc').value, 16) || 4;
  const reg   = parseHexAddr(document.getElementById('fb-reg').value);
  const val   = parseInt(document.getElementById('fb-val').value) || 1;
  const slave = parseInt(document.getElementById('fb-slave').value) || 1;
  const frame = buildModbusFrame(slave, fc, reg, val);
  document.getElementById('fb-preview').textContent = fmtFrame(frame);
}

/* ── Decoder ─────────────────────────────────────────── */

const EXAMPLES = {
  input:   '01 04 14 00 EB 00 00 00 00 00 00 60 93',
  holding: '01 03 0E 48 34 37 35 32 32 5A 48 45 4E 47 57 45 4E 63 26',
  write:   '01 06 00 1F 00 00 48 0A',
};

function loadExample(key) {
  document.getElementById('dec-input').value = EXAMPLES[key] || '';
}

function clearDecoder() {
  document.getElementById('dec-input').value = '';
  document.getElementById('dec-table').innerHTML =
    '<tr><td colspan="7" class="empty-row">Paste a response frame and click Decode</td></tr>';
  document.getElementById('dec-summary').classList.add('hidden');
  document.getElementById('dec-summary').innerHTML = '';
}

function decodeFrame() {
  const raw = document.getElementById('dec-input').value
    .replace(/[:\s-]/g, '').trim();

  if (!raw) return;

  let bytes;
  try {
    bytes = [];
    for (let i = 0; i < raw.length; i += 2) {
      const b = parseInt(raw.slice(i, i + 2), 16);
      if (isNaN(b)) throw new Error('Invalid hex at offset ' + i);
      bytes.push(b);
    }
  } catch (e) {
    alert('Invalid hex input: ' + e.message);
    return;
  }

  if (bytes.length < 4) { alert('Frame too short (need at least 4 bytes).'); return; }

  const slave = bytes[0];
  const fc    = bytes[1];

  // CRC check
  const calcCRC  = crc16(bytes.slice(0, -2));
  const recvCRC  = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
  const crcOk    = calcCRC === recvCRC;

  // Summary strip
  const summary = document.getElementById('dec-summary');
  summary.classList.remove('hidden');
  summary.innerHTML =
    `<div class="dec-cell"><span>Slave ID</span>0x${slave.toString(16).toUpperCase().padStart(2,'0')} (${slave})</div>` +
    `<div class="dec-cell"><span>FC</span>0x${fc.toString(16).toUpperCase().padStart(2,'0')}</div>` +
    `<div class="dec-cell"><span>Bytes</span>${bytes.length}</div>` +
    `<div class="dec-cell" style="color:${crcOk ? 'var(--accent)' : 'var(--danger)'}"><span>CRC</span>${crcOk ? 'Valid' : 'INVALID'}</div>`;

  const tbody   = document.getElementById('dec-table');
  const startR  = parseHexAddr(document.getElementById('dec-reg').value || '0');

  if (fc === 0x83 || fc === 0x84) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger)">Exception response — error code: 0x${bytes[2].toString(16).toUpperCase().padStart(2,'0')}</td></tr>`;
    return;
  }

  if (fc === 0x03 || fc === 0x04) {
    const byteCount = bytes[2];
    const payload   = bytes.slice(3, 3 + byteCount);
    const words     = [];
    for (let i = 0; i + 1 < payload.length; i += 2) {
      words.push((payload[i] << 8) | payload[i + 1]);
    }

    tbody.innerHTML = '';
    words.forEach((w, idx) => {
      const addr = startR + idx;
      const row  = document.createElement('tr');
      row.innerHTML =
        `<td>${idx}</td>` +
        `<td>0x${addr.toString(16).toUpperCase().padStart(4,'0')}</td>` +
        `<td>${w}</td>` +
        `<td>${asInt16(w)}</td>` +
        `<td>0x${w.toString(16).toUpperCase().padStart(4,'0')}</td>` +
        `<td>${(w * 0.1).toFixed(1)}</td>` +
        `<td>${(w * 0.01).toFixed(2)}</td>`;
      tbody.appendChild(row);
    });
    return;
  }

  if (fc === 0x06 && bytes.length >= 6) {
    const regA = (bytes[2] << 8) | bytes[3];
    const valW = (bytes[4] << 8) | bytes[5];
    tbody.innerHTML =
      `<tr>` +
      `<td colspan="2">Write ACK</td>` +
      `<td colspan="2">Reg: 0x${regA.toString(16).toUpperCase().padStart(4,'0')} (${regA})</td>` +
      `<td colspan="3">Value: 0x${valW.toString(16).toUpperCase().padStart(4,'0')} (${valW})</td>` +
      `</tr>`;
    return;
  }

  tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Unrecognised frame format</td></tr>';
}

/* ── Log helper ─────────────────────────────────────────── */

function logLine(boxId, msg, cls = '') {
  const box  = document.getElementById(boxId);
  const line = document.createElement('div');
  line.className = 'log-line ' + cls;
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  line.textContent = ts + '  ' + msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

/* ── Init ─────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  updateScanFrame();
  buildFrame();

  document.getElementById('reg-start').addEventListener('input', updateScanFrame);
  document.getElementById('reg-end').addEventListener('input', updateScanFrame);
  document.getElementById('fb-reg').addEventListener('input', buildFrame);
  document.getElementById('fb-val').addEventListener('input', buildFrame);
  document.getElementById('fb-fc').addEventListener('change', buildFrame);
  document.getElementById('fb-slave').addEventListener('input', buildFrame);
});
