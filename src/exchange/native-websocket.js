import { EventEmitter } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import { connect as tlsConnect } from 'node:tls';

function encodeFrame(opcode, payload = Buffer.alloc(0)) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const mask = randomBytes(4);
  let header;
  if (data.length < 126) header = Buffer.from([0x80 | opcode, 0x80 | data.length]);
  else if (data.length <= 0xffff) {
    header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0xfe; header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0xff; header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  const masked = Buffer.alloc(data.length);
  for (let index = 0; index < data.length; index += 1) masked[index] = data[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

export class NativeWebSocket extends EventEmitter {
  #socket;
  #buffer = Buffer.alloc(0);
  #fragmentOpcode = null;
  #fragments = [];
  #opened = false;

  connect(urlValue) {
    const url = new URL(urlValue);
    if (url.protocol !== 'wss:') throw new Error('Only wss:// WebSockets are allowed');
    const key = randomBytes(16).toString('base64');
    const path = `${url.pathname || '/'}${url.search}`;
    this.#socket = tlsConnect({ host: url.hostname, port: Number(url.port || 443), servername: url.hostname });
    let handshake = Buffer.alloc(0);
    const onHandshake = (chunk) => {
      handshake = Buffer.concat([handshake, chunk]);
      const end = handshake.indexOf('\r\n\r\n');
      if (end < 0) return;
      const head = handshake.subarray(0, end).toString('utf8');
      if (!head.startsWith('HTTP/1.1 101')) {
        this.emit('error', new Error(`WebSocket upgrade rejected: ${head.split('\r\n')[0]}`));
        this.close(); return;
      }
      const accept = head.match(/^Sec-WebSocket-Accept:\s*(.+)$/im)?.[1]?.trim();
      const expected = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
      if (accept !== expected) {
        this.emit('error', new Error('WebSocket upgrade returned an invalid accept key'));
        this.close(); return;
      }
      this.#socket.off('data', onHandshake);
      this.#socket.on('data', (data) => this.#consume(data));
      this.#opened = true;
      this.emit('open');
      const remainder = handshake.subarray(end + 4);
      if (remainder.length) this.#consume(remainder);
    };
    this.#socket.on('secureConnect', () => {
      this.#socket.write([
        `GET ${path} HTTP/1.1`, `Host: ${url.host}`, 'Upgrade: websocket', 'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', '\r\n'
      ].join('\r\n'));
    });
    this.#socket.on('data', onHandshake);
    this.#socket.on('error', (error) => this.emit('error', error));
    this.#socket.on('close', () => { this.#opened = false; this.emit('close'); });
    return this;
  }

  sendText(value) {
    if (!this.#opened) throw new Error('WebSocket is not open');
    this.#socket.write(encodeFrame(0x1, Buffer.from(value)));
  }

  close() {
    if (!this.#socket) return;
    if (this.#opened) this.#socket.write(encodeFrame(0x8));
    this.#socket.end();
  }

  #consume(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    while (this.#buffer.length >= 2) {
      const first = this.#buffer[0]; const second = this.#buffer[1];
      const final = Boolean(first & 0x80); const opcode = first & 0x0f; const masked = Boolean(second & 0x80);
      let length = second & 0x7f; let offset = 2;
      if (length === 126) { if (this.#buffer.length < 4) return; length = this.#buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) {
        if (this.#buffer.length < 10) return;
        const long = this.#buffer.readBigUInt64BE(2); if (long > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Frame too large');
        length = Number(long); offset = 10;
      }
      const maskLength = masked ? 4 : 0;
      if (this.#buffer.length < offset + maskLength + length) return;
      const mask = masked ? this.#buffer.subarray(offset, offset + 4) : null;
      const payload = Buffer.from(this.#buffer.subarray(offset + maskLength, offset + maskLength + length));
      this.#buffer = this.#buffer.subarray(offset + maskLength + length);
      if (masked) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
      this.#frame(opcode, final, payload);
    }
  }

  #frame(opcode, final, payload) {
    if (opcode === 0x8) { this.close(); return; }
    if (opcode === 0x9) { this.#socket.write(encodeFrame(0xA, payload)); return; }
    if (opcode === 0xA) return;
    if (opcode === 0x1 || opcode === 0x2) { this.#fragmentOpcode = opcode; this.#fragments = [payload]; }
    else if (opcode === 0x0 && this.#fragmentOpcode !== null) this.#fragments.push(payload);
    else return;
    if (final) {
      const complete = Buffer.concat(this.#fragments);
      const kind = this.#fragmentOpcode;
      this.#fragmentOpcode = null; this.#fragments = [];
      if (kind === 0x1) this.emit('message', complete.toString('utf8'));
    }
  }
}
